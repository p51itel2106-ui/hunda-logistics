const root = document.querySelector("#app");
const cfg = window.HUNDA_CONFIG || {};
const DB_URL = String(cfg.supabaseUrl || "").replace(/\/$/, "");
const PUBLIC_KEY = cfg.publishableKey || "";
const BUCKET = "hunda-documents";
const SESSION_KEY = "hunda-auth-session";
const state = { page: "dashboard", workspace: "admin", isAdmin: false, customerAccount: null, customerAccounts: [], managedAccounts: [], wallet: null, walletAdmin: null, session: readSession(), user: null, customers: [], orders: [], customerOrders: [], transactions: [], documents: [], quotes: [], quoteDraft: { actual: "0", cbm: "0", convert: false }, activity: [], customerPage: "orders", search: "", month: new Date().toISOString().slice(0, 7), realtime: null };

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

function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
function saveSession(session) { state.session = session; session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY); }
function headers(extra = {}) { return { apikey: PUBLIC_KEY, Authorization: `Bearer ${state.session?.access_token || PUBLIC_KEY}`, ...extra }; }
async function accountAdminRequest(payload) { return request("/functions/v1/hunda-admin-accounts", { method: "POST", body: JSON.stringify(payload) }); }
async function walletRequest(payload) { return request("/functions/v1/hunda-wallet", { method: "POST", body: JSON.stringify(payload) }); }
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
  root.innerHTML = `<main class="auth-page"><div class="auth-left"><div class="auth-copy"><span class="eyebrow">VẬN HÀNH TRONG MỘT NƠI</span><h1>Quản lý hành trình.<br><em>Nắm chắc dòng tiền.</em></h1><p>Đơn hàng, khách hàng, chứng từ và tài chính được đồng bộ an toàn trên mọi thiết bị.</p><div class="auth-proof"><span>${icon("shield", 17)} Dữ liệu riêng tư</span><span>${icon("refresh", 17)} Đồng bộ máy chủ</span></div></div><div class="auth-foot">© ${new Date().getFullYear()} Hunda Logistics</div></div><section class="auth-right"><div class="auth-brand"><img src="/assets/hunda-emblem.jpg" alt="" /><div class="auth-brand-copy"><b>HUNDA <em>BUS</em></b><small>LOGISTICS <i>×</i> E-COMMERCE</small></div></div><div class="auth-content-wrap"><div class="auth-form-wrap"><span class="eyebrow">${signup ? "TẠO TÀI KHOẢN" : reset ? "BẢO MẬT TÀI KHOẢN" : forgot ? "HỖ TRỢ ĐĂNG NHẬP" : "KHÁCH HÀNG & QUẢN TRỊ"}</span><h2>${heading}</h2><p class="muted">${subheading}</p>${message ? `<div class="form-alert ${successMessage ? "success" : ""}">${escapeHTML(message)}</div>` : ""}<form id="auth-form" data-view="${view}">${authFields}<button class="btn primary wide" type="submit">${actionLabel}${icon("arrow", 17)}</button></form><p class="auth-switch">${switchText} <button class="text-button" data-auth-view="${switchView}">${switchLabel}</button></p><div class="auth-safe">${icon("shield", 15)} Tài khoản mới vào không gian khách hàng; quyền quản trị được cấp riêng.</div></div></div></section></main><div id="toast-host" class="toast-host"></div>`;
  bindAuth();
}

function renderPending(email) {
  root.innerHTML = `<main class="setup-page"><section class="setup-card pending-card"><img class="setup-logo" src="/assets/hunda-logo.jpg" alt="Hunda Bus Logistics" /><div class="eyebrow">CHƯA CÓ HỒ SƠ</div><h1>Không tìm thấy hồ sơ truy cập</h1><p><b>${escapeHTML(email || "")}</b> chưa có hồ sơ khách hàng hoặc quyền quản trị Hunda Logistics.</p><p>Nếu đây là tài khoản mới, hãy liên hệ Hunda để kiểm tra trạng thái xác nhận email và hồ sơ đồng bộ.</p><button class="btn ghost" id="logout-pending">${icon("logout", 16)} Đăng xuất</button></section></main>`;
  document.querySelector("#logout-pending")?.addEventListener("click", signOut);
}

const pages = [
  ["dashboard", "Tổng quan", "grid"], ["orders", "Đơn hàng", "box"], ["customers", "Khách hàng", "users"], ["transactions", "Thu chi", "wallet"], ["reports", "Báo cáo tài chính", "chart"], ["documents", "Chứng từ", "file"], ["quotes", "Báo giá", "file"], ["activity", "Nhật ký thao tác", "clock"]
];
const pageTitles = { dashboard: ["Tổng quan", "Theo dõi hoạt động và dòng tiền của Hunda Logistics."], orders: ["Đơn hàng", "Quản lý vận chuyển từ lúc tiếp nhận đến khi hoàn tất."], customers: ["Khách hàng", "Lưu thông tin và theo dõi lịch sử hợp tác."], transactions: ["Thu chi", "Ghi nhận các khoản thu, chi và trạng thái thanh toán."], reports: ["Báo cáo tài chính", "Dòng tiền và kết quả theo các giao dịch đã xác nhận."], documents: ["Chứng từ", "Tệp đính kèm được lưu trong kho riêng tư trên máy chủ."], quotes: ["Báo giá", "Duyệt yêu cầu và chốt giá cuối cùng gửi cho khách hàng."], activity: ["Nhật ký thao tác", "Theo dõi thay đổi đơn hàng, khách hàng, thu chi và chứng từ."] };

