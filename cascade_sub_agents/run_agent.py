#!/usr/bin/env python3
import argparse
import asyncio
from textwrap import dedent

from agents_config import AGENTS
from base_agent import GroqAgent


def list_agents():
    lines = ["Available agents:"]
    for name, cfg in AGENTS.items():
        lines.append(f"  - {name}: {cfg.get('description', '').strip()}")
    return "\n".join(lines)


async def main():
    parser = argparse.ArgumentParser(
        description="Cascade sub-agent runner (Groq Llama 3.3-70B)."
    )
    parser.add_argument(
        "--agent",
        "-a",
        required=False,
        help="Agent name (e.g. voice_diag, frontend_support).",
    )
    parser.add_argument(
        "--task",
        "-t",
        required=False,
        help="Task / question for the agent. If omitted, reads from stdin.",
    )

    args = parser.parse_args()

    if not args.agent or args.agent not in AGENTS:
        print(list_agents())
        return

    task = args.task
    if not task:
        print("Enter task for agent, then Ctrl+D (Unix) / Ctrl+Z+Enter (Windows):")
        task = "".join(iter(input, ""))

    cfg = AGENTS[args.agent]
    system_prompt = cfg["system"]

    agent = GroqAgent(system_prompt=system_prompt)
    print(f"\n=== Running agent: {args.agent} ===\n")
    result = await agent.run(task)
    print(dedent(result).strip())
    print("\n=== End ===")


if __name__ == "__main__":
    asyncio.run(main())
