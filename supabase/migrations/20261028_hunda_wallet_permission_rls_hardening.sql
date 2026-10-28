-- Security hardening: wallet reads must honor the granular wallet permission.
-- Customers retain read access to their own wallet and wallet history.
drop policy if exists "users read own wallet and admins read all" on public.user_wallets;
create policy "users read own wallet or wallet permission admins"
on public.user_wallets for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_hunda_permission('wallet'))
);

drop policy if exists "users read own wallet history and admins read all" on public.wallet_transactions;
create policy "users read own wallet history or wallet permission admins"
on public.wallet_transactions for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_hunda_permission('wallet'))
);
