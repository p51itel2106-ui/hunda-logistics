grant select on public.user_wallets, public.wallet_transactions, public.wallet_settings to authenticated;

drop policy if exists "users read own wallet and admins read all" on public.user_wallets;
create policy "users read own wallet and admins read all"
on public.user_wallets for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_hunda_admin()));

drop policy if exists "users read own wallet history and admins read all" on public.wallet_transactions;
create policy "users read own wallet history and admins read all"
on public.wallet_transactions for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_hunda_admin()));

drop policy if exists "signed-in users read transfer instructions" on public.wallet_settings;
create policy "signed-in users read transfer instructions"
on public.wallet_settings for select to authenticated
using (true);