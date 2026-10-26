-- Hunda Logistics audit trail for customer and administrator activity.
-- Database timestamps remain timestamptz (UTC); the UI renders Asia/Ho_Chi_Minh.

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  actor_role text not null default 'authenticated',
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  record_id text,
  record_label text,
  changed_fields text[] not null default '{}',
  source_ip text,
  user_agent text
);

create index if not exists activity_log_occurred_at_idx on public.activity_log (occurred_at desc);
create index if not exists activity_log_actor_id_idx on public.activity_log (actor_id, occurred_at desc);

alter table public.activity_log enable row level security;
revoke all on table public.activity_log from public, anon, authenticated;
grant select on table public.activity_log to authenticated;
drop policy if exists "approved admins read activity log" on public.activity_log;
create policy "approved admins read activity log"
on public.activity_log for select to authenticated
using ((select private.is_hunda_admin()));

create or replace function private.capture_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  current_row jsonb;
  req_headers jsonb;
  change_names text[] := '{}';
  label text;
  actor_role_name text := 'authenticated';
begin
  if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
  current_row := case when tg_op = 'DELETE' then old_row else new_row end;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into change_names
    from jsonb_object_keys(old_row || new_row) as keys(k)
    where old_row -> k is distinct from new_row -> k
      and k not in ('updated_at');
  elsif tg_op = 'INSERT' then
    select coalesce(array_agg(k order by k), '{}') into change_names
    from jsonb_object_keys(current_row) as keys(k)
    where k not in ('id', 'created_at', 'updated_at');
  end if;

  label := coalesce(current_row ->> 'code', current_row ->> 'name', current_row ->> 'file_name', current_row ->> 'category', current_row ->> 'storage_path', current_row ->> 'id');
  req_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  if tg_table_schema = 'storage' and coalesce(new_row ->> 'bucket_id', old_row ->> 'bucket_id') is distinct from 'hunda-documents' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if (select auth.uid()) is null then actor_role_name := 'system';
  elsif (select private.is_hunda_admin()) then actor_role_name := 'admin';
  else actor_role_name := 'customer';
  end if;

  insert into public.activity_log (
    actor_id, actor_email, actor_role, action, entity_type, record_id,
    record_label, changed_fields, source_ip, user_agent
  ) values (
    (select auth.uid()),
    coalesce((select auth.jwt() ->> 'email'), nullif(req_headers ->> 'x-authenticated-user-email', '')),
    actor_role_name,
    tg_op,
    case when tg_table_schema = 'storage' then 'chứng từ · tệp lưu trữ' else tg_table_name end,
    current_row ->> 'id',
    label,
    change_names,
    coalesce(nullif(req_headers ->> 'cf-connecting-ip', ''), nullif(req_headers ->> 'x-real-ip', ''), nullif(split_part(req_headers ->> 'x-forwarded-for', ',', 1), '')),
    coalesce(nullif(req_headers ->> 'user-agent', ''), nullif(req_headers ->> 'sec-ch-ua', ''))
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.capture_activity() from public, anon, authenticated;

drop trigger if exists activity_customers on public.customers;
create trigger activity_customers after insert or update or delete on public.customers
for each row execute function private.capture_activity();
drop trigger if exists activity_orders on public.orders;
create trigger activity_orders after insert or update or delete on public.orders
for each row execute function private.capture_activity();
drop trigger if exists activity_transactions on public.transactions;
create trigger activity_transactions after insert or update or delete on public.transactions
for each row execute function private.capture_activity();
drop trigger if exists activity_order_documents on public.order_documents;
create trigger activity_order_documents after insert or update or delete on public.order_documents
for each row execute function private.capture_activity();
drop trigger if exists activity_hunda_storage on storage.objects;
create trigger activity_hunda_storage after insert or update or delete on storage.objects
for each row execute function private.capture_activity();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_log'
  ) then
    alter publication supabase_realtime add table public.activity_log;
  end if;
end;
$$;
