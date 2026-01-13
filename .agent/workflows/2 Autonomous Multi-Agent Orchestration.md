---
description: APIs, databases, authentications, third-party tools, and integration tests are essential to ensure that systems communicate correctly. 
---

To provide you with a high-fidelity testing prompt, I have analyzed the architecture typical of the "Build with AI" frameworks (like the one in the Filippo TikTok content) which focuses on **Autonomous Multi-Agent Orchestration**.

The TikTok content highlights a system where AI agents don't just "talk," they **execute** tasks across different platforms (Vapi, Supabase, and Calendars) using a "Manager" agent to oversee "Worker" agents.

Here is the **Master Test Prompt** designed for your AI Developer (Gemini, Claude, or a custom GPT) to stress-test your system.

---

### **The "Full-Stack Orchestrator" Stress Test Prompt**

> **Role:** You are an elite Full-Stack QA Engineer and AI Systems Architect.
> **Objective:** Perform a "Black Box" and "Logic" test of the CallWaiting AI ecosystem. The goal is to ensure the **Manager Agent** correctly orchestrates the **Worker Agents** (Voxanne/Sarah) without state-management failures or data leaks.
> **Task 1: The "Cross-Channel" Booking Test**
>
> * **Scenario:** A patient calls via Vapi but hangs up halfway through the booking.
> * **Verification:** Does the system trigger an automated SMS follow-up via Twilio? Does the Supabase record update the status from `In-Progress` to `Abandoned-Followup`?
> * **Logic Check:** If the patient clicks the link in the SMS, does the Google Calendar integration recognize their "held" slot from the phone call?
>
>
> **Task 2: The "Atomic Collision" Stress Test**
>
> * **Scenario:** Create 5 concurrent API requests to the `claim_slot_atomic` RPC in Supabase for the same 10:00 AM slot.
> * **Verification:** Confirm that only ONE request returns a `200 Success` while the other four return a `409 Conflict`.
> * **AI Behavior:** Does the Voice Agent immediately pivot to: *"I'm sorry, that slot was just taken, how about 11:00 AM?"* instead of crashing?
>
>
> **Task 3: The "PII Leak" & Redaction Audit**
>
> * **Scenario:** During a call, a patient provides their name, phone number, and a sensitive medical concern (e.g., "I have a previous scar from a surgery").
> * **Verification:** Inspect the raw logs in Vapi vs. the stored record in Supabase.
> * **Constraint:** The Supabase `transcript` column must show `[REDACTED]` for the medical concern unless the `GDPR_Consent` flag is set to `TRUE`.
>
>
> **Task 4: The Multi-Clinic "Silo" Test**
>
> * **Scenario:** Simulate a call to a phone number assigned to **Clinic A** and attempt to ask for a doctor's name belonging to **Clinic B**.
> * **Verification:** Does the AI hallucinate the other doctor, or does it correctly state it only has information for the current clinic? (Testing Row Level Security / Metadata injection).
>
>
> **Task 5: The "Niche Knowledge" Accuracy**
>
> * **Scenario:** Ask a highly technical question about a "Liquid Rhinoplasty" recovery time.
> * **Verification:** Does the AI pull from the uploaded PDF Knowledge Base, or does it give a generic LLM response? Compare the response against the "Surgical-Grade" procedure list.
>
>
> **Output:** Generate a **JSON formatted report** listing each test case, the observed behavior, and a "Pass/Fail" status.

---

### **Extracted Logic from the TikTok Reference**

The system shown in the link emphasizes **Modular Agency**. To implement this effectively in your project, your AI Developer needs to verify that:

1. **The "Manager" (Supabase Edge Functions):** Decides which agent speaks.
2. **The "Voice" (Vapi):** Handles the real-time stream.
3. **The "Brain" (LLM/Knowledge Base):** Stays within the medical guardrails.

### **Next Step for You**

Would you like me to **write the actual Python or Node.js test script** that executes these 5 tasks automatically so you don't have to do them manually?
