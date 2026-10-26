alter table public.wallet_settings add column if not exists bank_code text not null default '';
alter table public.wallet_transactions add column if not exists transfer_code text;
alter table public.wallet_transactions add column if not exists payment_provider text;
alter table public.wallet_transactions add column if not exists provider_transaction_id bigint;

create unique index if not exists wallet_transactions_transfer_code_uidx
  on public.wallet_transactions(transfer_code) where transfer_code is not null;
create unique index if not exists wallet_transactions_provider_tx_uidx
  on public.wallet_transactions(provider_transaction_id) where provider_transaction_id is not null;

create table if not exists public.sepay_webhook_events (
  provider_transaction_id bigint primary key,
  gateway text,
  account_number text,
  payment_code text,
  content text,
  transfer_type text,
  transfer_amount bigint,
  reference_code text,
  payload jsonb not null default '{}'::jsonb,
  outcome text not null default 'received',
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.sepay_webhook_events enable row level security;
revoke all on public.sepay_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on public.sepay_webhook_events to service_role;

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
set search_path = ''
as $$
declare
  wallet_balance bigint;
  transaction_key uuid;
  payment_code text;
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
$$;
revoke all on function public.hunda_request_wallet_transaction(uuid, text, bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.hunda_request_wallet_transaction(uuid, text, bigint, text, text, text, text) to service_role;

create or replace function public.hunda_process_sepay_deposit(
  p_provider_transaction_id bigint,
  p_gateway text,
  p_account_number text,
  p_code text,
  p_content text,
  p_transfer_type text,
  p_transfer_amount bigint,
  p_reference_code text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id bigint;
  transaction_row public.wallet_transactions%rowtype;
  expected_account text;
  matched_code text;
  result jsonb;
begin
  if p_provider_transaction_id is null or p_provider_transaction_id <= 0 then
    raise exception 'Mã giao dịch SePay không hợp lệ.';
  end if;

  insert into public.sepay_webhook_events (
    provider_transaction_id, gateway, account_number, payment_code, content,
    transfer_type, transfer_amount, reference_code, payload
  ) values (
    p_provider_transaction_id, left(coalesce(p_gateway, ''), 120),
    left(coalesce(p_account_number, ''), 120), left(coalesce(p_code, ''), 160),
    left(coalesce(p_content, ''), 2000), left(coalesce(p_transfer_type, ''), 20),
    p_transfer_amount, left(coalesce(p_reference_code, ''), 160), coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider_transaction_id) do nothing
  returning provider_transaction_id into inserted_id;

  if inserted_id is null then
    return jsonb_build_object('success', true, 'duplicate', true);
  end if;

  select regexp_replace(coalesce(bank_account, ''), '\D', '', 'g')
  into expected_account
  from public.wallet_settings where id = 1;

  if coalesce(p_transfer_type, '') <> 'in'
     or coalesce(p_transfer_amount, 0) <= 0
     or regexp_replace(coalesce(p_account_number, ''), '\D', '', 'g') <> coalesce(expected_account, '') then
    update public.sepay_webhook_events set outcome = 'unmatched', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return jsonb_build_object('success', true, 'matched', false);
  end if;

  select wt.transfer_code into matched_code
  from public.wallet_transactions as wt
  where wt.transaction_type = 'deposit'
    and wt.status = 'pending'
    and wt.amount = p_transfer_amount
    and (
      wt.transfer_code = nullif(trim(coalesce(p_code, '')), '')
      or position(wt.transfer_code in upper(coalesce(p_content, ''))) > 0
    )
  order by wt.created_at
  limit 1
  for update;

  if matched_code is null then
    update public.sepay_webhook_events set outcome = 'unmatched', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return jsonb_build_object('success', true, 'matched', false);
  end if;

  select * into transaction_row
  from public.wallet_transactions
  where transfer_code = matched_code and status = 'pending'
  for update;

  if not found then
    update public.sepay_webhook_events set outcome = 'unmatched', processed_at = now()
    where provider_transaction_id = p_provider_transaction_id;
    return jsonb_build_object('success', true, 'matched', false);
  end if;

  update public.user_wallets
  set balance = balance + transaction_row.amount, updated_at = now()
  where user_id = transaction_row.user_id;

  update public.wallet_transactions
  set status = 'approved', payment_provider = 'sepay',
      provider_transaction_id = p_provider_transaction_id,
      decided_at = now(), updated_at = now(),
      admin_note = 'Tự động xác nhận qua SePay'
  where id = transaction_row.id;

  update public.sepay_webhook_events
  set outcome = 'credited', wallet_transaction_id = transaction_row.id, processed_at = now()
  where provider_transaction_id = p_provider_transaction_id;

  return jsonb_build_object('success', true, 'matched', true);
end;
$$;
revoke all on function public.hunda_process_sepay_deposit(bigint, text, text, text, text, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.hunda_process_sepay_deposit(bigint, text, text, text, text, text, bigint, text, jsonb) to service_role;
