---
description: Master Orchestrator
---

To move this into the production-ready phase with your AI developer, we need to implement the specific **Modular Agency** logic found in the Filippo TikTok reference. The core of that system is that the AI doesn't just "talk"; it manages state across different "Workers."

Here is the **Master Implementation & Validation Prompt** to give to your AI developer system (e.g., Cursor, Claude, or a custom GPT) to build and test the core functionalities.

---

### **The "Master Orchestrator" Build & Test Prompt**

> **Role:** You are a Lead AI Solutions Architect. Your task is to implement and validate a "Modular Agency" system for **CallWaiting AI**.
> **System Architecture:**
>
> 1. **Manager (Supabase Edge Functions):** Coordinates state, logic, and external API calls.
> 2. **Voice Interface (Vapi + Twilio):** Handles the real-time audio stream.
> 3. **The Brain (LLM + Vector DB):** Provides "Surgical-Grade" medical knowledge.
>
>
> **Task 1: Implement the "Atomic Lock" Middleware**
>
> * **Code Requirement:** Write a Supabase RPC function `claim_slot_atomic` that uses `Pessimistic Locking` (`SELECT FOR UPDATE`).
> * **Logic:** When a call triggers a booking intent, the slot must be locked for 90 seconds. If the call drops, the lock must auto-release. If the booking is confirmed, update the status to `booked`.
>
>
> **Task 2: Build the "Context-Aware" Hand-off**
>
> * **Code Requirement:** Implement a state-management hook that passes "Memory" between the Inbound Agent (Voxanne) and the Follow-up Agent (Sarah).
> * **Test Scenario:** If a patient mentions a "Facelift" but doesn't book, Sarah must receive a webhook to send an SMS with a specific "Facelift Aftercare" PDF link within 5 minutes.
>
>
> **Task 3: Regulatory & Security Stress Test**
>
> * **Verification:** Audit the data flow. Ensure that no PII (Patient Identifiable Information) is sent to the LLM's training logs.
> * **Requirement:** Implement an **intercept layer** that redacts specific keywords related to medical history before the transcript is saved to the public `logs` table.
>
>
> **Task 4: Latency Optimization (The "Premium Clinic" Feel)**
>
> * **Audit:** Measure the delay between the "User End" and the "AI Start."
> * **Optimization:** If latency is >700ms, implement **Stream-based responses** and switch the STT (Speech-to-Text) provider to Deepgram Nova-2 to ensure the conversation feels human.
>
>
> **Output:** Provide the **Full-Stack JSON Config** for the Vapi Assistant and the **SQL Schema** for the Supabase tables including Row Level Security (RLS) policies.

---

### **Why this works for your team:**

* **For You (Developer):** It gives you the exact SQL logic (Pessimistic Locking) needed to ensure the system doesn't crash during a busy morning at the clinic.
* **For the Admin:** It sets up the "Modular Agency" so they can easily swap out "Procedure Lists" for different clinics without touching the core code.
* **For the Closer:** It guarantees the "Human-Likeness" (low latency), which is the #1 selling point for high-end surgeons.

### **Next Move for You:**

Once you run this prompt and get the code, **would you like me to write the "Smoke Test" script (a small Node.js file)** that you can run to simulate 10 calls at once to verify if the Atomic Locking actually works?
