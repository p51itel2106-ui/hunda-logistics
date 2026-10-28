-- Remove redundant legacy variants and retain one permission-scoped policy per wallet table.
drop policy if exists "users read own wallet or wallet permission admins" on public.user_wallets;
drop policy if exists "users read own wallet and admins read all" on public.user_wallets;
drop policy if exists "users read own wallet or wallet-authorized admins" on public.user_wallets;
drop policy if exists "users read own wallet history or wallet permission admins" on public.wallet_transactions;
drop policy if exists "users read own wallet history and admins read all" on public.wallet_transactions;
drop policy if exists "users read own wallet history or wallet-authorized admins" on public.wallet_transactions;

create policy "users read own wallet or wallet-authorized admins"
on public.user_wallets for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_hunda_permission('wallet')));

create policy "users read own wallet history or wallet-authorized admins"
on public.wallet_transactions for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_hunda_permission('wallet')));