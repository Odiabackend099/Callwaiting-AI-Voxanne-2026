#!/usr/bin/env python3
"""
Roxanne Text Chat - Fast Testing Without Audio Latency
Type to chat with Roxanne, responses are instant
"""

import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

def get_roxanne_prompt():
    now = datetime.now()
    current_date = now.strftime("%A, %B %d, %Y")
    current_time = now.strftime("%I:%M %p")
    
    return f"""You are **Roxanne**, the world-class AI Sales Agent for CallWaiting AI.

## DYNAMIC CONTEXT
Today is: {current_date}
Current time: {current_time}

## YOUR PERSONA
- Voice: Warm British-Nigerian professional (mid-30s energy)
- Style: Consultative, curious, empathetic, goal-oriented

## CRITICAL RULES
1. Keep responses BRIEF (1-3 sentences max)
2. Be conversational, NOT scripted
3. Use natural fillers: "Got it...", "Hmm...", "Right..."
4. Always steer toward booking demos

## COMPANY
- CallWaiting AI builds AI Voice Receptionists for medical practices
- Pricing: Essentials $169/mo, Growth $289/mo, Premium $499/mo
- No per-minute fees

## YOUR MISSION
1. Qualify leads (BANT)
2. Handle objections with empathy
3. Book demos

Remember: Brief responses. Be warm. Close deals."""


def main():
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        print("❌ Set GROQ_API_KEY in .env")
        sys.exit(1)
    
    client = Groq(api_key=groq_key)
    messages = [{"role": "system", "content": get_roxanne_prompt()}]
    
    print("\n" + "="*60)
    print("🎤 ROXANNE TEXT CHAT - Fast Testing Mode")
    print("="*60)
    print("Type your message and press Enter. Type 'quit' to exit.\n")
    
    # Initial greeting
    greeting = "Hi! This is Roxanne from CallWaiting A.I. How can I help you today?"
    print(f"👩🏼‍⚕️ Roxanne: {greeting}\n")
    messages.append({"role": "assistant", "content": greeting})
    
    while True:
        try:
            user_input = input("👤 You: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["quit", "exit", "bye"]:
                print("👩🏼‍⚕️ Roxanne: Thank you for calling! Have a wonderful day. 👋")
                break
            
            messages.append({"role": "user", "content": user_input})
            
            # Stream response
            print("👩🏼‍⚕️ Roxanne: ", end="", flush=True)
            start = time.time()
            
            stream = client.chat.completions.create(
                model="llama-3.1-8b-instant",  # Fast model
                messages=messages,
                max_tokens=100,
                temperature=0.7,
                stream=True
            )
            
            response = ""
            first = True
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    if first:
                        ttfb = (time.time() - start) * 1000
                        print(f"[{ttfb:.0f}ms] ", end="", flush=True)
                        first = False
                    print(delta, end="", flush=True)
                    response += delta
            
            print("\n")
            messages.append({"role": "assistant", "content": response})
            
            # Keep history short
            if len(messages) > 12:
                messages = [messages[0]] + messages[-10:]
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main()
