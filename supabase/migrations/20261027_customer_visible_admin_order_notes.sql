-- Give admins a separate order note and return it through the signed-in customer's order RPC.
alter table public.orders add column if not exists admin_note text;
drop function if exists public.get_customer_orders();
drop function if exists private.get_customer_orders();
create function private.get_customer_orders()
returns table (
 id uuid,code text,customer_id uuid,route text,cargo_description text,
 status text,note text,admin_note text,created_at timestamptz,updated_at timestamptz,
 quote_id uuid,quote_final_price_cny numeric,quote_final_price_vnd numeric
)
language sql stable security definer set search_path='' as $$
 select o.id,o.code,o.customer_id,o.route,o.cargo_description,o.status,o.note,o.admin_note,o.created_at,o.updated_at,o.quote_id,q.final_price_cny,q.final_price_vnd
 from public.orders o left join public.customer_quotes q on q.id=o.quote_id and q.user_id=(select auth.uid()) and q.status='approved'
 where (select auth.uid()) is not null and (select private.is_hunda_customer()) and o.customer_user_id=(select auth.uid())
$$;
revoke all on function private.get_customer_orders() from public,anon,authenticated;
grant execute on function private.get_customer_orders() to authenticated;
create function public.get_customer_orders()
returns table (
 id uuid,code text,customer_id uuid,route text,cargo_description text,
 status text,note text,admin_note text,created_at timestamptz,updated_at timestamptz,
 quote_id uuid,quote_final_price_cny numeric,quote_final_price_vnd numeric
)
language sql stable security invoker set search_path='' as $$
 select * from private.get_customer_orders()
$$;
revoke all on function public.get_customer_orders() from public,anon,authenticated;
grant execute on function public.get_customer_orders() to authenticated;
notify pgrst,'reload schema';
