# Voxanne Aura Humanizer - Twilio Integration Guide
## Production Deployment for CallWaiting AI

---

## 🎯 Overview

This guide integrates the **VoxanneAuraHumanizer** with your existing Twilio Media Stream orchestration layer (`voxanne_orchestration.py`). The goal: replace robotic responses with human-like conversational quality using Deepgram Aura-2 optimization.

---

## 📋 Prerequisites

### 1. Install Dependencies
```bash
pip install websockets deepgram-sdk groq aiohttp python-dotenv colorama
```

### 2. Environment Variables
```bash
# .env file
DEEPGRAM_API_KEY=your_deepgram_key
GROQ_API_KEY=your_groq_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### 3. File Structure
```
callwaiting-ai/
├── voxanne_orchestration.py       # Your existing orchestration
├── voxanne_aura_humanizer.py      # NEW: Humanizer class
├── test_voxanne_naturalness.py    # NEW: Testing suite
├── server.py                       # FastAPI server (updated)
├── .env                            # API keys
└── README.md
```

---

## 🔧 Integration Steps

### Step 1: Update Your Orchestration Layer

**File: `voxanne_orchestration.py`**

Replace the `_llm_processor` method with humanized response generation:

```python
# ADD THIS IMPORT AT TOP
from voxanne_aura_humanizer import VoxanneAuraHumanizer

class TwilioMediaHandler:
    """Orchestration layer with Aura humanization"""
    
    def __init__(self, deepgram_api_key: str, groq_api_key: str):
        self.dg_client = DeepgramClient(api_key=deepgram_api_key)
        self.groq_client = Groq(api_key=groq_api_key)
        self.logger = logging.getLogger(__name__)
        self.active_calls: dict[str, ConversationContext] = {}
        
        # NEW: Initialize humanizer
        self.humanizer = VoxanneAuraHumanizer(
            deepgram_key=deepgram_api_key,
            groq_key=groq_api_key
        )
    
    async def _llm_processor(self, ctx: ConversationContext):
        """
        TASK 3: Language Model Processing (HUMANIZED VERSION)
        
        Changes:
        - Uses humanizer.generate_response() instead of raw Groq
        - Automatic text formatting for Aura-2 prosody
        - Patient name extraction for personalized responses
        """
        while ctx.state != ConversationState.IDLE:
            try:
                if ctx.state != ConversationState.PROCESSING or not ctx.user_transcript.strip():
                    await asyncio.sleep(0.05)
                    continue
                
                self.logger.info(f"🧠 LLM processing: {ctx.user_transcript[:50]}...")
                
                # Extract patient name if mentioned
                patient_name = self._extract_patient_name(ctx.user_transcript)
                
                # NEW: Use humanizer instead of raw Groq
                llm_start = time.perf_counter()
                
                # Generate humanized response
                humanized_response = await self.humanizer.generate_response(
                    user_input=ctx.user_transcript.strip(),
                    patient_name=patient_name,
                    conversation_history=self._build_conversation_history(ctx)
                )
                
                llm_latency = (time.perf_counter() - llm_start) * 1000
                self.logger.info(f"⚡ LLM TTFT: {llm_latency:.0f}ms")
                
                if not ctx.barge_in_detected:
                    # Split into sentences for streaming
                    sentences = self.humanizer._split_into_sentences(humanized_response)
                    
                    for sentence in sentences:
                        if ctx.barge_in_detected:
                            self.logger.warn("⚠️ Interrupt detected, flushing")
                            break
                        
                        # Queue each sentence for TTS
                        await ctx.tts_queue.put(sentence.strip())
                    
                    ctx.llm_response = humanized_response
                    ctx.state = ConversationState.SPEAKING
                    await ctx.tts_queue.put("[[FLUSH]]")
                
                ctx.user_transcript = ""
                ctx.interim_transcript = ""
            
            except Exception as e:
                self.logger.error(f"LLM error: {e}")
                await asyncio.sleep(0.1)
    
    def _extract_patient_name(self, transcript: str) -> Optional[str]:
        """Extract patient name from transcript for personalization"""
        # Simple pattern matching (can be enhanced with NER)
        import re
        
        patterns = [
            r"(?:my name is|I'm|I am|this is)\s+([A-Z][a-z]+)",
            r"^([A-Z][a-z]+)\s+(?:here|calling)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, transcript)
            if match:
                return match.group(1)
        
        return None
    
    def _build_conversation_history(self, ctx: ConversationContext) -> list:
        """Build conversation history for context-aware responses"""
        # Simple implementation - store last 3 exchanges
        # In production, store in ctx.conversation_history
        return []  # Extend as needed
```

---

### Step 2: Update TTS Sender for Humanized Audio

**File: `voxanne_orchestration.py`** (continued)

Replace the `_tts_sender` to use the humanizer's sentence streaming:

```python
async def _tts_sender(self, ctx: ConversationContext, twilio_ws: ServerConnection):
    """
    TASK 4: Text-to-Speech Synthesis & Playback (HUMANIZED)
    
    Changes:
    - Uses humanizer.speak_sentence() for optimized Aura-2 prosody
    - Sentence-level streaming maintains natural pacing
    """
    try:
        while ctx.state != ConversationState.IDLE:
            try:
                # Get next sentence from queue
                sentence = await asyncio.wait_for(
                    ctx.tts_queue.get(), 
                    timeout=0.2
                )
            except asyncio.TimeoutError:
                continue
            
            if sentence == "[[FLUSH]]":
                # End of response
                self.logger.info("✅ TTS playback finished")
                ctx.state = ConversationState.LISTENING
                continue
            
            if not sentence or not sentence.strip():
                continue
            
            self.logger.info(f"🔊 TTS sentence: {sentence[:40]}...")
            
            tts_start = time.perf_counter()
            first_byte = True
            
            # Stream Aura-2 audio using humanizer
            async for audio_chunk in self.humanizer.speak_sentence(sentence):
                if ctx.barge_in_detected:
                    self.logger.warn("🛑 Barge-in during TTS, stopping")
                    break
                
                if first_byte:
                    tts_latency = (time.perf_counter() - tts_start) * 1000
                    self.logger.info(f"📊 TTS TTFB: {tts_latency:.0f}ms")
                    first_byte = False
                    ctx.speaking_started_at = time.perf_counter()
                    ctx.state = ConversationState.SPEAKING
                
                # Forward to Twilio
                await twilio_ws.send(json.dumps({
                    "event": "media",
                    "streamSid": ctx.stream_sid,
                    "media": {
                        "payload": audio_chunk.hex()
                    }
                }))
            
            # Natural breath between sentences (100ms)
            await asyncio.sleep(0.1)
    
    except Exception as e:
        self.logger.error(f"TTS sender error: {e}")
```

---

### Step 3: Update FastAPI Server

**File: `server.py`**

```python
import asyncio
import logging
from fastapi import FastAPI, WebSocket
from fastapi.responses import Response
from voxanne_orchestration import TwilioMediaHandler
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="CallWaiting AI - Voxanne Voice Agent")

