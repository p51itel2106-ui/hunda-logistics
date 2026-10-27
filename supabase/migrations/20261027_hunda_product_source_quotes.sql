alter table public.customer_quotes
  add column if not exists marketplace text not null default 'other',
  add column if not exists product_url text,
  add column if not exists product_sku text,
  add column if not exists product_quantity integer not null default 1,
  add column if not exists product_image_path text,
  add column if not exists product_note text;

alter table public.customer_quotes
  drop constraint if exists customer_quotes_has_weight,
  add constraint customer_quotes_has_weight_or_product
    check (actual_weight_kg > 0 or volume_cbm > 0 or product_url is not null),
  add constraint customer_quotes_marketplace_check
    check (marketplace in ('taobao', '1688', 'other')),
  add constraint customer_quotes_product_quantity_check
    check (product_quantity > 0),
  add constraint customer_quotes_product_url_check
    check (product_url is null or (product_url ~* '^https://' and product_url !~ '[[:space:]]')),
  add constraint customer_quotes_product_image_path_check
    check (product_image_path is null or product_image_path like user_id::text || '/quotes/%');

drop policy if exists "customers read own Hunda quote images" on storage.objects;
create policy "customers read own Hunda quote images"
on storage.objects for select to authenticated
using (
  bucket_id = 'hunda-documents'
  and exists (
    select 1 from public.customer_quotes q
    where q.product_image_path = name
      and (q.user_id = (select auth.uid()) or (select private.is_hunda_admin()))
  )
);

create index if not exists customer_quotes_marketplace_created_idx
  on public.customer_quotes (marketplace, created_at desc);
