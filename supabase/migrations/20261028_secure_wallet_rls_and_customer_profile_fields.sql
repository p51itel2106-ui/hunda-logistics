-- Close the direct REST/RLS path that allowed any active admin to read all wallet data.
drop policy if exists "users read own wallet and admins read all" on public.user_wallets;
create policy "users read own wallet or wallet-authorized admins"
on public.user_wallets for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_hunda_permission('wallet'))
);

drop policy if exists "users read own wallet history and admins read all" on public.wallet_transactions;
create policy "users read own wallet history or wallet-authorized admins"
on public.wallet_transactions for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_hunda_permission('wallet'))
);

-- Keep the account identifier immutable to customers even if UPDATE grants change later.
create or replace function private.prevent_customer_id_self_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and old.user_id = auth.uid()
     and not private.has_hunda_permission('accounts')
     and new.customer_id is distinct from old.customer_id then
    raise exception 'customer_id cannot be changed by the account owner'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_customer_id_self_change() from public, anon, authenticated;
drop trigger if exists prevent_customer_id_self_change on public.customer_accounts;
create trigger prevent_customer_id_self_change
before update on public.customer_accounts
for each row execute function private.prevent_customer_id_self_change();