# Initialize handler (singleton)
handler = TwilioMediaHandler(
    deepgram_api_key=os.getenv("DEEPGRAM_API_KEY"),
    groq_api_key=os.getenv("GROQ_API_KEY")
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "CallWaiting AI - Voxanne",
        "status": "operational",
        "version": "3.0-aura-humanized"
    }

@app.post("/twiml")
async def twiml_endpoint():
    """
    Twilio webhook endpoint
    Returns TwiML with Media Stream connection
    """
    twiml = """<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="Polly.Joanna">
            Connecting you to Voxanne, your AI assistant.
        </Say>
        <Connect>
            <Stream url="wss://your-domain.com/ws/media-stream" />
        </Connect>
    </Response>"""
    
    return Response(content=twiml, media_type="application/xml")

@app.websocket("/ws/media-stream")
async def websocket_endpoint(websocket: WebSocket):
    """
    Twilio Media Stream WebSocket endpoint
    Handles real-time audio bidirectional streaming
    """
    await websocket.accept()
    logger.info("📞 New WebSocket connection established")
    
    try:
        await handler.handle_twilio_stream(websocket)
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
    finally:
        logger.info("📴 WebSocket connection closed")

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting Voxanne Voice Agent Server...")
    print("   - Aura-2 Humanization: ENABLED")
    print("   - Sub-500ms Latency: ACTIVE")
    print("   - Barge-In Detection: ACTIVE")
    print("   - Endpoint: ws://localhost:8000/ws/media-stream")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
```

---

## 🧪 Testing Your Integration

### Test 1: Local Testing (No Twilio)

```bash
# Test humanization only
python test_voxanne_naturalness.py
```

**Expected Output:**
```
🧪 VOXANNE NATURALNESS TESTING SUITE
════════════════════════════════════════════════════════════════════════════════

Test 1/6: BBL Inquiry
────────────────────────────────────────────────────────────────────────────────

👤 Patient (Sarah): Do you do BBL?

🤖 Voxanne: Absolutely, Sarah! We specialize in Brazilian Butt Lift. Cost runs eight thousand to twelve thousand dollars. Recovery is about two weeks. Want me to check Tuesday availability?

📊 Validation Results:
  ✓ PASS | Short Sentences: All sentences under 12 words ✓
  ✓ PASS | Numbers as Words: All numbers formatted as words ✓
  ✓ PASS | Contractions: Uses natural contractions ✓
  ✓ PASS | Punctuation Spacing: Punctuation spacing correct ✓
  ✓ PASS | Response Length: Optimal length: 4 sentences ✓
  ✓ PASS | Direct Address: Direct address formatted correctly ✓
  ✓ PASS | Filler Frequency: Appropriate filler usage: 0 fillers ✓
