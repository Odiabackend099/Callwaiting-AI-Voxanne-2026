---
description: unit testing test individual components in isolation to make sure each piece behaves exactly as expected. 
---

To test the **CallWaiting AI** ecosystem effectively, we need a "Red Team" prompt that pushes the limits of your **Vapi, Twilio, and Supabase** integration. This prompt is designed to be given to an AI (like another Gemini session or a specialized QA agent) acting as the **"Senior QA & System Stress Tester."**

### **The "Surgical-Grade" QA Test Prompt**

Copy and paste this into an AI developer tool to begin the core functionality audit:

> **Role:** You are a Senior QA Engineer specializing in Voice AI and Medical SaaS Infrastructure.
> **Objective:** Conduct a comprehensive functional and stress test of the "CallWaiting AI" project. This system uses Vapi for voice orchestration, Twilio for telephony, and Supabase (PostgreSQL) for lead management and atomic calendar locking.
> **1. Functional Testing (The Happy Path):**
>
> * **Inbound Flow:** Simulate an inbound call to Voxanne. Verify if the agent identifies the clinic based on the inbound phone number and greets the patient with the correct clinic name.
> * **Booking Logic:** Simulate a booking request for a "Rhinoplasty Consultation." Verify that the AI correctly queries the Google Calendar API and provides available slots.
> * **Data Persistence:** Confirm that the lead's name, phone number, and intent are correctly saved into the `contacts` table in Supabase.
>
>
> **2. Edge Case & Stress Testing (The "Brutal" Audit):**
>
> * **The Race Condition:** Simulate two simultaneous calls from different patients trying to book the same 2:00 PM slot. Test if the **PostgreSQL RPC (`claim_slot_atomic`)** correctly locks the slot for the first caller and informs the second caller that the slot just became unavailable.
> * **Interruption Handling:** Test Voxanne’s response when a user interrupts with a completely different topic (e.g., "Wait, what's your address?") in the middle of a booking flow. Does she recover and return to the booking?
> * **Validation Loop:** Provide an incorrect 4-digit OTP. Verify that the system denies the booking and asks for the correct code, triggering a human hand-off after two failed attempts.
>
>
> **3. Compliance & Security Audit:**
>
> * **PII Redaction:** Review a mock transcript. Ensure that the AI has masked the patient’s address and Date of Birth before the transcript is permanently logged.
> * **Session Isolation:** Verify that an agent configured for "Clinic A" cannot see or access calendar slots or lead data belonging to "Clinic B" (RLS validation).
>
>
> **4. Technical Performance:**
>
> * Check for **latency spikes.** If the response time from STT (Speech-to-Text) to LLM response exceeds 800ms, flag it as a "Clinical User Experience Failure."
>
>
> **Output Requirement:** Provide a detailed **Bug Report** categorized by severity (Critical, Major, Minor) and a **Success Score (0-100%)** for each core functionality.

---

### **How to Use This Prompt Successfully**

1. **Environment:** Run this against your **Staging environment**, not your live production database.
2. **The "Live Agent" Test:** If you have a developer friend, have them call the bot while the AI QA Agent monitors the **Supabase Real-time logs**.
3. **The Result:** This will give you the "Technical Proof" you need to show clinic owners. Imagine telling a surgeon: *"We didn't just build this; we ran 100 simultaneous call simulations to prove our booking logic is 100% fail-proof."*

### **Next Step for You**

Would you like me to create a **"Testing Scorecard" Spreadsheet** template where your Admin can record the results of these tests for your first pilot?
