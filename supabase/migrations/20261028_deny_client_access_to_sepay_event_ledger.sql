-- Defense in depth: the SePay event ledger is service-role-only.
-- Keep direct client access denied even if table grants or permissive policies are accidentally added later.
drop policy if exists "deny direct client access to SePay webhook events" on public.sepay_webhook_events;
create policy "deny direct client access to SePay webhook events"
on public.sepay_webhook_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);