function shell(content) {
  const [title, subtitle] = pageTitles[state.page];
  root.innerHTML = `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><img class="brand-emblem" src="/assets/hunda-emblem.jpg" alt="" /><div><b>HUNDA <em>BUS</em></b><small>LOGISTICS × E-COMMERCE</small></div><button class="sidebar-close" id="close-sidebar" aria-label="Đóng menu">${icon("close", 17)}</button></div><div class="workspace"><span class="workspace-dot"></span><span><b>Hunda Logistics</b><small>Không gian quản trị</small></span>${icon("dots", 16)}</div><div class="nav-label">LÀM VIỆC</div><nav>${pages.map(([id, label, ico]) => `<button class="nav-item ${state.page === id ? "active" : ""}" data-page="${id}">${icon(ico, 18)}<span>${label}</span>${id === "orders" && state.orders.filter(o => !["completed", "cancelled"].includes(o.status)).length ? `<small>${state.orders.filter(o => !["completed", "cancelled"].includes(o.status)).length}</small>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="sync-card"><span class="sync-dot"></span><div><b>Đã đồng bộ</b><small>Dữ liệu trên máy chủ</small></div>${icon("refresh", 15)}</div><div class="user-row"><span class="avatar">${escapeHTML((state.user?.email || "H").slice(0, 1).toUpperCase())}</span><span class="user-info"><b>${escapeHTML(state.user?.email || "Quản trị viên")}</b><small>Quản trị viên</small></span><button class="icon-button logout-button" id="logout" title="Đăng xuất">${icon("logout", 17)}</button></div></div></aside><div class="sidebar-scrim" id="sidebar-scrim"></div><main class="main-area"><header class="topbar"><button class="mobile-menu icon-button" id="open-sidebar">${icon("menu", 20)}</button><div class="breadcrumb">Hunda Logistics <span>/</span> <b>${title}</b></div><div class="top-actions">${state.isAdmin ? `<button class="btn ghost small" data-action="switch-customer">${icon("users", 15)} Không gian khách hàng</button>` : ""}<span class="sync-label">${icon("refresh", 15)} Đồng bộ máy chủ</span><button class="icon-button" id="refresh" title="Làm mới dữ liệu">${icon("refresh", 18)}</button><span class="top-avatar">${escapeHTML((state.user?.email || "H").slice(0, 1).toUpperCase())}</span></div></header><div class="page-content"><div class="page-heading"><div><span class="eyebrow">HUNDA LOGISTICS</span><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${pageAction()}</div></div>${content}</div></main></div><div id="modal-root"></div><div id="toast-host" class="toast-host"></div>`;
  bindShell();
}
function pageAction() {
  if (state.page === "orders") return `<button class="btn primary" data-action="new-order">${icon("plus", 17)} Tạo đơn hàng</button>`;
  if (state.page === "customers") return `<button class="btn ghost" data-action="new-customer">${icon("plus", 16)} Thêm khách hàng</button><button class="btn primary" data-action="new-account">${icon("users", 16)} Cấp tài khoản</button>`;
  if (state.page === "transactions") return `<button class="btn primary" data-action="new-transaction">${icon("plus", 17)} Ghi nhận thu chi</button>`;
  if (state.page === "documents") return `<button class="btn primary" data-action="new-document">${icon("upload", 17)} Tải chứng từ</button>`;
  if (state.page === "quotes") return '<button class="btn ghost" data-action="refresh">' + icon("refresh", 16) + ' Làm mới yêu cầu</button>';
  if (state.page === "activity") return `<span class="live-badge ${state.realtimeStatus === "SUBSCRIBED" ? "connected" : ""}"><i></i>${state.realtimeStatus === "SUBSCRIBED" ? "Đang đồng bộ trực tiếp" : "Đang kết nối · làm mới dự phòng"} · UTC+7</span>`;
  if (state.page === "reports") return `<label class="month-control">${icon("calendar", 16)}<input type="month" id="report-month" value="${state.month}" /></label>`;
  return `<button class="btn ghost" data-page="orders">${icon("box", 16)} Xem đơn hàng</button>`;
}
function bindShell() {
  document.querySelectorAll("[data-page]").forEach(el => el.addEventListener("click", () => { state.page = el.dataset.page; state.search = ""; render(); }));
  document.querySelector("#logout")?.addEventListener("click", signOut);
  document.querySelector("#refresh")?.addEventListener("click", async () => { await loadData(); render(); showToast("Dữ liệu đã được làm mới."); });
  document.querySelector("#open-sidebar")?.addEventListener("click", () => document.body.classList.add("nav-open"));
  document.querySelector("#close-sidebar")?.addEventListener("click", closeNav);
  document.querySelector("#sidebar-scrim")?.addEventListener("click", closeNav);
  document.querySelector("#report-month")?.addEventListener("change", e => { state.month = e.target.value; render(); });
  document.querySelector("#search")?.addEventListener("input", e => { state.search = e.target.value.toLowerCase(); const pos = e.target.selectionStart; render(); const next = document.querySelector("#search"); next?.focus(); next?.setSelectionRange(pos, pos); });
}
function closeNav() { document.body.classList.remove("nav-open"); }
function render() {
  if (state.workspace === "customer") return customerWorkspaceView();
  if (state.page === "dashboard") return shell(dashboardView());
  if (state.page === "orders") return shell(ordersView());
  if (state.page === "customers") return shell(customersView());
  if (state.page === "transactions") return shell(transactionsView());
  if (state.page === "reports") return shell(reportsView());
  if (state.page === "activity") return shell(activityView());
  if (state.page === "quotes") return shell(quotesView());
  return shell(documentsView());
}
function customerWorkspaceView() {
  const orders = state.customerOrders || [];
  const active = orders.filter(o => !["completed", "cancelled"].includes(o.status)).length;
  const statusText = { new: "Đã tiếp nhận", in_progress: "Đang vận chuyển", completed: "Hoàn tất", cancelled: "Đã hủy" };
  const walletHistory = (state.wallet?.transactions || []).slice(0, 5).map(item => `<tr><td>${dateText(item.created_at)}</td><td>${item.transaction_type === "deposit" ? "Nạp tiền" : "Rút tiền"}</td><td><b>${money(item.amount)}</b></td><td><span class="pill ${item.status === "approved" ? "completed" : item.status === "rejected" ? "cancelled" : "pending"}">${item.status === "approved" ? "Đã duyệt" : item.status === "rejected" ? "Từ chối" : "Đang chờ"}</span></td><td>${escapeHTML(item.admin_note || item.note || "—")}</td></tr>`).join("");
  const walletTopbar = `<div class="customer-wallet-topbar"><span>Số dư</span><b>${money(state.wallet?.balance || 0)}</b><button class="btn primary small" data-action="wallet-deposit">${icon("plus", 14)} Nạp tiền</button><button class="btn ghost small" data-action="wallet-withdraw">${icon("upload", 14)} Rút tiền</button></div>`;
  const walletPanel = `<section class="panel table-panel wallet-history"><div class="panel-heading"><div><h2>Lịch sử nạp rút</h2><p>Yêu cầu nạp được cộng vào số dư sau khi Hunda xác nhận.</p></div></div><div class="table-wrap"><table><thead><tr><th>NGÀY</th><th>LOẠI</th><th>SỐ TIỀN</th><th>TRẠNG THÁI</th><th>GHI CHÚ</th></tr></thead><tbody>${walletHistory || `<tr><td colspan="5"><div class="empty-compact">Chưa có giao dịch ví.</div></td></tr>`}</tbody></table></div></section>`;
  const orderRows = orders.length ? orders.map(order => {
    const docs = state.documents.filter(d => d.order_id === order.id);
    return `<tr><td><b class="order-code">${escapeHTML(order.code)}</b><small class="subline">${dateText(order.created_at)}</small></td><td><b>${escapeHTML(order.route || "—")}</b><small class="subline">${escapeHTML(order.cargo_description || "Chưa có mô tả hàng")}</small>${order.quote_id ? '<small class="subline">Báo giá #' + escapeHTML(String(order.quote_id).slice(0, 8).toUpperCase()) + (order.quote_final_price_cny ? " · " + quoteCurrencyCny(order.quote_final_price_cny) : "") + '</small>' : ""}</td><td><span class="pill ${escapeHTML(order.status)}"><i></i>${statusText[order.status] || escapeHTML(order.status)}</span></td><td>${docs.length} tệp</td><td><div class="row-actions"><button class="btn ghost small" data-action="order-document" data-id="${order.id}">${icon("upload", 14)} Chứng từ</button></div></td></tr>`;
  }).join("") : `<tr><td colspan="5"><div class="empty-state customer-empty"><span class="empty-icon">${icon("box", 24)}</span><b>Chưa có yêu cầu đơn hàng</b><p>Gửi thông tin tuyến vận chuyển để Hunda tiếp nhận và phản hồi trạng thái.</p><button class="btn primary small" data-action="new-customer-order">${icon("plus", 15)} Tạo yêu cầu</button></div></td></tr>`;
  const approvedQuotes = (state.quotes || []).filter(quote => quote.user_id === state.user?.id && quote.status === "approved");
  const readyQuotes = approvedQuotes.filter(quote => !orders.some(order => order.quote_id === quote.id));
  const quoteOrderFlow = approvedQuotes.length ? `<section class="panel approved-quotes-flow"><div class="panel-heading"><div><h2>Báo giá đã duyệt</h2><p>Giá chốt được chuyển vào tiến trình đơn hàng. Chọn báo giá để gửi yêu cầu lên đơn.</p></div></div><div class="approved-quote-list">${approvedQuotes.map(quote => {
    const linkedOrder = orders.find(order => order.quote_id === quote.id);
    const amount = quote.convert_to_vnd ? money(Number(quote.final_price_cny || 0) * 3950) + " · " + quoteCurrencyCny(quote.final_price_cny) : quoteCurrencyCny(quote.final_price_cny);
    return `<article class="approved-quote-card"><div class="approved-quote-summary"><span class="quote-status approved">Đã chốt giá</span><b>Báo giá #${escapeHTML(String(quote.id).slice(0, 8).toUpperCase())}</b><small>${Number(quote.chargeable_weight_kg).toLocaleString("vi-VN")} kg · ${amount}</small>${quote.admin_note ? `<small>${escapeHTML(quote.admin_note)}</small>` : ""}</div>${linkedOrder ? `<span class="quote-order-linked">Đã gửi yêu cầu · ${escapeHTML(linkedOrder.code || "")}</span>` : `<button class="btn primary small" data-action="new-customer-order" data-id="${escapeHTML(quote.id)}">${icon("plus", 15)} Tạo yêu cầu lên đơn</button>`}</article>`;
  }).join("")}</div></section>` : "";
  const documents = state.documents.length ? state.documents.map(doc => {
    const order = orders.find(o => o.id === doc.order_id);
    return `<tr><td><b>${escapeHTML(doc.file_name)}</b><small class="subline">${escapeHTML(doc.note || doc.mime_type || "Chứng từ")}</small></td><td>${escapeHTML(order?.code || "—")}</td><td>${dateText(doc.created_at)}</td><td><div class="row-actions"><button class="icon-button" data-action="download-document" data-id="${doc.id}" title="Tải xuống">${icon("download", 16)}</button><button class="icon-button danger" data-action="delete-document" data-id="${doc.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`;
  }).join("") : `<tr><td colspan="4"><div class="empty-compact">Chứng từ của các đơn hàng sẽ xuất hiện tại đây.</div></td></tr>`;
  root.innerHTML = `<div class="app-shell customer-app"><aside class="sidebar"><div class="brand"><img class="brand-emblem" src="/assets/hunda-emblem.jpg" alt="" /><div><b>HUNDA <em>BUS</em></b><small>LOGISTICS × E-COMMERCE</small></div></div><div class="workspace"><span class="workspace-dot"></span><span><b>Hunda Logistics</b><small>Không gian khách hàng</small></span>${icon("dots", 16)}</div><div class="nav-label">ĐƠN HÀNG</div><nav><button class="nav-item" data-customer-page="quotes">${icon("file", 18)}<span>Báo giá</span></button><button class="nav-item active" data-customer-page="orders">${icon("box", 18)}<span>Lịch sử đơn hàng</span>${active ? `<small>${active}</small>` : ""}</button><button class="nav-item" data-customer-page="documents">${icon("file", 18)}<span>Chứng từ đơn hàng</span></button></nav><div class="sidebar-bottom"><div class="sync-card"><span class="sync-dot"></span><div><b>Đã đồng bộ</b><small>Yêu cầu lên máy chủ</small></div>${icon("refresh", 15)}</div><div class="user-row"><span class="avatar">${escapeHTML((state.customerAccount?.full_name || state.user?.email || "K").slice(0, 1).toUpperCase())}</span><span class="user-info"><b>${escapeHTML(state.customerAccount?.full_name || state.user?.email || "Khách hàng")}</b><small>Khách hàng</small></span><button class="icon-button logout-button" id="logout" title="Đăng xuất">${icon("logout", 17)}</button></div></div></aside><main class="main-area"><header class="topbar"><div class="breadcrumb">Hunda Logistics <span>/</span> <b>Không gian khách hàng</b></div>${walletTopbar}<div class="top-actions">${state.isAdmin ? `<button class="btn ghost small" data-action="switch-admin">${icon("shield", 15)} Trở về quản trị</button>` : ""}<span class="sync-label">${icon("refresh", 15)} Đồng bộ đơn hàng</span><button class="icon-button" id="customer-refresh" title="Làm mới">${icon("refresh", 18)}</button><button class="icon-button" id="logout-customer" title="Đăng xuất">${icon("logout", 17)}</button></div></header><div class="page-content"><div class="page-heading"><div><span class="eyebrow">CỔNG KHÁCH HÀNG</span><h1>Lịch sử đơn hàng</h1><p>Tạo yêu cầu vận chuyển và theo dõi các cập nhật từ Hunda Logistics.</p></div><div class="heading-actions"><button class="btn primary" data-action="new-customer-order">${icon("plus", 17)} Tạo yêu cầu đơn hàng</button></div></div><div class="welcome-strip"><div class="welcome-art">${icon("truck", 30)}</div><div><b>Xin chào, ${escapeHTML(state.customerAccount?.full_name || "Quý khách")}</b><span>Thông tin đơn hàng của bạn được đồng bộ với đội ngũ Hunda.</span></div></div><div class="stats-grid customer-stats"><article class="stat-card"><div class="stat-top"><span>Tổng yêu cầu</span><i class="stat-icon blue">${icon("box", 17)}</i></div><strong>${orders.length}</strong><small>Đơn hàng của bạn</small></article><article class="stat-card"><div class="stat-top"><span>Đang xử lý</span><i class="stat-icon amber">${icon("clock", 17)}</i></div><strong>${active}</strong><small>Chờ tiếp nhận hoặc đang vận chuyển</small></article><article class="stat-card"><div class="stat-top"><span>Đã hoàn tất</span><i class="stat-icon green">${icon("check", 17)}</i></div><strong>${orders.filter(o => o.status === "completed").length}</strong><small>Đơn hàng hoàn tất</small></article><article class="stat-card"><div class="stat-top"><span>Chứng từ</span><i class="stat-icon coral">${icon("file", 17)}</i></div><strong>${state.documents.length}</strong><small>Tệp đính kèm trên máy chủ</small></article></div>${walletPanel}${customerQuotesPanel()}${quoteOrderFlow}<section class="panel table-panel customer-table-panel"><div class="panel-heading"><div><h2>Tiến trình đơn hàng</h2><p>Trạng thái được cập nhật tự động khi Hunda xử lý.</p></div></div><div class="table-wrap"><table><thead><tr><th>MÃ YÊU CẦU</th><th>TUYẾN / HÀNG HÓA</th><th>TRẠNG THÁI</th><th>CHỨNG TỪ</th><th></th></tr></thead><tbody>${orderRows}</tbody></table></div></section><section class="panel table-panel customer-documents-panel"><div class="panel-heading"><div><h2>Chứng từ đơn hàng</h2><p>Tệp bạn đã gửi được lưu trên máy chủ riêng tư.</p></div></div><div class="table-wrap"><table><thead><tr><th>TÊN TỆP</th><th>ĐƠN HÀNG</th><th>NGÀY TẢI</th><th></th></tr></thead><tbody>${documents}</tbody></table></div></section><p class="customer-footer-note">Thông tin trạng thái sẽ tự làm mới định kỳ và được chuyển đến bộ phận quản trị.</p></div></main></div><div id="modal-root"></div><div id="toast-host" class="toast-host"></div>`;
  document.querySelector("#logout")?.addEventListener("click", signOut);
  document.querySelector("#logout-customer")?.addEventListener("click", signOut);
  document.querySelector("#customer-refresh")?.addEventListener("click", () => Promise.all([loadCustomerData(), loadWalletSnapshot()]).then(render).catch(fail));
  document.querySelectorAll("[data-customer-page]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-customer-page]").forEach(item => item.classList.remove("active")); button.classList.add("active"); state.customerPage = button.dataset.customerPage; const target = state.customerPage === "quotes" ? ".customer-quotes-panel" : state.customerPage === "documents" ? ".customer-documents-panel" : ".customer-table-panel"; document.querySelector(target)?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  bindCustomerQuoteForm();
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
function orderTable(rows, actions) {
  if (!rows.length) return emptyState("box", "Chưa có đơn hàng", "Tạo đơn hàng đầu tiên để bắt đầu quản lý vận hành.", "new-order");
  return `<div class="table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>TUYẾN / HÀNG HÓA</th><th>GIÁ TRỊ</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th>${actions ? "<th></th>" : ""}</tr></thead><tbody>${rows.map(o => `<tr><td><b class="order-code">${escapeHTML(o.code)}</b></td><td><span class="customer-cell">${avatar(o.customer?.name)}<span>${escapeHTML(o.customer?.name || "Khách lẻ")}</span></span></td><td><b>${escapeHTML(o.route || "—")}</b><small class="subline">${escapeHTML(o.cargo_description || "Chưa có mô tả hàng")}</small>${o.quote_id ? '<small class="subline">Báo giá #' + escapeHTML(String(o.quote_id).slice(0, 8).toUpperCase()) + (state.quotes.find(q => q.id === o.quote_id)?.final_price_cny ? " · " + quoteCurrencyCny(state.quotes.find(q => q.id === o.quote_id).final_price_cny) : "") + '</small>' : ""}</td><td><b>${money(o.amount)}</b></td><td>${statusPill(o.status, "order")}</td><td>${dateText(o.created_at)}</td>${actions ? `<td><div class="row-actions"><button class="icon-button" title="Chứng từ" data-action="order-document" data-id="${o.id}">${icon("upload", 16)}</button><button class="icon-button" title="Sửa" data-action="edit-order" data-id="${o.id}">${icon("edit", 16)}</button><button class="icon-button danger" title="Xóa" data-action="delete-order" data-id="${o.id}">${icon("trash", 16)}</button></div></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}
function customersView() {
  const rows = state.customers.filter(c => [c.name, c.email, c.phone, c.company].join(" ").toLowerCase().includes(state.search));
  const table = !rows.length ? emptyState("users", "Chưa có khách hàng", "Thêm khách hàng để liên kết với đơn hàng.", "new-customer") : `<div class="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>CÔNG TY</th><th>LIÊN HỆ</th><th>SỐ ĐƠN</th><th>TỔNG GIÁ TRỊ ĐƠN</th><th></th></tr></thead><tbody>${rows.map(c => { const orders = state.orders.filter(o => o.customer_id === c.id); const total = orders.reduce((n, o) => n + Number(o.amount || 0), 0); return `<tr><td><span class="customer-cell">${avatar(c.name)}<span><b>${escapeHTML(c.name)}</b><small class="subline">${escapeHTML(c.email || "")}</small></span></span></td><td>${escapeHTML(c.company || "—")}</td><td>${escapeHTML(c.phone || "—")}</td><td>${orders.length}</td><td><b>${money(total)}</b></td><td><div class="row-actions"><button class="icon-button" data-action="edit-customer" data-id="${c.id}" title="Sửa">${icon("edit", 16)}</button><button class="icon-button danger" data-action="delete-customer" data-id="${c.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`; }).join("")}</tbody></table></div>`;
  const accounts = state.managedAccounts || [];
  const accountRows = accounts.length ? accounts.map(a => `<tr><td><b>${escapeHTML(a.full_name || "—")}</b><small class="subline">${escapeHTML(a.email || "")}</small></td><td>${escapeHTML(a.company || "—")}</td><td>${escapeHTML(a.phone || "—")}</td><td><span class="pill ${a.role === "admin" ? "in_progress" : "completed"}">${a.role === "admin" ? "Quản trị viên" : "Khách hàng"}</span></td><td><b class="wallet-balance">${money(a.balance)}</b></td><td><span class="pill ${a.active ? "completed" : "cancelled"}">${a.active ? (a.email_confirmed ? "Đang hoạt động" : "Chưa xác minh email") : "Đã khóa"}</span></td><td>${dateText(a.created_at)}</td></tr>`).join("") : `<tr><td colspan="7"><div class="empty-compact">Chưa có tài khoản khách hàng hoặc quản trị viên.</div></td></tr>`;
  const accountPanel = `<section class="panel table-panel account-access-panel"><div class="panel-heading"><div><h2>Tài khoản truy cập</h2><p>Số dư và vai trò của từng tài khoản.</p></div><button class="btn ghost small" data-action="wallet-settings">${icon("wallet", 15)} Tài khoản nhận tiền</button></div><div class="table-wrap"><table><thead><tr><th>NGƯỜI DÙNG</th><th>CÔNG TY</th><th>ĐIỆN THOẠI</th><th>VAI TRÒ</th><th>SỐ DƯ</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th></tr></thead><tbody>${accountRows}</tbody></table></div></section>`;
  const requests = state.walletAdmin?.requests || [];
  const pendingRequests = requests.filter(request => request.status === "pending");
  const requestRows = pendingRequests.length ? pendingRequests.map(item => `<tr><td><b>${escapeHTML(item.full_name || item.email || "Tài khoản")}</b><small class="subline">${escapeHTML(item.email || "")}</small></td><td>${item.transaction_type === "deposit" ? "Nạp tiền" : "Rút tiền"}<small class="subline">${escapeHTML(item.note || "")}</small></td><td><b>${money(item.amount)}</b></td><td>${item.transaction_type === "withdrawal" ? escapeHTML([item.bank_name, item.bank_account, item.bank_holder].filter(Boolean).join(" · ")) : "Chuyển khoản đến tài khoản Hunda"}</td><td>${dateText(item.created_at)}</td><td><div class="row-actions"><button class="btn primary small" data-action="wallet-approve" data-id="${item.id}">Duyệt</button><button class="btn ghost small" data-action="wallet-reject" data-id="${item.id}">Từ chối</button></div></td></tr>`).join("") : `<tr><td colspan="6"><div class="empty-compact">Không có yêu cầu nạp hoặc rút tiền đang chờ.</div></td></tr>`;
  const walletRequestsPanel = `<section class="panel table-panel wallet-requests-panel"><div class="panel-heading"><div><h2>Yêu cầu nạp và rút tiền</h2><p>Chỉ duyệt nạp tiền sau khi đã xác nhận khoản chuyển đến.</p></div></div><div class="table-wrap"><table><thead><tr><th>TÀI KHOẢN</th><th>LOẠI</th><th>SỐ TIỀN</th><th>THÔNG TIN</th><th>NGÀY TẠO</th><th></th></tr></thead><tbody>${requestRows}</tbody></table></div></section>`;
  return `${accountPanel}${walletRequestsPanel}<section class="panel table-panel customer-records-panel">${toolbar("Tìm tên, công ty, email...")}${table}</section>`;
}
function transactionsView() {
  const rows = state.transactions.filter(t => [t.category, t.note, t.reference, t.customer?.name, t.order?.code].join(" ").toLowerCase().includes(state.search));
  const income = rows.filter(t => t.direction === "income" && t.status === "paid").reduce((n, t) => n + Number(t.amount), 0); const expense = rows.filter(t => t.direction === "expense" && t.status === "paid").reduce((n, t) => n + Number(t.amount), 0);
  const table = !rows.length ? emptyState("wallet", "Chưa có giao dịch", "Ghi nhận khoản thu hoặc chi đầu tiên.", "new-transaction") : `<div class="table-wrap"><table><thead><tr><th>NGÀY</th><th>NỘI DUNG</th><th>ĐỐI TƯỢNG</th><th>PHƯƠNG THỨC</th><th>TRẠNG THÁI</th><th class="align-right">SỐ TIỀN</th><th></th></tr></thead><tbody>${rows.map(t => `<tr><td>${dateText(t.transaction_date)}</td><td><span class="transaction-cell"><i class="transaction-mark ${t.direction}">${icon(t.direction === "income" ? "download" : "wallet", 15)}</i><span><b>${escapeHTML(t.category)}</b><small class="subline">${escapeHTML(t.note || t.reference || "")}</small></span></span></td><td>${escapeHTML(t.customer?.name || t.order?.code || "—")}</td><td>${escapeHTML(t.method || "—")}</td><td>${statusPill(t.status, "transaction")}</td><td class="align-right"><b class="${t.direction === "income" ? "amount-in" : "amount-out"}">${t.direction === "income" ? "+" : "−"}${money(t.amount)}</b></td><td><div class="row-actions"><button class="icon-button" data-action="edit-transaction" data-id="${t.id}" title="Sửa">${icon("edit", 16)}</button><button class="icon-button danger" data-action="delete-transaction" data-id="${t.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="mini-summary"><div><span>Tổng thu đã xác nhận</span><b class="amount-in">${money(income)}</b></div><div><span>Tổng chi đã xác nhận</span><b class="amount-out">${money(expense)}</b></div><div><span>Số giao dịch</span><b>${rows.length}</b></div></div><section class="panel table-panel">${toolbar("Tìm nội dung, mã đơn, khách hàng...")}${table}</section>`;
}
function reportsView() {
  const rows = state.transactions.filter(t => String(t.transaction_date).slice(0, 7) === state.month);
  const paidRows = rows.filter(t => t.status === "paid");
  const receipts = paidRows.filter(t => t.direction === "income").reduce((n, t) => n + Number(t.amount || 0), 0);
  const expense = paidRows.filter(t => t.direction === "expense").reduce((n, t) => n + Number(t.amount || 0), 0);
  const currentProfit = receipts - expense;
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
  state.transactions.filter(t => t.status === "paid" && t.direction === "income" && t.order_id).forEach(t => {
    paidByOrder.set(t.order_id, (paidByOrder.get(t.order_id) || 0) + Number(t.amount || 0));
  });
  const receivable = monthOrders.reduce((n, order) => n + Math.max(0, Number(order.amount || 0) - (paidByOrder.get(order.id) || 0)), 0);
  const max = Math.max(1, receipts, expense); const groups = new Map();
  paidRows.forEach(t => { const k = t.category || "Khác"; const g = groups.get(k) || { name: k, income: 0, expense: 0 }; g[t.direction] += Number(t.amount || 0); groups.set(k, g); });
  return `<div class="report-summary">
    <article class="report-card"><span>Doanh thu đơn hàng</span><b class="amount-in">${money(revenue)}</b><small>${monthOrders.length} đơn, không gồm đơn đã hủy · ${monthLabel(state.month)}</small></article>
    <article class="report-card"><span>Chi phí đã thanh toán</span><b class="amount-out">${money(expense)}</b><small>Giao dịch chi đã xác nhận · ${monthLabel(state.month)}</small></article>
    <article class="report-card emphasis"><span>Lợi nhuận hiện tại</span><b class="${currentProfit < 0 ? "negative" : ""}">${money(currentProfit)}</b><small>Tiền đã thu trừ chi phí đã thanh toán trong tháng</small></article>
    <article class="report-card emphasis"><span>Lợi nhuận dự kiến</span><b class="${expectedProfit < 0 ? "negative" : ""}">${money(expectedProfit)}</b><small>Doanh thu trừ chi phí dự kiến · ${monthOrders.length - ordersMissingCost}/${monthOrders.length} đơn đã nhập chi phí</small></article>
    <article class="report-card"><span>Tiền đã thu</span><b class="amount-in">${money(receipts)}</b><small>Khoản thu đã thanh toán · ${monthLabel(state.month)}</small></article>
    <article class="report-card"><span>Phải thu</span><b>${money(receivable)}</b><small>Đơn tạo trong tháng trừ khoản thu đã gắn với đơn</small></article>
    <article class="report-card"><span>Giao dịch đang chờ</span><b>${money(pending)}</b><small>Chưa cộng vào dòng tiền thực tế</small></article>
  </div><div class="report-grid"><section class="panel report-chart-panel"><div class="panel-heading"><div><h2>So sánh thu và chi</h2><p>${monthLabel(state.month)} · VND</p></div></div><div class="compare-chart"><div class="compare-item"><div class="compare-bar"><i class="income" style="height:${Math.max(receipts ? 5 : 0, receipts / max * 100)}%"></i></div><b>${money(receipts)}</b><span>Tiền đã thu</span></div><div class="compare-item"><div class="compare-bar"><i class="expense" style="height:${Math.max(expense ? 5 : 0, expense / max * 100)}%"></i></div><b>${money(expense)}</b><span>Chi phí đã trả</span></div><div class="compare-item"><div class="compare-bar"><i class="net" style="height:${Math.max(currentProfit ? 5 : 0, Math.abs(currentProfit) / max * 100)}%"></i></div><b>${money(currentProfit)}</b><span>Lãi dòng tiền</span></div></div></section><section class="panel"><div class="panel-heading"><div><h2>Theo danh mục</h2><p>Giao dịch đã thanh toán</p></div></div>${groups.size ? `<div class="category-list">${[...groups.values()].sort((a, b) => b.income + b.expense - a.income - a.expense).map(g => `<div class="category-row"><span>${escapeHTML(g.name)}</span><span class="amount-in">${g.income ? `+ ${money(g.income)}` : "—"}</span><span class="amount-out">${g.expense ? `− ${money(g.expense)}` : "—"}</span></div>`).join("")}</div>` : `<div class="empty-compact">Chưa có giao dịch đã xác nhận trong tháng này.</div>`}</section></div><div class="report-footnote">Lợi nhuận hiện tại ở đây là lãi dòng tiền (thu đã thanh toán − chi đã thanh toán). Lợi nhuận dự kiến tính trên đơn không bị hủy trong tháng tạo đơn; đơn chưa nhập chi phí dự kiến đang tạm tính chi phí bằng 0. Khoản phải thu chỉ được trừ giao dịch thu đã liên kết với đúng đơn hàng; hãy gắn giao dịch vào đơn để đối soát chính xác.</div>`;
}
function documentsView() {
  const rows = state.documents.filter(d => [d.file_name, d.order?.code, d.note].join(" ").toLowerCase().includes(state.search));
  const table = !rows.length ? emptyState("file", "Chưa có chứng từ", "Tải hóa đơn, biên nhận hoặc chứng từ vận chuyển lên máy chủ.", "new-document") : `<div class="table-wrap"><table><thead><tr><th>TÊN TỆP</th><th>ĐƠN HÀNG</th><th>GHI CHÚ</th><th>DUNG LƯỢNG</th><th>NGÀY TẢI</th><th></th></tr></thead><tbody>${rows.map(d => `<tr><td><span class="file-cell"><i class="file-icon">${icon("file", 17)}</i><span><b>${escapeHTML(d.file_name)}</b><small class="subline">${escapeHTML(d.mime_type || "Tệp đính kèm")}</small></span></span></td><td><b>${escapeHTML(d.order?.code || "—")}</b></td><td>${escapeHTML(d.note || "—")}</td><td>${formatSize(d.file_size)}</td><td>${dateText(d.created_at)}</td><td><div class="row-actions"><button class="icon-button" data-action="download-document" data-id="${d.id}" title="Tải xuống">${icon("download", 16)}</button><button class="icon-button danger" data-action="delete-document" data-id="${d.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="document-note">${icon("shield", 18)} Chứng từ được lưu trong kho riêng tư. Chỉ tài khoản quản trị đã được phê duyệt mới có thể xem hoặc tải tệp.</div><section class="panel table-panel">${toolbar("Tìm tên tệp hoặc mã đơn...")}${table}</section>`;
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
    const note = q.admin_note ? '<small class="subline">' + escapeHTML(q.admin_note) + '</small>' : "";
    return '<tr><td><b>' + dateText(q.created_at) + '</b><small class="subline">#' + escapeHTML(String(q.id).slice(0, 8).toUpperCase()) + '</small></td><td>' + Number(q.actual_weight_kg).toLocaleString("vi-VN") + ' kg</td><td>' + Number(q.volume_cbm).toLocaleString("vi-VN") + ' m³</td><td>' + Number(q.chargeable_weight_kg).toLocaleString("vi-VN") + ' kg</td><td><b>' + displayed + '</b>' + secondary + '</td><td><span class="quote-status ' + (approved ? "approved" : "pending") + '">' + status + '</span>' + note + '</td></tr>';
  }).join("");
  return '<section class="panel customer-quotes-panel"><div class="panel-heading"><div><h2>Tạo báo giá</h2><p>Gửi thông số hàng hóa để Hunda kiểm tra và chốt giá cuối cùng.</p></div></div>' +
    '<form id="customer-quote-form" class="customer-quote-form"><div class="customer-quote-fields">' +
    '<label class="quote-field"><span>Khối lượng thực tế (kg)</span><input id="quote-kgs" type="number" min="0" step="0.001" value="' + escapeHTML(state.quoteDraft?.actual ?? "0") + '" inputmode="decimal"></label>' +
    '<label class="quote-field"><span>Thể tích hàng (CBM)</span><input id="quote-cbm" type="number" min="0" step="0.0001" value="' + escapeHTML(state.quoteDraft?.cbm ?? "0") + '" inputmode="decimal"></label></div>' +
    '<p class="quote-formula">Trọng lượng quy đổi = CBM × 250. Trọng lượng tính giá là số lớn hơn giữa kg thực tế và kg quy đổi.</p>' +
    '<div class="quote-calc-grid"><div><span>Kg quy đổi (x)</span><b id="quote-volume-weight">0 kg</b></div><div><span>Trọng lượng tính giá</span><b id="quote-chargeable-weight">0 kg</b></div><div class="quote-total"><span>Giá tạm tính (e = kg tính giá × 7,75)</span><b id="quote-estimate-cny">0,00 ¥</b></div></div>' +
    '<label class="quote-convert"><input id="quote-convert-vnd" type="checkbox" ' + (state.quoteDraft?.convert ? "checked" : "") + '><span>Hiển thị thêm VND theo tỷ giá 1 CNY = 3.950 VND</span></label>' +
    '<div class="quote-vnd-result" id="quote-vnd-result" hidden><span>Giá tạm tính quy đổi (t = e × 3.950)</span><b id="quote-estimate-vnd">0 ₫</b></div>' +
    '<div class="quote-submit-row"><span>Báo giá sẽ ở trạng thái chờ quản trị viên phê duyệt.</span><button type="submit" class="btn primary">' + icon("arrow", 15) + ' Gửi yêu cầu báo giá</button></div></form>' +
    '<div class="panel-heading quote-history-heading"><div><h2>Lịch sử báo giá</h2><p>Giá cuối cùng chỉ được áp dụng sau khi Hunda phê duyệt.</p></div></div>' +
    '<div class="table-wrap"><table><thead><tr><th>NGÀY GỬI</th><th>KG THỰC TẾ</th><th>THỂ TÍCH</th><th>KG TÍNH GIÁ</th><th>GIÁ</th><th>TRẠNG THÁI</th></tr></thead><tbody>' +
    (history || '<tr><td colspan="6"><div class="empty-compact">Bạn chưa gửi yêu cầu báo giá nào.</div></td></tr>') +
    '</tbody></table></div></section>';
}
function bindCustomerQuoteForm() {
  const form = document.querySelector("#customer-quote-form");
  if (!form) return;
  const refresh = () => {
    const actualInput = form.querySelector("#quote-kgs");
    const cbmInput = form.querySelector("#quote-cbm");
    const convertInput = form.querySelector("#quote-convert-vnd");
    state.quoteDraft = { actual: actualInput.value, cbm: cbmInput.value, convert: convertInput.checked };
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
  form.querySelectorAll("input").forEach(input => input.addEventListener("input", refresh));
  form.querySelector("#quote-convert-vnd").addEventListener("change", refresh);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const actual = Number(form.querySelector("#quote-kgs").value) || 0;
    const cbm = Number(form.querySelector("#quote-cbm").value) || 0;
    if (actual <= 0 && cbm <= 0) { showToast("Nhập khối lượng hoặc thể tích hàng trước khi gửi.", "error"); return; }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true; button.innerHTML = '<span class="spinner"></span> Đang gửi';
    try {
      await api("customer_quotes?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ actual_weight_kg: actual, volume_cbm: cbm, convert_to_vnd: form.querySelector("#quote-convert-vnd").checked }) });
      state.quoteDraft = { actual: "0", cbm: "0", convert: false };
      await loadCustomerData(); render(); showToast("Đã gửi yêu cầu báo giá để Hunda phê duyệt.");
    } catch (error) {
      fail(error); button.disabled = false; button.innerHTML = icon("arrow", 15) + " Gửi yêu cầu báo giá";
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
    return '<tr><td><b>' + dateText(q.created_at) + '</b><small class="subline">#' + escapeHTML(String(q.id).slice(0, 8).toUpperCase()) + '</small></td><td><b>' + escapeHTML(nameFor(q.user_id)) + '</b></td><td>' + Number(q.actual_weight_kg).toLocaleString("vi-VN") + ' kg<small class="subline">' + Number(q.volume_cbm).toLocaleString("vi-VN") + ' CBM</small></td><td>' + Number(q.chargeable_weight_kg).toLocaleString("vi-VN") + ' kg</td><td><b>' + cny + '</b>' + vnd + '</td><td>' + status + '</td><td>' + action + '</td></tr>';
  }).join("");
  return '<div class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Chờ duyệt</span><i class="stat-icon amber">' + icon("clock", 17) + '</i></div><strong>' + pending + '</strong><small>Yêu cầu báo giá mới</small></article><article class="stat-card"><div class="stat-top"><span>Tổng yêu cầu</span><i class="stat-icon blue">' + icon("file", 17) + '</i></div><strong>' + (state.quotes || []).length + '</strong><small>Đồng bộ từ không gian khách hàng</small></article></div>' +
    '<section class="panel table-panel"><div class="panel-heading"><div><h2>Luồng yêu cầu báo giá</h2><p>Nhập giá cuối cùng để phê duyệt và gửi lại cho khách hàng.</p></div></div><div class="table-wrap"><table><thead><tr><th>NGÀY GỬI</th><th>KHÁCH HÀNG</th><th>KG / CBM</th><th>KG TÍNH GIÁ</th><th>TẠM TÍNH / CHỐT</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="7"><div class="empty-compact">Chưa có yêu cầu báo giá nào.</div></td></tr>') + '</tbody></table></div></section>';
}
function quoteApprovalModal(id) {
  const quote = (state.quotes || []).find(item => item.id === id);
  if (!quote) return;
  const isApproved = quote.status === "approved";
  const customer = state.customerAccounts.find(item => item.user_id === quote.user_id)?.full_name || "Khách hàng";
  const finalPrice = isApproved ? quote.final_price_cny : quote.estimated_price_cny;
  const finalVnd = isApproved ? Number(quote.final_price_cny || 0) * 3950 : quote.estimated_price_vnd;
  const fields = field("Khách hàng", "<p>" + escapeHTML(customer) + "</p>") +
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
function formatSize(bytes = 0) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function avatar(name = "?") { const colors = ["mint", "peach", "lavender", "sky", "butter"]; const n = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0); return `<i class="avatar ${colors[n % colors.length]}">${escapeHTML(name.trim().slice(0, 1).toUpperCase())}</i>`; }
function statusPill(value, type) {
  const labels = type === "order" ? { new: "Mới tiếp nhận", in_progress: "Đang vận chuyển", completed: "Hoàn tất", cancelled: "Đã hủy" } : { paid: "Đã thanh toán", pending: "Đang chờ", cancelled: "Đã hủy" };
  return `<span class="pill ${escapeHTML(value)}"><i></i>${labels[value] || value}</span>`;
}
function emptyState(ico, title, desc, action) { return `<div class="empty-state"><span class="empty-icon">${icon(ico, 24)}</span><b>${title}</b><p>${desc}</p><button class="btn primary small" data-action="${action}">${icon("plus", 15)} Thêm mới</button></div>`; }

