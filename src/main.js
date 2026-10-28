const root = document.querySelector("#app");
const cfg = window.HUNDA_CONFIG || {};
const DB_URL = String(cfg.supabaseUrl || "").replace(/\/$/, "");
const PUBLIC_KEY = cfg.publishableKey || "";
const BUCKET = "hunda-documents";
const SESSION_KEY = "hunda-auth-session";
const LAST_ACTIVITY_KEY = "hunda-last-activity";
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
let lastActivityWrite = 0;
let signOutInProgress = false;
const PERMISSION_ITEMS = [
  ["dashboard", "Tổng quan", "Xem dashboard và chỉ số tóm tắt"],
  ["orders", "Đơn hàng", "Xem, tạo, sửa, xóa và xuất dữ liệu đơn hàng"],
  ["customers", "Khách hàng", "Quản lý hồ sơ khách hàng"],
  ["transactions", "Thu chi", "Quản lý giao dịch thu và chi"],
  ["reports", "Báo cáo tài chính", "Xem báo cáo và số liệu tài chính"],
  ["documents", "Chứng từ", "Tải lên, xem và quản lý chứng từ"],
  ["quotes", "Báo giá", "Xem yêu cầu và duyệt/chốt báo giá"],
  ["activity", "Nhật ký thao tác", "Xem lịch sử thao tác hệ thống"],
  ["accounts", "Quản lý tài khoản", "Cấp tài khoản và xem danh sách tài khoản"],
  ["wallet", "Quản lý ví", "Duyệt nạp/rút và điều chỉnh số dư"],
  ["security", "Giám sát đăng nhập", "Xem IP, thiết bị và lịch sử đăng nhập tài khoản"]
];
const ALL_PERMISSIONS = Object.fromEntries(PERMISSION_ITEMS.map(([key]) => [key, true]));
const hasPermission = key => state.permissions?.[key] === true;
const requirePermission = key => { if (!hasPermission(key)) { showToast("Tài khoản của bạn chưa được cấp quyền cho chức năng này.", "error"); return false; } return true; };
const state = { page: "dashboard", loginEvents: [], workspace: "admin", isAdmin: false, permissions: {}, customerAccount: null, customerAccounts: [], managedAccounts: [], wallet: null, walletAdmin: null, walletAdminTab: "deposit", session: readSession(), user: null, customers: [], orders: [], customerOrders: [], transactions: [], transactionFilter: "all", documents: [], quotes: [], quoteImageUrls: {}, quoteDraft: { actual: "0", cbm: "0", convert: false, marketplace: "taobao", productUrl: "", productSku: "", productQuantity: "1", productNote: "", dirty: false }, activity: [], customerPage: "management", customerFinanceExpanded: true, search: "", month: new Date().toISOString().slice(0, 7), reportMode: "month", reportStart: new Date().toISOString().slice(0, 8) + "01", reportEnd: new Date().toISOString().slice(0, 10), realtime: null };

const walletPaymentTimers = new Map();

const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  box: '<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h.01M7 5V3h10v2"/>',
  chart: '<path d="M3 3v18h18M8 15l4-4 4 3 5-7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  truck: '<path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  logo: '<path d="M4 17.5V6l8 8 8-8v11.5"/><path d="M7 20h10"/>'
};
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateText = value => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "—";
const dateTime = value => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
const isoDate = () => new Date().toISOString().slice(0, 10);
const monthLabel = value => new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));

function readSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
function saveSession(session) {
  const hadSession = Boolean(state.session);
  state.session = session;
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (!hadSession && !localStorage.getItem(LAST_ACTIVITY_KEY)) localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    try { localStorage.setItem("hunda-session-signal", String(Date.now())); } catch {}
  }
}
function markUserActivity() {
  if (!state.session) return;
  const now = Date.now();
  if (now - lastActivityWrite < 15000) return;
  lastActivityWrite = now;
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(now)); } catch {}
}
async function enforceIdleTimeout() {
  if (!state.session || signOutInProgress) return;
  let last = 0;
  try { last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0); } catch {}
  if (!last) {
    try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch {}
    return;
  }
  if (Date.now() - last >= IDLE_TIMEOUT_MS) {
    await signOut();
    authShell("login", "Phiên đăng nhập đã tự động kết thúc sau 10 phút không hoạt động.");
  }
}
function headers(extra = {}) { return { apikey: PUBLIC_KEY, Authorization: `Bearer ${state.session?.access_token || PUBLIC_KEY}`, ...extra }; }
async function accountAdminRequest(payload) { return request("/functions/v1/hunda-admin-accounts", { method: "POST", body: JSON.stringify(payload) }); }
async function walletRequest(payload) { return request("/functions/v1/hunda-wallet", { method: "POST", body: JSON.stringify(payload) }); }
async function loginAuditRequest(payload) { return request("/functions/v1/hunda-login-audit", { method: "POST", body: JSON.stringify(payload) }); }
async function recordLoginEvent(action) { try { if (state.session?.access_token) await loginAuditRequest({ action }); } catch (error) { console.warn("Login audit event was not recorded:", error?.message || error); } }
async function loadWalletSnapshot() { state.wallet = await walletRequest({ action: "snapshot" }); return state.wallet; }
async function request(path, options = {}, auth = true) {
  const isBinary = typeof Blob !== "undefined" && options.body instanceof Blob;
  const response = await fetch(`${DB_URL}${path}`, { ...options, headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${auth ? state.session?.access_token || PUBLIC_KEY : PUBLIC_KEY}`, ...(options.body && !(options.body instanceof FormData) && !isBinary ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  const text = await response.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) { const message = body?.message || body?.msg || body?.error_description || body?.error || `Yêu cầu lỗi (${response.status})`; throw new Error(message); }
  return body;
}
async function refreshSession() {
  if (!state.session?.refresh_token) return false;
  try {
    const data = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: state.session.refresh_token }) }, false);
    saveSession(data); return true;
  } catch { saveSession(null); return false; }
}
async function api(path, options = {}) {
  let result;
  try { result = await request(`/rest/v1/${path}`, options); }
  catch (error) {
    if (/401|JWT|expired/i.test(error.message) && await refreshSession()) result = await request(`/rest/v1/${path}`, options);
    else throw error;
  }
  return result;
}
function showToast(message, kind = "success") {
  const host = document.querySelector("#toast-host"); if (!host) return;
  const node = document.createElement("div"); node.className = `toast ${kind}`; node.innerHTML = `${icon(kind === "error" ? "close" : "check", 16)}<span>${escapeHTML(message)}</span>`;
  host.append(node); setTimeout(() => node.remove(), 4200);
}
function fail(error) { showToast(error?.message || "Có lỗi xảy ra. Vui lòng thử lại.", "error"); }

function renderSetup() {
  root.innerHTML = `<main class="setup-page"><section class="setup-card"><img class="setup-logo" src="/assets/hunda-logo.jpg" alt="Hunda Bus Logistics" /><div class="eyebrow">HUNDA LOGISTICS</div><h1>Kết nối không gian vận hành</h1><p>Ứng dụng cần URL Supabase và publishable key để đồng bộ dữ liệu SQL và lưu chứng từ trên máy chủ.</p><div class="setup-steps"><div><b>01</b><span>Tạo Supabase project và áp dụng file <code>supabase/migrations/20261026_hunda_logistics.sql</code>.</span></div><div><b>02</b><span>Điền URL và publishable key vào <code>config.js</code>, sau đó triển khai thư mục này lên Vercel.</span></div><div><b>03</b><span>Tạo tài khoản đầu tiên rồi cấp quyền admin theo hướng dẫn trong README.</span></div></div><div class="setup-note">${icon("shield", 18)}<span>Chỉ dùng publishable key ở trình duyệt. Không dùng service role key.</span></div></section></main>`;
}

function authShell(view = "login", message = "") {
  const signup = view === "signup";
  const forgot = view === "forgot";
  const reset = view === "reset";
  const heading = signup ? "Tạo tài khoản Hunda" : forgot ? "Khôi phục mật khẩu" : reset ? "Đặt mật khẩu mới" : "Chào mừng trở lại";
  const subheading = signup ? "Thông tin công việc và xuất hóa đơn của bạn." : forgot ? "Nhập email để nhận liên kết đặt lại mật khẩu." : reset ? "Chọn mật khẩu mới cho tài khoản của bạn." : "Đăng nhập để tiếp tục công việc hôm nay.";
  const authFields = signup ? `<div class="auth-fields auth-fields-signup"><label>Họ và tên<input name="full_name" autocomplete="name" placeholder="Nguyễn Văn An" required /></label><label>Số điện thoại<input name="phone" type="tel" autocomplete="tel" placeholder="09xx xxx xxx" required /></label><label class="auth-field-wide">Tên công ty<input name="billing_company" autocomplete="organization" placeholder="Tên công ty" /></label><label class="auth-field-wide">Email công việc<input name="email" type="email" autocomplete="email" placeholder="ten@congty.vn" required /></label><label>Mật khẩu<input name="password" type="password" autocomplete="new-password" minlength="8" placeholder="Tối thiểu 8 ký tự" required /></label><label>Nhập lại mật khẩu<input name="confirm" type="password" autocomplete="new-password" minlength="8" placeholder="Nhập lại mật khẩu" required /></label></div><div class="invoice-heading"><b>Thông tin xuất hóa đơn</b><span>Có thể bổ sung hoặc chỉnh sửa sau</span></div><div class="auth-fields invoice-fields"><label>Mã số thuế<input name="billing_tax_code" placeholder="Mã số thuế" /></label><label class="auth-field-wide">Địa chỉ xuất hóa đơn<input name="billing_address" autocomplete="street-address" placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" /></label><label class="auth-field-wide">Email nhận hóa đơn<input name="billing_email" type="email" autocomplete="email" placeholder="ketoan@congty.vn" /></label></div>` : forgot ? `<label>Email công việc<input name="email" type="email" autocomplete="email" placeholder="ten@congty.vn" required /></label>` : reset ? `<label>Mật khẩu mới<input name="password" type="password" autocomplete="new-password" minlength="8" placeholder="Tối thiểu 8 ký tự" required /></label><label>Nhập lại mật khẩu<input name="confirm" type="password" autocomplete="new-password" minlength="8" placeholder="Nhập lại mật khẩu" required /></label>` : `<label>Email công việc<input name="email" type="email" autocomplete="email" placeholder="ten@congty.vn" required /></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" minlength="8" placeholder="Mật khẩu của bạn" required /></label><button class="forgot-link" type="button" data-auth-view="forgot">Quên mật khẩu?</button>`;
  const actionLabel = signup ? "Tạo tài khoản" : forgot ? "Gửi liên kết khôi phục" : reset ? "Cập nhật mật khẩu" : "Đăng nhập";
  const switchView = signup ? "login" : (forgot || reset) ? "login" : "signup";
  const switchText = signup ? "Đã có tài khoản?" : (forgot || reset) ? "Đã nhớ mật khẩu?" : "Chưa có tài khoản?";
  const switchLabel = signup || forgot || reset ? "Đăng nhập" : "Tạo tài khoản";
  const successMessage = /Nếu email thuộc|Mật khẩu đã được cập nhật|Tài khoản đã được tạo/.test(message);
  root.innerHTML = `<main class="auth-page"><div class="auth-left"><div class="auth-copy"><span class="eyebrow">VẬN HÀNH TRONG MỘT NƠI</span><h1>Giải pháp mua hàng<br><em>xuyên biên giới,<br>tiện ích tối ưu chi phí</em></h1><p>Đơn hàng, khách hàng, chứng từ và tài chính được đồng bộ an toàn trên mọi thiết bị.</p><div class="auth-proof"><span>${icon("shield", 17)} Dữ liệu riêng tư</span><span>${icon("refresh", 17)} Đồng bộ máy chủ</span></div></div><div class="auth-foot">© ${new Date().getFullYear()} Hunda Logistics</div></div><section class="auth-right"><div class="auth-brand"><img src="/assets/hunda-emblem.jpg" alt="" /><div class="auth-brand-copy"><b>HUNDA <em>BUS</em></b><small>LOGISTICS <i>×</i> E-COMMERCE</small></div></div><div class="auth-content-wrap"><div class="auth-form-wrap"><span class="eyebrow">${signup ? "TẠO TÀI KHOẢN" : reset ? "BẢO MẬT TÀI KHOẢN" : forgot ? "HỖ TRỢ ĐĂNG NHẬP" : "KHÁCH HÀNG & QUẢN TRỊ"}</span><h2>${heading}</h2><p class="muted">${subheading}</p>${message ? `<div class="form-alert ${successMessage ? "success" : ""}">${escapeHTML(message)}</div>` : ""}<form id="auth-form" data-view="${view}">${authFields}<button class="btn primary wide" type="submit">${actionLabel}${icon("arrow", 17)}</button></form><p class="auth-switch">${switchText} <button class="text-button" data-auth-view="${switchView}">${switchLabel}</button></p><div class="auth-safe">${icon("shield", 15)} Tài khoản mới vào không gian khách hàng; quyền quản trị được cấp riêng.</div></div></div></section></main><div id="toast-host" class="toast-host"></div>`;
  bindAuth();
}

function renderPending(email) {
  root.innerHTML = `<main class="setup-page"><section class="setup-card pending-card"><img class="setup-logo" src="/assets/hunda-logo.jpg" alt="Hunda Bus Logistics" /><div class="eyebrow">CHƯA CÓ HỒ SƠ</div><h1>Không tìm thấy hồ sơ truy cập</h1><p><b>${escapeHTML(email || "")}</b> chưa có hồ sơ khách hàng hoặc quyền quản trị Hunda Logistics.</p><p>Nếu đây là tài khoản mới, hãy liên hệ Hunda để kiểm tra trạng thái xác nhận email và hồ sơ đồng bộ.</p><button class="btn ghost" id="logout-pending">${icon("logout", 16)} Đăng xuất</button></section></main>`;
  document.querySelector("#logout-pending")?.addEventListener("click", signOut);
}

const pages = [
  ["dashboard", "Tổng quan", "grid"], ["orders", "Đơn hàng", "box"], ["customers", "Khách hàng", "users"], ["transactions", "Thu chi", "wallet"], ["reports", "Báo cáo tài chính", "chart"], ["documents", "Chứng từ", "file"], ["quotes", "Báo giá", "file"], ["activity", "Nhật ký thao tác", "clock"], ["security", "Giám sát đăng nhập", "shield"]
];
const pageTitles = { dashboard: ["Tổng quan", "Theo dõi hoạt động và dòng tiền của Hunda Logistics."], orders: ["Đơn hàng", "Quản lý vận chuyển từ lúc tiếp nhận đến khi hoàn tất."], customers: ["Khách hàng", "Lưu thông tin và theo dõi lịch sử hợp tác."], transactions: ["Thu chi", "Ghi nhận các khoản thu, chi và trạng thái thanh toán."], reports: ["Báo cáo tài chính", "Dòng tiền và kết quả theo các giao dịch đã xác nhận."], documents: ["Chứng từ", "Tệp đính kèm được lưu trong kho riêng tư trên máy chủ."], quotes: ["Báo giá", "Duyệt yêu cầu và chốt giá cuối cùng gửi cho khách hàng."], activity: ["Nhật ký thao tác", "Theo dõi thay đổi đơn hàng, khách hàng, thu chi và chứng từ."], security: ["Giám sát đăng nhập", "Theo dõi địa chỉ IP, thiết bị và thời điểm đăng nhập của các tài khoản."] };

function shell(content) {
  const [title, subtitle] = pageTitles[state.page];
  const visiblePages = pages.filter(([id]) => id === "customers" ? ["customers", "accounts", "wallet"].some(hasPermission) : hasPermission(id));
  root.innerHTML = `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><img class="brand-emblem" src="/assets/hunda-emblem.jpg" alt="" /><div><b>HUNDA <em>BUS</em></b><small>LOGISTICS × E-COMMERCE</small></div><button class="sidebar-close" id="close-sidebar" aria-label="Đóng menu">${icon("close", 17)}</button></div><div class="workspace"><span class="workspace-dot"></span><span><b>Hunda Logistics</b><small>Không gian quản trị</small></span>${icon("dots", 16)}</div><div class="nav-label">LÀM VIỆC</div><nav>${visiblePages.map(([id, label, ico]) => `<button class="nav-item ${state.page === id ? "active" : ""}" data-page="${id}">${icon(ico, 18)}<span>${label}</span>${id === "orders" && state.orders.filter(o => !["completed", "cancelled"].includes(o.status)).length ? `<small>${state.orders.filter(o => !["completed", "cancelled"].includes(o.status)).length}</small>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="sync-card"><span class="sync-dot"></span><div><b>Đã đồng bộ</b><small>Dữ liệu trên máy chủ</small></div>${icon("refresh", 15)}</div><div class="user-row"><span class="avatar">${escapeHTML((state.user?.email || "H").slice(0, 1).toUpperCase())}</span><span class="user-info"><b>${escapeHTML(state.user?.email || "Quản trị viên")}</b><small>Quản trị viên</small></span><button class="icon-button logout-button" id="logout" title="Đăng xuất">${icon("logout", 17)}</button></div></div></aside><div class="sidebar-scrim" id="sidebar-scrim"></div><main class="main-area"><header class="topbar"><button class="mobile-menu icon-button" id="open-sidebar">${icon("menu", 20)}</button><div class="breadcrumb">Hunda Logistics <span>/</span> <b>${title}</b></div><div class="top-actions">${state.isAdmin ? `<button class="btn ghost small" data-action="switch-customer">${icon("users", 15)} Không gian khách hàng</button>` : ""}<span class="sync-label">${icon("refresh", 15)} Đồng bộ máy chủ</span><button class="icon-button" id="refresh" title="Làm mới dữ liệu">${icon("refresh", 18)}</button><span class="top-avatar">${escapeHTML((state.user?.email || "H").slice(0, 1).toUpperCase())}</span></div></header><div class="page-content"><div class="page-heading"><div><span class="eyebrow">HUNDA LOGISTICS</span><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${pageAction()}</div></div>${content}</div></main></div><div id="modal-root"></div><div id="toast-host" class="toast-host"></div>`;
  bindShell();
}
function pageAction() {
  if (state.page === "orders") return `${hasPermission("orders") ? `<button class="btn ghost" data-action="export-orders">${icon("download", 16)} Xuất Excel (CSV)</button><button class="btn primary" data-action="new-order">${icon("plus", 17)} Tạo đơn hàng</button>` : ""}`;
  if (state.page === "customers") return `${hasPermission("customers") ? `<button class="btn ghost" data-action="new-customer">${icon("plus", 16)} Thêm khách hàng</button>` : ""}${hasPermission("accounts") ? `<button class="btn primary" data-action="new-account">${icon("users", 16)} Cấp tài khoản</button>` : ""}`;
  if (state.page === "transactions") return `${hasPermission("transactions") ? `<button class="btn primary" data-action="new-transaction">${icon("plus", 17)} Ghi nhận thu chi</button>` : ""}`;
  if (state.page === "documents") return `${hasPermission("documents") ? `<button class="btn primary" data-action="new-document">${icon("upload", 17)} Tải chứng từ</button>` : ""}`;
  if (state.page === "quotes") return hasPermission("quotes") ? '<button class="btn ghost" data-action="refresh">' + icon("refresh", 16) + ' Làm mới yêu cầu</button>' : "";
  if (state.page === "activity") return `<span class="live-badge ${state.realtimeStatus === "SUBSCRIBED" ? "connected" : ""}"><i></i>${state.realtimeStatus === "SUBSCRIBED" ? "Đang đồng bộ trực tiếp" : "Đang kết nối · làm mới dự phòng"} · UTC+7</span>`;
  if (state.page === "reports") return `<div class="report-period-control"><button class="btn ${state.reportMode === "month" ? "primary" : "ghost"}" data-action="report-month-mode">Theo tháng</button><button class="btn ${state.reportMode === "year" ? "primary" : "ghost"}" data-action="report-year-mode">Theo năm</button><button class="btn ${state.reportMode === "range" ? "primary" : "ghost"}" data-action="report-range-mode">Khoảng thời gian</button>${state.reportMode === "month" ? `<label class="month-control"><input type="month" id="report-month" value="${state.month}" /></label>` : state.reportMode === "year" ? `<label class="month-control"><input type="number" id="report-year" min="2000" max="2100" value="${Number(state.month.slice(0, 4))}" /></label>` : `<label class="month-control">Từ <input type="date" id="report-start" value="${state.reportStart}" /></label><label class="month-control">Đến <input type="date" id="report-end" value="${state.reportEnd}" /></label>`}</div>`;
  return `<button class="btn ghost" data-page="orders">${icon("box", 16)} Xem đơn hàng</button>`;
}
function bindShell() {
  document.querySelectorAll("[data-page]").forEach(el => el.addEventListener("click", () => { const target = el.dataset.page; if (target === "customers" ? !["customers","accounts","wallet"].some(hasPermission) : !hasPermission(target)) return showToast("Tài khoản của bạn chưa được cấp quyền cho mục này.", "error"); state.page = target; state.search = ""; render(); }));
  document.querySelector("#logout")?.addEventListener("click", signOut);
  document.querySelector("#refresh")?.addEventListener("click", async () => { await loadData(); render(); showToast("Dữ liệu đã được làm mới."); });
  document.querySelector("#open-sidebar")?.addEventListener("click", () => document.body.classList.add("nav-open"));
  document.querySelector("#close-sidebar")?.addEventListener("click", closeNav);
  document.querySelector("#sidebar-scrim")?.addEventListener("click", closeNav);
  document.querySelector("#report-month")?.addEventListener("change", e => { state.month = e.target.value; render(); });
  document.querySelector("#report-year")?.addEventListener("change", e => { const year = Math.min(2100, Math.max(2000, Number(e.target.value) || new Date().getFullYear())); state.month = `${year}-01`; render(); });
  document.querySelector("#report-start")?.addEventListener("change", e => { state.reportStart = e.target.value; const limit = new Date(state.reportStart + "T12:00:00"); limit.setFullYear(limit.getFullYear() + 1); const max = limit.toISOString().slice(0,10); if (state.reportEnd < state.reportStart) state.reportEnd = state.reportStart; if (state.reportEnd > max) state.reportEnd = max; render(); });
  document.querySelector("#report-end")?.addEventListener("change", e => { const limit = new Date(state.reportStart + "T12:00:00"); limit.setFullYear(limit.getFullYear() + 1); const max = limit.toISOString().slice(0,10); state.reportEnd = e.target.value < state.reportStart ? state.reportStart : e.target.value > max ? max : e.target.value; render(); });
  document.querySelector('[data-action="report-month-mode"]')?.addEventListener("click", () => { state.reportMode = "month"; render(); });
  document.querySelector('[data-action="report-year-mode"]')?.addEventListener("click", () => { state.reportMode = "year"; render(); });
  document.querySelector('[data-action="report-range-mode"]')?.addEventListener("click", () => { state.reportMode = "range"; render(); });
  document.querySelector("#transaction-source-filter")?.addEventListener("change", e => { state.transactionFilter = e.target.value; render(); });
  document.querySelector("#search")?.addEventListener("input", e => { state.search = e.target.value.toLowerCase(); const pos = e.target.selectionStart; render(); const next = document.querySelector("#search"); next?.focus(); next?.setSelectionRange(pos, pos); });
}
function closeNav() { document.body.classList.remove("nav-open"); }
function render() {
  if (state.workspace === "customer") return customerWorkspaceView();
  if (state.page === "customers" ? !["customers","accounts","wallet"].some(hasPermission) : !hasPermission(state.page)) state.page = pages.find(([id]) => hasPermission(id))?.[0] || "dashboard";
  if (state.page === "dashboard") return shell(dashboardView());
  if (state.page === "orders") return shell(ordersView());
  if (state.page === "customers") return shell(customersView());
  if (state.page === "transactions") return shell(transactionsView());
  if (state.page === "reports") return shell(reportsView());
  if (state.page === "activity") return shell(activityView());
  if (state.page === "security") return shell(securityView());
  if (state.page === "quotes") return shell(quotesView());
  return shell(documentsView());
}
function customerWorkspaceView() {
  const orders = state.customerOrders || [];
  const page = ["quotes", "management", "history", "finance-deposits", "finance-withdrawals"].includes(state.customerPage) ? state.customerPage : "management";
  state.customerPage = page;
  const active = orders.filter(o => !["completed", "cancelled"].includes(o.status)).length;
  const statusText = { new: "Đã tiếp nhận", in_progress: "Đang vận chuyển", completed: "Hoàn tất", cancelled: "Đã hủy" };
  const pageInfo = {
    quotes: ["Báo giá", "Gửi thông tin sản phẩm hoặc vận chuyển để Hunda kiểm tra và phản hồi."],
    management: ["Quản lý đơn hàng", "Theo dõi từng đơn và tải chứng từ trực tiếp vào đúng đơn hàng."],
    history: ["Lịch sử đơn hàng", "Xem riêng tiến trình và ghi chú cập nhật của Hunda."],
    "finance-deposits": ["Lịch sử nạp", "Theo dõi các lệnh nạp tiền và trạng thái xác nhận thanh toán."],
    "finance-withdrawals": ["Lịch sử rút", "Theo dõi các lệnh rút tiền và những khoản trừ từ ví."]
  }[page];
  const financeTransactionTypes = page === "finance-deposits" ? ["deposit", "admin_credit"] : ["withdrawal", "admin_debit", "order_payment"];
  const walletItems = (state.wallet?.transactions || []).filter(item => financeTransactionTypes.includes(item.transaction_type));
  const walletHistory = walletItems.map(item => {
    const label = item.transaction_type === "deposit" ? "Nạp tiền" : item.transaction_type === "withdrawal" ? "Rút tiền" : item.transaction_type === "order_payment" ? "Thanh toán đơn hàng" : item.transaction_type === "admin_credit" ? "Quản trị cộng tiền" : "Quản trị trừ tiền";
    const statusLabel = item.status === "approved" ? "Đã duyệt" : item.status === "failed" ? "Đã thất bại" : item.status === "rejected" ? "Từ chối" : "Đang chờ";
    const statusClass = item.status === "approved" ? "completed" : item.status === "pending" ? "pending" : "cancelled";
    return `<tr><td>${dateText(item.created_at)}</td><td>${label}</td><td><b>${money(item.amount)}</b></td><td><span class="pill ${statusClass}">${statusLabel}</span></td><td>${item.transfer_code ? '<b class="wallet-transfer-code">' + escapeHTML(item.transfer_code) + '</b><small class="subline">' + escapeHTML(item.admin_note || item.note || "—") + '</small>' : escapeHTML(item.admin_note || item.note || "—")}</td></tr>`;
  }).join("");
  const walletTopbar = `<div class="customer-wallet-topbar"><span>Số dư</span><b>${money(state.wallet?.balance || 0)}</b><button class="btn primary small" data-action="wallet-deposit">${icon("plus", 14)} Nạp tiền</button><button class="btn ghost small" data-action="wallet-withdraw">${icon("upload", 14)} Rút tiền</button></div>`;
  const walletPanel = `<section class="panel table-panel wallet-history"><div class="panel-heading"><div><h2>${page === "finance-deposits" ? "Lịch sử nạp" : "Lịch sử rút"}</h2><p>${page === "finance-deposits" ? "Lệnh nạp chưa được SePay xác nhận trong 5 phút sẽ tự chuyển sang thất bại." : "Theo dõi các yêu cầu rút tiền và các khoản đã trừ khỏi ví."}</p></div></div><div class="table-wrap"><table><thead><tr><th>NGÀY</th><th>LOẠI</th><th>SỐ TIỀN</th><th>TRẠNG THÁI</th><th>GHI CHÚ</th></tr></thead><tbody>${walletHistory || `<tr><td colspan="5"><div class="empty-compact">Chưa có giao dịch ${page === "finance-deposits" ? "nạp" : "rút"}.</div></td></tr>`}</tbody></table></div></section>`;
  const orderRows = orders.length ? orders.map(order => {
    const docs = state.documents.filter(d => d.order_id === order.id);
    const documentList = docs.length
      ? '<div class="customer-order-doc-list">' + docs.map(doc => '<div class="customer-order-doc"><button class="plain-link" data-action="download-document" data-id="' + escapeHTML(doc.id) + '">' + icon("file", 14) + ' ' + escapeHTML(doc.file_name) + '</button><small>' + dateText(doc.created_at) + '</small><button class="icon-button danger" data-action="delete-document" data-id="' + escapeHTML(doc.id) + '" title="Xóa tệp">' + icon("trash", 14) + '</button></div>').join("") + '</div>'
      : '<small class="subline">Chưa có chứng từ</small>';
    return '<tr><td><b class="order-code">' + escapeHTML(order.code) + '</b><small class="subline">' + dateText(order.created_at) + '</small></td><td><b>' + escapeHTML(order.route || "—") + '</b><small class="subline">' + escapeHTML(order.cargo_description || "Chưa có mô tả hàng") + '</small>' + (order.admin_note ? '<small class="subline customer-admin-note"><b>Ghi chú từ Hunda:</b> ' + escapeHTML(order.admin_note) + '</small>' : '') + (order.quote_id ? '<small class="subline">Báo giá #' + escapeHTML(String(order.quote_id).slice(0, 8).toUpperCase()) + (order.quote_final_price_cny ? " · " + quoteCurrencyCny(order.quote_final_price_cny) : "") + '</small>' : '') + '</td><td><span class="pill ' + escapeHTML(order.status) + '"><i></i>' + (statusText[order.status] || escapeHTML(order.status)) + '</span></td><td>' + documentList + '<button class="btn ghost small" data-action="order-document" data-id="' + escapeHTML(order.id) + '">' + icon("upload", 14) + ' Tải chứng từ vào đơn</button></td></tr>';
  }).join("") : '<tr><td colspan="4"><div class="empty-compact">Bạn chưa có đơn hàng. Sau khi báo giá được duyệt, hãy tạo yêu cầu lên đơn.</div></td></tr>';
  const historyRows = orders.length ? [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(order =>
    '<article class="customer-order-history-item"><div class="customer-order-history-mark">' + icon(order.status === "completed" ? "check" : "truck", 17) + '</div><div class="customer-order-history-content"><div class="customer-order-history-top"><b>' + escapeHTML(order.code) + '</b><span class="pill ' + escapeHTML(order.status) + '"><i></i>' + (statusText[order.status] || escapeHTML(order.status)) + '</span></div><p><b>' + escapeHTML(order.route || "—") + '</b> · ' + escapeHTML(order.cargo_description || "Chưa có mô tả hàng") + '</p>' + (order.admin_note ? '<div class="customer-admin-note"><b>Ghi chú từ Hunda:</b> ' + escapeHTML(order.admin_note) + '</div>' : '') + '<small>' + dateText(order.created_at) + (order.updated_at ? ' · Cập nhật ' + dateText(order.updated_at) : '') + '</small></div></article>'
  ).join("") : '<div class="empty-compact">Lịch sử đơn hàng sẽ hiển thị tại đây sau khi bạn tạo yêu cầu.</div>';
  const pageContent = page === "quotes"
    ? customerQuotesPanel()
    : page === "history"
      ? '<section class="panel customer-order-history"><div class="panel-heading"><div><h2>Tiến trình đơn hàng</h2><p>Các cập nhật trạng thái và ghi chú của Hunda được gom theo từng đơn.</p></div></div><div class="customer-order-history-list">' + historyRows + '</div></section>'
      : page.startsWith("finance-") ? walletPanel
      : '<div class="stats-grid customer-stats"><article class="stat-card"><div class="stat-top"><span>Tổng đơn hàng</span><i class="stat-icon blue">' + icon("box", 17) + '</i></div><strong>' + orders.length + '</strong><small>Đơn hàng của bạn</small></article><article class="stat-card"><div class="stat-top"><span>Đang xử lý</span><i class="stat-icon amber">' + icon("clock", 17) + '</i></div><strong>' + active + '</strong><small>Chờ tiếp nhận hoặc đang vận chuyển</small></article><article class="stat-card"><div class="stat-top"><span>Đã hoàn tất</span><i class="stat-icon green">' + icon("check", 17) + '</i></div><strong>' + orders.filter(o => o.status === "completed").length + '</strong><small>Đơn hàng hoàn tất</small></article></div>' +
        '<section class="panel table-panel customer-order-management"><div class="panel-heading"><div><h2>Đơn hàng và chứng từ</h2><p>Mỗi tệp được gắn trực tiếp vào đơn tương ứng để dễ tra cứu.</p></div><button class="btn primary small" data-action="new-customer-order">' + icon("plus", 15) + ' Tạo yêu cầu</button></div><div class="table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>TUYẾN / HÀNG HÓA</th><th>TRẠNG THÁI</th><th>CHỨNG TỪ CỦA ĐƠN</th></tr></thead><tbody>' + orderRows + '</tbody></table></div></section>';
  const navItems = [
    ["quotes", "Báo giá", "file"],
    ["management", "Quản lý đơn hàng", "box"],
    ["history", "Lịch sử đơn hàng", "clock"]
  ];
  const financeActive = page.startsWith("finance-");
  const financeExpanded = financeActive || state.customerFinanceExpanded;
  root.innerHTML = `<div class="app-shell customer-app"><aside class="sidebar"><div class="brand"><img class="brand-emblem" src="/assets/hunda-emblem.jpg" alt="" /><div><b>HUNDA <em>BUS</em></b><small>LOGISTICS × E-COMMERCE</small></div></div><div class="workspace"><span class="workspace-dot"></span><span><b>Hunda Logistics</b><small>Không gian khách hàng</small></span>${icon("dots", 16)}</div><div class="nav-label">KHÔNG GIAN KHÁCH HÀNG</div><nav>${navItems.map(([key, label, glyph]) => '<button class="nav-item ' + (page === key ? "active" : "") + '" data-customer-page="' + key + '">' + icon(glyph, 18) + '<span>' + label + '</span>' + (key === "management" && active ? '<small>' + active + '</small>' : '') + '</button>').join("")}</nav><div class="customer-nav-group"><button type="button" class="nav-item customer-nav-toggle ${financeActive ? "active" : ""}" data-customer-finance-toggle aria-expanded="${financeExpanded}">${icon("wallet", 18)}<span>Tài chính</span><span class="customer-nav-caret">${financeExpanded ? "⌄" : "›"}</span></button>${financeExpanded ? `<div class="customer-nav-children"><button type="button" class="customer-nav-child ${page === "finance-deposits" ? "active" : ""}" data-customer-page="finance-deposits">Lịch sử nạp</button><button type="button" class="customer-nav-child ${page === "finance-withdrawals" ? "active" : ""}" data-customer-page="finance-withdrawals">Lịch sử rút</button></div>` : ""}</div><div class="sidebar-bottom"><div class="sync-card"><span class="sync-dot"></span><div><b>Đã đồng bộ</b><small>Yêu cầu lên máy chủ</small></div>${icon("refresh", 15)}</div><div class="user-row"><span class="avatar">${escapeHTML((state.customerAccount?.full_name || state.user?.email || "K").slice(0, 1).toUpperCase())}</span><span class="user-info"><b>${escapeHTML(state.customerAccount?.full_name || state.user?.email || "Khách hàng")}</b><small>Khách hàng</small></span><button class="icon-button logout-button" id="logout" title="Đăng xuất">${icon("logout", 17)}</button></div></div></aside><main class="main-area"><header class="topbar"><div class="breadcrumb">Hunda Logistics <span>/</span> <b>Không gian khách hàng</b> <span>/</span> <b>${pageInfo[0]}</b></div>${walletTopbar}<div class="top-actions">${state.isAdmin ? `<button class="btn ghost small" data-action="switch-admin">${icon("shield", 15)} Trở về quản trị</button>` : ""}<span class="sync-label">${icon("refresh", 15)} Đồng bộ đơn hàng</span><button class="icon-button" id="customer-refresh" title="Làm mới">${icon("refresh", 18)}</button><button class="icon-button" id="logout-customer" title="Đăng xuất">${icon("logout", 17)}</button></div></header><div class="page-content"><div class="page-heading"><div><span class="eyebrow">CỔNG KHÁCH HÀNG</span><h1>${pageInfo[0]}</h1><p>${pageInfo[1]}</p></div>${page === "management" ? '<div class="heading-actions"><button class="btn primary" data-action="new-customer-order">' + icon("plus", 17) + ' Tạo yêu cầu đơn hàng</button></div>' : ""}</div><div class="welcome-strip"><div class="welcome-art">${icon("truck", 30)}</div><div><b>Xin chào, ${escapeHTML(state.customerAccount?.full_name || "Quý khách")}</b><span>Thông tin của bạn được đồng bộ an toàn với đội ngũ Hunda.</span></div></div>${pageContent}<p class="customer-footer-note">Thông tin được đồng bộ tự động và chuyển đến bộ phận quản trị.</p></div></main></div><div id="modal-root"></div><div id="toast-host" class="toast-host"></div>`;
  document.querySelector("#logout")?.addEventListener("click", signOut);
  document.querySelector("#logout-customer")?.addEventListener("click", signOut);
  document.querySelector("#customer-refresh")?.addEventListener("click", () => Promise.all([loadCustomerData(), loadWalletSnapshot()]).then(() => { if (!state.quoteDraft?.dirty) render(); }).catch(fail));
  document.querySelectorAll("[data-customer-page]").forEach(button => button.addEventListener("click", () => {
    state.customerPage = button.dataset.customerPage;
    render();
  }));
  document.querySelector("[data-customer-finance-toggle]")?.addEventListener("click", () => {
    state.customerFinanceExpanded = !state.customerFinanceExpanded;
    if (!state.customerFinanceExpanded && page.startsWith("finance-")) state.customerPage = "management";
    else if (state.customerFinanceExpanded && !page.startsWith("finance-")) state.customerPage = "finance-deposits";
    render();
  });
  bindCustomerQuoteForm();
}
async function loadQuoteImageUrls(quotes) {
  const entries = await Promise.all((quotes || []).filter(q => q.product_image_path).map(async q => {
    try {
      const result = await request("/storage/v1/object/sign/" + BUCKET + "/" + q.product_image_path.split("/").map(encodeURIComponent).join("/"), { method: "POST", body: JSON.stringify({ expiresIn: 3600 }) });
      const url = result.signedURL.startsWith("http") ? result.signedURL : DB_URL + "/storage/v1" + (result.signedURL.startsWith("/") ? "" : "/") + result.signedURL;
      return [q.id, url];
    } catch { return null; }
  }));
  state.quoteImageUrls = Object.fromEntries(entries.filter(Boolean));
}
async function loadCustomerData() {
  if (!state.session) return;
  const [orders, documents, quotes] = await Promise.all([
    api("rpc/get_customer_orders", { method: "POST", body: "{}" }),
    api("order_documents?select=*&order=created_at.desc"),
    api("customer_quotes?select=*&order=created_at.desc")
  ]);
  state.customerOrders = orders || [];
  state.orders = state.customerOrders;
  state.documents = documents || [];
  state.quotes = quotes || [];
  await loadQuoteImageUrls(state.quotes);
}
async function switchToAdminWorkspace() {
  state.workspace = "admin";
  try { await loadData(); render(); } catch (error) { fail(error); }
}
function currentMonthTx() { return state.transactions.filter(t => t.status === "paid" && String(t.transaction_date).slice(0, 7) === new Date().toISOString().slice(0, 7)); }
function dashboardView() {
  const tx = currentMonthTx(); const income = tx.filter(t => t.direction === "income").reduce((n, t) => n + Number(t.amount), 0); const expense = tx.filter(t => t.direction === "expense").reduce((n, t) => n + Number(t.amount), 0); const open = state.orders.filter(o => !["completed", "cancelled"].includes(o.status));
  const bars = monthlyBars(6);
  const latest = [...state.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  return `<div class="welcome-strip"><div class="welcome-art">${icon("truck", 33)}</div><div><b>Chào mừng đến Hunda Logistics</b><span>Đây là tổng quan vận hành và dòng tiền tháng ${new Intl.DateTimeFormat("vi-VN", { month: "long" }).format(new Date())}.</span></div><button class="welcome-link" data-page="reports">Xem báo cáo ${icon("arrow", 16)}</button></div><div class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Đã thu trong tháng</span><i class="stat-icon green">${icon("download", 17)}</i></div><strong>${money(income)}</strong><small>Giao dịch thu đã xác nhận</small></article><article class="stat-card"><div class="stat-top"><span>Đã chi trong tháng</span><i class="stat-icon coral">${icon("wallet", 17)}</i></div><strong>${money(expense)}</strong><small>Giao dịch chi đã xác nhận</small></article><article class="stat-card"><div class="stat-top"><span>Dòng tiền ròng</span><i class="stat-icon blue">${icon("chart", 17)}</i></div><strong class="${income - expense < 0 ? "negative" : ""}">${money(income - expense)}</strong><small>Theo thu chi đã xác nhận</small></article><article class="stat-card"><div class="stat-top"><span>Đơn đang xử lý</span><i class="stat-icon amber">${icon("box", 17)}</i></div><strong>${open.length}<small class="unit"> đơn</small></strong><small>Trên tổng ${state.orders.length} đơn hàng</small></article></div><div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Dòng tiền 6 tháng</h2><p>Thu và chi đã xác nhận · VND</p></div><button class="plain-link" data-page="reports">Báo cáo chi tiết ${icon("arrow", 15)}</button></div><div class="chart-legend"><span><i class="legend-dot income"></i>Khoản thu</span><span><i class="legend-dot expense"></i>Khoản chi</span></div><div class="bar-chart">${bars.map(b => `<div class="bar-group"><div class="bar-pair" title="Thu ${money(b.income)} · Chi ${money(b.expense)}"><i class="bar income-bar" style="height:${b.incomePct}%"></i><i class="bar expense-bar" style="height:${b.expensePct}%"></i></div><span>${b.label}</span></div>`).join("")}</div></section><section class="panel order-status-panel"><div class="panel-heading"><div><h2>Trạng thái đơn hàng</h2><p>Phân bổ hiện tại</p></div></div>${statusBreakdown()}</section></div><section class="panel table-panel"><div class="panel-heading"><div><h2>Đơn hàng gần đây</h2><p>Cập nhật mới nhất từ hệ thống</p></div><button class="plain-link" data-page="orders">Tất cả đơn hàng ${icon("arrow", 15)}</button></div>${orderTable(latest, false)}</section>`;
}
function statusBreakdown() {
  const statuses = [["new", "Mới tiếp nhận"], ["in_progress", "Đang vận chuyển"], ["completed", "Hoàn tất"], ["cancelled", "Đã hủy"]];
  return `<div class="status-breakdown">${statuses.map(([key, label]) => { const count = state.orders.filter(o => o.status === key).length; const pct = state.orders.length ? Math.round(count / state.orders.length * 100) : 0; return `<div class="status-row"><span class="status-mark ${key}"></span><span>${label}</span><b>${count}</b><div class="status-track"><i class="${key}" style="width:${pct}%"></i></div></div>`; }).join("")}</div>`;
}
function monthlyBars(count) {
  const now = new Date(); const months = Array.from({ length: count }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; const items = state.transactions.filter(t => t.status === "paid" && String(t.transaction_date).slice(0, 7) === key); return { key, label: new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(d), income: items.filter(t => t.direction === "income").reduce((n, t) => n + Number(t.amount), 0), expense: items.filter(t => t.direction === "expense").reduce((n, t) => n + Number(t.amount), 0) }; });
  const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
  return months.map(m => ({ ...m, incomePct: Math.max(m.income ? 5 : 0, Math.round(m.income / max * 100)), expensePct: Math.max(m.expense ? 5 : 0, Math.round(m.expense / max * 100)) }));
}
function toolbar(placeholder = "Tìm kiếm...") { return `<div class="table-toolbar"><label class="search-box">${icon("search", 17)}<input id="search" value="${escapeHTML(state.search)}" placeholder="${placeholder}" /></label><button class="btn ghost filter-button" data-action="refresh">${icon("refresh", 16)} Làm mới</button></div>`; }
function ordersView() {
  let rows = state.orders.filter(o => [o.code, o.cargo_description, o.route, o.customer?.name].join(" ").toLowerCase().includes(state.search));
  return `<section class="panel table-panel">${toolbar("Tìm mã đơn, khách hàng, tuyến...")}${orderTable(rows, true)}</section>`;
}

function exportOrdersToExcel() {
  const rows = state.orders.filter(o => [o.code, o.cargo_description, o.route, o.customer?.name].join(" ").toLowerCase().includes(state.search));
  if (!rows.length) { showToast("Không có đơn hàng để xuất.", "error"); return; }
  const statusLabels = { new: "Mới tiếp nhận", in_progress: "Đang vận chuyển", completed: "Hoàn tất", cancelled: "Đã hủy" };
  const columns = [
    ["Mã đơn hàng", o => o.code],
    ["Khách hàng", o => o.customer?.name || "Khách lẻ"],
    ["Tuyến vận chuyển", o => o.route || ""],
    ["Mô tả hàng hóa", o => o.cargo_description || ""],
    ["Giá trị đơn (VND)", o => Number(o.amount || 0)],
    ["Trạng thái", o => statusLabels[o.status] || o.status || ""],
    ["Số chứng từ", o => state.documents.filter(doc => doc.order_id === o.id).length],
    ["Mã báo giá", o => o.quote_id || ""],
    ["Ghi chú nội bộ", o => o.admin_note || o.note || ""],
    ["Ngày tạo", o => o.created_at ? new Date(o.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace(" ", "T") : ""],
    ["Cập nhật lần cuối", o => o.updated_at ? new Date(o.updated_at).toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace(" ", "T") : ""]
  ];
  const safeCell = value => {
    let text = value == null ? "" : String(value);
    // Prevent spreadsheet formula injection for text fields.
    if (/^[\s]*[=+@]/.test(text) || /^[\s]*-/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const csv = [columns.map(([label]) => safeCell(label)).join(","), ...rows.map(row => columns.map(([, get]) => safeCell(get(row))).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hunda-don-hang-" + isoDate() + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Đã xuất " + rows.length + " đơn hàng. Mở file CSV bằng Excel để xem dữ liệu.");
}
function orderTable(rows, actions) {
  if (!rows.length) return emptyState("box", "Chưa có đơn hàng", "Tạo đơn hàng đầu tiên để bắt đầu quản lý vận hành.", "new-order");
  return `<div class="table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>TUYẾN / HÀNG HÓA</th><th>GIÁ TRỊ</th><th>TRẠNG THÁI</th><th>CHỨNG TỪ</th><th>NGÀY TẠO</th>${actions ? "<th></th>" : ""}</tr></thead><tbody>${rows.map(o => {
    const documentCount = state.documents.filter(doc => doc.order_id === o.id).length;
    return `<tr><td><b class="order-code">${escapeHTML(o.code)}</b></td><td><span class="customer-cell">${avatar(o.customer?.name)}<span>${escapeHTML(o.customer?.name || "Khách lẻ")}</span></span></td><td><b>${escapeHTML(o.route || "—")}</b><small class="subline">${escapeHTML(o.cargo_description || "Chưa có mô tả hàng")}</small>${o.quote_id ? '<small class="subline">Báo giá #' + escapeHTML(String(o.quote_id).slice(0, 8).toUpperCase()) + (state.quotes.find(q => q.id === o.quote_id)?.final_price_cny ? " · " + quoteCurrencyCny(state.quotes.find(q => q.id === o.quote_id).final_price_cny) : "") + '</small>' : ""}</td><td><b>${money(o.amount)}</b></td><td>${statusPill(o.status, "order")}</td><td><span class="document-count">${documentCount} tệp</span></td><td>${dateText(o.created_at)}</td>${actions ? `<td><div class="row-actions"><button class="btn ghost small" title="Tải Bill PDF hoặc chứng từ lên đơn hàng này" data-action="order-document" data-id="${o.id}">${icon("upload", 14)} Tải chứng từ</button><button class="icon-button" title="Sửa" data-action="edit-order" data-id="${o.id}">${icon("edit", 16)}</button><button class="icon-button danger" title="Xóa" data-action="delete-order" data-id="${o.id}">${icon("trash", 16)}</button></div></td>` : ""}</tr>`;
  }).join("")}</tbody></table></div>`;
}
function customersView() {
  const rows = state.customers.filter(c => [c.name, c.email, c.phone, c.company].join(" ").toLowerCase().includes(state.search));
  const table = !rows.length ? emptyState("users", "Chưa có khách hàng", "Thêm khách hàng để liên kết với đơn hàng.", "new-customer") : `<div class="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>CÔNG TY</th><th>LIÊN HỆ</th><th>SỐ ĐƠN</th><th>TỔNG GIÁ TRỊ ĐƠN</th><th></th></tr></thead><tbody>${rows.map(c => { const orders = state.orders.filter(o => o.customer_id === c.id); const total = orders.reduce((n, o) => n + Number(o.amount || 0), 0); return `<tr><td><span class="customer-cell">${avatar(c.name)}<span><b>${escapeHTML(c.name)}</b><small class="subline">${escapeHTML(c.email || "")}</small></span></span></td><td>${escapeHTML(c.company || "—")}</td><td>${escapeHTML(c.phone || "—")}</td><td>${orders.length}</td><td><b>${money(total)}</b></td><td><div class="row-actions"><button class="icon-button" data-action="edit-customer" data-id="${c.id}" title="Sửa">${icon("edit", 16)}</button><button class="icon-button danger" data-action="delete-customer" data-id="${c.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`; }).join("")}</tbody></table></div>`;
  const accounts = state.managedAccounts || [];
  const accountRows = accounts.length ? accounts.map(a => `<tr><td><b>${escapeHTML(a.full_name || "—")}</b><small class="subline">${escapeHTML(a.email || "")}</small></td><td>${escapeHTML(a.company || "—")}</td><td>${escapeHTML(a.phone || "—")}</td><td><span class="pill ${a.role === "admin" ? "in_progress" : "completed"}">${a.role === "admin" ? "Quản trị viên" : "Khách hàng"}</span>${a.role === "admin" ? '<small class="subline">Quyền: ' + escapeHTML(PERMISSION_ITEMS.filter(([key]) => a.permissions?.[key] === true).map(([, label]) => label).join(", ") || "Chưa cấp quyền") + '</small>' : ""}</td>${hasPermission("wallet") ? '<td><b class="wallet-balance">' + money(a.balance) + '</b></td>' : ""}<td><span class="pill ${a.active ? "completed" : "cancelled"}">${a.active ? (a.email_confirmed ? "Đang hoạt động" : "Chưa xác minh email") : "Đã khóa"}</span></td><td>${dateText(a.created_at)}</td><td>${a.role === "customer" ? `${hasPermission("wallet") ? '<button class="btn ghost small" data-action="wallet-adjust" data-id="' + escapeHTML(a.user_id) + '">' + icon("wallet", 14) + ' Điều chỉnh</button>' : "—"}` : "—"}</td></tr>`).join("") : `<tr><td colspan="${hasPermission("wallet") ? 8 : 7}"><div class="empty-compact">Chưa có tài khoản khách hàng hoặc quản trị viên.</div></td></tr>`;
  const accountPanel = `<section class="panel table-panel account-access-panel"><div class="panel-heading"><div><h2>Tài khoản truy cập</h2><p>Số dư và vai trò của từng tài khoản.</p></div>${hasPermission("wallet") ? '<button class="btn ghost small" data-action="wallet-settings">' + icon("wallet", 15) + ' Tài khoản nhận tiền</button>' : ""}</div><div class="table-wrap"><table><thead><tr><th>NGƯỜI DÙNG</th><th>CÔNG TY</th><th>ĐIỆN THOẠI</th><th>VAI TRÒ</th>${hasPermission("wallet") ? "<th>SỐ DƯ</th>" : ""}<th>TRẠNG THÁI</th><th>NGÀY TẠO</th><th>THAO TÁC</th></tr></thead><tbody>${accountRows}</tbody></table></div></section>`;
  const requests = state.walletAdmin?.requests || [];
  const walletTab = state.walletAdminTab === "withdrawal" ? "withdrawal" : "deposit";
  const tabTypes = walletTab === "deposit" ? ["deposit", "admin_credit"] : ["withdrawal", "admin_debit"];
  const tabLabel = walletTab === "deposit" ? "nạp tiền" : "rút tiền";
  const pendingRequests = requests.filter(request => request.status === "pending" && tabTypes.includes(request.transaction_type));
  const requestRows = pendingRequests.length ? pendingRequests.map(item => `<tr><td><b>${escapeHTML(item.full_name || item.email || "Tài khoản")}</b><small class="subline">${escapeHTML(item.email || "")}</small></td><td>${item.transaction_type === "deposit" ? "Nạp tiền" : item.transaction_type === "withdrawal" ? "Rút tiền" : item.transaction_type === "admin_credit" ? "Quản trị cộng tiền" : "Quản trị trừ tiền"}<small class="subline">${escapeHTML(item.note || "")}</small>${item.transaction_type === "withdrawal" && item.transfer_code ? '<small class="subline">Mã giao dịch: ' + escapeHTML(item.transfer_code) + '</small>' : ""}</td><td><b>${money(item.amount)}</b></td><td>${item.transaction_type === "withdrawal" ? escapeHTML([item.bank_name, item.bank_account, item.bank_holder].filter(Boolean).join(" · ")) : "Chuyển khoản đến tài khoản Hunda"}</td><td>${dateText(item.created_at)}</td><td><div class="row-actions"><button class="btn primary small" data-action="wallet-approve" data-id="${item.id}">Duyệt</button><button class="btn ghost small" data-action="wallet-reject" data-id="${item.id}">Từ chối</button></div></td></tr>`).join("") : `<tr><td colspan="6"><div class="empty-compact">Không có yêu cầu ${tabLabel} đang chờ.</div></td></tr>`;
  const walletRequestsPanel = `<section class="panel table-panel wallet-requests-panel"><div class="panel-heading"><div><h2>Yêu cầu ${tabLabel} đang chờ</h2><p>${walletTab === "deposit" ? "Chỉ duyệt sau khi đã xác nhận khoản chuyển đến." : "Kiểm tra thông tin tài khoản nhận trước khi xác nhận."}</p></div></div><div class="table-wrap"><table><thead><tr><th>TÀI KHOẢN</th><th>LOẠI</th><th>SỐ TIỀN</th><th>THÔNG TIN</th><th>NGÀY TẠO</th><th></th></tr></thead><tbody>${requestRows}</tbody></table></div></section>`;
  const reviewedRequests = requests.filter(request => request.status !== "pending" && tabTypes.includes(request.transaction_type));
  const reviewRows = reviewedRequests.length ? reviewedRequests.map(item => `<tr><td><b>${escapeHTML(item.full_name || item.email || "Tài khoản")}</b><small class="subline">${escapeHTML(item.email || "")}</small></td><td>${item.transaction_type === "deposit" ? "Nạp tiền" : item.transaction_type === "withdrawal" ? "Rút tiền" : item.transaction_type === "admin_credit" ? "Quản trị cộng tiền" : "Quản trị trừ tiền"}${item.transaction_type === "withdrawal" && item.transfer_code ? '<small class="subline">Mã: ' + escapeHTML(item.transfer_code) + '</small>' : ""}</td><td><b>${money(item.amount)}</b></td><td><span class="pill ${item.status === "approved" ? "completed" : "cancelled"}">${item.status === "approved" ? "Đã duyệt" : item.status === "failed" ? "Đã thất bại" : "Từ chối"}</span><small class="subline">${escapeHTML(item.admin_note || "—")}</small></td><td>${dateText(item.created_at)}</td><td>${dateTime(item.decided_at)}<small class="subline">${escapeHTML(item.reviewer_email || (item.decided_by ? String(item.decided_by).slice(0, 8) : "—"))}</small></td></tr>`).join("") : `<tr><td colspan="6"><div class="empty-compact">Chưa có lịch sử ${tabLabel}.</div></td></tr>`;
  const walletHistoryPanel = `<section class="panel table-panel wallet-requests-panel"><div class="panel-heading"><div><h2>Lịch sử ${tabLabel} và điều chỉnh số dư</h2><p>Các khoản ${tabLabel} được lưu trên máy chủ cùng trạng thái, người xử lý và thời điểm.</p></div></div><div class="table-wrap"><table><thead><tr><th>TÀI KHOẢN</th><th>LOẠI</th><th>SỐ TIỀN</th><th>KẾT QUẢ</th><th>NGÀY GỬI</th><th>NGƯỜI DUYỆT / THỜI GIAN</th></tr></thead><tbody>${reviewRows}</tbody></table></div></section>`;
  const pendingDepositCount = requests.filter(request => request.status === "pending" && ["deposit", "admin_credit"].includes(request.transaction_type)).length;
  const pendingWithdrawalCount = requests.filter(request => request.status === "pending" && ["withdrawal", "admin_debit"].includes(request.transaction_type)).length;
  const walletTabs = `<div class="wallet-history-tabs" role="tablist" aria-label="Phân loại yêu cầu ví"><button type="button" role="tab" aria-selected="${walletTab === "deposit"}" class="${walletTab === "deposit" ? "active" : ""}" data-action="wallet-history-tab" data-id="deposit">Nạp tiền${pendingDepositCount ? `<span>${pendingDepositCount}</span>` : ""}</button><button type="button" role="tab" aria-selected="${walletTab === "withdrawal"}" class="${walletTab === "withdrawal" ? "active" : ""}" data-action="wallet-history-tab" data-id="withdrawal">Rút tiền${pendingWithdrawalCount ? `<span>${pendingWithdrawalCount}</span>` : ""}</button></div>`;
  const customerPanel = hasPermission("customers") ? `<section class="panel table-panel customer-records-panel">${toolbar("Tìm tên, công ty, email...")}${table}</section>` : "";
  return `${hasPermission("accounts") ? accountPanel : ""}${hasPermission("wallet") ? `${walletTabs}${walletRequestsPanel}${walletHistoryPanel}` : ""}${customerPanel}`;
}
function transactionsView() {
  const rows = state.transactions.filter(t => {
    const matchesSearch = [t.category, t.note, t.reference, t.customer?.name, t.order?.code].join(" ").toLowerCase().includes(state.search);
    const source = t.source_type || "manual";
    const matchesSource = state.transactionFilter === "all" || source === state.transactionFilter || (state.transactionFilter === "other" && source === "manual");
    return matchesSearch && matchesSource;
  });
  const income = rows.filter(t => t.direction === "income" && t.status === "paid").reduce((n, t) => n + Number(t.amount), 0); const expense = rows.filter(t => t.direction === "expense" && t.status === "paid").reduce((n, t) => n + Number(t.amount), 0);
  const table = !rows.length ? emptyState("wallet", "Chưa có giao dịch", "Ghi nhận khoản thu hoặc chi đầu tiên.", "new-transaction") : `<div class="table-wrap"><table><thead><tr><th>NGÀY</th><th>NỘI DUNG</th><th>ĐỐI TƯỢNG</th><th>PHƯƠNG THỨC</th><th>TRẠNG THÁI</th><th class="align-right">SỐ TIỀN</th><th></th></tr></thead><tbody>${rows.map(t => `<tr><td>${dateText(t.transaction_date)}</td><td><span class="transaction-cell"><i class="transaction-mark ${t.direction}">${icon(t.direction === "income" ? "download" : "wallet", 15)}</i><span><b>${escapeHTML(t.category)}</b><small class="subline">${escapeHTML(t.note || t.reference || "")}</small></span></span></td><td>${escapeHTML(t.customer?.name || t.order?.code || "—")}</td><td>${escapeHTML(t.method || "—")}</td><td>${statusPill(t.status, "transaction")}</td><td class="align-right"><b class="${t.direction === "income" ? "amount-in" : "amount-out"}">${t.direction === "income" ? "+" : "−"}${money(t.amount)}</b></td><td><div class="row-actions"><button class="icon-button" data-action="edit-transaction" data-id="${t.id}" title="Sửa">${icon("edit", 16)}</button><button class="icon-button danger" data-action="delete-transaction" data-id="${t.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`).join("")}</tbody></table></div>`;
  const sourceFilter = `<label class="form-field transaction-source-filter"><span>Phân loại</span><select id="transaction-source-filter"><option value="all" ${state.transactionFilter === "all" ? "selected" : ""}>Tất cả khoản thu chi</option><option value="customer_order_payment" ${state.transactionFilter === "customer_order_payment" ? "selected" : ""}>Khách thanh toán đơn</option><option value="customer_withdrawal" ${state.transactionFilter === "customer_withdrawal" ? "selected" : ""}>Khách hàng rút</option><option value="admin_withdrawal" ${state.transactionFilter === "admin_withdrawal" ? "selected" : ""}>Quản trị rút</option><option value="other" ${state.transactionFilter === "other" ? "selected" : ""}>Thu chi khác</option></select></label>`;
  return `<div class="mini-summary"><div><span>Tổng thu đã xác nhận</span><b class="amount-in">${money(income)}</b></div><div><span>Tổng chi đã xác nhận</span><b class="amount-out">${money(expense)}</b></div><div><span>Số giao dịch</span><b>${rows.length}</b></div></div><section class="panel table-panel">${toolbar("Tìm nội dung, mã đơn, khách hàng...")}${sourceFilter}${table}</section>`;
}
function reportsAnnualView() {
  const year = Number(state.month.slice(0, 4));
  const yearPrefix = String(year);
  const months = Array.from({ length: 12 }, (_, i) => `${yearPrefix}-${String(i + 1).padStart(2, "0")}`);
  const paidRows = state.transactions.filter(t => t.status === "paid" && String(t.transaction_date).slice(0, 4) === yearPrefix);
  const monthRows = months.map(month => {
    const tx = paidRows.filter(t => String(t.transaction_date).slice(0, 7) === month);
    const income = tx.filter(t => t.direction === "income").reduce((n, t) => n + Number(t.amount || 0), 0);
    const operatingExpense = tx.filter(t => t.direction === "expense" && t.source_type !== "customer_withdrawal" && t.source_type !== "admin_withdrawal").reduce((n, t) => n + Number(t.amount || 0), 0);
    const withdrawals = tx.filter(t => t.source_type === "customer_withdrawal").reduce((n, t) => n + Number(t.amount || 0), 0);
    const orders = state.orders.filter(o => o.status !== "cancelled" && o.created_at && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date(o.created_at)) === month);
    const revenue = orders.reduce((n, o) => n + Number(o.amount || 0), 0);
    const expectedCost = orders.reduce((n, o) => n + Number(o.expected_cost || 0), 0);
    return { month, income, operatingExpense, withdrawals, profit: income - operatingExpense, revenue, expectedCost, expectedProfit: revenue - expectedCost };
  });
  const sum = key => monthRows.reduce((n, m) => n + m[key], 0);
  const table = `<div class="table-wrap"><table><thead><tr><th>THÁNG</th><th>DOANH THU ĐƠN</th><th>TIỀN ĐÃ THU</th><th>CHI PHÍ NGHIỆP VỤ</th><th>KHÁCH RÚT</th><th>LỢI NHUẬN THU/CHI</th><th>LỢI NHUẬN DỰ KIẾN</th></tr></thead><tbody>${monthRows.map(m => `<tr><td><b>${escapeHTML(m.month)}</b></td><td>${money(m.revenue)}</td><td class="amount-in">${money(m.income)}</td><td class="amount-out">${money(m.operatingExpense)}</td><td class="amount-out">${money(m.withdrawals)}</td><td class="${m.profit < 0 ? "negative" : "amount-in"}">${money(m.profit)}</td><td class="${m.expectedProfit < 0 ? "negative" : ""}">${money(m.expectedProfit)}</td></tr>`).join("")}</tbody><tfoot><tr><th>CẢ NĂM ${year}</th><th>${money(sum("revenue"))}</th><th class="amount-in">${money(sum("income"))}</th><th class="amount-out">${money(sum("operatingExpense"))}</th><th class="amount-out">${money(sum("withdrawals"))}</th><th class="${sum("profit") < 0 ? "negative" : "amount-in"}">${money(sum("profit"))}</th><th>${money(sum("expectedProfit"))}</th></tr></tfoot></table></div>`;
  return `<div class="report-summary">
    <article class="report-card"><span>Doanh thu đơn hàng cả năm</span><b class="amount-in">${money(sum("revenue"))}</b><small>Đơn không bị hủy trong năm ${year}</small></article>
    <article class="report-card"><span>Chi phí nghiệp vụ thực tế</span><b class="amount-out">${money(sum("operatingExpense"))}</b><small>Không bao gồm khách hàng rút tiền</small></article>
    <article class="report-card emphasis"><span>Lợi nhuận thu/chi nghiệp vụ</span><b class="${sum("profit") < 0 ? "negative" : ""}">${money(sum("profit"))}</b><small>Tiền thu đã xác nhận trừ chi phí nghiệp vụ</small></article>
    <article class="report-card"><span>Khách hàng rút tiền</span><b class="amount-out">${money(sum("withdrawals"))}</b><small>Dòng tiền riêng, không tính là chi phí kinh doanh</small></article>
    <article class="report-card"><span>Tiền đã thu</span><b class="amount-in">${money(sum("income"))}</b><small>Tổng giao dịch thu đã xác nhận trong năm</small></article>
    <article class="report-card emphasis"><span>Lợi nhuận dự kiến theo đơn</span><b class="${sum("expectedProfit") < 0 ? "negative" : ""}">${money(sum("expectedProfit"))}</b><small>Doanh thu đơn hàng trừ chi phí dự kiến</small></article>
  </div><section class="panel table-panel"><div class="panel-heading"><div><h2>Báo cáo chi tiết 12 tháng · ${year}</h2><p>Đối chiếu doanh thu, thu chi thực tế và khoản khách rút</p></div></div>${table}</section><div class="report-footnote">Báo cáo năm tổng hợp từ tháng 01 đến tháng 12 của năm được chọn. Lợi nhuận thu/chi nghiệp vụ = tiền thu đã xác nhận − chi phí nghiệp vụ đã xác nhận; khoản khách hàng rút tiền được trình bày riêng và không làm giảm lợi nhuận. Lợi nhuận dự kiến theo đơn dựa trên chi phí dự kiến đã nhập.</div>`;
}
function reportsRangeView() {
  const start = state.reportStart, end = state.reportEnd;
  const inside = v => { const d = String(v || "").slice(0,10); return d >= start && d <= end; };
  const tx = state.transactions.filter(t => t.status === "paid" && inside(t.transaction_date));
  const income = tx.filter(t => t.direction === "income").reduce((n,t) => n + Number(t.amount || 0),0);
  const expense = tx.filter(t => t.direction === "expense" && !["customer_withdrawal","admin_withdrawal"].includes(t.source_type)).reduce((n,t) => n + Number(t.amount || 0),0);
  const withdrawal = tx.filter(t => t.source_type === "customer_withdrawal").reduce((n,t) => n + Number(t.amount || 0),0);
  const orders = state.orders.filter(o => o.status !== "cancelled" && o.created_at && inside(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(o.created_at))));
  const revenue = orders.reduce((n,o) => n + Number(o.amount || 0),0), costs = orders.reduce((n,o) => n + Number(o.expected_cost || 0),0);
  return `<div class="report-summary"><article class="report-card"><span>Doanh thu đơn hàng</span><b class="amount-in">${money(revenue)}</b><small>${orders.length} đơn không bị hủy</small></article><article class="report-card"><span>Chi phí nghiệp vụ thực tế</span><b class="amount-out">${money(expense)}</b><small>Không gồm khách rút tiền</small></article><article class="report-card emphasis"><span>Lợi nhuận thu/chi nghiệp vụ</span><b>${money(income-expense)}</b><small>Thu đã xác nhận trừ chi nghiệp vụ</small></article><article class="report-card"><span>Khách hàng rút tiền</span><b class="amount-out">${money(withdrawal)}</b><small>Dòng tiền riêng, không tính là chi phí</small></article><article class="report-card"><span>Tiền đã thu</span><b class="amount-in">${money(income)}</b></article><article class="report-card emphasis"><span>Lợi nhuận dự kiến theo đơn</span><b>${money(revenue-costs)}</b><small>Doanh thu trừ chi phí dự kiến</small></article></div><div class="report-footnote">Khoảng ${escapeHTML(start)} đến ${escapeHTML(end)} (tối đa 1 năm, tính cả hai ngày). Khách rút tiền được thống kê riêng, không làm giảm lợi nhuận.</div>`;
}
function reportsView() {
  if (state.reportMode === "range") return reportsRangeView();
  if (state.reportMode === "year") return reportsAnnualView();
  const rows = state.transactions.filter(t => String(t.transaction_date).slice(0, 7) === state.month);
  const paidRows = rows.filter(t => t.status === "paid");
  const receipts = paidRows.filter(t => t.direction === "income").reduce((n, t) => n + Number(t.amount || 0), 0);
  // Customer withdrawals are movements of customer funds, not operating expenses.
  const customerWithdrawalRows = paidRows.filter(t => t.source_type === "customer_withdrawal");
  const customerWithdrawals = customerWithdrawalRows.reduce((n, t) => n + Number(t.amount || 0), 0);
  const operatingExpenseRows = paidRows.filter(t =>
    t.direction === "expense" && t.source_type !== "customer_withdrawal" && t.source_type !== "admin_withdrawal"
  );
  const operatingExpense = operatingExpenseRows.reduce((n, t) => n + Number(t.amount || 0), 0);
  const currentProfit = receipts - operatingExpense;
  const pending = rows.filter(t => t.status === "pending").reduce((n, t) => n + Number(t.amount || 0), 0);
  const monthOrders = state.orders.filter(order => {
    if (order.status === "cancelled" || !order.created_at) return false;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date(order.created_at));
    const key = parts.find(part => part.type === "year")?.value + "-" + parts.find(part => part.type === "month")?.value;
    return key === state.month;
  });
  const revenue = monthOrders.reduce((n, order) => n + Number(order.amount || 0), 0);
  const expectedCosts = monthOrders.reduce((n, order) => n + Number(order.expected_cost || 0), 0);
  const expectedProfit = revenue - expectedCosts;
  const ordersMissingCost = monthOrders.filter(order => Number(order.expected_cost || 0) <= 0).length;
  const paidByOrder = new Map();
  paidRows.filter(t => t.direction === "income" && t.order_id).forEach(t => {
    paidByOrder.set(t.order_id, (paidByOrder.get(t.order_id) || 0) + Number(t.amount || 0));
  });
  const receivable = monthOrders.reduce((n, order) => n + Math.max(0, Number(order.amount || 0) - (paidByOrder.get(order.id) || 0)), 0);
  const max = Math.max(1, receipts, operatingExpense, customerWithdrawals);
  const groups = new Map();
  operatingExpenseRows.concat(paidRows.filter(t => t.direction === "income")).forEach(t => {
    const k = t.category || "Khác";
    const g = groups.get(k) || { name: k, income: 0, expense: 0 };
    g[t.direction] += Number(t.amount || 0);
    groups.set(k, g);
  });
  return `<div class="report-summary">
    <article class="report-card"><span>Doanh thu đơn hàng</span><b class="amount-in">${money(revenue)}</b><small>${monthOrders.length} đơn, không gồm đơn đã hủy · ${monthLabel(state.month)}</small></article>
    <article class="report-card"><span>Chi phí thực tế đơn hàng / nghiệp vụ</span><b class="amount-out">${money(operatingExpense)}</b><small>Chỉ gồm khoản chi nghiệp vụ đã xác nhận · ${monthLabel(state.month)}</small></article>
    <article class="report-card emphasis"><span>Lợi nhuận theo thu chi nghiệp vụ</span><b class="${currentProfit < 0 ? "negative" : ""}">${money(currentProfit)}</b><small>Tiền thu đã xác nhận trừ chi phí nghiệp vụ thực tế; không trừ tiền khách rút</small></article>
    <article class="report-card"><span>Khách hàng rút tiền</span><b class="amount-out">${money(customerWithdrawals)}</b><small>Dòng tiền rút từ ví khách hàng; không tính vào chi phí/lỗ kinh doanh</small></article>
    <article class="report-card emphasis"><span>Lợi nhuận dự kiến</span><b class="${expectedProfit < 0 ? "negative" : ""}">${money(expectedProfit)}</b><small>Doanh thu trừ chi phí dự kiến · ${monthOrders.length - ordersMissingCost}/${monthOrders.length} đơn đã nhập chi phí</small></article>
    <article class="report-card"><span>Tiền đã thu</span><b class="amount-in">${money(receipts)}</b><small>Khoản thu đã thanh toán · ${monthLabel(state.month)}</small></article>
    <article class="report-card"><span>Phải thu</span><b>${money(receivable)}</b><small>Đơn tạo trong tháng trừ khoản thu đã gắn với đơn</small></article>
    <article class="report-card"><span>Giao dịch đang chờ</span><b>${money(pending)}</b><small>Chưa cộng vào dòng tiền thực tế</small></article>
  </div><div class="report-grid"><section class="panel report-chart-panel"><div class="panel-heading"><div><h2>So sánh thu, chi nghiệp vụ và tiền khách rút</h2><p>${monthLabel(state.month)} · VND</p></div></div><div class="compare-chart"><div class="compare-item"><div class="compare-bar"><i class="income" style="height:${Math.max(receipts ? 5 : 0, receipts / max * 100)}%"></i></div><b>${money(receipts)}</b><span>Tiền đã thu</span></div><div class="compare-item"><div class="compare-bar"><i class="expense" style="height:${Math.max(operatingExpense ? 5 : 0, operatingExpense / max * 100)}%"></i></div><b>${money(operatingExpense)}</b><span>Chi phí nghiệp vụ</span></div><div class="compare-item"><div class="compare-bar"><i class="expense" style="height:${Math.max(customerWithdrawals ? 5 : 0, customerWithdrawals / max * 100)}%"></i></div><b>${money(customerWithdrawals)}</b><span>Khách rút tiền</span></div><div class="compare-item"><div class="compare-bar"><i class="net" style="height:${Math.max(currentProfit ? 5 : 0, Math.abs(currentProfit) / max * 100)}%"></i></div><b>${money(currentProfit)}</b><span>Lợi nhuận thu/chi nghiệp vụ</span></div></div></section><section class="panel"><div class="panel-heading"><div><h2>Theo danh mục</h2><p>Thu và chi nghiệp vụ đã thanh toán · không gồm khách rút tiền</p></div></div>${groups.size ? `<div class="category-list">${[...groups.values()].sort((a, b) => b.income + b.expense - a.income - a.expense).map(g => `<div class="category-row"><span>${escapeHTML(g.name)}</span><span class="amount-in">${g.income ? `+ ${money(g.income)}` : "—"}</span><span class="amount-out">${g.expense ? `− ${money(g.expense)}` : "—"}</span></div>`).join("")}</div>` : `<div class="empty-compact">Chưa có giao dịch thu/chi nghiệp vụ đã xác nhận trong tháng này.</div>`}</section></div><div class="report-footnote">Lợi nhuận theo thu chi nghiệp vụ = các khoản thu đã thanh toán − chi phí nghiệp vụ đã thanh toán. Giao dịch khách hàng rút tiền được báo cáo riêng như một dòng tiền, không phải chi phí kinh doanh. Lợi nhuận dự kiến tính trên đơn không bị hủy trong tháng tạo đơn; đơn chưa nhập chi phí dự kiến đang tạm tính chi phí bằng 0. Khoản phải thu chỉ được trừ giao dịch thu đã liên kết với đúng đơn hàng.</div>`;
}
function documentsView() {
  const rows = state.documents.filter(d => [d.file_name, d.order?.code, d.note].join(" ").toLowerCase().includes(state.search));
  const table = !rows.length ? emptyState("file", "Chưa có chứng từ", "Tải hóa đơn, biên nhận hoặc chứng từ vận chuyển lên máy chủ.", "new-document") : `<div class="table-wrap"><table><thead><tr><th>TÊN TỆP</th><th>ĐƠN HÀNG</th><th>GHI CHÚ</th><th>DUNG LƯỢNG</th><th>NGÀY TẢI</th><th></th></tr></thead><tbody>${rows.map(d => `<tr><td><span class="file-cell"><i class="file-icon">${icon("file", 17)}</i><span><b>${escapeHTML(d.file_name)}</b><small class="subline">${escapeHTML(d.mime_type || "Tệp đính kèm")}</small></span></span></td><td><b>${escapeHTML(d.order?.code || "—")}</b></td><td>${escapeHTML(d.note || "—")}</td><td>${formatSize(d.file_size)}</td><td>${dateText(d.created_at)}</td><td><div class="row-actions"><button class="icon-button" data-action="download-document" data-id="${d.id}" title="Tải xuống">${icon("download", 16)}</button><button class="icon-button danger" data-action="delete-document" data-id="${d.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="document-note">${icon("shield", 18)} Bill PDF và chứng từ được lưu riêng tư trên máy chủ, gắn với đơn hàng và đồng bộ để mở từ thiết bị khác. Khách hàng chỉ xem tệp của đơn mình; quản trị viên xem toàn bộ.</div><section class="panel table-panel">${toolbar("Tìm tên tệp hoặc mã đơn...")}${table}</section>`;
}

