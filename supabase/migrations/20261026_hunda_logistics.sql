-- Hunda Logistics: SQL data model, admin-only RLS, and private document storage.
-- Apply this migration in the Supabase SQL Editor before connecting the web app.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  phone text,
  email text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  route text not null,
  cargo_description text,
  amount numeric(16, 0) not null default 0 check (amount >= 0),
  expected_cost numeric(16, 0) not null default 0 check (expected_cost >= 0),
  status text not null default 'new' check (status in ('new', 'in_progress', 'completed', 'cancelled')),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('income', 'expense')),
  category text not null,
  amount numeric(16, 0) not null check (amount > 0),
  transaction_date date not null default current_date,
  status text not null default 'paid' check (status in ('paid', 'pending', 'cancelled')),
  method text,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  reference text,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint not null check (file_size > 0),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists transactions_date_status_idx on public.transactions(transaction_date desc, status);
create index if not exists transactions_order_id_idx on public.transactions(order_id);
create index if not exists documents_order_id_idx on public.order_documents(order_id);

create or replace function private.is_hunda_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users as a
    where a.user_id = (select auth.uid())
      and a.active = true
  );
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

revoke all on function private.is_hunda_admin() from public, anon;
grant execute on function private.is_hunda_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.transactions enable row level security;
alter table public.order_documents enable row level security;

revoke all on table public.admin_users, public.customers, public.orders, public.transactions, public.order_documents from public, anon, authenticated;
grant select on table public.admin_users to authenticated;
grant select, insert, update, delete on table public.customers, public.orders, public.transactions, public.order_documents to authenticated;

drop policy if exists "admins can read their own membership" on public.admin_users;
create policy "admins can read their own membership"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "approved admins manage customers" on public.customers;
create policy "approved admins manage customers"
on public.customers for all to authenticated
using ((select private.is_hunda_admin()))
with check ((select private.is_hunda_admin()));

drop policy if exists "approved admins manage orders" on public.orders;
create policy "approved admins manage orders"
on public.orders for all to authenticated
using ((select private.is_hunda_admin()))
with check ((select private.is_hunda_admin()));

drop policy if exists "approved admins manage transactions" on public.transactions;
create policy "approved admins manage transactions"
on public.transactions for all to authenticated
using ((select private.is_hunda_admin()))
with check ((select private.is_hunda_admin()));

drop policy if exists "approved admins manage document metadata" on public.order_documents;
create policy "approved admins manage document metadata"
on public.order_documents for all to authenticated
using ((select private.is_hunda_admin()))
with check ((select private.is_hunda_admin()));

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at before update on public.customers
for each row execute function private.touch_updated_at();
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders
for each row execute function private.touch_updated_at();
drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at before update on public.transactions
for each row execute function private.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hunda-documents',
  'hunda-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "approved admins read Hunda documents" on storage.objects;
create policy "approved admins read Hunda documents"
on storage.objects for select to authenticated
using (bucket_id = 'hunda-documents' and (select private.is_hunda_admin()));

drop policy if exists "approved admins upload Hunda documents" on storage.objects;
create policy "approved admins upload Hunda documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'hunda-documents' and (select private.is_hunda_admin()));

drop policy if exists "approved admins delete Hunda documents" on storage.objects;
create policy "approved admins delete Hunda documents"
on storage.objects for delete to authenticated
using (bucket_id = 'hunda-documents' and (select private.is_hunda_admin()));
