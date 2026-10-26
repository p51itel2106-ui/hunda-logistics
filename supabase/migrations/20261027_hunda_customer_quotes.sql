create table if not exists public.customer_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  actual_weight_kg numeric(12,3) not null default 0 check (actual_weight_kg >= 0),
  volume_cbm numeric(12,4) not null default 0 check (volume_cbm >= 0),
  volume_weight_kg numeric(12,3) generated always as (round(volume_cbm * 250, 3)) stored,
  chargeable_weight_kg numeric(12,3) generated always as (greatest(actual_weight_kg, round(volume_cbm * 250, 3))) stored,
  estimated_price_cny numeric(14,2) generated always as (round(greatest(actual_weight_kg, round(volume_cbm * 250, 3)) * 7.75, 2)) stored,
  estimated_price_vnd numeric(18,0) generated always as (round(greatest(actual_weight_kg, round(volume_cbm * 250, 3)) * 7.75 * 3950, 0)) stored,
  convert_to_vnd boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  final_price_cny numeric(14,2) check (final_price_cny is null or final_price_cny > 0),
  final_price_vnd numeric(18,0) generated always as (case when final_price_cny is null then null else round(final_price_cny * 3950, 0) end) stored,
  admin_note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_quotes_has_weight check (actual_weight_kg > 0 or volume_cbm > 0),
  constraint customer_quotes_approval_consistency check (
    (status = 'pending' and final_price_cny is null and approved_by is null and approved_at is null)
    or
    (status = 'approved' and final_price_cny is not null and approved_by is not null and approved_at is not null)
  )
);

create index if not exists customer_quotes_user_created_idx on public.customer_quotes (user_id, created_at desc);
create index if not exists customer_quotes_status_created_idx on public.customer_quotes (status, created_at desc);

alter table public.customer_quotes enable row level security;
revoke all on table public.customer_quotes from public, anon, authenticated;
grant select, insert, update on table public.customer_quotes to authenticated;

drop policy if exists "customers and admins read Hunda quotes" on public.customer_quotes;
create policy "customers and admins read Hunda quotes"
on public.customer_quotes for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_hunda_admin()));

drop policy if exists "customers submit own Hunda quotes" on public.customer_quotes;
create policy "customers submit own Hunda quotes"
on public.customer_quotes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and ((select private.is_hunda_customer()) or (select private.is_hunda_admin()))
  and status = 'pending'
  and final_price_cny is null
  and approved_by is null
  and approved_at is null
);

drop policy if exists "admins finalize Hunda quotes" on public.customer_quotes;
create policy "admins finalize Hunda quotes"
on public.customer_quotes for update to authenticated
using ((select private.is_hunda_admin()))
with check ((select private.is_hunda_admin()));

drop trigger if exists activity_customer_quotes on public.customer_quotes;
create trigger activity_customer_quotes
after insert or update on public.customer_quotes
for each row execute function private.capture_activity();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customer_quotes'
     ) then
    alter publication supabase_realtime add table public.customer_quotes;
  end if;
end $$;