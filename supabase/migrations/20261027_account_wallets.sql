create table if not exists public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal')),
  amount bigint not null check (
    amount > 0 and (transaction_type <> 'withdrawal' or amount >= 100000)
  ),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  bank_name text,
  bank_account text,
  bank_holder text,
  note text,
  admin_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions(user_id, created_at desc);
create index if not exists wallet_transactions_pending_idx
  on public.wallet_transactions(status, created_at desc);

create table if not exists public.wallet_settings (
  id smallint primary key check (id = 1),
  bank_name text not null default '',
  bank_account text not null default '',
  bank_holder text not null default '',
  transfer_note text not null default 'HUNDA',
  updated_at timestamptz not null default now()
);
insert into public.wallet_settings (id) values (1) on conflict (id) do nothing;

alter table public.user_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_settings enable row level security;
revoke all on public.user_wallets, public.wallet_transactions, public.wallet_settings from public, anon, authenticated;
grant select, insert, update, delete on public.user_wallets, public.wallet_transactions, public.wallet_settings to service_role;

create or replace function private.create_hunda_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_hunda_wallet() from public, anon, authenticated;

drop trigger if exists hunda_wallet_after_signup on auth.users;
create trigger hunda_wallet_after_signup
after insert on auth.users
for each row execute function private.create_hunda_wallet();

insert into public.user_wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

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
  end if;

  insert into public.wallet_transactions (
    user_id, transaction_type, amount, bank_name, bank_account, bank_holder, note
  ) values (
    p_user_id, p_type, p_amount,
    nullif(trim(coalesce(p_bank_name, '')), ''),
    nullif(trim(coalesce(p_bank_account, '')), ''),
    nullif(trim(coalesce(p_bank_holder, '')), ''),
    nullif(trim(coalesce(p_note, '')), '')
  ) returning id into transaction_key;
  return transaction_key;
end;
$$;
revoke all on function public.hunda_request_wallet_transaction(uuid, text, bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.hunda_request_wallet_transaction(uuid, text, bigint, text, text, text, text) to service_role;

create or replace function public.hunda_review_wallet_transaction(
  p_transaction_id uuid,
  p_approve boolean,
  p_admin_id uuid,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_row public.wallet_transactions%rowtype;
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
  end if;

  update public.wallet_transactions
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = p_admin_id,
      decided_at = now(),
      admin_note = nullif(trim(coalesce(p_review_note, '')), ''),
      updated_at = now()
  where id = p_transaction_id;
end;
$$;
revoke all on function public.hunda_review_wallet_transaction(uuid, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.hunda_review_wallet_transaction(uuid, boolean, uuid, text) to service_role;
