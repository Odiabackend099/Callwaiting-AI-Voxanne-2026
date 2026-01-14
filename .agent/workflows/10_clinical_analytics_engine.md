---
name: clinical-analytics-engine
description: Advanced SQL schema design and clinical intelligence calculation engine. Use when designing analytics, calculating ROI, or implementing lead scoring algorithms for healthcare.
---

# Clinical Analytics Engine

**Role:** Senior Data Scientist & Clinical Intelligence Architect

This skill provides a "Master's Degree" in mathematical database calculation for medical AI systems. It transforms raw call data into actionable clinical intelligence.

## Core Competencies

1. **Lead Scoring Algorithms:** Calculating "Lead Temperature" based on intent, value, and urgency.
2. **ROI Calculation:** Determining "Cost per Lead" vs "Revenue Saved".
3. **Sentiment Analysis Integration:** Mapping LLM outputs to numerical sentiment scores.
4. **Real-Time Analytics:** Designing efficient async pipelines for live dashboards.
5. **Multi-Dimensional SQL Views:** Creating complex views for instant dashboard rendering.

## Instructions

### Step 1: Schema Design (The Foundation)

Always start by defining the data structure. Use PostgreSQL `JSONB` for flexibility and `Generated Columns` for performance.

**Standard Schema Pattern:**

- `calls` table: Stores raw call data (duration, status, recording URL).
- `analysis` table or column: Stores AI-derived data (sentiment, intent, topics).
- `metrics` views: Pre-calculated views for the dashboard.

### Step 2: The "Lead Temperature" Algorithm

Use this logic to categorize leads:

- **HOT 🔥**: `Status = 'Abandoned'` AND `Intent = 'High Value'` AND `Duration > 2m`.
- **WARM ☀️**: `Status = 'Completed'` AND `Intent = 'General'` AND `Booking = False`.
- **COOL ❄️**: `Status = 'Completed'` AND `Intent = 'Inquiry'` (Hours/Location).

### Step 3: SQL Implementation Guide

When implementing metrics, use these SQL patterns:

**1. ROI Calculator:**

```sql
-- Calculate Potential Revenue based on Procedure Type
CASE
    WHEN metadata->>'intent' = 'facelift' THEN 10000
    WHEN metadata->>'intent' = 'rhinoplasty' THEN 6000
    ELSE 150 -- General Consultation
END as potential_value
```

**2. Sentiment Score:**

```sql
-- Normalized Sentiment (0-100)
(COALESCE((analysis->>'sentiment_score')::float, 0.5) * 100)::int
```

**3. Efficiency Metrics:**

```sql
-- Calls handled by AI vs Human
COUNT(*) FILTER (WHERE handled_by = 'ai') as ai_calls,
COUNT(*) FILTER (WHERE handled_by = 'human') as human_calls
```

## Best Practices

- **Async Processing:** Never calculate sentiment during the webhook. Trigger a background job.
- **Privacy First:** Redact PII in analytics views.
- **Performance:** Use `MATERIALIZED VIEWS` for heavy aggregations if data volume > 1M rows.
- **Accuracy:** Always aggregate by `org_id` to ensure multi-tenant isolation.
