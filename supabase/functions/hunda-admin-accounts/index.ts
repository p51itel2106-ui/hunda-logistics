import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
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

    const { data: membership, error: membershipError } = await adminClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Bạn không có quyền cấp tài khoản." }, 403);

    const body = await req.json();
    if (body?.action === "list") {
      const [{ data: adminRows, error: adminError }, { data: profileRows, error: profileError }, { data: usersResult, error: usersError }] = await Promise.all([
        adminClient.from("admin_users").select("user_id,email,active,created_at"),
        adminClient.from("customer_accounts").select("user_id,customer_id,full_name,phone,billing_company,created_at"),
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      if (adminError) throw adminError;
      if (profileError) throw profileError;
      if (usersError) throw usersError;

      const admins = new Map((adminRows || []).map((row) => [row.user_id, row]));
      const profiles = new Map((profileRows || []).map((row) => [row.user_id, row]));
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
            active: admin ? admin.active && !authUser.banned_until : !authUser.banned_until,
            email_confirmed: Boolean(authUser.email_confirmed_at),
            created_at: authUser.created_at,
          };
        })
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return json({ accounts });
    }

    if (body?.action !== "create") return json({ error: "Thao tác không hợp lệ." }, 400);
    const account = body.account || {};
    const email = String(account.email || "").trim().toLowerCase();
    const fullName = String(account.full_name || "").trim();
    const phone = String(account.phone || "").trim();
    const company = String(account.company || "").trim();
    const password = String(account.password || "");
    const role = account.role;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email chưa đúng định dạng." }, 400);
    if (!fullName) return json({ error: "Vui lòng nhập họ và tên." }, 400);
    if (!["customer", "admin"].includes(role)) return json({ error: "Vai trò không hợp lệ." }, 400);
    if (password.length < 8) return json({ error: "Mật khẩu khởi tạo cần ít nhất 8 ký tự." }, 400);

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
      });
      if (insertError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw insertError;
      }
    }

    return json({
      account: { user_id: created.user.id, email, full_name: fullName, phone, company, role, active: true },
    }, 201);
  } catch (error) {
    console.error("Hunda account management failed:", error);
    return json({ error: "Không thể hoàn tất thao tác tài khoản. Vui lòng thử lại." }, 500);
  }
});
