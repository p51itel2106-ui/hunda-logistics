import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, private",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Phương thức không được hỗ trợ." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) return json({ error: "Vui lòng đăng nhập lại." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !publicKey || !serviceKey) {
    console.error("Missing required Supabase Edge Function environment variables.");
    return json({ error: "Chức năng cấp tài khoản chưa được cấu hình trên máy chủ." }, 500);
  }

  const authClient = createClient(supabaseUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);

    const body = await req.json();
    if (body?.action === "check-access") {
      const [{ data: adminRow, error: adminCheckError }, { data: profileRow, error: profileCheckError }] = await Promise.all([
        adminClient.from("admin_users").select("active").eq("user_id", user.id).maybeSingle(),
        adminClient.from("customer_accounts").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (adminCheckError) throw adminCheckError;
      if (profileCheckError) throw profileCheckError;
      const { data: authInfo, error: authInfoError } = await adminClient.auth.admin.getUserById(user.id);
      if (authInfoError) throw authInfoError;
      const isLocked = Boolean(authInfo.user?.banned_until) || (adminRow ? adminRow.active !== true : !profileRow);
      return json({ allowed: !isLocked, suspended: isLocked });
    }

    const { data: membership, error: membershipError } = await adminClient
      .from("admin_users")
      .select("user_id,permissions")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Bạn không có quyền quản lý tài khoản." }, 403);
    const grantedPermissions = membership.permissions || {};
    if (grantedPermissions.accounts !== true) return json({ error: "Bạn chưa được cấp quyền quản lý tài khoản." }, 403);
    if (body?.action === "list") {
      const [{ data: adminRows, error: adminError }, { data: profileRows, error: profileError }, walletResult, { data: usersResult, error: usersError }] = await Promise.all([
        adminClient.from("admin_users").select("user_id,email,active,permissions,created_at"),
        adminClient.from("customer_accounts").select("user_id,customer_id,full_name,phone,billing_company,created_at"),
        grantedPermissions.wallet === true
          ? adminClient.from("user_wallets").select("user_id,balance")
          : Promise.resolve({ data: [], error: null }),
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      if (adminError) throw adminError;
      if (profileError) throw profileError;
      if (walletResult.error) throw walletResult.error;
      if (usersError) throw usersError;
      const walletRows = walletResult.data || [];

      const admins = new Map((adminRows || []).map((row) => [row.user_id, row]));
      const profiles = new Map((profileRows || []).map((row) => [row.user_id, row]));
      const wallets = new Map((walletRows || []).map((row) => [row.user_id, row]));
      const accounts = (usersResult?.users || [])
        .filter((authUser) => admins.has(authUser.id) || profiles.has(authUser.id))
        .map((authUser) => {
          const admin = admins.get(authUser.id);
          const profile = profiles.get(authUser.id);
          return {
            user_id: authUser.id,
            email: authUser.email || admin?.email || "",
            full_name: profile?.full_name || authUser.user_metadata?.full_name || "",
            phone: profile?.phone || authUser.user_metadata?.phone || "",
            company: profile?.billing_company || authUser.user_metadata?.billing_company || "",
            role: admin ? "admin" : "customer",
            permissions: admin?.permissions || {},
            ...(grantedPermissions.wallet === true ? { balance: Number(wallets.get(authUser.id)?.balance || 0) } : {}),
            active: admin ? admin.active && !authUser.banned_until : !authUser.banned_until,
            email_confirmed: Boolean(authUser.email_confirmed_at),
            created_at: authUser.created_at,
          };
        })
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return json({ accounts });
    }

    if (body?.action === "set-status") {
      const targetId = String(body.user_id || "");
      const lock = body.active === false;
      if (!targetId || !["admin", "customer"].includes(body.role)) return json({ error: "Tài khoản không hợp lệ." }, 400);
      if (targetId === user.id) return json({ error: "Bạn không thể tự khóa tài khoản đang sử dụng." }, 400);
      const [{ data: targetAdmin, error: targetAdminError }, { data: targetProfile, error: targetProfileError }] = await Promise.all([
        adminClient.from("admin_users").select("user_id,active,email").eq("user_id", targetId).maybeSingle(),
        adminClient.from("customer_accounts").select("user_id,full_name").eq("user_id", targetId).maybeSingle(),
      ]);
      if (targetAdminError) throw targetAdminError;
      if (targetProfileError) throw targetProfileError;
      if (body.role === "admin" && !targetAdmin) return json({ error: "Không tìm thấy tài khoản quản trị." }, 404);
      if (body.role === "customer" && !targetProfile) return json({ error: "Không tìm thấy tài khoản khách hàng." }, 404);
      const { data: targetAuth, error: targetAuthError } = await adminClient.auth.admin.getUserById(targetId);
      if (targetAuthError || !targetAuth.user) return json({ error: "Không tìm thấy tài khoản đăng nhập." }, 404);
      const { error: banError } = await adminClient.auth.admin.updateUserById(targetId, { ban_duration: lock ? "876000h" : "none" });
      if (banError) throw banError;
      if (targetAdmin) {
        const { error: updateAdminError } = await adminClient.from("admin_users").update({ active: !lock }).eq("user_id", targetId);
        if (updateAdminError) throw updateAdminError;
      }
      const { error: auditError } = await adminClient.from("activity_log").insert({
        actor_id: user.id,
        actor_email: user.email || "",
        actor_role: "admin",
        action: "UPDATE",
        entity_type: "account",
        record_id: targetId,
        record_label: targetAuth.user.email || targetProfile?.full_name || targetAdmin?.email || targetId,
        changed_fields: [lock ? "account_locked" : "account_unlocked"],
      });
      if (auditError) throw auditError;
      return json({ success: true, user_id: targetId, active: !lock });
    }

    if (body?.action !== "create") return json({ error: "Thao tác không hợp lệ." }, 400);
    const account = body.account || {};
    const email = String(account.email || "").trim().toLowerCase();
    const fullName = String(account.full_name || "").trim();
    const phone = String(account.phone || "").trim();
    const company = String(account.company || "").trim();
    const password = String(account.password || "");
    const role = account.role;
    const permissionKeys = ["dashboard", "orders", "customers", "transactions", "reports", "documents", "quotes", "activity", "accounts", "wallet", "security"];
    // A delegated administrator may only grant permissions they personally hold.
    // This prevents an accounts-only operator from escalating a new account to wallet/security access.
    const permissions = role === "admin"
      ? Object.fromEntries(permissionKeys.map((key) => [key, grantedPermissions[key] === true && account.permissions?.[key] === true]))
      : {};

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return json({ error: "Email chưa đúng định dạng." }, 400);
    if (!fullName) return json({ error: "Vui lòng nhập họ và tên." }, 400);
    if (!["customer", "admin"].includes(role)) return json({ error: "Vai trò không hợp lệ." }, 400);
    if (password.length < 8) return json({ error: "Mật khẩu khởi tạo cần ít nhất 8 ký tự." }, 400);
    if (role === "admin" && !Object.values(permissions).some(Boolean)) return json({ error: "Hãy chọn ít nhất một chức năng cho quản trị viên." }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, billing_company: company },
      app_metadata: { hunda_role: role },
    });
    if (createError) return json({ error: createError.message }, 400);
    if (!created.user) return json({ error: "Máy chủ không trả về tài khoản mới." }, 500);

    if (role === "admin") {
      const { error: insertError } = await adminClient.from("admin_users").insert({
        user_id: created.user.id,
        email,
        active: true,
        permissions,
      });
      if (insertError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw insertError;
      }
    }

    return json({
      account: { user_id: created.user.id, email, full_name: fullName, phone, company, role, permissions, active: true },
    }, 201);
  } catch (error) {
    console.error("Hunda account management failed:", error);
    return json({ error: "Không thể hoàn tất thao tác tài khoản. Vui lòng thử lại." }, 500);
  }
});
