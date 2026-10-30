-- Round the shipping rate to 7 CNY per chargeable kilogram while retaining
-- the separate 3% purchase/service fee and the 3,950 VND/CNY conversion.
alter table public.customer_quotes
  drop column estimated_price_cny,
  drop column estimated_price_vnd,
  drop column shipping_price_cny;

alter table public.customer_quotes
  add column shipping_price_cny numeric(14,2)
    generated always as (round(greatest(actual_weight_kg, round(volume_cbm * 250, 3)) * 7, 2)) stored,
  add column estimated_price_cny numeric(14,2)
    generated always as (
      case when product_value_cny is null then null else
        round(
          round(greatest(actual_weight_kg, round(volume_cbm * 250, 3)) * 7, 2)
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
            round(greatest(actual_weight_kg, round(volume_cbm * 250, 3)) * 7, 2)
            + round(product_value_cny * 0.03, 2)
          ) * 3950,
          0
        )
      end
    ) stored;
