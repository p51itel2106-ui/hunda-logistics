create or replace function private.create_hunda_customer_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  customer_key uuid;
begin
  -- Admin membership is created by the trusted account-management Edge Function.
  if coalesce(new.raw_app_meta_data ->> 'hunda_role', '') = 'admin' then
    return new;
  end if;

  -- Reuse a matching CRM customer when an account is assigned to an existing contact.
  select c.id into customer_key
  from public.customers as c
  where lower(c.email) = lower(new.email)
  order by c.created_at
  limit 1;

  if customer_key is null then
    insert into public.customers (name, company, phone, email)
    values (
      coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1)),
      nullif(meta ->> 'billing_company', ''),
      nullif(meta ->> 'phone', ''),
      new.email
    )
    returning id into customer_key;
  else
    update public.customers
    set name = coalesce(nullif(meta ->> 'full_name', ''), name),
        company = coalesce(nullif(meta ->> 'billing_company', ''), company),
        phone = coalesce(nullif(meta ->> 'phone', ''), phone),
        updated_at = now()
    where id = customer_key;
  end if;

  insert into public.customer_accounts (
    user_id, customer_id, full_name, phone, billing_company,
    billing_tax_code, billing_address, billing_email
  )
  values (
    new.id, customer_key,
    coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1)),
    nullif(meta ->> 'phone', ''),
    nullif(meta ->> 'billing_company', ''),
    nullif(meta ->> 'billing_tax_code', ''),
    nullif(meta ->> 'billing_address', ''),
    nullif(meta ->> 'billing_email', '')
  );
  return new;
end;
$$;