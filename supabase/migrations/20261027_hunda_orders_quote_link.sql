-- Require every customer order request to reference that customer's approved quote.
alter table public.orders
  add column if not exists quote_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_quote_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_quote_id_fkey
      foreign key (quote_id) references public.customer_quotes(id) on delete set null;
  end if;
end
$$;

create index if not exists orders_quote_id_idx on public.orders(quote_id);

-- Replace the customer order list RPC to expose only the selected approved quote's final price.
drop function if exists public.get_customer_orders();
drop function if exists private.get_customer_orders();

create function private.get_customer_orders()
returns table (
  id uuid, code text, customer_id uuid, route text, cargo_description text,
  status text, note text, created_at timestamptz, updated_at timestamptz,
  quote_id uuid, quote_final_price_cny numeric, quote_final_price_vnd numeric
)
language sql stable security definer set search_path = '' as $$
  select o.id, o.code, o.customer_id, o.route, o.cargo_description,
         o.status, o.note, o.created_at, o.updated_at,
         o.quote_id, q.final_price_cny, q.final_price_vnd
  from public.orders as o
  left join public.customer_quotes as q
    on q.id = o.quote_id
   and q.user_id = (select auth.uid())
   and q.status = 'approved'
  where (select auth.uid()) is not null
    and (select private.is_hunda_customer())
    and o.customer_user_id = (select auth.uid())
$$;
revoke all on function private.get_customer_orders() from public, anon, authenticated;
grant execute on function private.get_customer_orders() to authenticated;

create function public.get_customer_orders()
returns table (
  id uuid, code text, customer_id uuid, route text, cargo_description text,
  status text, note text, created_at timestamptz, updated_at timestamptz,
  quote_id uuid, quote_final_price_cny numeric, quote_final_price_vnd numeric
)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_customer_orders()
$$;
revoke all on function public.get_customer_orders() from public, anon, authenticated;
grant execute on function public.get_customer_orders() to authenticated;

-- Retire the old RPC signature so clients cannot create unlinked orders.
drop function if exists public.submit_customer_order(text, text, text);
drop function if exists private.submit_customer_order(text, text, text);

create function private.submit_customer_order(
  p_quote_id uuid,
  p_route text,
  p_cargo_description text default null,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  customer_key uuid;
  order_key uuid;
  approved_amount numeric;
begin
  if current_user_id is null or not (select private.is_hunda_customer()) then
    raise exception 'Tài khoản chưa có hồ sơ khách hàng.' using errcode = '42501';
  end if;
  if nullif(trim(p_route), '') is null then
    raise exception 'Vui lòng nhập tuyến vận chuyển.' using errcode = '22023';
  end if;
  if p_quote_id is null then
    raise exception 'Chọn báo giá đã được quản trị viên duyệt trước khi tạo đơn hàng.' using errcode = '22023';
  end if;

  select q.final_price_vnd into approved_amount
  from public.customer_quotes as q
  where q.id = p_quote_id
    and q.user_id = current_user_id
    and q.status = 'approved'
    and q.final_price_cny > 0;
  if not found then
    raise exception 'Báo giá không tồn tại hoặc chưa được duyệt cho tài khoản này.' using errcode = '22023';
  end if;

  customer_key := (select private.hunda_customer_id());
  insert into public.orders (
    code, customer_id, customer_user_id, quote_id, route, cargo_description,
    amount, expected_cost, status, note, created_by
  )
  values (
    'HND-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    customer_key, current_user_id, p_quote_id, trim(p_route),
    nullif(trim(p_cargo_description), ''), approved_amount, 0, 'new',
    nullif(trim(p_note), ''), current_user_id
  )
  returning id into order_key;
  return order_key;
end
$$;
revoke all on function private.submit_customer_order(uuid, text, text, text) from public, anon, authenticated;
grant execute on function private.submit_customer_order(uuid, text, text, text) to authenticated;

create function public.submit_customer_order(
  p_quote_id uuid,
  p_route text,
  p_cargo_description text default null,
  p_note text default null
)
returns uuid
language sql security invoker set search_path = '' as $$
  select private.submit_customer_order(p_quote_id, p_route, p_cargo_description, p_note)
$$;
revoke all on function public.submit_customer_order(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_customer_order(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
