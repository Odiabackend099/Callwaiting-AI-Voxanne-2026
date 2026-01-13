---
description: Secure data and access before launch.   After go-live, validate everything works as expected in production. 
---

To ensure your AI Developer builds a system that isn't just a "chatbot" but a robust **Autonomous Medical Agent**, you need a prompt that focuses on **State Validation**, **Concurrency**, and **Compliance**.

This prompt is designed to be used in a new chat with your AI developer (like Cursor, Claude, or a custom GPT) to perform a "Surgical-Grade" system audit.

---

### **The "Master Orchestrator" Build & Test Prompt**

**Copy and paste the following into your AI Developer's workspace:**

> **Role:** You are a Lead AI Solutions Architect and Senior Security Auditor for Medical SaaS.
> **Objective:** Conduct an end-to-end technical validation of the **CallWaiting AI** ecosystem. Your goal is to verify the logic flow between the Voice Interface (Vapi), the State Database (Supabase), and the Scheduling Engine (Google Calendar).
> **Task 1: The "Atomic Collision" Test (Concurrency)**
>
> * **Scenario:** Simulate two separate Vapi instances attempting to book the same 2:00 PM Rhinoplasty slot at the exact same microsecond.
> * **Verification:** Review the `claim_slot_atomic` RPC in Supabase. It **must** use `SELECT FOR UPDATE` or a `Pessimistic Lock`.
> * **Success Metric:** Exactly one agent must confirm the booking; the other must immediately receive a `409 Conflict` and pivot the conversation to: *"I'm sorry, that slot was just taken—how about 3:00 PM?"*
>
>
> **Task 2: The "Contextual Memory" Hand-off (Inter-Agent State)**
>
> * **Scenario:** A patient calls via Voxanne (Inbound), provides their name and intent (Facelift), but hangs up before the final confirmation.
> * **Verification:** Check the webhook trigger. It must detect a `call_ended` status without a `booking_complete` flag.
> * **Action:** It must pass the `Lead_ID` and `Procedure_Type` to the Outbound Worker (Sarah) to trigger a personalized SMS follow-up via Twilio within 5 minutes.
>
>
> **Task 3: The "Silo" Security Audit (Multi-Tenancy)**
>
> * **Test:** Use an API key/JWT authorized for **Clinic A** and attempt to read or update a booking record for **Clinic B**.
> * **Requirement:** Confirm that Supabase Row Level Security (RLS) is strictly mapping `auth.uid()` to `clinic_id`. The request must return a `403 Forbidden`.
>
>
> **Task 4: Medical Data Redaction & Compliance**
>
> * **Test Case:** A patient says, *"My phone is 07700 123456 and I've had heart issues in the past."*
> * **Verification:** Audit the `logs` table. The phone number must be parsed into the `contacts` table, but the medical history must be **REDACTED** in the transcript log to comply with GDPR "Special Category" data rules.
>
>
> **Task 5: Latency Benchmarking**
>
> * **Requirement:** Measure "Time to First Byte" (TTFB). If end-to-end latency is > 800ms, rewrite the STT/TTS pipeline to use **Stream-based processing** (Deepgram Nova-2 + Cartesia) to ensure a premium, human-like experience.
>
>
> **Deliverable:** Provide a JSON report identifying any "Critical" logic flaws and the optimized code to fix them.

---

### **Why this prompt works for your project:**

1. **Prevents Operational Failure:** The **Atomic Collision** test ensures you never double-book a surgeon, which would destroy the clinic's trust.
2. **Automates Revenue Recovery:** The **Contextual Memory** test ensures that "lost" calls are automatically turned into "warm" SMS leads, proving the ROI of your tool to the business owner.
3. **Legal Shield:** The **Redaction & Silo** tests ensure you are GDPR compliant before you ever talk to a clinic owner, which is your biggest barrier to entry in the UK medical market.

**Next Step for you:** Once your AI Developer runs this audit, would you like me to create a **"Smoke Test" script (Node.js)** that you can run on your local machine to see these 5 tasks in action?
