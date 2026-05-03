create extension if not exists "pgcrypto";

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  title text not null,
  source_label text not null default 'Meeting',
  capture_mode text not null check (capture_mode in ('typed', 'upload', 'record', 'live')),
  transcript text not null default '',
  overview text not null default '',
  speaker_style_summary text not null default '',
  buying_channel text not null default '',
  confidence text not null default 'Low',
  gap numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  start_seconds integer not null default 0,
  end_seconds integer not null default 0,
  text text not null,
  speaker text,
  is_partial boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  start_seconds integer not null default 0,
  text text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references public.meetings (id) on delete cascade,
  dominant_channel text not null default '',
  secondary_channel text not null default '',
  channel_scores jsonb not null default '{}'::jsonb,
  phrases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_owner_id_idx on public.meetings (owner_id);
create index if not exists transcript_segments_meeting_id_idx on public.transcript_segments (meeting_id);
create index if not exists action_items_meeting_id_idx on public.action_items (meeting_id);
create index if not exists analysis_results_meeting_id_idx on public.analysis_results (meeting_id);

alter table public.meetings enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.action_items enable row level security;
alter table public.analysis_results enable row level security;

create policy "meetings_owner_select" on public.meetings
  for select using (auth.uid()::text = owner_id);

create policy "meetings_owner_insert" on public.meetings
  for insert with check (auth.uid()::text = owner_id);

create policy "meetings_owner_update" on public.meetings
  for update using (auth.uid()::text = owner_id);

create policy "meetings_owner_delete" on public.meetings
  for delete using (auth.uid()::text = owner_id);

create policy "segments_owner_select" on public.transcript_segments
  for select using (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.transcript_segments.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  );

create policy "segments_owner_write" on public.transcript_segments
  for all using (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.transcript_segments.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  ) with check (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.transcript_segments.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  );

create policy "action_items_owner_select" on public.action_items
  for select using (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.action_items.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  );

create policy "action_items_owner_write" on public.action_items
  for all using (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.action_items.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  ) with check (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.action_items.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  );

create policy "analysis_owner_select" on public.analysis_results
  for select using (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.analysis_results.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  );

create policy "analysis_owner_write" on public.analysis_results
  for all using (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.analysis_results.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  ) with check (
    exists (
      select 1 from public.meetings
      where public.meetings.id = public.analysis_results.meeting_id
        and public.meetings.owner_id = auth.uid()::text
    )
  );
