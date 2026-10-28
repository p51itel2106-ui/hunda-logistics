-- The profile editor sends PATCH requests for these fields. Grant only the editable profile columns;
-- never grant customer_id or user_id, which are protected identifiers.
grant update (full_name, phone, billing_company, billing_tax_code, billing_address, billing_email, updated_at)
on public.customer_accounts to authenticated;