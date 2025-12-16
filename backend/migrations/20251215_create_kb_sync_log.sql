-- Create KB Sync Log table for persistent rate limiting and audit trail

create table if not exists public.kb_sync_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  created_at timestamptz not null default now(),
  tool_id text,
  status text not null default 'success',
  error_message text,
  duration_ms integer,
  docs_synced integer,
  assistants_updated integer
);

create index if not exists kb_sync_log_org_id_idx on public.kb_sync_log(org_id);
create index if not exists kb_sync_log_org_id_created_at_idx on public.kb_sync_log(org_id, created_at desc);
