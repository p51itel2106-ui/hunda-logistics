-- Granular feature permissions for Hunda Logistics administrators.
-- Existing administrators retain their current access; new administrator accounts
-- receive only the permissions explicitly selected in the account-creation form.

alter table public.admin_users
  add column if not exists permissions jsonb not null default '{}'::jsonb;

update public.admin_users
set permissions = jsonb_build_object(
  'dashboard', true, 'orders', true, 'customers', true, 'transactions', true,
  'reports', true, 'documents', true, 'quotes', true, 'activity', true,
  'accounts', true, 'wallet', true
)
where permissions = '{}'::jsonb or permissions is null;

create or replace function private.has_hunda_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users as a
    where a.user_id = (select auth.uid())
      and a.active = true
      and coalesce(a.permissions -> permission_key, 'false'::jsonb) = 'true'::jsonb
  );
$$;

revoke all on function private.has_hunda_permission(text) from public, anon;
grant execute on function private.has_hunda_permission(text) to authenticated;

-- Customer records: separate customer self-read from admin management.
drop policy if exists "approved admins manage customers" on public.customers;
create policy "admins with customer permission manage customers"
on public.customers for all to authenticated
using ((select private.has_hunda_permission('customers')))
with check ((select private.has_hunda_permission('customers')));

-- Orders: dashboard gets read-only access for summary widgets.
drop policy if exists "approved admins manage orders" on public.orders;
create policy "admins with order permission manage orders"
on public.orders for all to authenticated
using ((select private.has_hunda_permission('orders')))
with check ((select private.has_hunda_permission('orders')));
create policy "dashboard permission can read orders"
on public.orders for select to authenticated
using ((select private.has_hunda_permission('dashboard')));

-- Financial transactions are writable only by the Thu chi permission;
-- reports/dashboard can read them for summaries.
drop policy if exists "approved admins manage transactions" on public.transactions;
create policy "admins with transaction permission manage transactions"
on public.transactions for all to authenticated
using ((select private.has_hunda_permission('transactions')))
with check ((select private.has_hunda_permission('transactions')));
create policy "reports permission can read transactions"
on public.transactions for select to authenticated
using ((select private.has_hunda_permission('reports')) or (select private.has_hunda_permission('dashboard')));

-- Document metadata and private Storage objects.
drop policy if exists "approved admins read Hunda documents" on storage.objects;
drop policy if exists "approved admins upload Hunda documents" on storage.objects;
drop policy if exists "approved admins delete Hunda documents" on storage.objects;
create policy "admins with document permission read Hunda documents"
on storage.objects for select to authenticated
using (bucket_id = 'hunda-documents' and (select private.has_hunda_permission('documents')));
create policy "admins with document permission upload Hunda documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'hunda-documents' and (select private.has_hunda_permission('documents')));
create policy "admins with document permission delete Hunda documents"
on storage.objects for delete to authenticated
using (bucket_id = 'hunda-documents' and (select private.has_hunda_permission('documents')));

drop policy if exists "approved admins manage document metadata" on public.order_documents;
create policy "admins with document permission manage document metadata"
on public.order_documents for all to authenticated
using ((select private.has_hunda_permission('documents')))
with check ((select private.has_hunda_permission('documents')));

-- Customer workspace access remains intact; admin-wide access requires account permission.
drop policy if exists "customers read own account" on public.customer_accounts;
create policy "customers and permitted admins read account profiles"
on public.customer_accounts for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_hunda_permission('accounts')));
drop policy if exists "customers update own account" on public.customer_accounts;
create policy "customers update own profile or permitted admins manage profiles"
on public.customer_accounts for update to authenticated
using (user_id = (select auth.uid()) or (select private.has_hunda_permission('accounts')))
with check (user_id = (select auth.uid()) or (select private.has_hunda_permission('accounts')));

-- Activity log.
drop policy if exists "approved admins read activity log" on public.activity_log;
create policy "admins with activity permission read activity log"
on public.activity_log for select to authenticated
using ((select private.has_hunda_permission('activity')));

-- Quotes: customers may submit their own; admin review requires the quotes permission.
drop policy if exists "customers and admins read Hunda quotes" on public.customer_quotes;
create policy "customers read own Hunda quotes or admins with quote permission"
on public.customer_quotes for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_hunda_permission('quotes')));
drop policy if exists "customers submit own Hunda quotes" on public.customer_quotes;
create policy "customers submit own Hunda quotes"
on public.customer_quotes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_hunda_customer())
  and status = 'pending'
  and final_price_cny is null
  and approved_by is null
  and approved_at is null
);
drop policy if exists "admins finalize Hunda quotes" on public.customer_quotes;
create policy "admins with quote permission finalize Hunda quotes"
on public.customer_quotes for update to authenticated
using ((select private.has_hunda_permission('quotes')))
with check ((select private.has_hunda_permission('quotes')));
