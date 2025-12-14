# Cascade Sub-Agents – Global Rules

- Truth-first, no hallucinations.
- Never hardcode secrets or API keys. Always read from environment variables.
- Use Groq Llama 3.3-70B (`llama-3.3-70b-versatile`) for all reasoning.
- Assume this repo is the source of truth for Voxanne (Next.js frontend, FastAPI voice, Deepgram/Groq).
- Prioritize:
  1. Voice agent stability (Deepgram + Groq).
  2. Clean prompts and pricing consistency.
  3. Fast, safe debugging with minimal file changes.
- Output short, command-ready suggestions (shell, git, code snippets) that are copy-pasteable.
