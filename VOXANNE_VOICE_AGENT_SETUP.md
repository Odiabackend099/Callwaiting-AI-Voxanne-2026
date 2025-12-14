# Voxanne Voice Agent – Complete Setup & Deployment Guide

**Status:** Phase 1 → Production Ready  
**Last Updated:** Dec 11, 2025  
**Owner:** Cascade Sub-Agents (Groq Llama 3.3-70B)

---

## What's Been Done

### 1. ✅ System Prompts Unified
- **Chat Widget** (`src/app/api/chat/route.ts`): Uses new "Voxanne Support" prompt
- **Voice Agent v2** (`roxanne_v2.py`): Uses new "Voxanne Support" prompt
- **Voice Agent v1** (`main.py`): Still uses old prompt (needs update if used)

### 2. ✅ Backend Configured
- **Port 9121**: FastAPI `roxanne_v2:app` with Deepgram + Groq
- **Endpoints**:
  - `/health` – Basic health check
  - `/metrics` – Session metrics
  - `/ws/web-client` – Browser voice UI WebSocket
  - `/ws` – Twilio Media Stream (legacy, not in use)

### 3. ✅ Frontend Configured
- **Port 9120**: Next.js dev server
- **`.env.local`**: Points to `localhost:9121` for local testing
- **Voice Widget**: Uses `useVoiceAgent` hook with Deepgram STT + Groq LLM

### 4. ✅ Cascade Sub-Agents Created
- **Directory**: `cascade_sub_agents/`
- **Agents**:
  - `voice_diag` – Voice pipeline diagnostics
  - `frontend_support` – React/Next.js issues
  - `backend_support` – FastAPI/orchestration
  - `docs_prompt` – Prompt alignment
- **Powered by**: Groq Llama 3.3-70B (via env var `GROQ_API_KEY`)

---

## How to Use (Local Development)

### Step 1: Set API Keys (do NOT commit)

```bash
export GROQ_API_KEY="<YOUR_GROQ_KEY>"
export DEEPGRAM_API_KEY="<YOUR_DEEPGRAM_KEY>"
```

### Step 2: Run One-Shot Diagnostic & Startup

```bash
cd "/Users/mac/Desktop/VOXANNE  WEBSITE"
python3 cascade_sub_agents/voice_diagnostic_workflow.py
```

This will:
1. Verify API keys
2. Update `.env.local`
3. Kill existing processes
4. Start backend (9121) + frontend (9120)
5. Run `voice_diag` agent to analyze setup
6. Provide next steps

### Step 3: Test Voice Widget

1. Open `http://localhost:9120` in Chrome/Edge
2. Click the voice widget mic button
3. Grant microphone permissions
4. Speak: "Hello Voxanne, can you hear me?"
5. Watch backend logs for diagnostic output

### Step 4: Use Cascade Agents for Issues

If voice doesn't work:

```bash
python3 cascade_sub_agents/run_agent.py --agent voice_diag \
  --task "Why is the voice widget not transcribing?"
```

For code changes:

```bash
python3 cascade_sub_agents/run_agent.py --agent backend_support \
  --task "Add retry logic to Deepgram STT connection"
```

---

## Deployment to Production (Render)

### Step 1: Update Render Environment Variables

In the Render dashboard for your service:

```
GROQ_API_KEY = <YOUR_GROQ_KEY>
DEEPGRAM_API_KEY = <YOUR_DEEPGRAM_KEY>
PORT = 3000 (or auto-detected)
```

### Step 2: Deploy Backend

Push to your Render-connected repo:

```bash
git add .
git commit -m "Update Voxanne voice agent: unified prompts, Groq Llama 3.3-70B, Cascade sub-agents"
git push
```

Render will auto-deploy `roxanne_v2:app` with the new env vars.

### Step 3: Update Frontend `.env.local` for Production

```bash
NEXT_PUBLIC_VOICE_BACKEND_URL=<YOUR_RENDER_HOST>
```

