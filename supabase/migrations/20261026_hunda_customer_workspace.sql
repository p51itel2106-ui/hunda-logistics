-- Customer workspace with server-enforced ownership. New signups are customers;
-- administrative privileges continue to come only from public.admin_users.

create table if not exists public.customer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  full_name text not null,
  phone text,
  billing_company text,
  billing_tax_code text,
  billing_address text,
  billing_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_customer_user_created_idx on public.orders(customer_user_id, created_at desc);
create index if not exists order_documents_created_by_idx on public.order_documents(created_by);

alter table public.customer_accounts enable row level security;
revoke all on table public.customer_accounts from public, anon, authenticated;
grant select on table public.customer_accounts to authenticated;
grant update (full_name, phone, billing_company, billing_tax_code, billing_address, billing_email, updated_at) on table public.customer_accounts to authenticated;
drop policy if exists "customers read own account" on public.customer_accounts;
create policy "customers read own account" on public.customer_accounts for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_hunda_admin()));
drop policy if exists "customers update own account" on public.customer_accounts;
create policy "customers update own account" on public.customer_accounts for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_hunda_admin()))
with check (user_id = (select auth.uid()) or (select private.is_hunda_admin()));

create or replace function private.is_hunda_customer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.customer_accounts as c where c.user_id = (select auth.uid()))
$$;
create or replace function private.hunda_customer_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.customer_id from public.customer_accounts as c where c.user_id = (select auth.uid()) limit 1
$$;
create or replace function private.owns_hunda_order(order_key uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders as o where o.id = order_key and o.customer_user_id = (select auth.uid()))
$$;
revoke all on function private.is_hunda_customer() from public, anon;
revoke all on function private.hunda_customer_id() from public, anon;
revoke all on function private.owns_hunda_order(uuid) from public, anon;
grant execute on function private.is_hunda_customer() to authenticated;
grant execute on function private.hunda_customer_id() to authenticated;
grant execute on function private.owns_hunda_order(uuid) to authenticated;

-- New signups always receive customer access based on this server-side mapping,
-- never from editable user metadata. The trigger runs as its owner.
create or replace function private.create_hunda_customer_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); customer_key uuid;
begin
  insert into public.customers (name, company, phone, email)
  values (coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1)),
          nullif(meta ->> 'billing_company', ''), nullif(meta ->> 'phone', ''), new.email)
  returning id into customer_key;
  insert into public.customer_accounts (user_id, customer_id, full_name, phone, billing_company, billing_tax_code, billing_address, billing_email)
  values (new.id, customer_key, coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1)),
          nullif(meta ->> 'phone', ''), nullif(meta ->> 'billing_company', ''), nullif(meta ->> 'billing_tax_code', ''),
          nullif(meta ->> 'billing_address', ''), nullif(meta ->> 'billing_email', ''));
  return new;
end;
$$;
revoke all on function private.create_hunda_customer_account() from public, anon, authenticated;
drop trigger if exists hunda_customer_after_signup on auth.users;
create trigger hunda_customer_after_signup after insert on auth.users
for each row execute function private.create_hunda_customer_account();

create or replace function private.sync_hunda_customer_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.customers set name = new.full_name, company = new.billing_company, phone = new.phone,
    email = coalesce(new.billing_email, (select u.email from auth.users as u where u.id = new.user_id)), updated_at = now()
  where id = new.customer_id;
  return new;
end;
$$;
revoke all on function private.sync_hunda_customer_account() from public, anon, authenticated;
drop trigger if exists hunda_customer_account_sync on public.customer_accounts;
create trigger hunda_customer_account_sync after update on public.customer_accounts
for each row execute function private.sync_hunda_customer_account();
drop trigger if exists hunda_customer_account_touch on public.customer_accounts;
create trigger hunda_customer_account_touch before update on public.customer_accounts
for each row execute function private.touch_updated_at();

drop policy if exists "customers read own customer record" on public.customers;
create policy "customers read own customer record" on public.customers for select to authenticated
using (id = (select private.hunda_customer_id()));

drop policy if exists "customers read own orders" on public.orders;
-- The base orders table remains admin-only. Customers use this safe view, which
-- deliberately omits contract amounts, internal cost, and internal fields.
create or replace view public.customer_orders as
select id, code, customer_id, route, cargo_description, status, note, created_at, updated_at
from public.orders
where customer_user_id = (select auth.uid());
revoke all on public.customer_orders from public, anon, authenticated;
grant select on public.customer_orders to authenticated;

create or replace function public.ensure_customer_workspace()
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); current_email text := auth.jwt() ->> 'email'; customer_key uuid;
begin
  if current_user_id is null or not (select private.is_hunda_admin()) then
    raise exception 'Chỉ quản trị viên mới được mở chế độ khách hàng.' using errcode = '42501';
  end if;
  select ca.customer_id into customer_key from public.customer_accounts as ca where ca.user_id = current_user_id;
  if customer_key is null then
    insert into public.customers (name, email) values (coalesce(current_email, 'Tài khoản quản trị'), current_email) returning id into customer_key;
    insert into public.customer_accounts (user_id, customer_id, full_name, billing_email)
    values (current_user_id, customer_key, coalesce(current_email, 'Tài khoản quản trị'), current_email);
  end if;
  return customer_key;
end;
$$;
revoke all on function public.ensure_customer_workspace() from public, anon;
grant execute on function public.ensure_customer_workspace() to authenticated;