function quoteCurrencyCny(value) {
  return new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0) + " ¥";
}
function customerQuotesPanel() {
  const history = (state.quotes || []).map(q => {
    const approved = q.status === "approved";
    const displayed = q.convert_to_vnd
      ? money(approved ? Number(q.final_price_cny || 0) * 3950 : q.estimated_price_vnd)
      : quoteCurrencyCny(approved ? q.final_price_cny : q.estimated_price_cny);
    const status = approved ? "Đã chốt giá" : "Chờ Hunda duyệt";
    const secondary = q.convert_to_vnd ? '<small class="subline">' + quoteCurrencyCny(approved ? q.final_price_cny : q.estimated_price_cny) + '</small>' : "";
    const note = q.admin_note ? '<small class="subline">Hunda: ' + escapeHTML(q.admin_note) + '</small>' : "";
    const item = q.product_url ? '<b>' + escapeHTML(q.marketplace || "Sản phẩm") + '</b><small class="subline"><a href="' + escapeHTML(q.product_url) + '" target="_blank" rel="noopener">Mở link sản phẩm</a></small><small class="subline">' + escapeHTML(q.product_sku || "Chưa chọn phân loại") + ' · SL ' + Number(q.product_quantity || 1) + '</small>' : "Vận chuyển";
    const image = state.quoteImageUrls?.[q.id] ? '<a href="' + escapeHTML(state.quoteImageUrls[q.id]) + '" target="_blank" rel="noopener">Xem ảnh</a>' : "";
    return '<tr><td><b>' + dateText(q.created_at) + '</b><small class="subline">#' + escapeHTML(String(q.id).slice(0, 8).toUpperCase()) + '</small></td><td>' + item + '<small class="subline">' + image + '</small></td><td>' + Number(q.actual_weight_kg).toLocaleString("vi-VN") + ' kg</td><td>' + Number(q.volume_cbm).toLocaleString("vi-VN") + ' m³</td><td>' + Number(q.chargeable_weight_kg).toLocaleString("vi-VN") + ' kg</td><td><b>' + displayed + '</b>' + secondary + '</td><td><span class="quote-status ' + (approved ? "approved" : "pending") + '">' + status + '</span>' + note + '</td></tr>';
  }).join("");
  return '<section class="panel customer-quotes-panel"><div class="panel-heading"><div><h2>Yêu cầu báo giá & mua hộ</h2><p>Gửi thông số vận chuyển hoặc sản phẩm từ Taobao/1688 để Hunda kiểm tra và báo giá.</p></div></div>' +
    '<form id="customer-quote-form" class="customer-quote-form">' +
    '<div class="customer-quote-fields"><label class="quote-field"><span>Nền tảng</span><select id="quote-marketplace"><option value="taobao" ' + ((state.quoteDraft?.marketplace || "taobao") === "taobao" ? "selected" : "") + '>Taobao</option><option value="1688" ' + (state.quoteDraft?.marketplace === "1688" ? "selected" : "") + '>1688</option><option value="other" ' + (state.quoteDraft?.marketplace === "other" ? "selected" : "") + '>Khác / chỉ vận chuyển</option></select></label>' +
    '<label class="quote-field"><span>Link sản phẩm</span><input id="quote-product-url" type="url" placeholder="https://..." autocomplete="url" value="' + escapeHTML(state.quoteDraft?.productUrl || "") + '"></label>' +
    '<label class="quote-field"><span>Phân loại / SKU / màu / kích cỡ</span><input id="quote-product-sku" maxlength="300" placeholder="Ví dụ: màu đen, size L" value="' + escapeHTML(state.quoteDraft?.productSku || "") + '"></label>' +
    '<label class="quote-field"><span>Số lượng</span><input id="quote-product-quantity" type="number" min="1" step="1" value="' + escapeHTML(state.quoteDraft?.productQuantity || "1") + '" required></label>' +
    '<label class="quote-field"><span>Ảnh sản phẩm (tùy chọn, tối đa 5 MB)</span><input id="quote-product-image" type="file" accept="image/png,image/jpeg,image/webp"></label>' +
    '<label class="quote-field"><span>Ghi chú sản phẩm</span><input id="quote-product-note" maxlength="1000" placeholder="Yêu cầu đóng gói hoặc lưu ý khác" value="' + escapeHTML(state.quoteDraft?.productNote || "") + '"></label>' +
    '<label class="quote-field"><span>Khối lượng thực tế (kg, nếu đã biết)</span><input id="quote-kgs" type="number" min="0" step="0.001" value="' + escapeHTML(state.quoteDraft?.actual ?? "0") + '" inputmode="decimal"></label>' +
    '<label class="quote-field"><span>Thể tích hàng (CBM, nếu đã biết)</span><input id="quote-cbm" type="number" min="0" step="0.0001" value="' + escapeHTML(state.quoteDraft?.cbm ?? "0") + '" inputmode="decimal"></label></div>' +
    '<p class="quote-formula">Có thể gửi yêu cầu mua hộ chỉ bằng link sản phẩm. Nếu có cân nặng hoặc thể tích, hệ thống sẽ tính giá vận chuyển tạm tính.</p>' +
    '<div class="quote-calc-grid"><div><span>Kg quy đổi (x)</span><b id="quote-volume-weight">0 kg</b></div><div><span>Trọng lượng tính giá</span><b id="quote-chargeable-weight">0 kg</b></div><div class="quote-total"><span>Giá tạm tính vận chuyển</span><b id="quote-estimate-cny">0,00 ¥</b></div></div>' +
    '<label class="quote-convert"><input id="quote-convert-vnd" type="checkbox" ' + (state.quoteDraft?.convert ? "checked" : "") + '><span>Hiển thị thêm VND theo tỷ giá 1 CNY = 3.950 VND</span></label>' +
    '<div class="quote-vnd-result" id="quote-vnd-result" hidden><span>Giá tạm tính quy đổi</span><b id="quote-estimate-vnd">0 ₫</b></div>' +
    '<div class="quote-submit-row"><span>Hunda sẽ kiểm tra sản phẩm, phí mua hộ và vận chuyển rồi phản hồi báo giá.</span><button type="submit" class="btn primary">' + icon("arrow", 15) + ' Gửi yêu cầu</button></div></form>' +
    '<div class="panel-heading quote-history-heading"><div><h2>Lịch sử yêu cầu</h2><p>Giá cuối cùng chỉ được áp dụng sau khi Hunda phê duyệt.</p></div></div>' +
    '<div class="table-wrap"><table><thead><tr><th>NGÀY GỬI</th><th>SẢN PHẨM</th><th>KG</th><th>CBM</th><th>KG TÍNH GIÁ</th><th>GIÁ</th><th>TRẠNG THÁI / PHẢN HỒI</th></tr></thead><tbody>' +
    (history || '<tr><td colspan="7"><div class="empty-compact">Bạn chưa gửi yêu cầu báo giá nào.</div></td></tr>') +
    '</tbody></table></div></section>';
}
function bindCustomerQuoteForm() {
  const form = document.querySelector("#customer-quote-form");
  if (!form) return;
  const refresh = (markDirty = false) => {
    const actualInput = form.querySelector("#quote-kgs");
    const cbmInput = form.querySelector("#quote-cbm");
    const convertInput = form.querySelector("#quote-convert-vnd");
    state.quoteDraft = {
      ...state.quoteDraft, actual: actualInput.value, cbm: cbmInput.value, convert: convertInput.checked,
      marketplace: form.querySelector("#quote-marketplace").value,
      productUrl: form.querySelector("#quote-product-url").value,
      productSku: form.querySelector("#quote-product-sku").value,
      productQuantity: form.querySelector("#quote-product-quantity").value,
      productNote: form.querySelector("#quote-product-note").value,
      dirty: state.quoteDraft.dirty || Boolean(markDirty)
    };
    const actual = Math.max(0, Number(actualInput.value) || 0);
    const cbm = Math.max(0, Number(cbmInput.value) || 0);
    const volumeWeight = cbm * 250;
    const chargeable = Math.max(actual, volumeWeight);
    const estimate = chargeable * 7.75;
    form.querySelector("#quote-volume-weight").textContent = volumeWeight.toLocaleString("vi-VN", { maximumFractionDigits: 3 }) + " kg";
    form.querySelector("#quote-chargeable-weight").textContent = chargeable.toLocaleString("vi-VN", { maximumFractionDigits: 3 }) + " kg";
    form.querySelector("#quote-estimate-cny").textContent = quoteCurrencyCny(estimate);
    form.querySelector("#quote-estimate-vnd").textContent = money(estimate * 3950);
    form.querySelector("#quote-vnd-result").hidden = !convertInput.checked;
  };
  form.querySelectorAll("input").forEach(input => input.addEventListener("input", () => refresh(true)));
  form.querySelectorAll("select").forEach(input => input.addEventListener("change", () => refresh(true)));
  form.querySelector("#quote-convert-vnd").addEventListener("change", () => refresh(true));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const actual = Number(form.querySelector("#quote-kgs").value) || 0;
    const cbm = Number(form.querySelector("#quote-cbm").value) || 0;
    const productUrl = form.querySelector("#quote-product-url").value.trim();
    const image = form.querySelector("#quote-product-image").files[0];
    if (actual <= 0 && cbm <= 0 && !productUrl) { showToast("Nhập link sản phẩm hoặc khối lượng/thể tích hàng.", "error"); return; }
    if (productUrl && !/^https:\/\//i.test(productUrl)) { showToast("Link sản phẩm phải bắt đầu bằng https://.", "error"); return; }
    if (image && (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 5 * 1024 * 1024)) { showToast("Ảnh phải là JPG, PNG hoặc WebP và tối đa 5 MB.", "error"); return; }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true; button.innerHTML = '<span class="spinner"></span> Đang gửi';
    let imagePath = null;
    try {
      if (image) {
        const safeName = image.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
        imagePath = state.user.id + "/quotes/" + crypto.randomUUID() + "_" + safeName;
        await request("/storage/v1/object/" + BUCKET + "/" + imagePath.split("/").map(encodeURIComponent).join("/"), { method: "POST", headers: { "Content-Type": image.type, "x-upsert": "false" }, body: image });
      }
      try {
        await api("customer_quotes?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
          actual_weight_kg: actual, volume_cbm: cbm, convert_to_vnd: form.querySelector("#quote-convert-vnd").checked,
          marketplace: productUrl ? form.querySelector("#quote-marketplace").value : "other",
          product_url: productUrl || null, product_sku: form.querySelector("#quote-product-sku").value.trim() || null,
          product_quantity: Math.max(1, Number(form.querySelector("#quote-product-quantity").value) || 1),
          product_image_path: imagePath, product_note: form.querySelector("#quote-product-note").value.trim() || null
        }) });
      } catch (error) {
        if (imagePath) await request("/storage/v1/object/" + BUCKET + "/" + imagePath.split("/").map(encodeURIComponent).join("/"), { method: "DELETE" }).catch(() => {});
        throw error;
      }
      state.quoteDraft = { actual: "0", cbm: "0", convert: false, marketplace: "taobao", productUrl: "", productSku: "", productQuantity: "1", productNote: "", dirty: false };
      await loadCustomerData(); render(); showToast("Đã gửi yêu cầu để Hunda kiểm tra và báo giá.");
    } catch (error) {
      fail(error); button.disabled = false; button.innerHTML = icon("arrow", 15) + " Gửi yêu cầu";
    }
  });
  refresh();
}
function quotesView() {
  const nameFor = userId => state.customerAccounts.find(c => c.user_id === userId)?.full_name || ("Khách hàng · " + String(userId || "").slice(0, 8));
  const pending = (state.quotes || []).filter(q => q.status === "pending").length;
  const rows = (state.quotes || []).map(q => {
    const cny = quoteCurrencyCny(q.status === "approved" ? q.final_price_cny : q.estimated_price_cny);
    const vnd = q.convert_to_vnd ? '<small class="subline">' + money(q.status === "approved" ? Number(q.final_price_cny || 0) * 3950 : q.estimated_price_vnd) + '</small>' : "";
    const status = q.status === "approved" ? '<span class="quote-status approved">Đã chốt giá</span>' : '<span class="quote-status pending">Chờ duyệt</span>';
    const action = q.status === "pending" ? '<button class="btn primary small" data-action="approve-quote" data-id="' + q.id + '">Chốt giá</button>' : '<button class="btn ghost small" data-action="approve-quote" data-id="' + q.id + '">Sửa giá</button>';
    const item = q.product_url ? '<b>' + escapeHTML(q.marketplace || "Sản phẩm") + '</b><small class="subline"><a href="' + escapeHTML(q.product_url) + '" target="_blank" rel="noopener">Mở sản phẩm</a> · SL ' + Number(q.product_quantity || 1) + '</small><small class="subline">' + escapeHTML(q.product_sku || "Chưa chọn phân loại") + '</small>' + (q.product_image_path && state.quoteImageUrls?.[q.id] ? '<small class="subline"><a href="' + escapeHTML(state.quoteImageUrls[q.id]) + '" target="_blank" rel="noopener">Xem ảnh</a></small>' : '') + (q.product_note ? '<small class="subline">' + escapeHTML(q.product_note) + '</small>' : '') : "Vận chuyển";
    return '<tr><td><b>' + dateText(q.created_at) + '</b><small class="subline">#' + escapeHTML(String(q.id).slice(0, 8).toUpperCase()) + '</small></td><td><b>' + escapeHTML(nameFor(q.user_id)) + '</b></td><td>' + item + '</td><td>' + Number(q.actual_weight_kg).toLocaleString("vi-VN") + ' kg<small class="subline">' + Number(q.volume_cbm).toLocaleString("vi-VN") + ' CBM</small></td><td>' + Number(q.chargeable_weight_kg).toLocaleString("vi-VN") + ' kg</td><td><b>' + cny + '</b>' + vnd + '</td><td>' + status + '</td><td>' + action + '</td></tr>';
  }).join("");
  return '<div class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Chờ duyệt</span><i class="stat-icon amber">' + icon("clock", 17) + '</i></div><strong>' + pending + '</strong><small>Yêu cầu báo giá mới</small></article><article class="stat-card"><div class="stat-top"><span>Tổng yêu cầu</span><i class="stat-icon blue">' + icon("file", 17) + '</i></div><strong>' + (state.quotes || []).length + '</strong><small>Đồng bộ từ không gian khách hàng</small></article></div>' +
    '<section class="panel table-panel"><div class="panel-heading"><div><h2>Luồng yêu cầu báo giá</h2><p>Đơn mua hộ và vận chuyển từ khách hàng.</p></div></div><div class="table-wrap"><table><thead><tr><th>NGÀY GỬI</th><th>KHÁCH HÀNG</th><th>SẢN PHẨM / SỐ LƯỢNG</th><th>KG / CBM</th><th>KG TÍNH GIÁ</th><th>TẠM TÍNH / CHỐT</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="8"><div class="empty-compact">Chưa có yêu cầu báo giá nào.</div></td></tr>') + '</tbody></table></div></section>';
}
function quoteApprovalModal(id) {
  const quote = (state.quotes || []).find(item => item.id === id);
  if (!quote) return;
  const isApproved = quote.status === "approved";
  const customer = state.customerAccounts.find(item => item.user_id === quote.user_id)?.full_name || "Khách hàng";
  const finalPrice = isApproved ? quote.final_price_cny : quote.estimated_price_cny;
  const finalVnd = isApproved ? Number(quote.final_price_cny || 0) * 3950 : quote.estimated_price_vnd;
  const product = quote.product_url
    ? field("Nền tảng / sản phẩm", '<p>' + escapeHTML(quote.marketplace || "") + ' · <a href="' + escapeHTML(quote.product_url) + '" target="_blank" rel="noopener">Mở link sản phẩm</a></p>')
      + field("Phân loại / số lượng", "<p>" + escapeHTML(quote.product_sku || "Chưa chọn") + " · " + Number(quote.product_quantity || 1) + "</p>")
      + (quote.product_note ? field("Ghi chú sản phẩm", "<p>" + escapeHTML(quote.product_note) + "</p>") : "")
      + (state.quoteImageUrls?.[quote.id] ? field("Ảnh sản phẩm", '<p><a href="' + escapeHTML(state.quoteImageUrls[quote.id]) + '" target="_blank" rel="noopener">Mở ảnh khách gửi</a></p>') : "")
    : "";
  const fields = field("Khách hàng", "<p>" + escapeHTML(customer) + "</p>") + product +
    field("Trọng lượng tính giá", "<p>" + Number(quote.chargeable_weight_kg).toLocaleString("vi-VN") + " kg</p>") +
    textInput("final_price_cny", "Giá chốt (CNY) *", finalPrice, "Nhập giá chốt", "number", true) +
    textareaInput("admin_note", "Ghi chú gửi khách", quote.admin_note || "", "Thời hạn báo giá, điều kiện áp dụng...") +
    field("Quy đổi", "<p>" + (quote.convert_to_vnd ? money(Number(finalVnd)) + " (tham khảo theo 3.950 VND/CNY)" : "Khách đang xem giá bằng CNY") + "</p>") +
    (isApproved ? field("Cập nhật", "<p>Khách hàng sẽ thấy giá mới ngay sau khi lưu.</p>") : "");
  openModal(isApproved ? "Điều chỉnh giá đã chốt" : "Phê duyệt và chốt báo giá", formShell("quote-approval", quote.id, fields), isApproved ? "Lưu giá mới" : "Duyệt và gửi giá");
}
function activityView() {
  const rows = state.activity || [];
  const actionLabel = { INSERT: "Tạo mới", UPDATE: "Cập nhật", DELETE: "Xóa" };
  const entityLabel = { customers: "Khách hàng", orders: "Đơn hàng", transactions: "Thu chi", order_documents: "Chứng từ", "chứng từ · tệp lưu trữ": "Tệp chứng từ" };
  const fieldLabel = { name: "Tên", company: "Công ty", phone: "Điện thoại", email: "Email", route: "Tuyến", cargo_description: "Hàng hóa", amount: "Giá trị", expected_cost: "Chi phí dự kiến", status: "Trạng thái", note: "Ghi chú", direction: "Loại thu/chi", category: "Danh mục", transaction_date: "Ngày giao dịch", method: "Phương thức", customer_id: "Khách hàng", order_id: "Đơn hàng", quote_id: "Báo giá liên quan", reference: "Mã tham chiếu", file_name: "Tên tệp", storage_path: "Đường dẫn tệp", file_size: "Dung lượng" };
  const deviceLabel = ua => {
    if (!ua) return "Không rõ thiết bị";
    const os = /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Thiết bị khác";
    const browser = /Edg\//i.test(ua) ? "Edge" : /Firefox\//i.test(ua) ? "Firefox" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "Trình duyệt khác";
    const kind = /Mobile|Android|iPhone/i.test(ua) ? "Điện thoại" : /iPad|Tablet/i.test(ua) ? "Máy tính bảng" : "Máy tính";
    return `${kind} · ${os} · ${browser}`;
  };
  const rowsHtml = rows.length ? rows.map(row => {
    const changes = (row.changed_fields || []).map(key => fieldLabel[key] || key).join(", ") || (row.action === "DELETE" ? "Bản ghi đã xóa" : "Thao tác hệ thống");
    const actor = row.actor_email || (row.actor_role === "admin" ? "Quản trị viên" : "Tài khoản đã đăng nhập");
    const actionClass = row.action === "DELETE" ? "deleted" : row.action === "INSERT" ? "created" : "updated";
    const time = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(row.occurred_at));
    return `<tr><td><b>${time}</b><small class="subline">UTC+7 · Việt Nam</small></td><td><b>${escapeHTML(actor)}</b><small class="subline">${row.actor_role === "admin" ? "Quản trị viên" : "Khách hàng / tài khoản"}</small></td><td><span class="activity-action ${actionClass}">${actionLabel[row.action] || escapeHTML(row.action)}</span><small class="subline">${escapeHTML(changes)}</small></td><td><b>${escapeHTML(entityLabel[row.entity_type] || row.entity_type)}</b><small class="subline">${escapeHTML(row.record_label || row.record_id || "—")}</small></td><td>${escapeHTML(row.source_ip || "Không nhận được IP")}</td><td>${escapeHTML(deviceLabel(row.user_agent))}</td></tr>`;
  }).join("") : `<tr><td colspan="6"><div class="empty-compact">Chưa có thay đổi nào được ghi nhận.</div></td></tr>`;
  return `<div class="activity-note"><span class="activity-live-dot"></span><div><b>Nhật ký đồng bộ trực tiếp</b><span>Ghi nhận trên máy chủ, sắp xếp mới nhất trước. Giờ hiển thị theo Việt Nam (UTC+7).</span></div><button class="btn ghost small" data-action="refresh">${icon("refresh", 15)} Làm mới</button></div><section class="panel table-panel"><div class="table-toolbar"><div class="activity-count">${rows.length} hoạt động gần nhất</div><span class="activity-retention">Theo dõi đơn hàng · khách hàng · thu chi · chứng từ</span></div><div class="table-wrap"><table class="activity-table"><thead><tr><th>THỜI GIAN</th><th>NGƯỜI THAO TÁC</th><th>HÀNH ĐỘNG / TRƯỜNG THAY ĐỔI</th><th>ĐỐI TƯỢNG</th><th>ĐỊA CHỈ IP</th><th>THIẾT BỊ</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></section>`;
}
function securityView() {
  const events = state.loginEvents || [];
  const filtered = events.filter(e => {
    const q = (state.search || "").trim().toLowerCase();
    return !q || [e.email, e.ip_address, e.device_type, e.browser, e.os, e.role, e.event_type].some(v => String(v || "").toLowerCase().includes(q));
  });
  const fmt = value => value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value)) : "—";
  const rows = filtered.length ? filtered.map(e => `<tr><td><b>${escapeHTML(fmt(e.occurred_at))}</b><small class="subline">UTC+7 · Việt Nam</small></td><td><b>${escapeHTML(e.email || "—")}</b><small class="subline">${e.role === "admin" ? "Quản trị viên" : e.role === "customer" ? "Khách hàng" : "Chưa xác định"}</small></td><td><span class="activity-action ${e.event_type === "login" ? "created" : "updated"}">${e.event_type === "login" ? "Đăng nhập" : "Đăng xuất"}</span></td><td><b>${escapeHTML(e.ip_address || "Không nhận được IP")}</b></td><td><b>${escapeHTML(e.device_type || "Không rõ")}</b><small class="subline">${escapeHTML([e.os, e.browser].filter(Boolean).join(" · ") || "Không rõ hệ điều hành/trình duyệt")}</small></td></tr>`).join("") : `<tr><td colspan="5"><div class="empty-compact">Chưa có sự kiện đăng nhập được ghi nhận.</div></td></tr>`;
  return `<div class="activity-note"><span class="activity-live-dot"></span><div><b>Giám sát đăng nhập</b><span>Ghi nhận đăng nhập thành công và đăng xuất; địa chỉ IP được lấy từ header do máy chủ biên cung cấp khi có sẵn.</span></div><button class="btn ghost small" data-action="refresh">${icon("refresh", 15)} Làm mới</button></div><section class="panel table-panel"><div class="table-toolbar"><div class="activity-count">${filtered.length} sự kiện</div><span class="activity-retention">Tối đa 300 sự kiện gần nhất được tải</span><label class="table-search">${icon("search", 16)}<input id="search" placeholder="Tìm email, IP, thiết bị..." value="${escapeHTML(state.search)}" /></label></div><div class="table-wrap"><table class="activity-table"><thead><tr><th>THỜI GIAN</th><th>TÀI KHOẢN</th><th>SỰ KIỆN</th><th>ĐỊA CHỈ IP</th><th>THIẾT BỊ / TRÌNH DUYỆT</th></tr></thead><tbody>${rows}</tbody></table></div></section><p class="muted security-footnote">Lưu ý: IP có thể thay đổi khi dùng VPN hoặc mạng di động. Thiết bị/trình duyệt được suy ra từ User-Agent, không phải mã định danh phần cứng. Phiên bản này chưa ghi nhận đăng nhập thất bại.</p>`;
}
function formatSize(bytes = 0) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function avatar(name = "?") { const colors = ["mint", "peach", "lavender", "sky", "butter"]; const n = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0); return `<i class="avatar ${colors[n % colors.length]}">${escapeHTML(name.trim().slice(0, 1).toUpperCase())}</i>`; }
function statusPill(value, type) {
  const labels = type === "order" ? { new: "Mới tiếp nhận", in_progress: "Đang vận chuyển", completed: "Hoàn tất", cancelled: "Đã hủy" } : { paid: "Đã thanh toán", pending: "Đang chờ", cancelled: "Đã hủy" };
  return `<span class="pill ${escapeHTML(value)}"><i></i>${labels[value] || value}</span>`;
}
function emptyState(ico, title, desc, action) { return `<div class="empty-state"><span class="empty-icon">${icon(ico, 24)}</span><b>${title}</b><p>${desc}</p><button class="btn primary small" data-action="${action}">${icon("plus", 15)} Thêm mới</button></div>`; }

