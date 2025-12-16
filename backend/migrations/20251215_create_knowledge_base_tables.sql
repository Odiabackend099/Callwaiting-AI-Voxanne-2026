-- Idempotent Knowledge Base tables used by backend routes

create extension if not exists pgcrypto;

create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  filename text not null,
  content text not null,
  category text not null default 'general',
  version integer not null default 1,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_base_org_id_idx on public.knowledge_base(org_id);
create index if not exists knowledge_base_org_id_active_idx on public.knowledge_base(org_id, active);

create table if not exists public.knowledge_base_changelog (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null,
  org_id uuid not null,
  version_from integer,
  version_to integer,
  change_type text not null,
  changed_by text,
  change_summary text,
  previous_content text,
  new_content text,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_base_changelog_org_id_idx on public.knowledge_base_changelog(org_id);

create table if not exists public.hallucination_flags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  agent_id uuid,
  call_id uuid,
  transcript text,
  flagged_claim text,
  confidence_score double precision,
  knowledge_base_search_result text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists hallucination_flags_org_id_idx on public.hallucination_flags(org_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_base_set_updated_at on public.knowledge_base;
create trigger knowledge_base_set_updated_at
before update on public.knowledge_base
for each row
execute function public.set_updated_at();
