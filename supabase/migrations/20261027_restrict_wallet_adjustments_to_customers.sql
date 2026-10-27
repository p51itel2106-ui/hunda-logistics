-- Restrict administrative wallet adjustments to customer accounts.
create or replace function public.hunda_admin_adjust_wallet(
 p_user_id uuid,p_operation text,p_amount bigint,p_admin_id uuid,p_note text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare wallet_balance bigint; transaction_key uuid; clean_note text:=nullif(trim(coalesce(p_note,'')),'');
begin
 if p_operation not in ('credit','debit') then raise exception 'Loại điều chỉnh số dư không hợp lệ.' using errcode='22023'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'Số tiền điều chỉnh phải lớn hơn 0.' using errcode='22023'; end if;
 if clean_note is null then raise exception 'Vui lòng ghi lý do điều chỉnh để lưu lịch sử.' using errcode='22023'; end if;
 if not exists(select 1 from public.admin_users au where au.user_id=p_admin_id and au.active=true) then raise exception 'Tài khoản không có quyền quản lý ví.' using errcode='42501'; end if;
 if not exists(select 1 from public.customer_accounts ca where ca.user_id=p_user_id) then raise exception 'Chỉ có thể điều chỉnh số dư tài khoản khách hàng.' using errcode='42501'; end if;
 select w.balance into wallet_balance from public.user_wallets w where w.user_id=p_user_id for update;
 if not found then raise exception 'Không tìm thấy ví của tài khoản.' using errcode='P0002'; end if;
 if p_operation='debit' and wallet_balance<p_amount then raise exception 'Số dư hiện tại không đủ để trừ khoản này.' using errcode='22023'; end if;
 update public.user_wallets set balance=case when p_operation='credit' then balance+p_amount else balance-p_amount end,updated_at=now() where user_id=p_user_id;
 insert into public.wallet_transactions(user_id,transaction_type,amount,status,note,admin_note,decided_by,decided_at)
 values(p_user_id,case when p_operation='credit' then 'admin_credit' else 'admin_debit' end,p_amount,'approved',clean_note,clean_note,p_admin_id,now()) returning id into transaction_key;
 return transaction_key;
end $$;
revoke all on function public.hunda_admin_adjust_wallet(uuid,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.hunda_admin_adjust_wallet(uuid,text,bigint,uuid,text) to service_role;
