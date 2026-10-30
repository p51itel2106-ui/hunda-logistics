-- Add the product value used for the 3% purchase/service fee.
-- Keep this nullable for existing quotes: those records predate the required
-- input and must remain identifiable as incomplete instead of becoming zero.
alter table public.customer_quotes
  add column if not exists product_value_cny numeric(14,2);

alter table public.customer_quotes
  drop constraint if exists customer_quotes_product_value_cny_check,
  add constraint customer_quotes_product_value_cny_check
    check (product_value_cny is null or product_value_cny >= 0);

-- Legacy rows may stay null, but every newly submitted quote must include the
-- value. Restrict this validation to inserts so admins can still approve old
-- requests while displaying them as incomplete.
create or replace function private.require_customer_quote_product_value()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.product_value_cny is null then
    raise exception 'Giá trị đơn hàng/sản phẩm (CNY) là bắt buộc.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists require_customer_quote_product_value on public.customer_quotes;
create trigger require_customer_quote_product_value
before insert on public.customer_quotes
for each row execute function private.require_customer_quote_product_value();

-- Generated expressions are replaced so PostgreSQL and the live form share
-- the same shipping + service fee estimate. The VND conversion stays 3,950.
alter table public.customer_quotes
  drop column if exists estimated_price_cny,
  drop column if exists estimated_price_vnd;

alter table public.customer_quotes
  add column shipping_price_cny numeric(14,2)
    generated always as (round(greatest(actual_weight_kg, round(volume_cbm * 250, 3)) * 6.97, 2)) stored,
  add column purchase_service_fee_cny numeric(14,2)
    generated always as (case when product_value_cny is null then null else round(product_value_cny * 0.03, 2) end) stored,
  add column estimated_price_cny numeric(14,2)
    generated always as (
      case when product_value_cny is null then null else
        round(
          round(greatest(actual_weight_kg, round(volume_cbm * 250, 3)) * 6.97, 2)
          + round(product_value_cny * 0.03, 2),
          2
        )
      end
    ) stored,
  add column estimated_price_vnd numeric(18,0)
    generated always as (
      case when product_value_cny is null then null else
        round(
          (
            round(greatest(actual_weight_kg, round(volume_cbm * 250, 3)) * 6.97, 2)
            + round(product_value_cny * 0.03, 2)
          ) * 3950,
          0
        )
      end
    ) stored;
