import os
import asyncio
from typing import List, Dict

from groq import AsyncGroq  # already in requirements.txt


class GroqAgent:
    def __init__(self, system_prompt: str, model: str = "llama-3.3-70b-versatile"):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set in environment.")
        self.client = AsyncGroq(api_key=api_key)
        self.system_prompt = system_prompt.strip()
        self.model = model

    async def run(self, user_message: str, extra_messages: List[Dict] = None) -> str:
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_message},
        ]
        if extra_messages:
            messages.extend(extra_messages)

        resp = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
            max_tokens=800,
        )
        choice = resp.choices[0]
        return choice.message.content or ""
