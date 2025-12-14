"""
Cascade Sub-Agents – Terminal-based Groq Llama 3.3-70B agents for Voxanne.

Agents:
  - voice_diag: Deepgram + Groq voice pipeline diagnostics
  - frontend_support: Next.js / React voice and chat widgets
  - backend_support: FastAPI + uvicorn orchestration
  - docs_prompt: Prompt and docs alignment

Usage:
  python3 -m cascade_sub_agents.run_agent --agent voice_diag --task "..."
"""

__version__ = "1.0.0"
