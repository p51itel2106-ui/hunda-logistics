import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Phương thức không được hỗ trợ." }, 405);
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) return json({ error: "Vui lòng đăng nhập lại." }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !publicKey || !serviceKey) return json({ error: "Chức năng ví chưa được cấu hình trên máy chủ." }, 500);

  const authClient = createClient(url, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
    const body = await req.json();
    const action = body?.action;

    const requireAdmin = async () => {
      const { data, error } = await adminClient.from("admin_users").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    };

    if (action === "snapshot") {
      const [{ data: wallet, error: walletError }, { data: transactions, error: transactionError }, { data: bank, error: bankError }] = await Promise.all([
        adminClient.from("user_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
        adminClient.from("wallet_transactions").select("id,transaction_type,amount,status,bank_name,bank_account,bank_holder,note,admin_note,created_at,decided_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        adminClient.from("wallet_settings").select("bank_name,bank_code,bank_account,bank_holder,transfer_note").eq("id", 1).maybeSingle(),
      ]);
      if (walletError) throw walletError;
      if (transactionError) throw transactionError;
      if (bankError) throw bankError;
      return json({ balance: Number(wallet?.balance || 0), transactions: transactions || [], bank: bank || null });
    }

    if (action === "request") {
      const transactionType = body?.transaction_type;
      const amount = Number(body?.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0) return json({ error: "Số tiền phải là số nguyên lớn hơn 0." }, 400);
      if (!["deposit", "withdrawal"].includes(transactionType)) return json({ error: "Loại giao dịch không hợp lệ." }, 400);
      if (transactionType === "withdrawal" && amount < 100000) return json({ error: "Mỗi lần rút tối thiểu 100.000đ." }, 400);

      if (transactionType === "deposit") {
        const { data: bank, error } = await adminClient.from("wallet_settings").select("bank_name,bank_code,bank_account,bank_holder").eq("id", 1).maybeSingle();
        if (error) throw error;
        if (!bank?.bank_name || !bank?.bank_code || !bank?.bank_account || !bank?.bank_holder) {
          return json({ error: "Tài khoản ngân hàng nhận tiền chưa được quản trị viên cấu hình." }, 409);
        }
      }
      if (transactionType === "withdrawal" && (!String(body?.bank_name || "").trim() || !String(body?.bank_account || "").trim() || !String(body?.bank_holder || "").trim())) {
        return json({ error: "Vui lòng nhập đầy đủ ngân hàng, số tài khoản và tên chủ tài khoản nhận tiền." }, 400);
      }
      const { data: transactionId, error } = await adminClient.rpc("hunda_request_wallet_transaction", {
        p_user_id: user.id,
        p_type: transactionType,
        p_amount: amount,
        p_bank_name: transactionType === "withdrawal" ? body.bank_name : null,
        p_bank_account: transactionType === "withdrawal" ? body.bank_account : null,
        p_bank_holder: transactionType === "withdrawal" ? body.bank_holder : null,
        p_note: transactionType === "deposit" ? null : body.note || null,
      });
      if (error) return json({ error: error.message }, 400);
      if (transactionType === "deposit") {
        const [{ data: transaction, error: transactionError }, { data: bank, error: bankError }] = await Promise.all([
          adminClient.from("wallet_transactions").select("transfer_code").eq("id", transactionId).single(),
          adminClient.from("wallet_settings").select("bank_name,bank_code,bank_account,bank_holder").eq("id", 1).single(),
        ]);
        if (transactionError) throw transactionError;
        if (bankError) throw bankError;
        const params = new URLSearchParams({
          acc: bank.bank_account,
          bank: bank.bank_code,
          amount: String(amount),
          des: transaction.transfer_code,
          template: "compact",
          showinfo: "true",
          fullacc: "true",
          holder: bank.bank_holder,
        });
        return json({ transaction_id: transactionId, amount, transfer_code: transaction.transfer_code, qr_url: "https://vietqr.app/img?" + params.toString(), bank }, 201);
      }
      return json({ transaction_id: transactionId }, 201);
    }

    if (!await requireAdmin()) return json({ error: "Bạn không có quyền quản lý ví." }, 403);

    if (action === "admin-list") {
      const [{ data: requests, error: requestsError }, { data: bank, error: bankError }, { data: usersResult, error: usersError }, { data: profiles, error: profilesError }] = await Promise.all([
        adminClient.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(200),
        adminClient.from("wallet_settings").select("bank_name,bank_code,bank_account,bank_holder,transfer_note").eq("id", 1).maybeSingle(),
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        adminClient.from("customer_accounts").select("user_id,full_name"),
      ]);
      if (requestsError) throw requestsError;
      if (bankError) throw bankError;
      if (usersError) throw usersError;
      if (profilesError) throw profilesError;
      const authUsers = new Map((usersResult?.users || []).map((item) => [item.id, item]));
      const emails = new Map((usersResult?.users || []).map((item) => [item.id, item.email || ""]));
      const names = new Map((profiles || []).map((item) => [item.user_id, item.full_name || ""]));
      return json({
        requests: (requests || []).map((item) => ({ ...item, email: emails.get(item.user_id) || "", full_name: names.get(item.user_id) || authUsers.get(item.user_id)?.user_metadata?.full_name || "", reviewer_email: item.decided_by ? emails.get(item.decided_by) || "" : "" })),
        bank: bank || { bank_name: "", bank_account: "", bank_holder: "", transfer_note: "HUNDA" },
      });
    }

    if (action === "admin-review") {
      const transactionId = String(body?.transaction_id || "");
      const approve = body?.approve === true;
      const { error } = await adminClient.rpc("hunda_review_wallet_transaction", {
        p_transaction_id: transactionId,
        p_approve: approve,
        p_admin_id: user.id,
        p_review_note: String(body?.review_note || "").trim() || null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "admin-settings") {
      const settings = {
        bank_name: String(body?.settings?.bank_name || "").trim(),
        bank_code: String(body?.settings?.bank_code || "").trim(),
        bank_account: String(body?.settings?.bank_account || "").trim(),
        bank_holder: String(body?.settings?.bank_holder || "").trim(),
        transfer_note: String(body?.settings?.transfer_note || "HUNDA").trim().slice(0, 80),
        updated_at: new Date().toISOString(),
      };
      const { error } = await adminClient.from("wallet_settings").upsert({ id: 1, ...settings }, { onConflict: "id" });
      if (error) throw error;
      return json({ bank: settings });
    }
    return json({ error: "Thao tác không hợp lệ." }, 400);
  } catch (error) {
    console.error("Hunda wallet request failed:", error);
    return json({ error: "Không thể hoàn tất thao tác ví. Vui lòng thử lại." }, 500);
  }
});
