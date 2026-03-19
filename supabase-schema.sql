-- ATALNT Client Portal Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- CLIENTS
-- ============================================
create table clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- ============================================
-- CLIENT USERS (multiple contacts per client)
-- ============================================
create table client_users (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  email text unique not null,
  name text not null,
  magic_token text,
  magic_token_expires_at timestamptz,
  verified_at timestamptz,
  last_login timestamptz,
  created_at timestamptz default now()
);

create index idx_client_users_email on client_users(email);
create index idx_client_users_client on client_users(client_id);

-- ============================================
-- OPS LEADS
-- ============================================
create table ops_leads (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- ============================================
-- CLIENT ASSIGNMENTS (which ops lead owns which client)
-- ============================================
create table client_assignments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  ops_lead_id uuid references ops_leads(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(client_id, ops_lead_id)
);

-- ============================================
-- CANDIDATES
-- ============================================
create table candidates (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  ops_lead_id uuid references ops_leads(id) not null,
  name text not null,
  position_title text not null,
  summary_html text,
  highlights text[] default '{}',
  location text,
  comp_target text,
  notice_period text,
  linkedin_url text,
  notes text,
  reason_for_exploring text,
  visible_fields jsonb default '{"summary": true, "highlights": true, "location": true, "comp_target": true, "notice_period": true, "linkedin_url": true, "notes": true, "reason_for_exploring": true}',
  status text default 'submitted' check (status in ('submitted', 'interview', 'offer', 'placed', 'rejected')),
  resume_url text,
  resume_filename text,
  published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_candidates_client on candidates(client_id);
create index idx_candidates_ops_lead on candidates(ops_lead_id);
create index idx_candidates_status on candidates(status);

-- ============================================
-- FEEDBACK
-- ============================================
create table feedback (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid references candidates(id) on delete cascade not null,
  client_user_id uuid references client_users(id) not null,
  thumbs_up boolean not null,
  comment text,
  created_at timestamptz default now()
);

create index idx_feedback_candidate on feedback(candidate_id);

-- ============================================
-- ACTIVITY LOG (immutable)
-- ============================================
create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid references candidates(id) on delete cascade not null,
  action text not null,
  actor_email text not null,
  actor_type text not null check (actor_type in ('ops_lead', 'client')),
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_activity_candidate on activity_log(candidate_id);

-- Prevent updates/deletes on activity_log (immutable)
create or replace function prevent_activity_log_modification()
returns trigger as $$
begin
  raise exception 'Activity log entries cannot be modified or deleted';
end;
$$ language plpgsql;

create trigger no_update_activity_log
  before update or delete on activity_log
  for each row execute function prevent_activity_log_modification();

-- ============================================
-- AUTO-UPDATE updated_at on candidates
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger candidates_updated_at
  before update on candidates
  for each row execute function update_updated_at();

-- ============================================
-- STORAGE BUCKET FOR RESUMES
-- ============================================
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do nothing;

-- Allow authenticated uploads to resumes bucket
create policy "Allow uploads to resumes" on storage.objects
  for insert with check (bucket_id = 'resumes');

-- Allow public reads from resumes bucket
create policy "Allow public reads from resumes" on storage.objects
  for select using (bucket_id = 'resumes');

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- For now, we use the service_role key server-side which bypasses RLS.
-- RLS policies below are for future direct-client access if needed.

alter table clients enable row level security;
alter table client_users enable row level security;
alter table ops_leads enable row level security;
alter table client_assignments enable row level security;
alter table candidates enable row level security;
alter table feedback enable row level security;
alter table activity_log enable row level security;

-- Service role bypasses all RLS, so these are permissive for now
create policy "Service role full access" on clients for all using (true);
create policy "Service role full access" on client_users for all using (true);
create policy "Service role full access" on ops_leads for all using (true);
create policy "Service role full access" on client_assignments for all using (true);
create policy "Service role full access" on candidates for all using (true);
create policy "Service role full access" on feedback for all using (true);
create policy "Service role full access" on activity_log for all using (true);
