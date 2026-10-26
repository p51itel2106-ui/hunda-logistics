import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function secureEquals(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);
  const secret = Deno.env.get("SEPAY_WEBHOOK_API_KEY") || "";
  if (!secret) return json({ success: false, error: "Webhook authentication is not configured." }, 503);
  const authorization = req.headers.get("Authorization") || "";
  const supplied = authorization.match(/^Apikey\\s+(.+)$/i)?.[1] || "";
  if (!supplied || !secureEquals(supplied, secret)) return json({ success: false, error: "Unauthorized." }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) return json({ success: false, error: "Server is not configured." }, 500);

  try {
    const raw = await req.text();
    if (raw.length > 32_000) return json({ success: false, error: "Payload too large." }, 413);
    const payload = JSON.parse(raw);
    const id = String(payload?.id ?? "");
    const amount = Number(payload?.transferAmount);
    if (!/^\\d{1,18}$/.test(id) || !Number.isSafeInteger(amount) || amount < 0) {
      return json({ success: false, error: "Invalid transaction payload." }, 400);
    }

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.rpc("hunda_process_sepay_deposit", {
      p_provider_transaction_id: id,
      p_gateway: String(payload?.gateway || ""),
      p_account_number: String(payload?.accountNumber || ""),
      p_code: String(payload?.code || ""),
      p_content: String(payload?.content || payload?.description || ""),
      p_transfer_type: String(payload?.transferType || ""),
      p_transfer_amount: amount,
      p_reference_code: String(payload?.referenceCode || ""),
      p_payload: payload,
    });
    if (error) throw error;
    return json({ success: true, ...data }, 200);
  } catch (error) {
    console.error("SePay webhook failed:", error);
    return json({ success: false, error: "Unable to process transaction." }, 500);
  }
});
