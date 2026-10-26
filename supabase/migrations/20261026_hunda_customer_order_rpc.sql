-- Replace the owner-privileged view with a narrow, identity-checked private RPC.
drop view if exists public.customer_orders;

create or replace function private.get_customer_orders()
returns table (
  id uuid, code text, customer_id uuid, route text, cargo_description text,
  status text, note text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select o.id, o.code, o.customer_id, o.route, o.cargo_description,
         o.status, o.note, o.created_at, o.updated_at
  from public.orders as o
  where (select auth.uid()) is not null
    and (select private.is_hunda_customer())
    and o.customer_user_id = (select auth.uid())
$$;
revoke all on function private.get_customer_orders() from public, anon, authenticated;
grant execute on function private.get_customer_orders() to authenticated;

create or replace function public.get_customer_orders()
returns table (
  id uuid, code text, customer_id uuid, route text, cargo_description text,
  status text, note text, created_at timestamptz, updated_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_customer_orders()
$$;
revoke all on function public.get_customer_orders() from public, anon, authenticated;
grant execute on function public.get_customer_orders() to authenticated;

notify pgrst, 'reload schema';
