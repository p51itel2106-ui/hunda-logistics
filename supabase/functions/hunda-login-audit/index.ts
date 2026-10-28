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
function parseAgent(ua: string) {
  const os = /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Không rõ";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Firefox\//i.test(ua) ? "Firefox" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "Không rõ";
  const device = /iPad|Tablet/i.test(ua) ? "Máy tính bảng" : /Mobile|Android|iPhone/i.test(ua) ? "Điện thoại" : ua ? "Máy tính" : "Không rõ";
  return { os, browser, device };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Phương thức không được hỗ trợ." }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token === (req.headers.get("Authorization") || "")) return json({ error: "Vui lòng đăng nhập lại." }, 401);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !service) return json({ error: "Chức năng nhật ký đăng nhập chưa được cấu hình." }, 500);
  const auth = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
    const [{ data: admin }, { data: customer }] = await Promise.all([
      db.from("admin_users").select("user_id,permissions,active").eq("user_id", user.id).maybeSingle(),
      db.from("customer_accounts").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    const role = admin?.active ? "admin" : customer ? "customer" : "unknown";
    if (role === "unknown") return json({ error: "Không tìm thấy hồ sơ tài khoản." }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.action === "list") {
      if (role !== "admin" || admin?.permissions?.security !== true) return json({ error: "Bạn chưa được cấp quyền giám sát đăng nhập." }, 403);
      const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 500);
      const { data, error: queryError } = await db.from("login_events").select("id,user_id,email,role,ip_address,user_agent,device_type,browser,os,event_type,success,occurred_at").order("occurred_at", { ascending: false }).limit(limit);
      if (queryError) throw queryError;
      return json({ events: data || [] });
    }
    if (!["login", "logout"].includes(body.action)) return json({ error: "Thao tác không hợp lệ." }, 400);
    // IP is taken only from Cloudflare's edge-provided header; arbitrary X-Forwarded-For values are not trusted.
    const ip = req.headers.get("cf-connecting-ip");
    const ua = (req.headers.get("user-agent") || "").slice(0, 1200);
    const parsed = parseAgent(ua);
    const { error: insertError } = await db.from("login_events").insert({
      user_id: user.id,
      email: user.email || "",
      role,
      ip_address: ip,
      user_agent: ua,
      device_type: parsed.device,
      browser: parsed.browser,
      os: parsed.os,
      event_type: body.action,
      success: true,
    });
    if (insertError) throw insertError;
    return json({ ok: true });
  } catch (e) {
    console.error("Hunda login audit error:", e);
    return json({ error: "Không thể xử lý nhật ký đăng nhập." }, 500);
  }
});
