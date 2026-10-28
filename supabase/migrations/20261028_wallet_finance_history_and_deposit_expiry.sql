-- Expire unpaid top-ups after five minutes and separate customer finance histories.
create extension if not exists pg_cron;

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_status_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_status_check
  check (status in ('pending', 'approved', 'rejected', 'failed'));

create index if not exists wallet_transactions_pending_deposit_deadline_idx
  on public.wallet_transactions (created_at)
  where transaction_type = 'deposit' and status = 'pending';

create or replace function private.expire_pending_wallet_deposits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare expired_count integer;
begin
  update public.wallet_transactions
  set status = 'failed',
      decided_at = now(),
      updated_at = now(),
      admin_note = 'Tự động thất bại: không nhận được xác nhận thanh toán trong 5 phút.'
  where transaction_type = 'deposit'
    and status = 'pending'
    and created_at <= now() - interval '5 minutes';

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;
revoke all on function private.expire_pending_wallet_deposits() from public, anon, authenticated;
grant execute on function private.expire_pending_wallet_deposits() to postgres;

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
    and wt.created_at > now() - interval '5 minutes'
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

do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'hunda-expire-pending-wallet-deposits';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'hunda-expire-pending-wallet-deposits',
    '10 seconds',
    'select private.expire_pending_wallet_deposits();'
  );
end;
$$;

select private.expire_pending_wallet_deposits();