```

---

### Test 2: Server Startup Test

```bash
# Start the server
python server.py
```

**Expected Output:**
```
🚀 Starting Voxanne Voice Agent Server...
   - Aura-2 Humanization: ENABLED
   - Sub-500ms Latency: ACTIVE
   - Barge-In Detection: ACTIVE
   - Endpoint: ws://localhost:8000/ws/media-stream

INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

### Test 3: Twilio Configuration

**Step 1: Expose Local Server (for testing)**
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from ngrok.com

# Expose port 8000
ngrok http 8000
```

**Step 2: Configure Twilio**

1. Go to Twilio Console → Phone Numbers
2. Select your number
3. Under "Voice Configuration":
   - Set "A CALL COMES IN" to "Webhook"
   - Enter: `https://your-ngrok-url.ngrok.io/twiml`
   - Set method to "HTTP POST"
4. Click "Save"

**Step 3: Make Test Call**
```bash
# Call your Twilio number
# Expected: Hear Voxanne's humanized voice
```

---

### Test 4: Monitor Logs

```bash
# In terminal running server.py
tail -f logs/voxanne.log

# Expected output during call:
📞 Call started: CA1234567890abcdef
⚡ STT TTFT: 287ms
👂 Final: "Do you do BBL?"
🧠 LLM processing: Do you do BBL?...
⚡ LLM TTFT: 142ms
🗣️ Voxanne: Absolutely! We specialize in Brazilian Butt Lift.
📊 TTS TTFB: 198ms
✅ TTS playback finished
```

---

## 🎯 Performance Benchmarks

### Target Metrics (Sub-500ms Total)

| Metric | Target | Your System | Status |
|--------|--------|-------------|--------|
| STT TTFT | < 300ms | ___ ms | ⏳ |
| LLM TTFT | < 150ms | ___ ms | ⏳ |
| TTS TTFB | < 200ms | ___ ms | ⏳ |
| **Total Latency (P95)** | **< 500ms** | **___ ms** | **⏳** |

### How to Measure

Add this to your orchestration layer:

```python
@dataclass
class LatencyMetrics:
    stt_ttft: float = 0.0
    llm_ttft: float = 0.0
    tts_ttfb: float = 0.0
    total_rtt: float = 0.0

# In your handler
async def log_metrics(self, ctx: ConversationContext):
    """Log performance metrics after each turn"""
    metrics = ctx.metrics  # Assuming you store metrics in context
    
    self.logger.info(f"""
    📊 Performance Metrics:
       - STT TTFT: {metrics.stt_ttft:.0f}ms
       - LLM TTFT: {metrics.llm_ttft:.0f}ms
       - TTS TTFB: {metrics.tts_ttfb:.0f}ms
       - Total RTT: {metrics.total_rtt:.0f}ms
    """)
    
    # Alert if over budget
    if metrics.total_rtt > 500:
        self.logger.warning("⚠️ LATENCY BUDGET EXCEEDED!")
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Audio sounds choppy"

**Cause:** Network latency or insufficient buffering

**Solution:**
```python
# In _tts_sender, add buffering
audio_buffer = []
buffer_size = 5  # Buffer 5 chunks before playing

async for audio_chunk in self.humanizer.speak_sentence(sentence):
    audio_buffer.append(audio_chunk)
    
    if len(audio_buffer) >= buffer_size:
        for chunk in audio_buffer:
            await twilio_ws.send(...)
        audio_buffer = []
```

---

### Issue 2: "Barge-in not working"

**Cause:** Interrupt detection not fast enough

**Solution:**
```python
# In _audio_receiver, reduce sleep time
async def _audio_receiver(self, websocket, ctx):
    async for message in websocket:
        if ctx.state == ConversationState.SPEAKING:
            # IMMEDIATE interrupt (no sleep)
            ctx.barge_in_detected = True
            # Cancel TTS task
            if self.current_tts_task:
                self.current_tts_task.cancel()
```

---

### Issue 3: "Responses still sound robotic"

**Cause:** LLM not following Aura-2 formatting rules

**Solution:**
```python
# Check humanizer output
response = await humanizer.generate_response(user_input)
print(f"Raw LLM: {response}")
print(f"Humanized: {humanizer.humanize_text(response)}")

