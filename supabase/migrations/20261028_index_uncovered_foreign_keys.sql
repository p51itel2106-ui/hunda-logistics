-- Index foreign-key columns reported by Supabase advisors to keep joins/deletes performant as data grows.
create index if not exists orders_created_by_idx on public.orders (created_by);
create index if not exists sepay_webhook_events_wallet_transaction_id_idx on public.sepay_webhook_events (wallet_transaction_id);
create index if not exists transactions_created_by_idx on public.transactions (created_by);
create index if not exists transactions_customer_id_idx on public.transactions (customer_id);
create index if not exists wallet_transactions_decided_by_idx on public.wallet_transactions (decided_by);