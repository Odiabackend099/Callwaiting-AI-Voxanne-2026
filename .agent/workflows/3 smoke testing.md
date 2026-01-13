---
description: Before real users touch it, test core flows to confirm the app doesn't crash under normal use. 
---

To ensure your AI Developer (the system building the code) is actually meeting the "Surgical-Grade" standards we've set, you need a prompt that acts as both a **Debugger** and a **Stress-Tester**.

Based on the multi-agent architecture from the Filippo/Build-with-AI framework and your specific stack (Vapi + Supabase + Google Calendar), here is the master prompt.

---

### **The "System Architect" Validation Prompt**

**Copy and paste this into your AI Developer's chat window:**

> **Role:** You are a Lead Systems Architect and Senior Security Auditor for Medical SaaS.
> **Task:** Conduct an end-to-end technical validation of the **CallWaiting AI** ecosystem. You must verify the logic flow between the Voice Interface (Vapi), the Database (Supabase), and the Scheduling Engine (Google Calendar).
> **Audit Module 1: The "Atomic" Reservation Logic**
>
> * **Test Case:** Simulate a "Race Condition" where two separate Vapi instances attempt to book the same slot at the exact same microsecond.
> * **Requirement:** Review the `claim_slot_atomic` RPC in Supabase. Does it use `FOR UPDATE` or a `pessimistic lock`? If not, rewrite the SQL to ensure zero double-bookings.
>
>
> **Audit Module 2: The Multi-Agent "Hand-off"**
>
> * **Test Case:** A caller speaks to **Voxanne** (Inbound) but asks for a price quote that requires a follow-up.
> * **Requirement:** Verify the trigger that moves the lead from the `inbound_logs` table to the `outbound_queue` for **Sarah**. Ensure the `Lead_ID` remains consistent across agents to prevent data fragmentation.
>
>
> **Audit Module 3: Medical Compliance & Redaction**
>
> * **Test Case:** A patient provides a phone number and mentions a sensitive medical condition (e.g., "breast augmentation follow-up").
> * **Requirement:** Test the regex and NER (Named Entity Recognition) filters. Ensure that the **Vapi transcript** stored in Supabase redacts the medical condition while keeping the phone number for the `contacts` table.
>
>
> **Audit Module 4: Latency & "Human-Likeness"**
>
> * **Requirement:** Audit the current `voice_id` and `provider` settings in the Vapi config. If end-to-end latency is projected > 800ms, suggest a model swap (e.g., to Cartesia or Deepgram Nova-2) to maintain the "premium clinic" feel.
>
>
> **Audit Module 5: The "Silo" Security (RLS)**
>
> * **Test Case:** Simulate an API call using a JWT from **Clinic A** trying to read a calendar slot for **Clinic B**.
> * **Requirement:** Confirm the Row Level Security (RLS) policies on the `appointments` table are correctly mapping `auth.uid()` to `clinic_id`.
>
>
> **Deliverable:** > 1. List any "Critical" logic flaws.
> 2. Provide the optimized code for any failing modules.
> 3. Give a "Production-Ready" score from 1-100.

---

### **Why this prompt is different:**

* **It tests "State":** Most AI developers just test if the code "runs." This prompt tests if the **data stays accurate** as it moves from a phone call to a database to a calendar.
* **It uses your "Brutal Roast" data:** It specifically looks for the **Race Condition** we identified earlier as your biggest technical risk.
* **It focuses on "Silos":** Since you want to scale to multiple clinics, it forces the AI to check that Clinic A can never see Clinic B’s patients.

### **Next Step for You:**

Would you like me to generate a **"Dummy Data Generator"** script? This would allow your AI developer to populate Supabase with 100 "fake" clinics and patients so you can run these tests for real.