create or replace function public.submit_customer_order(p_route text, p_cargo_description text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); customer_key uuid; order_key uuid;
begin
  if current_user_id is null or not (select private.is_hunda_customer()) then
    raise exception 'Tài khoản chưa có hồ sơ khách hàng.' using errcode = '42501';
  end if;
  if nullif(trim(p_route), '') is null then raise exception 'Vui lòng nhập tuyến vận chuyển.' using errcode = '22023'; end if;
  customer_key := (select private.hunda_customer_id());
  insert into public.orders (code, customer_id, customer_user_id, route, cargo_description, amount, expected_cost, status, note, created_by)
  values ('HND-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
          customer_key, current_user_id, trim(p_route), nullif(trim(p_cargo_description), ''), 0, 0, 'new', nullif(trim(p_note), ''), current_user_id)
  returning id into order_key;
  return order_key;
end;
$$;
revoke all on function public.submit_customer_order(text, text, text) from public, anon;
grant execute on function public.submit_customer_order(text, text, text) to authenticated;

-- Only approved admins may read financial totals from the base orders table.
drop policy if exists "approved admins manage orders" on public.orders;
create policy "approved admins manage orders" on public.orders for all to authenticated
using ((select private.is_hunda_admin())) with check ((select private.is_hunda_admin()));

drop policy if exists "customers read own order documents" on public.order_documents;
create policy "customers read own order documents" on public.order_documents for select to authenticated
using (order_id is not null and (select private.owns_hunda_order(order_id)));
drop policy if exists "customers attach documents to own orders" on public.order_documents;
create policy "customers attach documents to own orders" on public.order_documents for insert to authenticated
with check (order_id is not null and created_by = (select auth.uid()) and (select private.owns_hunda_order(order_id)));
drop policy if exists "customers delete own order documents" on public.order_documents;
create policy "customers delete own order documents" on public.order_documents for delete to authenticated
using (order_id is not null and created_by = (select auth.uid()) and (select private.owns_hunda_order(order_id)));

drop policy if exists "customers upload own Hunda documents" on storage.objects;
create policy "customers upload own Hunda documents" on storage.objects for insert to authenticated
with check (bucket_id = 'hunda-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "customers read own Hunda documents" on storage.objects;
create policy "customers read own Hunda documents" on storage.objects for select to authenticated
using (bucket_id = 'hunda-documents' and exists (
  select 1 from public.order_documents as d where d.storage_path = name and d.order_id is not null and (select private.owns_hunda_order(d.order_id))
));
drop policy if exists "customers delete own Hunda documents" on storage.objects;
create policy "customers delete own Hunda documents" on storage.objects for delete to authenticated
using (bucket_id = 'hunda-documents' and exists (
  select 1 from public.order_documents as d where d.storage_path = name and d.created_by = (select auth.uid()) and d.order_id is not null and (select private.owns_hunda_order(d.order_id))
));

-- Helper variant accepts a trusted user ID for Auth signup trigger context.
create or replace function private.is_hunda_admin_for(user_key uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users as a where a.user_id = user_key and a.active = true)
$$;
revoke all on function private.is_hunda_admin_for(uuid) from public, anon, authenticated;

-- Include signup-triggered profile writes in the audit trail using the new
-- account's immutable user_id when the Auth request has no auth.uid() claim.
create or replace function private.capture_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_row jsonb; new_row jsonb; current_row jsonb; req_headers jsonb; change_names text[] := '{}'; label text; actor_role_name text := 'authenticated'; event_actor uuid;
begin
  if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
  current_row := case when tg_op = 'DELETE' then old_row else new_row end;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into change_names from jsonb_object_keys(old_row || new_row) as keys(k) where old_row -> k is distinct from new_row -> k and k not in ('updated_at');
  elsif tg_op = 'INSERT' then
    select coalesce(array_agg(k order by k), '{}') into change_names from jsonb_object_keys(current_row) as keys(k) where k not in ('id', 'created_at', 'updated_at');
  end if;
  label := coalesce(current_row ->> 'code', current_row ->> 'name', current_row ->> 'file_name', current_row ->> 'category', current_row ->> 'storage_path', current_row ->> 'id');
  req_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  if tg_table_schema = 'storage' and coalesce(new_row ->> 'bucket_id', old_row ->> 'bucket_id') is distinct from 'hunda-documents' then
    if tg_op = 'DELETE' then return old; end if; return new;
  end if;
  event_actor := (select auth.uid());
  if event_actor is null then
    begin event_actor := nullif(current_row ->> 'user_id', '')::uuid; exception when invalid_text_representation then event_actor := null; end;
  end if;
  if event_actor is null then actor_role_name := 'system'; elsif (select private.is_hunda_admin_for(event_actor)) then actor_role_name := 'admin'; else actor_role_name := 'customer'; end if;
  insert into public.activity_log (actor_id, actor_email, actor_role, action, entity_type, record_id, record_label, changed_fields, source_ip, user_agent)
  values (event_actor,
    coalesce((select auth.jwt() ->> 'email'), current_row ->> 'email', nullif(req_headers ->> 'x-authenticated-user-email', ''), (select u.email from auth.users as u where u.id = event_actor)),
    actor_role_name, tg_op, case when tg_table_schema = 'storage' then 'chứng từ · tệp lưu trữ' else tg_table_name end,
    coalesce(current_row ->> 'id', current_row ->> 'user_id'), label, change_names,
    coalesce(nullif(req_headers ->> 'cf-connecting-ip', ''), nullif(req_headers ->> 'x-real-ip', ''), nullif(split_part(req_headers ->> 'x-forwarded-for', ',', 1), '')),
    coalesce(nullif(req_headers ->> 'user-agent', ''), nullif(req_headers ->> 'sec-ch-ua', '')));
  if tg_op = 'DELETE' then return old; end if; return new;
end;
$$;

drop trigger if exists activity_customer_accounts on public.customer_accounts;
create trigger activity_customer_accounts after insert or update or delete on public.customer_accounts
for each row execute function private.capture_activity();
