-- Fix call_logs schema to match application expectations
-- Issue: Application expects 'ended_at' but schema has 'end_time'
-- Action: Add 'ended_at' column and indexes
-- 1. Add ended_at column if not exists
alter table public.call_logs
add column if not exists ended_at timestamptz;
-- 2. Ensure other expected columns exist (idempotent checks)
alter table public.call_logs
add column if not exists duration_seconds integer;
alter table public.call_logs
add column if not exists outcome text;
alter table public.call_logs
add column if not exists metadata jsonb not null default '{}'::jsonb;
-- 3. Create missing indexes for performance
create index if not exists idx_call_logs_vapi_call_id on public.call_logs(vapi_call_id);
create index if not exists idx_call_logs_started_at on public.call_logs(started_at desc);
-- 4. Backfill ended_at from end_time if present (optional but helpful cleanup)
update public.call_logs
set ended_at = end_time
where ended_at is null
    and end_time is not null;
SELECT 'Call logs schema fix applied' as status;