with numbered_withdrawals as (
  select
    id,
    'TXHD' || to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'DDMMYYHH24MISS') as base_code,
    row_number() over (
      partition by to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'DDMMYYHH24MISS')
      order by created_at, id
    ) as sequence_number
  from public.wallet_transactions
  where transaction_type = 'withdrawal' and transfer_code is null
)
update public.wallet_transactions as wt
set transfer_code = numbered_withdrawals.base_code ||
  case when numbered_withdrawals.sequence_number = 1 then ''
       else '-' || lpad(numbered_withdrawals.sequence_number::text, 2, '0') end
from numbered_withdrawals
where wt.id = numbered_withdrawals.id;

update public.transactions as t
set reference = wt.transfer_code
from public.wallet_transactions as wt
where t.wallet_transaction_id = wt.id
  and wt.transaction_type = 'withdrawal'
  and wt.transfer_code is not null
  and t.reference is distinct from wt.transfer_code;

create or replace function public.hunda_request_wallet_transaction(
  p_user_id uuid,
  p_type text,
  p_amount bigint,
  p_bank_name text default null,
  p_bank_account text default null,
  p_bank_holder text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  wallet_balance bigint;
  transaction_key uuid;
  payment_code text;
  base_code text;
  code_suffix integer := 0;
  local_transaction_time timestamp without time zone;
begin
  if p_type not in ('deposit', 'withdrawal') then
    raise exception 'Loại giao dịch không hợp lệ.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Số tiền phải lớn hơn 0.';
  end if;
  if p_type = 'withdrawal' and p_amount < 100000 then
    raise exception 'Mỗi lần rút tối thiểu 100.000 VND.';
  end if;

  perform w.user_id from public.user_wallets as w where w.user_id = p_user_id for update;
  if not found then raise exception 'Tài khoản chưa có ví số dư.'; end if;

  if p_type = 'withdrawal' then
    select w.balance into wallet_balance from public.user_wallets as w where w.user_id = p_user_id;
    if wallet_balance < p_amount then raise exception 'Số dư khả dụng không đủ.'; end if;
    update public.user_wallets set balance = balance - p_amount, updated_at = now() where user_id = p_user_id;

    local_transaction_time := clock_timestamp() at time zone 'Asia/Ho_Chi_Minh';
    base_code := 'TXHD' || to_char(local_transaction_time, 'DDMMYYHH24MISS');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(base_code, 0));
    payment_code := base_code;
    while exists (select 1 from public.wallet_transactions as wt where wt.transfer_code = payment_code) loop
      code_suffix := code_suffix + 1;
      payment_code := base_code || '-' || lpad(code_suffix::text, 2, '0');
    end loop;
  else
    payment_code := 'HND' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  end if;

  insert into public.wallet_transactions (
    user_id, transaction_type, amount, bank_name, bank_account, bank_holder, note, transfer_code
  ) values (
    p_user_id, p_type, p_amount,
    nullif(trim(coalesce(p_bank_name, '')), ''),
    nullif(trim(coalesce(p_bank_account, '')), ''),
    nullif(trim(coalesce(p_bank_holder, '')), ''),
    case when p_type = 'deposit' then payment_code else nullif(trim(coalesce(p_note, '')), '') end,
    payment_code
  ) returning id into transaction_key;
  return transaction_key;
end;
$function$;

create or replace function public.hunda_review_wallet_transaction(
  p_transaction_id uuid,
  p_approve boolean,
  p_admin_id uuid,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  transaction_row public.wallet_transactions%rowtype;
  customer_key uuid;
begin
  select * into transaction_row
  from public.wallet_transactions
  where id = p_transaction_id
  for update;

  if not found then raise exception 'Không tìm thấy yêu cầu giao dịch.'; end if;
  if transaction_row.status <> 'pending' then raise exception 'Yêu cầu này đã được xử lý.'; end if;

  if transaction_row.transaction_type = 'deposit' and p_approve then
    update public.user_wallets
    set balance = balance + transaction_row.amount, updated_at = now()
    where user_id = transaction_row.user_id;
  elsif transaction_row.transaction_type = 'withdrawal' and not p_approve then
    update public.user_wallets
    set balance = balance + transaction_row.amount, updated_at = now()
    where user_id = transaction_row.user_id;
  elsif transaction_row.transaction_type = 'withdrawal' and p_approve then
    select ca.customer_id into customer_key
    from public.customer_accounts ca
    where ca.user_id = transaction_row.user_id;

    insert into public.transactions (
      direction, category, amount, transaction_date, status, method,
      customer_id, reference, note, created_by, source_type, wallet_transaction_id
    ) values (
      'expense', 'Khách hàng rút tiền', transaction_row.amount, current_date, 'paid',
      'Chuyển khoản', customer_key, coalesce(transaction_row.transfer_code, transaction_row.id::text),
      coalesce(nullif(trim(transaction_row.admin_note), ''), transaction_row.note, 'Rút từ ví khách hàng'),
      p_admin_id, 'customer_withdrawal', transaction_row.id
    )
    on conflict (wallet_transaction_id) where wallet_transaction_id is not null do nothing;
  end if;

  update public.wallet_transactions
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = p_admin_id,
      decided_at = now(),
      admin_note = nullif(trim(coalesce(p_review_note, '')), ''),
      updated_at = now()
  where id = p_transaction_id;
end;
$function$;
