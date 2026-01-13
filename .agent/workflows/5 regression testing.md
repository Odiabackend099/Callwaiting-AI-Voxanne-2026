---
description: After changes or fixes, retest existing features to ensure nothing unintentionally broke. 
---

To ensure your AI Developer (whether it’s Cursor, an LLM agent, or a coding assistant) delivers a system that doesn't just "talk" but actually **executes** with surgical precision, you need a prompt that focuses on **State Validation** and **Infrastructure Stress.**

Here is the master prompt to give to your AI developer to build and test the core "Modular Agency" functionalities.

---

### **The "Master Orchestrator" Build & Test Prompt**

> **Role:** You are a Lead AI Solutions Architect and Senior QA Engineer.
> **Objective:** Build and validate a "Modular Agency" ecosystem for **CallWaiting AI**. The system must coordinate state across Vapi (Voice), Supabase (State/Database), and Google Calendar (Execution).
> **Task 1: Implement & Test "Atomic Slot Locking"**
>
> * **Code Requirement:** Write a Supabase RPC `claim_slot_atomic` using `SELECT FOR UPDATE`.
> * **Test Logic:** Simulate 5 concurrent API calls to the same time slot.
> * **Success Metric:** Exactly **one** call must return a success code; the other four must receive a `409 Conflict` error. The AI Agent must then pivot to: *"I'm sorry, that slot was just taken, how about [Next Available]?"*
>
>
> **Task 2: Build the "Contextual Memory" Hand-off**
>
> * **Scenario:** A patient speaks to the Inbound Agent (**Voxan**) about a "Rhinoplasty" but hangs up before confirming.
> * **Logic:** Create a webhook trigger that detects the `call_ended` status without a `booking_confirmed` flag.
> * **Action:** It must pass the `Lead_ID` and the keyword `Rhinoplasty` to the Outbound Agent (**Sarah**) to trigger a follow-up SMS with the correct "Rhinoplasty Guide" PDF link.
>
>
> **Task 3: Security & Compliance "Redline" Test**
>
> * **Requirement:** Implement a Named Entity Recognition (NER) filter on the transcript stream.
> * **Test:** If a user says, *"My address is 123 Harley Street and I have a history of heart issues,"* the script must verify that the address is saved to the `contacts` table, but the medical history is **REDACTED** in the public log and moved to a secure, encrypted `clinical_notes` table.
>
>
> **Task 4: Latency & Response Benchmarking**
>
> * **Verification:** Measure the "Time to First Byte" (TTFB) for the AI response.
> * **Optimization:** If latency exceeds 800ms, rewrite the integration to use **Stream-based processing** (Deepgram Nova-2 + Cartesia/ElevenLabs Turbo) to ensure zero awkward silences during high-stakes medical inquiries.
>
>
> **Task 5: Multi-Tenant "Silo" Validation**
>
> * **Test:** Use a JWT for **Clinic A** to attempt an update on a booking for **Clinic B**.
> * **Success Metric:** The request must be rejected by Row Level Security (RLS) with a `403 Forbidden` error.
>
>

---

### **Why this is the "Gold Standard" for your team:**

1. **It solves the Race Condition:** By forcing the AI to build the `SELECT FOR UPDATE` logic, you prevent the embarrassment of two patients showing up for the same surgery slot.
2. **It automates the Admin:** The "Contextual Memory" hand-off means your Admin doesn't have to manually check who hung up; the system handles the "Sarah" follow-up automatically.
3. **It secures the "Silos":** The RLS test ensures that as you scale to 100+ clinics, their data remains perfectly separated, which is your #1 legal requirement for GDPR.

### **Next Move for You:**

Once your AI Developer generates the code for these modules, **would you like me to write a "Smoke Test" script in Node.js** that you can run locally to verify these 5 tasks actually work before you go live?
