#!/usr/bin/env python3
"""
Voice Diagnostic Workflow – One-shot script to diagnose and fix Voxanne voice agent.

This script:
1. Verifies API keys (Deepgram, Groq) via curl.
2. Updates .env.local to point frontend to local backend.
3. Kills existing backend/frontend processes.
4. Starts backend on 9121 and frontend on 9120.
5. Runs the voice_diag Cascade agent to analyze the setup.
6. Provides next steps for fixing any issues.

Usage:
  export GROQ_API_KEY="<YOUR_GROQ_KEY>"
  export DEEPGRAM_API_KEY="<YOUR_DEEPGRAM_KEY>"
  python3 cascade_sub_agents/voice_diagnostic_workflow.py
"""

import asyncio
import os
import subprocess
import sys
import time
from pathlib import Path

from base_agent import GroqAgent
from agents_config import AGENTS


def run_cmd(cmd: str, cwd: str = None, check: bool = False) -> tuple[int, str]:
    """Run a shell command and return (exit_code, output)."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return -1, "Command timed out"
    except Exception as e:
        return -1, str(e)


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


async def main():
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)

    print_section("VOXANNE VOICE DIAGNOSTIC WORKFLOW")

    # Step 1: Verify API keys
    print_section("Step 1/6: Verifying API Keys")

    groq_key = os.getenv("GROQ_API_KEY")
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")

    if not groq_key:
        print("❌ GROQ_API_KEY not set in environment")
        sys.exit(1)
    if not deepgram_key:
        print("❌ DEEPGRAM_API_KEY not set in environment")
        sys.exit(1)

    print(f"✅ GROQ_API_KEY: {groq_key[:20]}...")
    print(f"✅ DEEPGRAM_API_KEY: {deepgram_key[:20]}...")

    # Test Deepgram TTS
    print("\nTesting Deepgram TTS...")
    code, out = run_cmd(
        f'curl -s -o /dev/null -w "%{{http_code}}" '
        f'-X POST "https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3" '
        f'-H "Authorization: Token {deepgram_key}" '
        f'-H "Content-Type: application/json" '
        f'-d \'{{"text":"test"}}\''
    )
    if code == 0 and "200" in out:
        print("✅ Deepgram TTS key valid")
    else:
        print(f"❌ Deepgram TTS failed (HTTP {out})")
        sys.exit(1)

    # Test Groq
    print("\nTesting Groq LLM...")
    code, out = run_cmd(
        f'curl -s -X POST "https://api.groq.com/openai/v1/chat/completions" '
        f'-H "Authorization: Bearer {groq_key}" '
        f'-H "Content-Type: application/json" '
        f'-d \'{{"model":"llama-3.3-70b-versatile","messages":[{{"role":"user","content":"hi"}}],"max_tokens":5}}\''
    )
    if "choices" in out:
        print("✅ Groq API key valid")
    else:
        print(f"❌ Groq API failed")
        sys.exit(1)

    # Step 2: Update .env.local
    print_section("Step 2/6: Updating .env.local")

    env_local = project_root / ".env.local"
    if env_local.exists():
        content = env_local.read_text()
        if "NEXT_PUBLIC_VOICE_BACKEND_URL=localhost:9121" not in content:
            content = content.replace(
                "NEXT_PUBLIC_VOICE_BACKEND_URL=roxanneai.onrender.com",
                "NEXT_PUBLIC_VOICE_BACKEND_URL=localhost:9121",
            )
            env_local.write_text(content)
            print("✅ Updated .env.local to use localhost:9121")
        else:
            print("✅ .env.local already points to localhost:9121")
    else:
        print("⚠️  .env.local not found, skipping")

    # Step 3: Kill existing processes
    print_section("Step 3/6: Stopping Existing Processes")

    for port in [9121, 9120]:
        code, _ = run_cmd(f"lsof -ti :{port} | xargs kill -9 2>/dev/null")
        if code == 0:
            print(f"✅ Killed process on port {port}")
        else:
            print(f"ℹ️  No process on port {port}")

    time.sleep(1)

    # Step 4: Start backend
    print_section("Step 4/6: Starting Backend (port 9121)")

    backend_cmd = (
        f"GROQ_API_KEY={groq_key} DEEPGRAM_API_KEY={deepgram_key} "
        f"python3 -m uvicorn roxanne_v2:app --host 0.0.0.0 --port 9121 --reload"
    )
    print(f"Running: {backend_cmd[:80]}...")

    # Start backend in background
    backend_proc = subprocess.Popen(
        backend_cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    print(f"✅ Backend started (PID: {backend_proc.pid})")

    # Wait for backend to be ready
    print("Waiting for backend to start...")
    for i in range(10):
        code, _ = run_cmd("curl -s http://localhost:9121/health > /dev/null 2>&1")
        if code == 0:
            print("✅ Backend is ready")
            break
        time.sleep(1)
    else:
        print("❌ Backend failed to start")
        sys.exit(1)

    # Step 5: Start frontend
    print_section("Step 5/6: Starting Frontend (port 9120)")

    frontend_cmd = "npm run dev -- --port 9120"
    print(f"Running: {frontend_cmd}...")

    frontend_proc = subprocess.Popen(
        frontend_cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    print(f"✅ Frontend started (PID: {frontend_proc.pid})")
    time.sleep(5)

    # Step 6: Run voice_diag agent
    print_section("Step 6/6: Running Voice Diagnostic Agent")

    diagnostic_task = """
Analyze this Voxanne voice agent setup:
- Backend: uvicorn roxanne_v2:app on port 9121
- Frontend: Next.js on port 9120
- WebSocket: /ws/web-client for browser voice UI
- STT/TTS: Deepgram
- LLM: Groq Llama 3.3-70B

Provide:
1. A 3-step checklist to verify the setup is working.
2. Expected log signatures from backend when user speaks.
3. Expected console logs from frontend.
4. One minimal fix if transcripts/responses aren't flowing.
"""

    try:
        agent = GroqAgent(system_prompt=AGENTS["voice_diag"]["system"])
        result = await agent.run(diagnostic_task)
        print(result)
    except Exception as e:
        print(f"❌ Agent error: {e}")

    # Final summary
    print_section("SETUP COMPLETE")
    print(f"Backend:  http://localhost:9121/health")
    print(f"Frontend: http://localhost:9120")
    print(f"WebSocket: ws://localhost:9121/ws/web-client")
    print(f"\nBackend PID:  {backend_proc.pid}")
    print(f"Frontend PID: {frontend_proc.pid}")
    print(f"\nTo stop:")
    print(f"  kill {backend_proc.pid} {frontend_proc.pid}")
    print(f"\nNext: Open http://localhost:9120 and test the voice widget.")


if __name__ == "__main__":
    asyncio.run(main())