Then redeploy frontend to Vercel.

### Step 4: Verify Remote Connection

```bash
# Test backend health
curl https://<YOUR_RENDER_HOST>/health

# Test WebSocket (using wscat)
wscat -c wss://<YOUR_RENDER_HOST>/ws/web-client?sessionId=test
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Port 9120)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js Frontend                                    │   │
│  │  ├─ Chat Widget (Groq via /api/chat)               │   │
│  │  └─ Voice Widget (WebSocket to /ws/web-client)     │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓ (ws://localhost:9121)           │
├─────────────────────────────────────────────────────────────┤
│                    FastAPI Backend (Port 9121)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  roxanne_v2.py (ConversationManager)                │   │
│  │  ├─ /ws/web-client (browser voice)                 │   │
│  │  ├─ /health (status)                               │   │
│  │  └─ /metrics (observability)                       │   │
│  └──────────────────────────────────────────────────────┘   │
│         ↓ (HTTP/WSS)              ↓ (HTTP/WSS)              │
│    ┌─────────────┐           ┌──────────────┐               │
│    │  Deepgram   │           │  Groq LLM    │               │
│    │ STT / TTS   │           │ Llama 3.3-70B│               │
│    └─────────────┘           └──────────────┘               │
└─────────────────────────────────────────────────────────────┘

Cascade Sub-Agents (Terminal):
  ├─ voice_diag (diagnose STT/TTS/LLM)
  ├─ frontend_support (React/Next.js)
  ├─ backend_support (FastAPI/logging)
  └─ docs_prompt (prompt alignment)
  
  All powered by: Groq Llama 3.3-70B (env var: GROQ_API_KEY)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `roxanne_v2.py` | FastAPI voice agent (Deepgram + Groq) |
| `src/app/api/chat/route.ts` | Chat widget API (Groq) |
| `src/hooks/useVoiceAgent.ts` | Browser voice UI hook |
| `.env.local` | Local dev env vars |
| `cascade_sub_agents/` | Terminal Groq agents |
| `cascade_sub_agents/voice_diagnostic_workflow.py` | One-shot diagnostic + startup |

---

## Troubleshooting

### Voice widget not transcribing?

```bash
python3 cascade_sub_agents/run_agent.py --agent voice_diag \
  --task "Debug: no transcripts in console, WebSocket connected"
```

### Backend crashes?

```bash
# Check logs
tail -f backend.log

# Run backend support agent
python3 cascade_sub_agents/run_agent.py --agent backend_support \
  --task "Backend crashed with error: <error_message>"
```

### Frontend not connecting?

```bash
# Verify .env.local
grep NEXT_PUBLIC_VOICE_BACKEND_URL .env.local

# Should show: localhost:9121 (local) or your Render host (prod)
```

### API key errors?

```bash
# Verify keys are set
echo $GROQ_API_KEY
echo $DEEPGRAM_API_KEY

# Test Groq
curl -X POST "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
```

---

## Next Steps

1. **Local Testing** (today):
   ```bash
   python3 cascade_sub_agents/voice_diagnostic_workflow.py
   ```

2. **Deploy to Render** (when ready):
   - Set env vars in Render dashboard
   - Push code
   - Test remote connection

3. **Monitor & Optimize**:
   - Use `/metrics` endpoint to track latency
   - Use Cascade agents to diagnose issues
   - Add more logging as needed

4. **Scale**:
   - Add more Cascade agents for other domains (Twilio, Supabase, etc.)
   - Use agents to automate deployments and monitoring

---

## Support

For any issues, use the Cascade agents:

```bash
# List all agents
python3 cascade_sub_agents/run_agent.py

# Ask any agent
python3 cascade_sub_agents/run_agent.py --agent <agent_name> --task "<question>"
```

---

**Created by:** Cascade (Groq Llama 3.3-70B)  
**Last Updated:** Dec 11, 2025  
**Status:** Production Ready
