-- Recognize customer spending from their wallet as finance income for the order.
alter table public.transactions drop constraint if exists transactions_source_type_check;
alter table public.transactions add constraint transactions_source_type_check
  check (source_type in ('manual','customer_withdrawal','admin_withdrawal','customer_order_payment'));

create or replace function private.submit_customer_order(
  p_quote_id uuid,
  p_route text,
  p_cargo_description text default null,
  p_note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  customer_key uuid;
  order_key uuid;
  order_code text;
  approved_amount numeric;
  wallet_balance bigint;
begin
  if current_user_id is null or not (select private.is_hunda_customer()) then
    raise exception 'Tài khoản chưa có hồ sơ khách hàng.' using errcode = '42501';
  end if;
  if nullif(trim(p_route), '') is null then raise exception 'Vui lòng nhập tuyến vận chuyển.' using errcode = '22023'; end if;
  if p_quote_id is null then raise exception 'Chọn báo giá đã được quản trị viên duyệt trước khi tạo đơn hàng.' using errcode = '22023'; end if;

  select q.final_price_vnd into approved_amount
  from public.customer_quotes q
  where q.id = p_quote_id and q.user_id = current_user_id and q.status = 'approved' and q.final_price_cny > 0;
  if not found or approved_amount is null or approved_amount <= 0 then
    raise exception 'Báo giá không tồn tại, chưa được duyệt hoặc chưa có giá VND.' using errcode = '22023';
  end if;

  select w.balance into wallet_balance from public.user_wallets w where w.user_id = current_user_id for update;
  if not found then raise exception 'Ví khách hàng chưa được khởi tạo. Vui lòng liên hệ quản trị viên.'; end if;
  if wallet_balance < approved_amount then
    raise exception 'Số dư không đủ. Bạn cần nạp thêm % để lên đơn.',
      replace(to_char(approved_amount - wallet_balance, 'FM999G999G999G999G990'), ',', '.') using errcode = 'P0001';
  end if;

  customer_key := (select private.hunda_customer_id());
  insert into public.orders(code,customer_id,customer_user_id,quote_id,route,cargo_description,amount,expected_cost,status,note,created_by)
  values(
    'HND-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    customer_key,current_user_id,p_quote_id,trim(p_route),nullif(trim(p_cargo_description),''),approved_amount,0,'new',nullif(trim(p_note),''),current_user_id
  ) returning id,code into order_key,order_code;

  update public.user_wallets set balance=balance-approved_amount::bigint,updated_at=now() where user_id=current_user_id;
  insert into public.wallet_transactions(user_id,transaction_type,amount,status,note,order_id,decided_at)
  values(current_user_id,'order_payment',approved_amount::bigint,'approved','Thanh toán báo giá '||left(p_quote_id::text,8),order_key,now());

  insert into public.transactions(direction,category,amount,transaction_date,status,method,customer_id,order_id,reference,note,created_by,source_type)
  values('income','Thanh toán đơn hàng',approved_amount,current_date,'paid','Ví khách hàng',customer_key,order_key,order_code,'Khách hàng thanh toán đơn hàng '||order_code||' bằng số dư ví',current_user_id,'customer_order_payment');
  return order_key;
end
$$;
revoke all on function private.submit_customer_order(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.submit_customer_order(uuid,text,text,text) to authenticated;

-- Backfill revenue rows for any order wallet debits already recorded.
insert into public.transactions(direction,category,amount,transaction_date,status,method,customer_id,order_id,reference,note,created_by,source_type,wallet_transaction_id)
select 'income','Thanh toán đơn hàng',wt.amount,coalesce((wt.decided_at at time zone 'Asia/Ho_Chi_Minh')::date,wt.created_at::date),
 'paid','Ví khách hàng',o.customer_id,o.id,o.code,'Khách hàng thanh toán đơn hàng '||o.code||' bằng số dư ví',
 wt.user_id,'customer_order_payment',wt.id
from public.wallet_transactions wt join public.orders o on o.id=wt.order_id
where wt.transaction_type='order_payment' and wt.status='approved'
and not exists(select 1 from public.transactions t where t.wallet_transaction_id=wt.id);

notify pgrst,'reload schema';
