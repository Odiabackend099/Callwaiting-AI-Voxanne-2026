This is the **Master PRD (Product Requirement Document)** for Voxanne AI, version 2026.1. It incorporates the infrastructure audit we just completed, the 2026 AI industry standards for voice, and the specific backend logic required to make the Knowledge Base and Calendar integrations bulletproof.

---

# 📋 Voxanne AI: Comprehensive Product Requirement Document (2026)

## 1. Project Overview

**Voxanne AI** is a premium, multi-tenant AI Voice-as-a-Service (VaaS) platform. It allows small-to-medium businesses (primarily healthcare and service-based) to deploy autonomous voice agents that handle inbound inquiries, perform outbound scheduling, and resolve customer service queries using a proprietary knowledge base.

### **Core Objectives (MVP)**

* **Zero-Latency Interactions:** Sub-500ms response times for tool-calling.
* **Hard Multi-Tenancy:** Absolute data isolation via Database RLS.
* **Autonomous Scheduling:** Full synchronization with external calendars (Google/Outlook).
* **Contextual Intelligence:** RAG-based knowledge retrieval for clinic-specific policies.

---

## 2. User Journey & Experience (UX)

### **A. Onboarding Flow**

1. **Signup:** User creates an account via Supabase Auth.
2. **Organization Provisioning:** A system trigger automatically creates a unique `org_id`, initializes a `profile`, and stamps the `org_id` into the user’s JWT `app_metadata`.
3. **Integration:** User connects their Google Calendar via OAuth.
4. **Agent Configuration:** User uploads a "Knowledge PDF" (e.g., pricing, FAQs) and selects a voice.

### **B. The "Live Call" Experience**

* **Inbound:** A patient calls the clinic. The backend resolves the `org_id` via the phone number, fetches the "Brain" (Knowledge), and the AI answers.
* **Mid-Call:** The patient asks for a 2:00 PM appointment. The AI "Tool Call" checks the backend, locks the slot, and confirms.
* **Post-Call:** The transcript is saved, the calendar event is created, and the user receives a dashboard notification.

---

## 3. Core Functionalities & Backend Requirements

### **1. Knowledge Base (RAG Pipeline)**

* **Requirement:** Documents must be searchable, not just stored as text.
* **Backend Logic:**
* **Vector Ingestion:** Convert uploaded files into vector embeddings using `pgvector`.
* **Similarity Search:** When a call starts, the backend queries the vector DB for context relevant to the caller's intent.


* **2026 Standard:** Support for dynamic context injection (the AI "remembers" previous calls from the same number).

### **2. Inbound/Outbound Voice Agent**

* **Vapi Orchestration:** Secure tool-calling endpoints (`/api/vapi/tools`).
* **Identity Resolution:** A lookup table mapping `phone_number` ↔ `org_id`.
* **Security:** HMAC signature verification on every incoming Vapi request to prevent unauthorized tool execution.

### **3. Calendar & Integration Engine**

* **Two-Way Sync:** Backend workers to poll/webhook Google Calendar for external changes.
* **Atomic Booking:** Use **Postgres Advisory Locks** or `SELECT FOR UPDATE` to prevent two concurrent calls from booking the same slot.
* **Conflict Resolution:** Intelligent handling of buffer times (e.g., "Don't book back-to-back if the clinic needs 15 mins of cleanup").

---

## 4. Security & Infrastructure Audit Results

### **Current Issues (Addressed in Audit)**

* **Identity Crisis:** Successfully moved from `tenant_id` to a single source of truth: `org_id`.
* **Auth Fallback:** Removed dangerous fallback logic that defaulted users to the "first" organization in the DB.
* **Frontend Leakage:** Removed `localStorage` dependencies; the frontend now trusts only the secure, server-signed JWT.

### **Critical Backend Risks (To Watch)**

* **Race Conditions:** High-volume call days could lead to double-bookings if non-atomic SQL is used.
* **PII Exposure:** 2026 compliance requires that call transcripts in the database redact sensitive patient info (SSNs, private health details).
* **Token Expiry:** Long-duration calls must use a `Service Role` key for tool-calls to prevent mid-call authentication failures.

---

## 5. Technical Specifications (The "Backend Fix List")

| Feature | Technical Implementation |
| --- | --- |
| **Tenancy** | PostgreSQL RLS enabled on all tables using `(auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid`. |
| **Concurrency** | Implementation of **Postgres Advisory Locks** for the `calendar-slot-service`. |
| **API Security** | Validation of `x-vapi-secret` and UUID format validation for all `org_id` parameters. |
| **Knowledge** | Move from standard text columns to `vector` data type for the `knowledge_base` table. |
| **Logging** | Structured JSON logging with `pino` or `winston` for easier audit trails in 2026 observability tools. |

---

## 6. Open Questions & Assumptions

1. **Assumption:** Vapi is the sole voice provider; we do not need to support Twilio/SIP directly yet.
2. **Question:** Do we need HIPAA BAA (Business Associate Agreements) for the database storage layer immediately?
3. **Question:** Should we support "Draft" appointments that the business owner must approve, or is it 100% autonomous?

---

## 7. Final Recommendations: Next Steps

1. **Phase 4 (Current):** Finalize the Organization Settings UI so users can name their clinics and manage their basic metadata.
2. **Atomic Calendar Logic:** Refactor the booking service to handle the "Race Condition" logic.
3. **Knowledge Base Vectorization:** Enable `pgvector` in Supabase and build the file-upload-to-embedding pipeline.
4. **Vapi Secret Hardening:** Ensure all backend routes reject any request not carrying the verified Vapi secret.

---
