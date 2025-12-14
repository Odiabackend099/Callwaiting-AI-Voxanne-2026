# Cascade Sub-Agents – Voxanne Voice Agent Diagnostics & Control

Terminal-based AI agents powered by **Groq Llama 3.3-70B** for diagnosing, fixing, and optimizing the Voxanne voice agent (Deepgram + Groq + FastAPI + Next.js).

## Quick Start

### 1. Set your API keys (do NOT commit these)

```bash
export GROQ_API_KEY="<YOUR_GROQ_KEY>"
export DEEPGRAM_API_KEY="<YOUR_DEEPGRAM_KEY>"
```

### 2. Run the voice diagnostic workflow (one-shot)

```bash
cd "/Users/mac/Desktop/VOXANNE  WEBSITE"
python3 cascade_sub_agents/voice_diagnostic_workflow.py
```

This will:
- Verify API keys
- Update `.env.local` to use local backend
- Kill existing processes
- Start backend on 9121 + frontend on 9120
- Run the `voice_diag` agent to analyze the setup
- Provide next steps

### 3. Or run individual agents

```bash
# List all agents
python3 cascade_sub_agents/run_agent.py

# Run voice diagnostics
python3 cascade_sub_agents/run_agent.py --agent voice_diag --task "Why is the voice widget not transcribing?"

# Run frontend support
python3 cascade_sub_agents/run_agent.py --agent frontend_support --task "How do I add error messages to the voice widget?"

# Run backend support
python3 cascade_sub_agents/run_agent.py --agent backend_support --task "Add retry logic to Deepgram STT connection"

# Run docs/prompt alignment
python3 cascade_sub_agents/run_agent.py --agent docs_prompt --task "Are all system prompts using the new Voxanne Support persona?"
```

## Architecture

```
cascade_sub_agents/
├── cloud.md                          # Global rules for all agents
├── agents_config.py                  # Agent definitions & system prompts
├── base_agent.py                     # Groq Llama 3.3-70B harness
├── run_agent.py                      # CLI entrypoint for individual agents
├── voice_diagnostic_workflow.py      # One-shot diagnostic + startup script
├── __init__.py                       # Package marker
└── README.md                         # This file
```

## Agents

### `voice_diag` – Voice Pipeline Diagnostics
Specializes in Deepgram STT/TTS, Groq LLM, WebSocket flows, and FastAPI/uvicorn behavior.

**Use when:**
- Voice widget not transcribing
- No agent responses
- WebSocket connection issues
- Latency problems

### `frontend_support` – Next.js / React
Specializes in chat widget, voice widget, useVoiceAgent hook, recorder.ts, player.ts.

**Use when:**
- UI bugs or glitches
- Microphone permission issues
- Audio playback problems
- Chat API errors

### `backend_support` – FastAPI / Orchestration
Specializes in main.py, roxanne_v2.py, conversation_manager.py, logging, retries, health checks.

**Use when:**
- Backend crashes or errors
- Need to add logging
- Need to add retry logic
- Need to optimize latency

### `docs_prompt` – Prompt & Docs Alignment
Specializes in system prompts, pricing consistency, persona alignment.

**Use when:**
- Prompts are out of sync
- Pricing info is inconsistent
- Need to update all prompts at once

## Example: Diagnosing a Voice Issue

```bash
# 1. Set keys
export GROQ_API_KEY="gsk_..."
export DEEPGRAM_API_KEY="c0f60c39..."

# 2. Run the full workflow
python3 cascade_sub_agents/voice_diagnostic_workflow.py

# 3. If it suggests a fix, ask the backend_support agent
python3 cascade_sub_agents/run_agent.py --agent backend_support \
  --task "Add detailed logging to WebClientAgent._listen_deepgram() to debug why transcripts aren't being received"

# 4. Apply the suggested code changes
# 5. Restart backend and test
```

## Environment Variables

- `GROQ_API_KEY` – Required for all agents. Set before running.
- `DEEPGRAM_API_KEY` – Required for voice diagnostics. Set before running.

**Never hardcode these in code or scripts.**

## Logs & Debugging

### Backend logs
```bash
tail -f backend.log
```

### Frontend logs
```bash
# Open browser DevTools → Console
# Look for: 📨 WebSocket message, 🎤 Recording started, 🔊 Playing audio
```

### Agent output
Agents output concise, actionable suggestions. Copy-paste code snippets directly into your editor.

## Next Steps

1. **Get voice working locally:**
   ```bash
   python3 cascade_sub_agents/voice_diagnostic_workflow.py
   ```

2. **Deploy to Render:**
   - Set `GROQ_API_KEY` and `DEEPGRAM_API_KEY` in Render env vars
   - Redeploy `roxanne_v2` service
   - Update frontend `.env.local` to point to Render host

3. **Use ngrok for external testing:**
   ```bash
   ngrok http 9121
   # Then set NEXT_PUBLIC_VOICE_BACKEND_URL=<ngrok_url>
   ```

## Troubleshooting

**"GROQ_API_KEY is not set"**
```bash
export GROQ_API_KEY="<YOUR_KEY>"
```

**"Port 9121 already in use"**
```bash
lsof -ti :9121 | xargs kill -9
```

**"Frontend not connecting to backend"**
- Check `.env.local` has `NEXT_PUBLIC_VOICE_BACKEND_URL=localhost:9121`
- Restart `npm run dev`
- Check browser console for WebSocket URL

**"No transcripts in console"**
- Run `voice_diag` agent to diagnose
- Check backend logs for Deepgram errors
- Verify `DEEPGRAM_API_KEY` is valid

## Support

For detailed diagnostics, run:
```bash
python3 cascade_sub_agents/run_agent.py --agent voice_diag --task "Full diagnostic report"
```

For code changes, run:
```bash
python3 cascade_sub_agents/run_agent.py --agent backend_support --task "<your question>"
```
