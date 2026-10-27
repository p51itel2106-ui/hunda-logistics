-- Keep wallet approval history, finance expenses and order debits synchronized.
alter table public.wallet_transactions add column if not exists order_id uuid references public.orders(id) on delete set null;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.wallet_transactions'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%transaction_type%'
 loop execute format('alter table public.wallet_transactions drop constraint %I',c.conname); end loop;
end $$;
alter table public.wallet_transactions add constraint wallet_transactions_transaction_type_check check (transaction_type in ('deposit','withdrawal','order_payment'));
create unique index if not exists wallet_transactions_order_payment_unique on public.wallet_transactions(order_id) where transaction_type='order_payment' and order_id is not null;
alter table public.transactions add column if not exists source_type text not null default 'manual', add column if not exists wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null;
do $$ begin if not exists(select 1 from pg_constraint where conname='transactions_source_type_check' and conrelid='public.transactions'::regclass) then alter table public.transactions add constraint transactions_source_type_check check(source_type in ('manual','customer_withdrawal','admin_withdrawal')); end if; end $$;
create unique index if not exists transactions_wallet_transaction_unique on public.transactions(wallet_transaction_id) where wallet_transaction_id is not null;
-- Backfill finance expenses for withdrawals approved before this change.
insert into public.transactions(direction,category,amount,transaction_date,status,method,customer_id,reference,note,created_by,source_type,wallet_transaction_id)
select 'expense','Khách hàng rút tiền',wt.amount,
       coalesce((wt.decided_at at time zone 'Asia/Ho_Chi_Minh')::date,wt.created_at::date),
       'paid','Chuyển khoản',ca.customer_id,wt.id::text,
       coalesce(nullif(trim(wt.admin_note),''),wt.note,'Rút từ ví khách hàng'),
       wt.decided_by,'customer_withdrawal',wt.id
from public.wallet_transactions wt
left join public.customer_accounts ca on ca.user_id=wt.user_id
where wt.transaction_type='withdrawal' and wt.status='approved'
  and not exists(select 1 from public.transactions t where t.wallet_transaction_id=wt.id);

create or replace function public.hunda_review_wallet_transaction(p_transaction_id uuid,p_approve boolean,p_admin_id uuid,p_review_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare transaction_row public.wallet_transactions%rowtype; customer_key uuid;
begin
 select * into transaction_row from public.wallet_transactions where id=p_transaction_id for update;
 if not found then raise exception 'Không tìm thấy yêu cầu giao dịch.'; end if;
 if transaction_row.status<>'pending' then raise exception 'Yêu cầu này đã được xử lý.'; end if;
 if transaction_row.transaction_type='deposit' and p_approve then
  update public.user_wallets set balance=balance+transaction_row.amount,updated_at=now() where user_id=transaction_row.user_id;
 elsif transaction_row.transaction_type='withdrawal' and not p_approve then
  update public.user_wallets set balance=balance+transaction_row.amount,updated_at=now() where user_id=transaction_row.user_id;
 elsif transaction_row.transaction_type='withdrawal' and p_approve then
  select ca.customer_id into customer_key from public.customer_accounts ca where ca.user_id=transaction_row.user_id;
  insert into public.transactions(direction,category,amount,transaction_date,status,method,customer_id,reference,note,created_by,source_type,wallet_transaction_id)
  values('expense','Khách hàng rút tiền',transaction_row.amount,current_date,'paid','Chuyển khoản',customer_key,transaction_row.id::text,coalesce(nullif(trim(transaction_row.admin_note),''),transaction_row.note,'Rút từ ví khách hàng'),p_admin_id,'customer_withdrawal',transaction_row.id)
  on conflict(wallet_transaction_id) where wallet_transaction_id is not null do nothing;
 end if;
 update public.wallet_transactions set status=case when p_approve then 'approved' else 'rejected' end,decided_by=p_admin_id,decided_at=now(),admin_note=nullif(trim(coalesce(p_review_note,'')),''),updated_at=now() where id=p_transaction_id;
end $$;
revoke all on function public.hunda_review_wallet_transaction(uuid,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.hunda_review_wallet_transaction(uuid,boolean,uuid,text) to service_role;
create or replace function private.submit_customer_order(p_quote_id uuid,p_route text,p_cargo_description text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid(); customer_key uuid; order_key uuid; approved_amount numeric; wallet_balance bigint; shortfall numeric;
begin
 if current_user_id is null or not(select private.is_hunda_customer()) then raise exception 'Tài khoản chưa có hồ sơ khách hàng.' using errcode='42501'; end if;
 if nullif(trim(p_route),'') is null then raise exception 'Vui lòng nhập tuyến vận chuyển.' using errcode='22023'; end if;
 if p_quote_id is null then raise exception 'Chọn báo giá đã được quản trị viên duyệt trước khi tạo đơn hàng.' using errcode='22023'; end if;
 select q.final_price_vnd into approved_amount from public.customer_quotes q where q.id=p_quote_id and q.user_id=current_user_id and q.status='approved' and q.final_price_cny>0;
 if not found or approved_amount is null or approved_amount<=0 then raise exception 'Báo giá không tồn tại, chưa được duyệt hoặc chưa có giá VND.' using errcode='22023'; end if;
 select w.balance into wallet_balance from public.user_wallets w where w.user_id=current_user_id for update;
 if not found then raise exception 'Ví khách hàng chưa được khởi tạo. Vui lòng liên hệ quản trị viên.'; end if;
 if wallet_balance<approved_amount then
  shortfall:=approved_amount-wallet_balance;
  raise exception 'Số dư không đủ. Bạn cần nạp thêm % để lên đơn.',to_char(shortfall,'FM999G999G999G999G990') using errcode='P0001';
 end if;
 customer_key:=(select private.hunda_customer_id());
 insert into public.orders(code,customer_id,customer_user_id,quote_id,route,cargo_description,amount,expected_cost,status,note,created_by)
 values('HND-'||to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),customer_key,current_user_id,p_quote_id,trim(p_route),nullif(trim(p_cargo_description),''),approved_amount,0,'new',nullif(trim(p_note),''),current_user_id)
 returning id into order_key;
 update public.user_wallets set balance=balance-approved_amount::bigint,updated_at=now() where user_id=current_user_id;
 insert into public.wallet_transactions(user_id,transaction_type,amount,status,note,order_id,decided_at)
 values(current_user_id,'order_payment',approved_amount::bigint,'approved','Thanh toán báo giá '||left(p_quote_id::text,8),order_key,now());
 return order_key;
end $$;
revoke all on function private.submit_customer_order(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.submit_customer_order(uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
