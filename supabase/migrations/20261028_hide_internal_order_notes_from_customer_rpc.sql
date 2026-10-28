-- Do not expose the internal order admin_note through the customer-facing RPC.
-- The admin UI labels this field "Ghi chú nội bộ"; customers should only receive public order fields.
create or replace function private.get_customer_orders()
returns table(
  id uuid,
  code text,
  customer_id uuid,
  route text,
  cargo_description text,
  status text,
  note text,
  admin_note text,
  created_at timestamptz,
  updated_at timestamptz,
  quote_id uuid,
  quote_final_price_cny numeric,
  quote_final_price_vnd numeric
)
language sql
stable
security definer
set search_path = ''
as $function$
  select o.id, o.code, o.customer_id, o.route, o.cargo_description,
         o.status, o.note, null::text as admin_note, o.created_at, o.updated_at,
         o.quote_id, q.final_price_cny, q.final_price_vnd
  from public.orders o
  left join public.customer_quotes q
    on q.id = o.quote_id
   and q.user_id = (select auth.uid())
   and q.status = 'approved'
  where (select auth.uid()) is not null
    and (select private.is_hunda_customer())
    and o.customer_user_id = (select auth.uid())
$function$;