function openModal(title, body, submitLabel = "Lưu thông tin") {
  document.querySelector("#modal-root").innerHTML = `<div class="modal-backdrop" data-modal-close><section class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button type="button" class="icon-button" data-modal-close>${icon("close", 19)}</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button type="button" class="btn ghost" data-modal-close>Hủy</button><button type="submit" form="record-form" class="btn primary">${submitLabel}</button></div></section></div>`;
  if (document.querySelector('#record-form[data-kind="wallet-payment"]')) document.querySelector(".modal-card")?.classList.add("wallet-payment-modal");
  document.querySelectorAll("[data-modal-close]").forEach(el => el.addEventListener("click", e => { if (e.target === el || el.closest("button")) closeModal(); }));
  document.querySelector("#record-form")?.addEventListener("submit", handleRecordSubmit);
}
function closeModal() { document.querySelector("#modal-root").innerHTML = ""; }
function customerOptions(selected = "") { return `<option value="">Không gắn khách hàng</option>${state.customers.map(c => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${escapeHTML(c.name)}</option>`).join("")}`; }
function orderOptions(selected = "") { return `<option value="">Không gắn đơn hàng</option>${state.orders.map(o => `<option value="${o.id}" ${o.id === selected ? "selected" : ""}>${escapeHTML(o.code)} — ${escapeHTML(o.customer?.name || "Khách lẻ")}</option>`).join("")}`; }
function field(label, control, wide = false) { return `<label class="form-field ${wide ? "wide" : ""}"><span>${label}</span>${control}</label>`; }
function textInput(name, label, value = "", placeholder = "", type = "text", required = false) { return field(`${label}${required ? " *" : ""}`, `<input name="${name}" type="${type}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" ${required ? "required" : ""} />`); }
function selectInput(name, label, options, value = "", required = false) { return field(`${label}${required ? " *" : ""}`, `<select name="${name}" ${required ? "required" : ""}>${options}</select>`); }
function textareaInput(name, label, value = "", placeholder = "") { return field(label, `<textarea name="${name}" rows="3" placeholder="${escapeHTML(placeholder)}">${escapeHTML(value)}</textarea>`, true); }
function formShell(kind, id, fields) { return `<form id="record-form" data-kind="${kind}" data-id="${id || ""}"><div class="form-grid">${fields}</div></form>`; }
function action(actionName, id) {
  if (actionName === "switch-customer") { switchToCustomerWorkspace(); return; }
  if (actionName === "switch-admin") { switchToAdminWorkspace(); return; }
  if (actionName === "new-customer-order") return customerOrderModal(id || "");
  if (actionName === "approve-quote") return quoteApprovalModal(id);
  if (actionName === "export-orders") return exportOrdersToExcel();
  if (actionName === "refresh") { loadData().then(render).catch(fail); return; }
  if (actionName === "new-order") return orderModal();
  if (actionName === "edit-order") return orderModal(state.orders.find(o => o.id === id));
  if (actionName === "delete-order") return confirmDelete("đơn hàng", id, "orders");
  if (actionName === "new-customer") return customerModal();
  if (actionName === "new-account") return managedAccountModal();
  if (actionName === "wallet-deposit") return walletTransactionModal("deposit");
  if (actionName === "wallet-withdraw") return walletTransactionModal("withdrawal");
  if (actionName === "wallet-history-tab") { state.walletAdminTab = id === "withdrawal" ? "withdrawal" : "deposit"; render(); return; }
  if (actionName === "wallet-settings") return walletSettingsModal();
  if (actionName === "wallet-adjust") return walletAdjustmentModal(state.managedAccounts.find(account => account.user_id === id));
  if (actionName === "wallet-approve") return reviewWalletTransaction(id, true);
  if (actionName === "wallet-reject") return reviewWalletTransaction(id, false);
  if (actionName === "edit-customer") return customerModal(state.customers.find(c => c.id === id));
  if (actionName === "delete-customer") return confirmDelete("khách hàng", id, "customers");
  if (actionName === "new-transaction") return transactionModal();
  if (actionName === "edit-transaction") return transactionModal(state.transactions.find(t => t.id === id));
  if (actionName === "delete-transaction") return confirmDelete("giao dịch", id, "transactions");
  if (actionName === "new-document") return documentModal();
  if (actionName === "order-document") return documentModal(null, id);
  if (actionName === "download-document") return downloadDocument(id);
  if (actionName === "delete-document") return deleteDocument(id);
}
function orderModal(order) {
  const fields = `${textInput("code", "Mã đơn hàng", order?.code || `HND-${new Date().getFullYear()}-${String(state.orders.length + 1).padStart(4, "0")}`, "HND-2026-0001", "text", true)}${selectInput("customer_id", "Khách hàng", customerOptions(order?.customer_id || ""), order?.customer_id || "")}${textInput("route", "Tuyến vận chuyển", order?.route || "", "VD: TP. Hồ Chí Minh → Hà Nội", "text", true)}${textInput("cargo_description", "Mô tả hàng hóa", order?.cargo_description || "", "Tên hàng, số kiện, khối lượng...")}${textInput("amount", "Giá trị đơn (VND)", order?.amount || "", "0", "number", true)}${textInput("expected_cost", "Chi phí dự kiến (VND)", order?.expected_cost || "", "0", "number")}${selectInput("status", "Trạng thái", [["new", "Mới tiếp nhận"], ["in_progress", "Đang vận chuyển"], ["completed", "Hoàn tất"], ["cancelled", "Đã hủy"]].map(([v, t]) => `<option value="${v}" ${order?.status === v ? "selected" : ""}>${t}</option>`).join(""), order?.status || "new")}${textareaInput("note", "Ghi chú của khách hàng", order?.note || "", "Yêu cầu khách gửi về đơn hàng")}${textareaInput("admin_note", "Ghi chú quản trị viên (khách hàng sẽ thấy)", order?.admin_note || "", "Thông tin cập nhật gửi cho khách hàng")}`;
  openModal(order ? "Cập nhật đơn hàng" : "Tạo đơn hàng mới", formShell("order", order?.id, fields), order ? "Lưu thay đổi" : "Tạo đơn hàng");
}
function customerOrderModal(quoteId = "") {
  const linkedQuoteIds = new Set((state.customerOrders || []).map(order => order.quote_id).filter(Boolean));
  const approvedQuotes = (state.quotes || []).filter(quote => quote.user_id === state.user?.id && quote.status === "approved" && !linkedQuoteIds.has(quote.id));
  const selectedQuoteId = approvedQuotes.some(quote => quote.id === quoteId) ? quoteId : approvedQuotes[0]?.id || "";
  const quoteOptions = approvedQuotes.length
    ? approvedQuotes.map(quote => `<option value="${escapeHTML(quote.id)}" ${quote.id === selectedQuoteId ? "selected" : ""}>${dateText(quote.approved_at)} · ${quoteCurrencyCny(quote.final_price_cny)} · ${Number(quote.chargeable_weight_kg).toLocaleString("vi-VN")} kg</option>`).join("")
    : '<option value="" selected disabled>Chưa có báo giá được duyệt còn hiệu lực</option>';
  const quoteNotice = approvedQuotes.length ? "" : field("Lưu ý", '<p class="quote-order-note">Báo giá đã duyệt và chưa tạo đơn sẽ xuất hiện tại đây. Hãy gửi yêu cầu báo giá trước nếu bạn chưa có báo giá.</p>', true);
  const fields = `${selectInput("quote_id", "Báo giá đã được duyệt", quoteOptions, selectedQuoteId, true)}${quoteNotice}${textInput("route", "Tuyến vận chuyển", "", "VD: TP. Hồ Chí Minh → Hà Nội", "text", true)}${textInput("cargo_description", "Mô tả hàng hóa", "", "Tên hàng, số kiện, khối lượng...")}${textareaInput("note", "Yêu cầu xử lý", "", "Thời gian, lưu ý nhận hàng hoặc yêu cầu khác")}`;
  openModal("Gửi yêu cầu đơn hàng", formShell("customer-order", "", fields), "Gửi yêu cầu");
}
function walletPaymentModal(payment) {
  const bank = payment.bank || state.wallet?.bank || {};
  const fields = '<div class="wallet-payment" data-wallet-payment-id="' + escapeHTML(payment.transaction_id || "") + '"><div class="wallet-payment-amount">' + money(payment.amount || 0) + '</div><p>Mở ứng dụng ngân hàng và quét mã QR để chuyển khoản.</p><img class="wallet-payment-qr" src="' + escapeHTML(payment.qr_url) + '" alt="Mã QR chuyển khoản SePay" /><div class="wallet-bank-info"><b>' + escapeHTML(bank.bank_name || "Tài khoản nhận tiền") + '</b><span>Chủ tài khoản: ' + escapeHTML(bank.bank_holder || "") + '</span><strong>' + escapeHTML(bank.bank_account || "") + '</strong><div class="wallet-payment-code"><span>Nội dung chuyển khoản</span><b>' + escapeHTML(payment.transfer_code) + '</b><button type="button" class="btn ghost small" data-copy-transfer>' + icon("file", 14) + ' Sao chép</button></div></div><div class="wallet-payment-status pending" data-wallet-payment-status><span class="spinner"></span><span>Đang chờ SePay xác nhận khoản tiền đã vào tài khoản...</span></div><p class="form-hint">Số dư chỉ cập nhật sau khi máy chủ nhận xác nhận thanh toán từ SePay.</p></div>';
  openModal("Quét mã để nạp tiền", formShell("wallet-payment", payment.transaction_id || "", fields), "Đã hiểu");
  document.querySelector("[data-copy-transfer]")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(payment.transfer_code); showToast("Đã sao chép nội dung chuyển khoản."); }
    catch { showToast("Không thể sao chép tự động. Hãy chọn và sao chép mã.", "error"); }
  });
  watchWalletPayment(payment);
}
function walletPaymentResultModal(payment, transaction) {
  const success = transaction.status === "approved";
  const failed = transaction.status === "failed";
  const providerMessage = transaction.payment_provider === "sepay"
    ? "SePay đã xác nhận khoản chuyển và số dư ví đã được cập nhật."
    : "Khoản nạp đã được xác nhận và số dư ví đã được cập nhật.";
  const resultTitle = success ? "Giao dịch thành công" : failed ? "Lệnh nạp đã thất bại" : "Yêu cầu nạp tiền bị từ chối";
  const resultMessage = success ? providerMessage : transaction.admin_note || (failed ? "Không nhận được xác nhận thanh toán trong 5 phút." : "Yêu cầu nạp tiền chưa được xác nhận. Vui lòng liên hệ Hunda.");
  const fields = '<div class="wallet-payment-result ' + (success ? "success" : "rejected") + '"><div class="wallet-payment-result-icon">' + icon(success ? "check" : "close", 28) + '</div><h3>' + resultTitle + '</h3><p>' + escapeHTML(resultMessage) + '</p><strong>' + money(payment.amount || transaction.amount || 0) + '</strong><small>Mã giao dịch: ' + escapeHTML(payment.transfer_code || transaction.transfer_code || "") + '</small></div>';
  openModal(success ? "Nạp tiền thành công" : failed ? "Nạp tiền thất bại" : "Trạng thái nạp tiền", formShell("wallet-payment", payment.transaction_id || "", fields), "Hoàn tất");
}
async function watchWalletPayment(payment) {
  const transactionId = String(payment.transaction_id || "");
  if (!transactionId) return;
  const existing = walletPaymentTimers.get(transactionId);
  if (existing) clearInterval(existing);
  let checking = false;
  const startedAt = Date.now();
  let timer;
  const checkStatus = async () => {
    if (checking) return;
    checking = true;
    try {
      const snapshot = await walletRequest({ action: "snapshot" });
      state.wallet = snapshot;
      const transaction = (snapshot.transactions || []).find(item => item.id === transactionId);
      if (transaction && ["approved", "rejected", "failed"].includes(transaction.status)) {
        clearInterval(timer);
        walletPaymentTimers.delete(transactionId);
        const activePayment = document.querySelector('.wallet-payment[data-wallet-payment-id="' + transactionId + '"]');
        if (activePayment) walletPaymentResultModal(payment, transaction);
        else {
          showToast(transaction.status === "approved" ? "Giao dịch nạp tiền đã thành công." : transaction.status === "failed" ? "Lệnh nạp tiền đã thất bại." : "Yêu cầu nạp tiền đã bị từ chối.", transaction.status === "approved" ? "success" : "error");
          if (!document.querySelector(".modal-backdrop") && state.workspace === "customer") render();
        }
        return;
      }
      if (Date.now() - startedAt > 15 * 60 * 1000) {
        clearInterval(timer);
        walletPaymentTimers.delete(transactionId);
        const status = document.querySelector('.wallet-payment[data-wallet-payment-id="' + transactionId + '"] [data-wallet-payment-status]');
        if (status) {
          status.classList.add("unconfirmed");
          status.innerHTML = "Chưa nhận được xác nhận từ SePay. Nếu bạn đã chuyển khoản, hãy giữ biên nhận và làm mới để kiểm tra lại.";
        }
      }
    } catch { /* Keep checking; only a server-confirmed status can produce a success state. */ }
    finally { checking = false; }
  };
  timer = setInterval(checkStatus, 4000);
  walletPaymentTimers.set(transactionId, timer);
  await checkStatus();
}

function walletTransactionModal(type) {
  const deposit = type === "deposit";
  const bank = state.wallet?.bank || {};
  const bankDetails = bank.bank_name && bank.bank_account && bank.bank_holder
    ? `<div class="wallet-bank-info"><b>${escapeHTML(bank.bank_name)}</b><span>Chủ tài khoản: ${escapeHTML(bank.bank_holder)}</span><strong>${escapeHTML(bank.bank_account)}</strong></div>`
    : `<div class="wallet-bank-info pending"><b>Tài khoản nhận tiền đang chờ cấu hình.</b><span>Vui lòng liên hệ Hunda trước khi chuyển khoản.</span></div>`;
  const fields = deposit
    ? `${field("Chuyển khoản đến", bankDetails, true)}${textInput("amount", "Số tiền nạp (VND) *", "", "Ví dụ: 500000", "number", true)}${field("Thanh toán tự động", `<p class="form-hint">Sau khi tiếp tục, mã QR sẽ điền sẵn số tiền và nội dung riêng. Số dư tự cập nhật khi SePay xác nhận tiền đã vào tài khoản.</p>`, true)}`
    : `${field("Số dư khả dụng", `<p class="wallet-available">${money(state.wallet?.balance || 0)}</p>`)}${field("Số tiền rút (VND) *", `<input name="amount" type="number" min="100000" step="1000" placeholder="Tối thiểu 100.000đ" required />`)}${textInput("bank_name", "Ngân hàng nhận *", "", "Tên ngân hàng", "text", true)}${textInput("bank_account", "Số tài khoản nhận *", "", "Số tài khoản", "text", true)}${textInput("bank_holder", "Chủ tài khoản nhận *", "", "Họ tên chủ tài khoản", "text", true)}${field("Lưu ý", `<p class="form-hint">Mỗi lần rút tối thiểu 100.000đ. Số tiền sẽ được giữ chỗ trong khi quản trị viên xử lý.</p>`, true)}`;
  openModal(deposit ? "Nạp tiền vào ví" : "Yêu cầu rút tiền", formShell(deposit ? "wallet-deposit" : "wallet-withdrawal", "", fields), deposit ? "Tạo yêu cầu nạp tiền" : "Gửi yêu cầu rút");
}
function walletAdjustmentModal(account) {
  if (!account) return fail(new Error("Không tìm thấy tài khoản khách hàng."));
  const fields = `${field("Số dư hiện tại", `<p class="wallet-available">${money(account.balance)}</p>`)}${selectInput("operation", "Thao tác", '<option value="credit">Cộng tiền vào ví</option><option value="debit">Trừ tiền khỏi ví</option>', "credit", true)}${textInput("amount", "Số tiền (VND)", "", "Nhập số tiền", "number", true)}${textareaInput("note", "Lý do điều chỉnh", "", "Ghi rõ lý do để lưu lịch sử")}`;
  openModal(`Điều chỉnh số dư · ${escapeHTML(account.full_name || account.email || "Khách hàng")}`, formShell("wallet-adjustment", account.user_id, fields), "Xác nhận điều chỉnh");
}
function walletSettingsModal() {
  const bank = state.walletAdmin?.bank || {};
  const fields = `${textInput("bank_name", "Ngân hàng", bank.bank_name || "", "Tên ngân hàng", "text", true)}${textInput("bank_code", "Mã ngân hàng VietQR", bank.bank_code || "", "Ví dụ: Vietcombank hoặc mã BIN", "text", true)}${textInput("bank_account", "Số tài khoản", bank.bank_account || "", "Số tài khoản nhận tiền", "text", true)}${textInput("bank_holder", "Tên chủ tài khoản", bank.bank_holder || "", "Tên trên tài khoản ngân hàng", "text", true)}${textInput("transfer_note", "Tiền tố nội dung chuyển khoản", bank.transfer_note || "HUNDA", "HUNDA", "text", true)}${field("Hiển thị cho khách hàng", `<p class="form-hint">Thông tin này sẽ xuất hiện khi khách hàng chọn Nạp tiền.</p>`, true)}`;
  openModal("Cấu hình tài khoản nhận tiền", formShell("wallet-settings", "", fields), "Lưu thông tin");
}
async function reviewWalletTransaction(id, approve) {
  const label = approve ? "duyệt" : "từ chối";
  if (!window.confirm(`Bạn có chắc muốn ${label} yêu cầu giao dịch này?`)) return;
  try {
    await walletRequest({ action: "admin-review", transaction_id: id, approve });
    await loadData();
    render();
    showToast(approve ? "Đã duyệt giao dịch ví." : "Đã từ chối và cập nhật số dư.");
  } catch (error) { fail(error); }
}
function managedAccountModal() {
  const roles = `<option value="customer" selected>Khách hàng — chỉ xem hồ sơ và đơn hàng của mình</option><option value="admin">Quản trị viên — phân quyền theo tính năng</option>`;
  const permissionFields = PERMISSION_ITEMS.map(([key, label, desc]) => `<label class="permission-option"><input type="checkbox" name="permission_${key}" /><span><b>${label}</b><small>${desc}</small></span></label>`).join("");
  const fields = `${selectInput("role", "Vai trò truy cập", roles, "customer", true)}${textInput("full_name", "Họ và tên", "", "Nguyễn Văn An", "text", true)}${textInput("email", "Email đăng nhập", "", "email@congty.vn", "email", true)}${textInput("phone", "Số điện thoại", "", "09xx xxx xxx", "tel")}${textInput("company", "Tên công ty", "", "Tên doanh nghiệp")}${textInput("password", "Mật khẩu khởi tạo", "", "Tối thiểu 8 ký tự", "password", true)}${field("Phân quyền chức năng", `<div class="permission-grid" id="admin-permission-grid">${permissionFields}</div><p class="form-hint">Chỉ tích chọn các chức năng tài khoản này thực sự cần sử dụng. Quyền được lưu cùng tài khoản quản trị.</p>`, true)}`;
  openModal("Cấp tài khoản truy cập", formShell("managed-account", "", fields), "Tạo tài khoản");
  const roleSelect = document.querySelector('#record-form select[name="role"]');
  const permissionField = document.querySelector("#admin-permission-grid")?.closest(".form-field");
  const togglePermissions = () => { if (permissionField) permissionField.style.display = roleSelect?.value === "admin" ? "" : "none"; };
  roleSelect?.addEventListener("change", togglePermissions);
  togglePermissions();
}
function customerModal(customer) {
  const fields = `${textInput("name", "Tên khách hàng", customer?.name || "", "Họ tên hoặc tên doanh nghiệp", "text", true)}${textInput("company", "Tên công ty", customer?.company || "", "Tên doanh nghiệp")}${textInput("phone", "Số điện thoại", customer?.phone || "", "090...", "tel")}${textInput("email", "Email", customer?.email || "", "email@company.vn", "email")}${textareaInput("note", "Ghi chú", customer?.note || "", "Địa chỉ, mã số thuế...")}`;
  openModal(customer ? "Cập nhật khách hàng" : "Thêm khách hàng", formShell("customer", customer?.id, fields), customer ? "Lưu thay đổi" : "Thêm khách hàng");
}
function transactionModal(transaction) {
  const sourceOptions = [["manual", "Thu chi khác"], ["customer_order_payment", "Khách thanh toán đơn"], ["customer_withdrawal", "Khách hàng rút"], ["admin_withdrawal", "Quản trị rút"]].map(([value, label]) => `<option value="${value}" ${(transaction?.source_type || "manual") === value ? "selected" : ""}>${label}</option>`).join("");
  const fields = `${selectInput("direction", "Loại giao dịch", `<option value="income" ${transaction?.direction === "income" ? "selected" : ""}>Khoản thu</option><option value="expense" ${transaction?.direction === "expense" ? "selected" : ""}>Khoản chi</option>`, transaction?.direction || "income")}${selectInput("source_type", "Phân loại", sourceOptions, transaction?.source_type || "manual")}${textInput("category", "Danh mục", transaction?.category || "", "Cước vận chuyển, nhiên liệu...", "text", true)}${textInput("amount", "Số tiền (VND)", transaction?.amount || "", "0", "number", true)}${textInput("transaction_date", "Ngày giao dịch", transaction?.transaction_date || isoDate(), "", "date", true)}${selectInput("status", "Trạng thái thanh toán", `<option value="paid" ${transaction?.status === "paid" ? "selected" : ""}>Đã thanh toán</option><option value="pending" ${transaction?.status === "pending" ? "selected" : ""}>Đang chờ</option><option value="cancelled" ${transaction?.status === "cancelled" ? "selected" : ""}>Đã hủy</option>`, transaction?.status || "paid")}${selectInput("method", "Phương thức", ["Chuyển khoản", "Tiền mặt", "Thẻ", "Ví điện tử", "Khác"].map(v => `<option ${transaction?.method === v ? "selected" : ""}>${v}</option>`).join(""), transaction?.method || "Chuyển khoản")}${selectInput("customer_id", "Khách hàng", customerOptions(transaction?.customer_id || ""), transaction?.customer_id || "")}${selectInput("order_id", "Đơn hàng liên quan", orderOptions(transaction?.order_id || ""), transaction?.order_id || "")}${textInput("reference", "Mã tham chiếu", transaction?.reference || "", "Mã giao dịch ngân hàng")}${textareaInput("note", "Ghi chú", transaction?.note || "", "Nội dung khoản thu / chi")}`;
  openModal(transaction ? "Cập nhật giao dịch" : "Ghi nhận thu chi", formShell("transaction", transaction?.id, fields), transaction ? "Lưu thay đổi" : "Ghi nhận");
}
function documentModal(document, orderId = "") {
  const targetOrderId = document?.order_id || orderId;
  const targetOrder = state.orders.find(order => order.id === targetOrderId);
  const orderField = targetOrder
    ? field("Đơn hàng liên quan", `<input value="${escapeHTML(targetOrder.code)} — ${escapeHTML(targetOrder.route || "Đơn hàng")}" disabled /><input type="hidden" name="order_id" value="${escapeHTML(targetOrder.id)}" />`, true)
    : selectInput("order_id", "Đơn hàng liên quan", orderOptions(document?.order_id || orderId), document?.order_id || orderId, true);
  const fields = `${orderField}${field("Chọn Bill PDF hoặc chứng từ *", `<input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" required />`, true)}${textareaInput("note", "Loại chứng từ / ghi chú", document?.note || "", "VD: Bill PDF, hóa đơn, biên nhận...")}`;
  openModal(targetOrder ? `Tải chứng từ · ${escapeHTML(targetOrder.code)}` : "Tải chứng từ lên máy chủ", formShell("document", "", fields), "Tải lên");
}
async function handleRecordSubmit(e) {
  e.preventDefault(); if (e.currentTarget.dataset.kind === "wallet-payment") { closeModal(); if (state.workspace === "customer") loadWalletSnapshot().then(render).catch(fail); return; } const form = e.currentTarget; const data = new FormData(form); const kind = form.dataset.kind; const id = form.dataset.id; let walletPayment = null; let withdrawalCode = ""; const button = document.querySelector(".modal-foot [type=submit]"); button.disabled = true; button.innerHTML = '<span class="spinner"></span> Đang lưu';
  try {
    if (kind === "wallet-adjustment") {
      const result = await walletRequest({ action: "admin-adjust", user_id: id, operation: String(data.get("operation") || ""), amount: Number(data.get("amount")), note: String(data.get("note") || "").trim() });
      if (!result?.transaction_id) throw new Error("Máy chủ chưa xác nhận điều chỉnh số dư.");
    } else if (kind === "wallet-settings") {
      const result = await walletRequest({ action: "admin-settings", settings: { bank_name: String(data.get("bank_name") || "").trim(), bank_code: String(data.get("bank_code") || "").trim(), bank_account: String(data.get("bank_account") || "").trim(), bank_holder: String(data.get("bank_holder") || "").trim(), transfer_note: String(data.get("transfer_note") || "HUNDA").trim() } });
      if (!result?.bank) throw new Error("Máy chủ chưa xác nhận thông tin nhận tiền.");
    } else if (kind === "wallet-deposit" || kind === "wallet-withdrawal") {
      const result = await walletRequest({ action: "request", transaction_type: kind === "wallet-deposit" ? "deposit" : "withdrawal", amount: Number(data.get("amount")), bank_name: String(data.get("bank_name") || "").trim(), bank_account: String(data.get("bank_account") || "").trim(), bank_holder: String(data.get("bank_holder") || "").trim(), note: kind === "wallet-deposit" ? `${state.wallet?.bank?.transfer_note || "HUNDA"}-${String(state.user?.id || "").slice(0, 8).toUpperCase()}` : "" });
      if (!result?.transaction_id) throw new Error("Máy chủ chưa tiếp nhận yêu cầu.");
      if (kind === "wallet-deposit") { if (!result.qr_url || !result.transfer_code) throw new Error("Chưa thể tạo QR. Hãy kiểm tra mã ngân hàng VietQR trong cấu hình nhận tiền."); walletPayment = result; } else { if (!result.transfer_code) throw new Error("Máy chủ chưa tạo mã cho lệnh rút."); withdrawalCode = result.transfer_code; }
    } else if (kind === "managed-account") {
      const role = String(data.get("role"));
      const permissions = Object.fromEntries(PERMISSION_ITEMS.map(([key]) => [key, data.get("permission_" + key) === "on"]));
      if (role === "admin" && !Object.values(permissions).some(Boolean)) throw new Error("Hãy chọn ít nhất một chức năng cho quản trị viên.");
      const result = await accountAdminRequest({ action: "create", account: { role, permissions, full_name: String(data.get("full_name") || "").trim(), email: String(data.get("email") || "").trim(), phone: String(data.get("phone") || "").trim(), company: String(data.get("company") || "").trim(), password: String(data.get("password") || "") } });
      if (!result?.account?.user_id) throw new Error("Máy chủ chưa xác nhận tài khoản mới.");
    } else if (kind === "document") await uploadDocument(data);
    else if (kind === "customer-order") {
      await api("rpc/submit_customer_order", { method: "POST", body: JSON.stringify({ p_quote_id: String(data.get("quote_id") || ""), p_route: String(data.get("route") || "").trim(), p_cargo_description: String(data.get("cargo_description") || "").trim() || null, p_note: String(data.get("note") || "").trim() || null }) });
    } else if (kind === "quote-approval") {
      const finalPrice = Number(data.get("final_price_cny"));
      if (!Number.isFinite(finalPrice) || finalPrice <= 0) throw new Error("Giá chốt phải lớn hơn 0.");
      await api("customer_quotes?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "approved", final_price_cny: finalPrice, admin_note: String(data.get("admin_note") || "").trim() || null, approved_by: state.user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    } else if (kind === "customer-profile") {
      const profile = Object.fromEntries(data.entries());
      await api(`customer_accounts?user_id=eq.${encodeURIComponent(state.user.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(profile) });
    }
    else {
      const record = Object.fromEntries(data.entries());
      if (kind === "order") { record.customer_id = record.customer_id || null; record.amount = Number(record.amount); record.expected_cost = Number(record.expected_cost || 0); }
      if (kind === "customer") { record.email = record.email || null; record.phone = record.phone || null; }
      if (kind === "transaction") { record.customer_id = record.customer_id || null; record.order_id = record.order_id || null; record.amount = Number(record.amount); }
      if (kind === "order") record.customer_user_id = record.customer_id ? (state.customerAccounts.find(a => a.customer_id === record.customer_id)?.user_id || null) : null;
      if (id) await api(`${kind === "order" ? "orders" : kind === "customer" ? "customers" : "transactions"}?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(record) });
      else await api(kind === "order" ? "orders" : kind === "customer" ? "customers" : "transactions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(record) });
    }
    closeModal(); if (state.workspace === "customer") { await loadCustomerData(); if (kind === "wallet-deposit" || kind === "wallet-withdrawal") await loadWalletSnapshot(); } else await loadData(); render(); showToast(kind === "wallet-adjustment" ? "Đã điều chỉnh và ghi lịch sử số dư trên máy chủ." : kind === "managed-account" ? "Đã cấp tài khoản và đồng bộ hồ sơ lên máy chủ." : kind === "wallet-settings" ? "Đã lưu tài khoản nhận tiền." : kind === "wallet-deposit" ? "Đã tạo yêu cầu nạp tiền." : kind === "wallet-withdrawal" ? "Đã gửi yêu cầu rút tiền. Mã giao dịch: " + withdrawalCode : "Đã lưu và đồng bộ dữ liệu."); if (walletPayment) walletPaymentModal(walletPayment);
  } catch (error) { fail(error); button.disabled = false; button.innerHTML = "Thử lại"; }
}
async function uploadDocument(form) {
  const file = form.get("file"); if (!(file instanceof File) || !file.size) throw new Error("Chọn tệp chứng từ trước khi tải lên.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Tệp vượt giới hạn 15 MB.");
  const allowed = ["application/pdf", "image/png", "image/jpeg", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
  if (file.type && !allowed.includes(file.type)) throw new Error("Định dạng chưa hỗ trợ. Chọn PDF, ảnh, Word hoặc Excel.");
  const orderId = form.get("order_id") || null; const cleanName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90); const path = `${state.user.id}/${orderId || "general"}/${crypto.randomUUID()}_${cleanName}`;
  await request(`/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file });
  try { await api("order_documents", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ order_id: orderId, file_name: file.name, storage_path: path, mime_type: file.type || null, file_size: file.size, note: form.get("note") || null }) }); }
  catch (error) { await request(`/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" }); throw error; }
}
async function downloadDocument(id) {
  const doc = state.documents.find(d => d.id === id); if (!doc) return;
  try { const result = await request(`/storage/v1/object/sign/${BUCKET}/${doc.storage_path.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", body: JSON.stringify({ expiresIn: 90 }) }); const url = result.signedURL.startsWith("http") ? result.signedURL : `${DB_URL}/storage/v1${result.signedURL.startsWith("/") ? "" : "/"}${result.signedURL}`; window.open(url, "_blank", "noopener,noreferrer"); }
  catch (error) { fail(error); }
}
async function deleteDocument(id) {
  const doc = state.documents.find(d => d.id === id); if (!doc || !confirm(`Xóa chứng từ “${doc.file_name}”?`)) return;
  try { await request(`/storage/v1/object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: [doc.storage_path] }) }); await api(`order_documents?id=eq.${id}`, { method: "DELETE" }); if (state.workspace === "customer") await loadCustomerData(); else await loadData(); render(); showToast("Đã xóa chứng từ."); } catch (error) { fail(error); }
}
async function confirmDelete(label, id, table) {
  if (!confirm(`Bạn có chắc muốn xóa ${label} này? Hành động này không thể hoàn tác.`)) return;
  try { await api(`${table}?id=eq.${id}`, { method: "DELETE" }); await loadData(); render(); showToast(`Đã xóa ${label}.`); } catch (error) { fail(error); }
}

async function loadData() {
  if (!state.session) return;
  const canDashboard = hasPermission("dashboard");
  const [customers, orders, transactions, documents, activity, customerAccounts, quotes, managedAccounts, walletAdmin, loginAudit] = await Promise.all([
    hasPermission("customers") ? api("customers?select=*&order=created_at.desc") : Promise.resolve([]),
    hasPermission("orders") || canDashboard ? api("orders?select=*,customer:customers(name)&order=created_at.desc") : Promise.resolve([]),
    hasPermission("transactions") || hasPermission("reports") || canDashboard ? api("transactions?select=*,customer:customers(name),order:orders(code)&order=transaction_date.desc,created_at.desc") : Promise.resolve([]),
    hasPermission("documents") ? api("order_documents?select=*,order:orders(code)&order=created_at.desc") : Promise.resolve([]),
    hasPermission("activity") ? api("activity_log?select=*&order=occurred_at.desc&limit=200") : Promise.resolve([]),
    hasPermission("accounts") ? api("customer_accounts?select=user_id,customer_id,full_name&order=created_at.desc") : Promise.resolve([]),
    hasPermission("quotes") ? api("customer_quotes?select=*&order=created_at.desc") : Promise.resolve([]),
    hasPermission("accounts") ? accountAdminRequest({ action: "list" }) : Promise.resolve({ accounts: [] }),
    hasPermission("wallet") ? walletRequest({ action: "admin-list" }) : Promise.resolve({ requests: [], bank: null }),
    hasPermission("security") ? loginAuditRequest({ action: "list", limit: 300 }).catch(() => ({ events: [] })) : Promise.resolve({ events: [] })
  ]);
  state.customers = customers || [];
  state.orders = orders || [];
  state.transactions = transactions || [];
  state.documents = documents || [];
  state.activity = activity || [];
  state.customerAccounts = customerAccounts || [];
  state.quotes = quotes || [];
  await loadQuoteImageUrls(state.quotes);
  state.managedAccounts = managedAccounts?.accounts || [];
  state.walletAdmin = walletAdmin || { requests: [], bank: null };
  state.loginEvents = loginAudit?.events || [];
}
function startRealtime() {
  if (state.realtime || !window.supabase?.createClient || !state.session?.access_token) return;
  const client = window.supabase.createClient(DB_URL, PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    accessToken: async () => state.session?.access_token || PUBLIC_KEY
  });
  state.realtimeStatus = "CONNECTING";
  state.realtime = client.channel("hunda-admin-activity")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, async () => {
      if (!state.session || document.hidden) return;
      try { await loadData(); if (document.querySelector(".app-shell")) render(); } catch { /* Periodic refresh remains available if realtime temporarily disconnects. */ }
    })
    .subscribe(status => { state.realtimeStatus = status; if (state.page === "activity" && state.workspace === "admin") render(); });
}
async function checkAdmin() {
  try { const rows = await api(`admin_users?select=user_id,permissions&user_id=eq.${encodeURIComponent(state.user.id)}&active=eq.true`); state.permissions = rows[0]?.permissions || {}; return rows.length > 0; }
  catch { state.permissions = {}; return false; }
}
async function authRequest(route, body) { return request(`/auth/v1/${route}`, { method: "POST", body: JSON.stringify(body) }, false); }
async function signIn(email, password) {
  const session = await authRequest("token?grant_type=password", { email, password }); saveSession(session); state.user = session.user || null;
  await recordLoginEvent("login");
  await enterApp();
}
async function signUp(email, password, profile) {
  const result = await authRequest("signup", { email, password, data: profile });
  if (result.access_token) { saveSession(result); state.user = result.user || null; await recordLoginEvent("login"); await enterApp(); }
  else authShell("login", "Tài khoản khách hàng đã được tạo. Hãy xác nhận email nếu hệ thống yêu cầu, sau đó đăng nhập để gửi và theo dõi yêu cầu đơn hàng.");
}
async function sendPasswordReset(email) {
  const redirectTo = `${location.origin}${location.pathname}`;
  await authRequest(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email });
}
async function updatePassword(password) {
  await request("/auth/v1/user", { method: "PUT", body: JSON.stringify({ password }) });
  saveSession(null); state.user = null;
  authShell("login", "Mật khẩu đã được cập nhật. Hãy đăng nhập bằng mật khẩu mới.");
}
async function signOut() {
  if (signOutInProgress) return;
  signOutInProgress = true;
  try {
    await recordLoginEvent("logout");
    if (state.realtime) { try { await state.realtime.unsubscribe(); } catch {} state.realtime = null; }
    try { if (state.session?.access_token) await request("/auth/v1/logout", { method: "POST" }); } catch { /* Local sign-out still completes when the server session expired. */ }
    saveSession(null); state.user = null; state.workspace = "admin"; state.isAdmin = false; state.customerAccount = null; state.customerAccounts = []; state.customers = []; state.orders = []; state.customerOrders = []; state.transactions = []; state.documents = []; state.activity = []; state.wallet = null; state.walletAdmin = null; state.managedAccounts = []; authShell("login");
  } finally {
    signOutInProgress = false;
  }
}
async function enterApp() {
  root.innerHTML = `<main class="loading-screen"><span class="loader"></span><p>Đang đồng bộ Hunda Logistics...</p></main>`;
  try {
    state.isAdmin = await checkAdmin();
    if (state.isAdmin) { state.workspace = "admin"; await loadData(); render(); startRealtime(); return; }
    const profile = await api(`customer_accounts?select=*&user_id=eq.${encodeURIComponent(state.user.id)}`);
    if (!profile?.length) return renderPending(state.user?.email);
    state.customerAccount = profile[0]; state.workspace = "customer"; await loadCustomerData(); await loadWalletSnapshot(); render(); startRealtime();
  } catch (error) { fail(error); authShell("login", `Không tải được dữ liệu: ${error.message}`); }
}
function bindAuth() {
  document.querySelectorAll("[data-auth-view]").forEach(b => b.addEventListener("click", () => authShell(b.dataset.authView)));
  document.querySelector("#auth-form")?.addEventListener("submit", async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const view = e.currentTarget.dataset.view; const email = String(f.get("email") || "").trim().toLowerCase(); const password = String(f.get("password") || ""); const isSignup = view === "signup";
    if (isSignup && password !== f.get("confirm")) return showToast("Mật khẩu nhập lại chưa khớp.", "error");
    if (view === "reset" && password !== f.get("confirm")) return showToast("Mật khẩu nhập lại chưa khớp.", "error");
    const button = e.currentTarget.querySelector("button[type=submit]"); button.disabled = true; button.innerHTML = '<span class="spinner"></span> Đang xử lý';
    try {
      if (isSignup) await signUp(email, password, { full_name: String(f.get("full_name")).trim(), phone: String(f.get("phone")).trim(), billing_company: String(f.get("billing_company") || "").trim(), billing_tax_code: String(f.get("billing_tax_code") || "").trim(), billing_address: String(f.get("billing_address") || "").trim(), billing_email: String(f.get("billing_email") || "").trim().toLowerCase() });
      else if (view === "forgot") { await sendPasswordReset(email); authShell("login", "Nếu email thuộc một tài khoản, liên kết đặt lại mật khẩu đã được gửi. Hãy kiểm tra hộp thư và thư rác."); }
      else if (view === "reset") await updatePassword(password);
      else await signIn(email, password);
    }
    catch (error) { authShell(view, error.message); }
  });
}
function bootstrap() {
  if (!DB_URL || !PUBLIC_KEY) return renderSetup();
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (hash.get("access_token") && hash.get("refresh_token")) {
    const isRecovery = hash.get("type") === "recovery";
    saveSession({ access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token"), token_type: hash.get("token_type") || "bearer", expires_in: Number(hash.get("expires_in") || 3600), expires_at: Number(hash.get("expires_at") || 0) });
    history.replaceState(null, "", location.pathname + location.search);
    if (isRecovery) { authShell("reset"); return; }
  }
  if (state.session?.access_token) {
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
    if (lastActivity && Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
      saveSession(null);
      authShell("login", "Phiên đăng nhập đã tự động kết thúc sau 10 phút không hoạt động.");
      return;
    }
    if (!lastActivity) localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }
  if (!state.session?.access_token) { authShell("login"); return; }
  state.user = state.session.user || null;
  request("/auth/v1/user").then(user => { state.user = user; return enterApp(); }).catch(async () => { if (await refreshSession()) { const user = await request("/auth/v1/user"); state.user = user; await enterApp(); } else { saveSession(null); authShell("login"); } });
}
document.addEventListener("click", e => { markUserActivity(); const btn = e.target.closest("[data-action]"); if (btn) action(btn.dataset.action, btn.dataset.id); });
["keydown", "pointerdown", "touchstart", "scroll", "input"].forEach(eventName => {
  document.addEventListener(eventName, markUserActivity, { passive: true });
});
window.addEventListener("pointermove", markUserActivity, { passive: true });
window.addEventListener("storage", e => {
  if (e.key === "hunda-session-signal") { sessionStorage.removeItem(SESSION_KEY); location.reload(); }
  if (e.key === LAST_ACTIVITY_KEY && state.session) void enforceIdleTimeout();
});
setInterval(() => { void enforceIdleTimeout(); }, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.session && state.workspace === "customer") Promise.all([loadCustomerData(), loadWalletSnapshot()]).then(() => { if (!state.quoteDraft?.dirty) render(); }).catch(() => {}); else if (!document.hidden && state.session) loadData().then(render).catch(() => {}); });
setInterval(() => { if (!document.hidden && state.session && state.workspace === "customer") Promise.all([loadCustomerData(), loadWalletSnapshot()]).then(() => { if (!state.quoteDraft?.dirty && document.querySelector(".app-shell") && !document.querySelector(".modal-backdrop")) render(); }).catch(() => {}); }, 8000);
setInterval(() => { if (!document.hidden && state.session && state.workspace === "admin") loadData().then(() => { if (document.querySelector(".app-shell") && !document.querySelector(".modal-backdrop")) render(); }).catch(() => {}); }, 45000);
bootstrap();

