-- Keep elevated RPC implementations private; expose only narrow invoker wrappers.

create or replace function private.ensure_customer_workspace()
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
revoke all on function private.ensure_customer_workspace() from public, anon, authenticated;
grant execute on function private.ensure_customer_workspace() to authenticated;

create or replace function private.submit_customer_order(p_route text, p_cargo_description text default null, p_note text default null)
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
revoke all on function private.submit_customer_order(text, text, text) from public, anon, authenticated;
grant execute on function private.submit_customer_order(text, text, text) to authenticated;

drop function if exists public.ensure_customer_workspace();
create function public.ensure_customer_workspace()
returns uuid language sql security invoker set search_path = '' as $$
  select private.ensure_customer_workspace()
$$;
revoke all on function public.ensure_customer_workspace() from public, anon, authenticated;
grant execute on function public.ensure_customer_workspace() to authenticated;

drop function if exists public.submit_customer_order(text, text, text);
create function public.submit_customer_order(p_route text, p_cargo_description text default null, p_note text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.submit_customer_order(p_route, p_cargo_description, p_note)
$$;
revoke all on function public.submit_customer_order(text, text, text) from public, anon, authenticated;
grant execute on function public.submit_customer_order(text, text, text) to authenticated;

create or replace view public.customer_orders with (security_barrier = true) as
select id, code, customer_id, route, cargo_description, status, note, created_at, updated_at
from public.orders
where customer_user_id = (select auth.uid());