function openModal(title, body, submitLabel = "Lưu thông tin") {
  document.querySelector("#modal-root").innerHTML = `<div class="modal-backdrop" data-modal-close><section class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button type="button" class="icon-button" data-modal-close>${icon("close", 19)}</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button type="button" class="btn ghost" data-modal-close>Hủy</button><button type="submit" form="record-form" class="btn primary">${submitLabel}</button></div></section></div>`;
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
  if (actionName === "refresh") { loadData().then(render).catch(fail); return; }
  if (actionName === "new-order") return orderModal();
  if (actionName === "edit-order") return orderModal(state.orders.find(o => o.id === id));
  if (actionName === "delete-order") return confirmDelete("đơn hàng", id, "orders");
  if (actionName === "new-customer") return customerModal();
  if (actionName === "new-account") return managedAccountModal();
  if (actionName === "wallet-deposit") return walletTransactionModal("deposit");
  if (actionName === "wallet-withdraw") return walletTransactionModal("withdrawal");
  if (actionName === "wallet-settings") return walletSettingsModal();
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
  const fields = `${textInput("code", "Mã đơn hàng", order?.code || `HND-${new Date().getFullYear()}-${String(state.orders.length + 1).padStart(4, "0")}`, "HND-2026-0001", "text", true)}${selectInput("customer_id", "Khách hàng", customerOptions(order?.customer_id || ""), order?.customer_id || "")}${textInput("route", "Tuyến vận chuyển", order?.route || "", "VD: TP. Hồ Chí Minh → Hà Nội", "text", true)}${textInput("cargo_description", "Mô tả hàng hóa", order?.cargo_description || "", "Tên hàng, số kiện, khối lượng...")}${textInput("amount", "Giá trị đơn (VND)", order?.amount || "", "0", "number", true)}${textInput("expected_cost", "Chi phí dự kiến (VND)", order?.expected_cost || "", "0", "number")}${selectInput("status", "Trạng thái", [["new", "Mới tiếp nhận"], ["in_progress", "Đang vận chuyển"], ["completed", "Hoàn tất"], ["cancelled", "Đã hủy"]].map(([v, t]) => `<option value="${v}" ${order?.status === v ? "selected" : ""}>${t}</option>`).join(""), order?.status || "new")}${textareaInput("note", "Ghi chú", order?.note || "", "Thông tin thêm về đơn hàng")}`;
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
function walletTransactionModal(type) {
  const deposit = type === "deposit";
  const bank = state.wallet?.bank || {};
  const memo = `${bank.transfer_note || "HUNDA"}-${String(state.user?.id || "").slice(0, 8).toUpperCase()}`;
  const bankDetails = bank.bank_name && bank.bank_account && bank.bank_holder
    ? `<div class="wallet-bank-info"><b>${escapeHTML(bank.bank_name)}</b><span>Chủ tài khoản: ${escapeHTML(bank.bank_holder)}</span><strong>${escapeHTML(bank.bank_account)}</strong><span>Nội dung chuyển khoản: <b>${escapeHTML(memo)}</b></span></div>`
    : `<div class="wallet-bank-info pending"><b>Tài khoản nhận tiền đang chờ cấu hình.</b><span>Vui lòng liên hệ Hunda trước khi chuyển khoản.</span></div>`;
  const fields = deposit
    ? `${field("Chuyển khoản đến", bankDetails, true)}${textInput("amount", "Số tiền nạp (VND) *", "", "Ví dụ: 500000", "number", true)}${field("Xác nhận", `<p class="form-hint">Sau khi chuyển khoản, gửi yêu cầu để Hunda xác nhận. Số dư chỉ tăng khi quản trị viên duyệt.</p>`, true)}`
    : `${field("Số dư khả dụng", `<p class="wallet-available">${money(state.wallet?.balance || 0)}</p>`)}${field("Số tiền rút (VND) *", `<input name="amount" type="number" min="100000" step="1000" placeholder="Tối thiểu 100.000đ" required />`)}${textInput("bank_name", "Ngân hàng nhận *", "", "Tên ngân hàng", "text", true)}${textInput("bank_account", "Số tài khoản nhận *", "", "Số tài khoản", "text", true)}${textInput("bank_holder", "Chủ tài khoản nhận *", "", "Họ tên chủ tài khoản", "text", true)}${field("Lưu ý", `<p class="form-hint">Mỗi lần rút tối thiểu 100.000đ. Số tiền sẽ được giữ chỗ trong khi quản trị viên xử lý.</p>`, true)}`;
  openModal(deposit ? "Nạp tiền vào ví" : "Yêu cầu rút tiền", formShell(deposit ? "wallet-deposit" : "wallet-withdrawal", "", fields), deposit ? "Tôi đã chuyển khoản" : "Gửi yêu cầu rút");
}
function walletSettingsModal() {
  const bank = state.walletAdmin?.bank || {};
  const fields = `${textInput("bank_name", "Ngân hàng", bank.bank_name || "", "Tên ngân hàng", "text", true)}${textInput("bank_account", "Số tài khoản", bank.bank_account || "", "Số tài khoản nhận tiền", "text", true)}${textInput("bank_holder", "Tên chủ tài khoản", bank.bank_holder || "", "Tên trên tài khoản ngân hàng", "text", true)}${textInput("transfer_note", "Tiền tố nội dung chuyển khoản", bank.transfer_note || "HUNDA", "HUNDA", "text", true)}${field("Hiển thị cho khách hàng", `<p class="form-hint">Thông tin này sẽ xuất hiện khi khách hàng chọn Nạp tiền.</p>`, true)}`;
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
  const roles = `<option value="customer" selected>Khách hàng — chỉ xem hồ sơ và đơn hàng của mình</option><option value="admin">Quản trị viên — quản lý toàn bộ hệ thống</option>`;
  const fields = `${selectInput("role", "Vai trò truy cập", roles, "customer", true)}${textInput("full_name", "Họ và tên", "", "Nguyễn Văn An", "text", true)}${textInput("email", "Email đăng nhập", "", "email@congty.vn", "email", true)}${textInput("phone", "Số điện thoại", "", "09xx xxx xxx", "tel")}${textInput("company", "Tên công ty", "", "Tên doanh nghiệp")}${textInput("password", "Mật khẩu khởi tạo", "", "Tối thiểu 8 ký tự", "password", true)}${field("Phân quyền", `<p class="form-hint">Quản trị viên được quản lý toàn bộ dữ liệu vận hành. Khách hàng chỉ truy cập hồ sơ và đơn hàng của mình.</p>`, true)}`;
  openModal("Cấp tài khoản truy cập", formShell("managed-account", "", fields), "Tạo tài khoản");
}
function customerModal(customer) {
  const fields = `${textInput("name", "Tên khách hàng", customer?.name || "", "Họ tên hoặc tên doanh nghiệp", "text", true)}${textInput("company", "Tên công ty", customer?.company || "", "Tên doanh nghiệp")}${textInput("phone", "Số điện thoại", customer?.phone || "", "090...", "tel")}${textInput("email", "Email", customer?.email || "", "email@company.vn", "email")}${textareaInput("note", "Ghi chú", customer?.note || "", "Địa chỉ, mã số thuế...")}`;
  openModal(customer ? "Cập nhật khách hàng" : "Thêm khách hàng", formShell("customer", customer?.id, fields), customer ? "Lưu thay đổi" : "Thêm khách hàng");
}
function transactionModal(transaction) {
  const fields = `${selectInput("direction", "Loại giao dịch", `<option value="income" ${transaction?.direction === "income" ? "selected" : ""}>Khoản thu</option><option value="expense" ${transaction?.direction === "expense" ? "selected" : ""}>Khoản chi</option>`, transaction?.direction || "income")}${textInput("category", "Danh mục", transaction?.category || "", "Cước vận chuyển, nhiên liệu...", "text", true)}${textInput("amount", "Số tiền (VND)", transaction?.amount || "", "0", "number", true)}${textInput("transaction_date", "Ngày giao dịch", transaction?.transaction_date || isoDate(), "", "date", true)}${selectInput("status", "Trạng thái thanh toán", `<option value="paid" ${transaction?.status === "paid" ? "selected" : ""}>Đã thanh toán</option><option value="pending" ${transaction?.status === "pending" ? "selected" : ""}>Đang chờ</option><option value="cancelled" ${transaction?.status === "cancelled" ? "selected" : ""}>Đã hủy</option>`, transaction?.status || "paid")}${selectInput("method", "Phương thức", ["Chuyển khoản", "Tiền mặt", "Thẻ", "Ví điện tử", "Khác"].map(v => `<option ${transaction?.method === v ? "selected" : ""}>${v}</option>`).join(""), transaction?.method || "Chuyển khoản")}${selectInput("customer_id", "Khách hàng", customerOptions(transaction?.customer_id || ""), transaction?.customer_id || "")}${selectInput("order_id", "Đơn hàng liên quan", orderOptions(transaction?.order_id || ""), transaction?.order_id || "")}${textInput("reference", "Mã tham chiếu", transaction?.reference || "", "Mã giao dịch ngân hàng")}${textareaInput("note", "Ghi chú", transaction?.note || "", "Nội dung khoản thu / chi")}`;
  openModal(transaction ? "Cập nhật giao dịch" : "Ghi nhận thu chi", formShell("transaction", transaction?.id, fields), transaction ? "Lưu thay đổi" : "Ghi nhận");
}
function documentModal(document, orderId = "") {
  const fields = `${selectInput("order_id", "Đơn hàng liên quan", orderOptions(order?.order_id || orderId), order?.order_id || orderId)}${field("Chọn chứng từ *", `<input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" required />`, true)}${textareaInput("note", "Ghi chú", order?.note || "", "Loại chứng từ, số hóa đơn...")}`;
  openModal("Tải chứng từ lên máy chủ", formShell("document", "", fields), "Tải lên");
}
async function handleRecordSubmit(e) {
  e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); const kind = form.dataset.kind; const id = form.dataset.id; const button = document.querySelector(".modal-foot [type=submit]"); button.disabled = true; button.innerHTML = '<span class="spinner"></span> Đang lưu';
  try {
    if (kind === "wallet-settings") {
      const result = await walletRequest({ action: "admin-settings", settings: { bank_name: String(data.get("bank_name") || "").trim(), bank_account: String(data.get("bank_account") || "").trim(), bank_holder: String(data.get("bank_holder") || "").trim(), transfer_note: String(data.get("transfer_note") || "HUNDA").trim() } });
      if (!result?.bank) throw new Error("Máy chủ chưa xác nhận thông tin nhận tiền.");
    } else if (kind === "wallet-deposit" || kind === "wallet-withdrawal") {
      const result = await walletRequest({ action: "request", transaction_type: kind === "wallet-deposit" ? "deposit" : "withdrawal", amount: Number(data.get("amount")), bank_name: String(data.get("bank_name") || "").trim(), bank_account: String(data.get("bank_account") || "").trim(), bank_holder: String(data.get("bank_holder") || "").trim(), note: kind === "wallet-deposit" ? `${state.wallet?.bank?.transfer_note || "HUNDA"}-${String(state.user?.id || "").slice(0, 8).toUpperCase()}` : "" });
      if (!result?.transaction_id) throw new Error("Máy chủ chưa tiếp nhận yêu cầu.");
    } else if (kind === "managed-account") {
      const result = await accountAdminRequest({ action: "create", account: { role: String(data.get("role")), full_name: String(data.get("full_name") || "").trim(), email: String(data.get("email") || "").trim(), phone: String(data.get("phone") || "").trim(), company: String(data.get("company") || "").trim(), password: String(data.get("password") || "") } });
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
    closeModal(); if (state.workspace === "customer") { await loadCustomerData(); if (kind === "wallet-deposit" || kind === "wallet-withdrawal") await loadWalletSnapshot(); } else await loadData(); render(); showToast(kind === "managed-account" ? "Đã cấp tài khoản và đồng bộ hồ sơ lên máy chủ." : kind === "wallet-settings" ? "Đã lưu tài khoản nhận tiền." : kind === "wallet-deposit" || kind === "wallet-withdrawal" ? "Yêu cầu đã gửi để quản trị viên xác nhận." : "Đã lưu và đồng bộ dữ liệu.");
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
  const [customers, orders, transactions, documents, activity, customerAccounts, quotes, managedAccounts, walletAdmin] = await Promise.all([
    api("customers?select=*&order=created_at.desc"),
    api("orders?select=*,customer:customers(name)&order=created_at.desc"),
    api("transactions?select=*,customer:customers(name),order:orders(code)&order=transaction_date.desc,created_at.desc"),
    api("order_documents?select=*,order:orders(code)&order=created_at.desc"),
    api("activity_log?select=*&order=occurred_at.desc&limit=200"),
    api("customer_accounts?select=user_id,customer_id,full_name&order=created_at.desc"),
    api("customer_quotes?select=*&order=created_at.desc"),
    accountAdminRequest({ action: "list" }),
    walletRequest({ action: "admin-list" })
  ]);
  state.customers = customers || [];
  state.orders = orders || [];
  state.transactions = transactions || [];
  state.documents = documents || [];
  state.activity = activity || [];
  state.customerAccounts = customerAccounts || [];
  state.quotes = quotes || [];
  state.managedAccounts = managedAccounts?.accounts || [];
  state.walletAdmin = walletAdmin || { requests: [], bank: null };
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
  try { const rows = await api(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(state.user.id)}&active=eq.true`); return rows.length > 0; }
  catch { return false; }
}
async function authRequest(route, body) { return request(`/auth/v1/${route}`, { method: "POST", body: JSON.stringify(body) }, false); }
async function signIn(email, password) {
  const session = await authRequest("token?grant_type=password", { email, password }); saveSession(session); state.user = session.user || null;
  await enterApp();
}
async function signUp(email, password, profile) {
  const result = await authRequest("signup", { email, password, data: profile });
  if (result.access_token) { saveSession(result); state.user = result.user || null; await enterApp(); }
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
  if (state.realtime) { try { await state.realtime.unsubscribe(); } catch {} state.realtime = null; }
  try { if (state.session?.access_token) await request("/auth/v1/logout", { method: "POST" }); } catch { /* Local sign-out still completes when the server session expired. */ }
  saveSession(null); state.user = null; state.workspace = "admin"; state.isAdmin = false; state.customerAccount = null; state.customerAccounts = []; state.customers = []; state.orders = []; state.customerOrders = []; state.transactions = []; state.documents = []; state.activity = []; state.wallet = null; state.walletAdmin = null; state.managedAccounts = []; authShell("login");
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
  if (!state.session?.access_token) { authShell("login"); return; }
  state.user = state.session.user || null;
  request("/auth/v1/user").then(user => { state.user = user; return enterApp(); }).catch(async () => { if (await refreshSession()) { const user = await request("/auth/v1/user"); state.user = user; await enterApp(); } else { saveSession(null); authShell("login"); } });
}
document.addEventListener("click", e => { const btn = e.target.closest("[data-action]"); if (btn) action(btn.dataset.action, btn.dataset.id); });
window.addEventListener("storage", e => { if (e.key === SESSION_KEY) location.reload(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.session) loadData().then(render).catch(() => {}); });
setInterval(() => { if (!document.hidden && state.session && state.workspace === "customer") Promise.all([loadCustomerData(), loadWalletSnapshot()]).then(() => { if (document.querySelector(".app-shell") && !document.querySelector(".modal-backdrop")) render(); }).catch(() => {}); }, 8000);
setInterval(() => { if (!document.hidden && state.session && state.workspace === "admin") loadData().then(() => { if (document.querySelector(".app-shell") && !document.querySelector(".modal-backdrop")) render(); }).catch(() => {}); }, 45000);
bootstrap();
