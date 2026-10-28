create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null default '',
  role text not null check (role in ('admin','customer','unknown')),
  ip_address text,
  user_agent text,
  device_type text not null default 'Không rõ',
  browser text not null default 'Không rõ',
  os text not null default 'Không rõ',
  event_type text not null check (event_type in ('login','logout')),
  success boolean not null default true,
  occurred_at timestamptz not null default now()
);
create index if not exists login_events_occurred_at_idx on public.login_events (occurred_at desc);
create index if not exists login_events_user_id_occurred_at_idx on public.login_events (user_id, occurred_at desc);
alter table public.login_events enable row level security;
revoke all on public.login_events from anon, authenticated;
drop policy if exists "deny client access to login events" on public.login_events;
create policy "deny client access to login events" on public.login_events for all to anon, authenticated using (false) with check (false);
update public.admin_users set permissions = coalesce(permissions, '{}'::jsonb) || '{"security": true}'::jsonb where active = true;