# If humanization is correct but speech is robotic,
# try different Aura-2 voice model:
AURA_MODEL = "aura-asteria-en"  # Try: asteria, arcas, luna, stella
```

---

## 📊 Production Checklist

Before deploying to production:

- [ ] All naturalness tests pass (90%+ pass rate)
- [ ] Latency under 500ms (P95)
- [ ] Barge-in responds within 100ms
- [ ] Error handling for API failures
- [ ] Logging enabled for debugging
- [ ] Metrics tracking (Datadog, CloudWatch, etc.)
- [ ] Load testing completed (50+ concurrent calls)
- [ ] Twilio webhook configured correctly
- [ ] Environment variables secured (not in code)
- [ ] Backup/fallback responses for API downtime

---

## 🔐 Security Considerations

### 1. Environment Variables
```bash
# Never commit .env file
echo ".env" >> .gitignore

# Use secrets management in production
# AWS: AWS Secrets Manager
# GCP: Secret Manager
# Azure: Key Vault
```

### 2. Rate Limiting
```python
# Add to FastAPI
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.websocket("/ws/media-stream")
@limiter.limit("10/minute")  # Max 10 calls per minute per IP
async def websocket_endpoint(websocket: WebSocket):
    ...
```

### 3. Input Validation
```python
# Sanitize user input before LLM
def sanitize_input(text: str) -> str:
    """Remove potential prompt injection attempts"""
    # Remove system-like instructions
    text = re.sub(r'(?i)(ignore|forget|disregard)\s+(previous|all|above)', '', text)
    return text.strip()
```

---

## 📈 Monitoring & Analytics

### Recommended Metrics to Track

1. **Conversational Quality**
   - Average response length (sentences)
   - Filler word frequency
   - Contraction usage rate
   - Number formatting accuracy

2. **Performance**
   - P50, P95, P99 latency
   - Time to First Byte (TTFB)
   - Time to First Token (TTFT)
   - Total Round-Trip Time (RTT)

3. **Reliability**
   - API error rate (Deepgram, Groq)
   - WebSocket connection drops
   - Successful call completion rate
   - Barge-in detection accuracy

### Example Dashboard (Grafana)
```python
# Export metrics to Prometheus
from prometheus_client import Counter, Histogram

calls_total = Counter('voxanne_calls_total', 'Total calls handled')
latency_histogram = Histogram('voxanne_latency_seconds', 'Call latency')

# In your handler
calls_total.inc()
with latency_histogram.time():
    await handler.handle_twilio_stream(websocket)
```

---

## 🚀 Deployment Options

### Option 1: Docker Container
```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "server.py"]
```

```bash
# Build and run
docker build -t voxanne-voice-agent .
docker run -p 8000:8000 --env-file .env voxanne-voice-agent
```

---

### Option 2: AWS ECS/Fargate
```yaml
# task-definition.json
{
  "family": "voxanne-voice-agent",
  "containerDefinitions": [{
    "name": "voxanne",
    "image": "your-ecr-repo/voxanne:latest",
    "portMappings": [{"containerPort": 8000}],
    "environment": [
      {"name": "DEEPGRAM_API_KEY", "value": "{{resolve:secretsmanager:deepgram-key}}"},
      {"name": "GROQ_API_KEY", "value": "{{resolve:secretsmanager:groq-key}}"}
    ]
  }]
}
```

---

### Option 3: Kubernetes
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voxanne-voice-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: voxanne
  template:
    metadata:
      labels:
        app: voxanne
    spec:
      containers:
      - name: voxanne
        image: your-registry/voxanne:latest
        ports:
        - containerPort: 8000
        env:
        - name: DEEPGRAM_API_KEY
          valueFrom:
            secretKeyRef:
              name: voxanne-secrets
              key: deepgram-key
```

---

## 📞 Support & Troubleshooting

### Debug Mode
```python
# Enable verbose logging
logging.basicConfig(level=logging.DEBUG)

# In humanizer
self.debug_mode = True  # Print all transformations
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ConnectionRefusedError` | WebSocket not accepting | Check server is running on correct port |
| `HTTPStatusError: 401` | Invalid API key | Verify DEEPGRAM_API_KEY in .env |
| `TimeoutError` | LLM taking too long | Reduce max_tokens, check Groq API status |
| `Audio playback stuttering` | Network latency | Increase buffer size, check bandwidth |

---

## ✅ Success Criteria

Your integration is successful when:

1. ✅ Naturalness tests pass at 90%+
2. ✅ Latency stays under 500ms (P95)
3. ✅ Patients say "she sounds real"
4. ✅ Barge-in works smoothly
5. ✅ No audio dropouts or stuttering
6. ✅ System handles 50+ concurrent calls

---

## 🎉 Next Steps

1. **Week 1:** Deploy to staging, run load tests
2. **Week 2:** A/B test with 10% of traffic
3. **Week 3:** Roll out to 100% if metrics look good
4. **Ongoing:** Monitor metrics, iterate on prompt

---

**Questions?** Check the test output or review the humanizer class comments.

**Ready to deploy?** Run the test suite first:
```bash
python test_voxanne_naturalness.py
```

🚀 **Good luck with your deployment!**