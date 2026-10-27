-- Preserve notes previously entered by admins in the shared orders.note field.
update public.orders o
set admin_note = nullif(trim(o.note), '')
where o.admin_note is null
  and nullif(trim(o.note), '') is not null
  and exists (
    select 1 from public.activity_log a
    where a.entity_type = 'orders'
      and a.record_id = o.id::text
      and a.actor_role = 'admin'
      and 'note' = any(a.changed_fields)
  );
