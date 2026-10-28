-- Restrict quote image downloads to the quote owner or admins who have quote permission.
-- Previously any active admin could read every customer's uploaded quote image via the storage policy.
drop policy if exists "customers read own Hunda quote images" on storage.objects;
create policy "customers and quote-authorized admins read Hunda quote images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'hunda-documents'
  and exists (
    select 1
    from public.customer_quotes q
    where q.product_image_path = objects.name
      and (
        q.user_id = (select auth.uid())
        or (select private.has_hunda_permission('quotes'))
      )
  )
);