const root = document.querySelector("#app");
const cfg = window.HUNDA_CONFIG || {};
const DB_URL = String(cfg.supabaseUrl || "").replace(/\/$/, "");
const PUBLIC_KEY = cfg.publishableKey || "";
const BUCKET = "hunda-documents";
const SESSION_KEY = "hunda-auth-session";
const state = { page: "dashboard", session: readSession(), user: null, customers: [], orders: [], transactions: [], documents: [], search: "", month: new Date().toISOString().slice(0, 7) };

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
  root.innerHTML = `<main class="auth-page"><div class="auth-left"><div class="auth-brand"><img src="/assets/hunda-logo.jpg" alt="Hunda Bus Logistics" /></div><div class="auth-copy"><span class="eyebrow">VẬN HÀNH TRONG MỘT NƠI</span><h1>Quản lý hành trình.<br><em>Nắm chắc dòng tiền.</em></h1><p>Đơn hàng, khách hàng, chứng từ và tài chính được đồng bộ an toàn trên mọi thiết bị.</p><div class="auth-proof"><span>${icon("shield", 17)} Dữ liệu riêng tư</span><span>${icon("refresh", 17)} Đồng bộ máy chủ</span></div></div><div class="auth-foot">© ${new Date().getFullYear()} Hunda Logistics</div></div><section class="auth-right"><div class="auth-form-wrap"><div class="auth-mobile-logo"><img src="/assets/hunda-logo.jpg" alt="Hunda Bus Logistics" /></div><span class="eyebrow">${signup ? "TẠO TÀI KHOẢN" : "KHU VỰC QUẢN TRỊ"}</span><h2>${signup ? "Bắt đầu tài khoản" : "Chào mừng trở lại"}</h2><p class="muted">${signup ? "Tạo tài khoản Hunda Logistics của bạn." : "Đăng nhập để tiếp tục công việc hôm nay."}</p>${message ? `<div class="form-alert">${escapeHTML(message)}</div>` : ""}<form id="auth-form" data-view="${signup ? "signup" : "login"}"><label>Email công việc<input name="email" type="email" autocomplete="email" placeholder="ten@congty.vn" required /></label><label>Mật khẩu<input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" placeholder="Tối thiểu 8 ký tự" required /></label>${signup ? `<label>Nhập lại mật khẩu<input name="confirm" type="password" autocomplete="new-password" minlength="8" placeholder="Nhập lại mật khẩu" required /></label>` : ""}<button class="btn primary wide" type="submit">${signup ? "Tạo tài khoản" : "Đăng nhập"}${icon("arrow", 17)}</button></form><p class="auth-switch">${signup ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <button class="text-button" data-auth-view="${signup ? "login" : "signup"}">${signup ? "Đăng nhập" : "Tạo tài khoản"}</button></p><div class="auth-safe">${icon("shield", 15)} Tài khoản mới cần được quản trị viên phê duyệt quyền truy cập.</div></div></section></main><div id="toast-host" class="toast-host"></div>`;
  bindAuth();
}

function renderPending(email) {
  root.innerHTML = `<main class="setup-page"><section class="setup-card pending-card"><img class="setup-logo" src="/assets/hunda-logo.jpg" alt="Hunda Bus Logistics" /><div class="eyebrow">ĐANG CHỜ DUYỆT</div><h1>Tài khoản chưa được cấp quyền</h1><p><b>${escapeHTML(email || "")}</b> đã đăng nhập, nhưng chưa có quyền quản trị Hunda Logistics.</p><p>Chủ tài khoản cần thêm User ID của bạn vào bảng <code>public.admin_users</code> trong Supabase SQL Editor. Xem hướng dẫn trong README của dự án.</p><button class="btn ghost" id="logout-pending">${icon("logout", 16)} Đăng xuất</button></section></main>`;
  document.querySelector("#logout-pending")?.addEventListener("click", signOut);
}

const pages = [
  ["dashboard", "Tổng quan", "grid"], ["orders", "Đơn hàng", "box"], ["customers", "Khách hàng", "users"], ["transactions", "Thu chi", "wallet"], ["reports", "Báo cáo tài chính", "chart"], ["documents", "Chứng từ", "file"]
];
const pageTitles = { dashboard: ["Tổng quan", "Theo dõi hoạt động và dòng tiền của Hunda Logistics."], orders: ["Đơn hàng", "Quản lý vận chuyển từ lúc tiếp nhận đến khi hoàn tất."], customers: ["Khách hàng", "Lưu thông tin và theo dõi lịch sử hợp tác."], transactions: ["Thu chi", "Ghi nhận các khoản thu, chi và trạng thái thanh toán."], reports: ["Báo cáo tài chính", "Dòng tiền và kết quả theo các giao dịch đã xác nhận."], documents: ["Chứng từ", "Tệp đính kèm được lưu trong kho riêng tư trên máy chủ."] };

function shell(content) {
  const [title, subtitle] = pageTitles[state.page];
  root.innerHTML = `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><img class="brand-emblem" src="/assets/hunda-emblem.jpg" alt="" /><div><b>HUNDA <em>BUS</em></b><small>LOGISTICS × E-COMMERCE</small></div><button class="sidebar-close" id="close-sidebar" aria-label="Đóng menu">${icon("close", 17)}</button></div><div class="workspace"><span class="workspace-dot"></span><span><b>Hunda Logistics</b><small>Không gian vận hành</small></span>${icon("dots", 16)}</div><div class="nav-label">LÀM VIỆC</div><nav>${pages.map(([id, label, ico]) => `<button class="nav-item ${state.page === id ? "active" : ""}" data-page="${id}">${icon(ico, 18)}<span>${label}</span>${id === "orders" && state.orders.filter(o => !["completed", "cancelled"].includes(o.status)).length ? `<small>${state.orders.filter(o => !["completed", "cancelled"].includes(o.status)).length}</small>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="sync-card"><span class="sync-dot"></span><div><b>Đã đồng bộ</b><small>Dữ liệu trên máy chủ</small></div>${icon("refresh", 15)}</div><div class="user-row"><span class="avatar">${escapeHTML((state.user?.email || "H").slice(0, 1).toUpperCase())}</span><span class="user-info"><b>${escapeHTML(state.user?.email || "Quản trị viên")}</b><small>Quản trị viên</small></span><button class="icon-button logout-button" id="logout" title="Đăng xuất">${icon("logout", 17)}</button></div></div></aside><div class="sidebar-scrim" id="sidebar-scrim"></div><main class="main-area"><header class="topbar"><button class="mobile-menu icon-button" id="open-sidebar">${icon("menu", 20)}</button><div class="breadcrumb">Hunda Logistics <span>/</span> <b>${title}</b></div><div class="top-actions"><span class="sync-label">${icon("refresh", 15)} Đồng bộ máy chủ</span><button class="icon-button" id="refresh" title="Làm mới dữ liệu">${icon("refresh", 18)}</button><span class="top-avatar">${escapeHTML((state.user?.email || "H").slice(0, 1).toUpperCase())}</span></div></header><div class="page-content"><div class="page-heading"><div><span class="eyebrow">HUNDA LOGISTICS</span><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${pageAction()}</div></div>${content}</div></main></div><div id="modal-root"></div><div id="toast-host" class="toast-host"></div>`;
  bindShell();
}
function pageAction() {
  if (state.page === "orders") return `<button class="btn primary" data-action="new-order">${icon("plus", 17)} Tạo đơn hàng</button>`;
  if (state.page === "customers") return `<button class="btn primary" data-action="new-customer">${icon("plus", 17)} Thêm khách hàng</button>`;
  if (state.page === "transactions") return `<button class="btn primary" data-action="new-transaction">${icon("plus", 17)} Ghi nhận thu chi</button>`;
  if (state.page === "documents") return `<button class="btn primary" data-action="new-document">${icon("upload", 17)} Tải chứng từ</button>`;
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
  if (state.page === "dashboard") return shell(dashboardView());
  if (state.page === "orders") return shell(ordersView());
  if (state.page === "customers") return shell(customersView());
  if (state.page === "transactions") return shell(transactionsView());
  if (state.page === "reports") return shell(reportsView());
  return shell(documentsView());
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
  return `<div class="table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>TUYẾN / HÀNG HÓA</th><th>GIÁ TRỊ</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th>${actions ? "<th></th>" : ""}</tr></thead><tbody>${rows.map(o => `<tr><td><b class="order-code">${escapeHTML(o.code)}</b></td><td><span class="customer-cell">${avatar(o.customer?.name)}<span>${escapeHTML(o.customer?.name || "Khách lẻ")}</span></span></td><td><b>${escapeHTML(o.route || "—")}</b><small class="subline">${escapeHTML(o.cargo_description || "Chưa có mô tả hàng")}</small></td><td><b>${money(o.amount)}</b></td><td>${statusPill(o.status, "order")}</td><td>${dateText(o.created_at)}</td>${actions ? `<td><div class="row-actions"><button class="icon-button" title="Chứng từ" data-action="order-document" data-id="${o.id}">${icon("upload", 16)}</button><button class="icon-button" title="Sửa" data-action="edit-order" data-id="${o.id}">${icon("edit", 16)}</button><button class="icon-button danger" title="Xóa" data-action="delete-order" data-id="${o.id}">${icon("trash", 16)}</button></div></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}
function customersView() {
  const rows = state.customers.filter(c => [c.name, c.email, c.phone, c.company].join(" ").toLowerCase().includes(state.search));
  const table = !rows.length ? emptyState("users", "Chưa có khách hàng", "Thêm khách hàng để liên kết với đơn hàng.", "new-customer") : `<div class="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>CÔNG TY</th><th>LIÊN HỆ</th><th>SỐ ĐƠN</th><th>TỔNG GIÁ TRỊ ĐƠN</th><th></th></tr></thead><tbody>${rows.map(c => { const orders = state.orders.filter(o => o.customer_id === c.id); const total = orders.reduce((n, o) => n + Number(o.amount || 0), 0); return `<tr><td><span class="customer-cell">${avatar(c.name)}<span><b>${escapeHTML(c.name)}</b><small class="subline">${escapeHTML(c.email || "")}</small></span></span></td><td>${escapeHTML(c.company || "—")}</td><td>${escapeHTML(c.phone || "—")}</td><td>${orders.length}</td><td><b>${money(total)}</b></td><td><div class="row-actions"><button class="icon-button" data-action="edit-customer" data-id="${c.id}" title="Sửa">${icon("edit", 16)}</button><button class="icon-button danger" data-action="delete-customer" data-id="${c.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`; }).join("")}</tbody></table></div>`;
  return `<section class="panel table-panel">${toolbar("Tìm tên, công ty, email...")}${table}</section>`;
}
function transactionsView() {
  const rows = state.transactions.filter(t => [t.category, t.note, t.reference, t.customer?.name, t.order?.code].join(" ").toLowerCase().includes(state.search));
  const income = rows.filter(t => t.direction === "income" && t.status === "paid").reduce((n, t) => n + Number(t.amount), 0); const expense = rows.filter(t => t.direction === "expense" && t.status === "paid").reduce((n, t) => n + Number(t.amount), 0);
  const table = !rows.length ? emptyState("wallet", "Chưa có giao dịch", "Ghi nhận khoản thu hoặc chi đầu tiên.", "new-transaction") : `<div class="table-wrap"><table><thead><tr><th>NGÀY</th><th>NỘI DUNG</th><th>ĐỐI TƯỢNG</th><th>PHƯƠNG THỨC</th><th>TRẠNG THÁI</th><th class="align-right">SỐ TIỀN</th><th></th></tr></thead><tbody>${rows.map(t => `<tr><td>${dateText(t.transaction_date)}</td><td><span class="transaction-cell"><i class="transaction-mark ${t.direction}">${icon(t.direction === "income" ? "download" : "wallet", 15)}</i><span><b>${escapeHTML(t.category)}</b><small class="subline">${escapeHTML(t.note || t.reference || "")}</small></span></span></td><td>${escapeHTML(t.customer?.name || t.order?.code || "—")}</td><td>${escapeHTML(t.method || "—")}</td><td>${statusPill(t.status, "transaction")}</td><td class="align-right"><b class="${t.direction === "income" ? "amount-in" : "amount-out"}">${t.direction === "income" ? "+" : "−"}${money(t.amount)}</b></td><td><div class="row-actions"><button class="icon-button" data-action="edit-transaction" data-id="${t.id}" title="Sửa">${icon("edit", 16)}</button><button class="icon-button danger" data-action="delete-transaction" data-id="${t.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="mini-summary"><div><span>Tổng thu đã xác nhận</span><b class="amount-in">${money(income)}</b></div><div><span>Tổng chi đã xác nhận</span><b class="amount-out">${money(expense)}</b></div><div><span>Số giao dịch</span><b>${rows.length}</b></div></div><section class="panel table-panel">${toolbar("Tìm nội dung, mã đơn, khách hàng...")}${table}</section>`;
}
function reportsView() {
  const rows = state.transactions.filter(t => t.status === "paid" && String(t.transaction_date).slice(0, 7) === state.month);
  const income = rows.filter(t => t.direction === "income").reduce((n, t) => n + Number(t.amount), 0); const expense = rows.filter(t => t.direction === "expense").reduce((n, t) => n + Number(t.amount), 0); const pending = state.transactions.filter(t => t.status === "pending" && String(t.transaction_date).slice(0, 7) === state.month).reduce((n, t) => n + Number(t.amount), 0);
  const max = Math.max(1, income, expense); const groups = new Map(); rows.forEach(t => { const k = t.category || "Khác"; const g = groups.get(k) || { name: k, income: 0, expense: 0 }; g[t.direction] += Number(t.amount); groups.set(k, g); });
  return `<div class="report-summary"><article class="report-card"><span>Khoản thu đã xác nhận</span><b class="amount-in">${money(income)}</b><small>${monthLabel(state.month)}</small></article><article class="report-card"><span>Khoản chi đã xác nhận</span><b class="amount-out">${money(expense)}</b><small>${monthLabel(state.month)}</small></article><article class="report-card emphasis"><span>Kết quả thu − chi</span><b class="${income - expense < 0 ? "negative" : ""}">${money(income - expense)}</b><small>Ghi nhận theo dòng tiền thực thu / thực chi</small></article><article class="report-card"><span>Khoản đang chờ</span><b>${money(pending)}</b><small>Chưa tính vào dòng tiền</small></article></div><div class="report-grid"><section class="panel report-chart-panel"><div class="panel-heading"><div><h2>So sánh thu và chi</h2><p>${monthLabel(state.month)} · VND</p></div></div><div class="compare-chart"><div class="compare-item"><div class="compare-bar"><i class="income" style="height:${Math.max(income ? 5 : 0, income / max * 100)}%"></i></div><b>${money(income)}</b><span>Khoản thu</span></div><div class="compare-item"><div class="compare-bar"><i class="expense" style="height:${Math.max(expense ? 5 : 0, expense / max * 100)}%"></i></div><b>${money(expense)}</b><span>Khoản chi</span></div><div class="compare-item"><div class="compare-bar"><i class="net" style="height:${Math.max(income - expense ? 5 : 0, Math.abs(income - expense) / max * 100)}%"></i></div><b>${money(income - expense)}</b><span>Chênh lệch</span></div></div></section><section class="panel"><div class="panel-heading"><div><h2>Theo danh mục</h2><p>Giao dịch đã xác nhận</p></div></div>${groups.size ? `<div class="category-list">${[...groups.values()].sort((a, b) => b.income + b.expense - a.income - a.expense).map(g => `<div class="category-row"><span>${escapeHTML(g.name)}</span><span class="amount-in">${g.income ? `+ ${money(g.income)}` : "—"}</span><span class="amount-out">${g.expense ? `− ${money(g.expense)}` : "—"}</span></div>`).join("")}</div>` : `<div class="empty-compact">Chưa có giao dịch đã xác nhận trong tháng này.</div>`}</section></div><div class="report-footnote">Báo cáo này tính theo giao dịch đã đánh dấu “Đã thanh toán”. Đây là báo cáo dòng tiền, chưa thay thế báo cáo kế toán dồn tích hoặc báo cáo thuế.</div>`;
}
function documentsView() {
  const rows = state.documents.filter(d => [d.file_name, d.order?.code, d.note].join(" ").toLowerCase().includes(state.search));
  const table = !rows.length ? emptyState("file", "Chưa có chứng từ", "Tải hóa đơn, biên nhận hoặc chứng từ vận chuyển lên máy chủ.", "new-document") : `<div class="table-wrap"><table><thead><tr><th>TÊN TỆP</th><th>ĐƠN HÀNG</th><th>GHI CHÚ</th><th>DUNG LƯỢNG</th><th>NGÀY TẢI</th><th></th></tr></thead><tbody>${rows.map(d => `<tr><td><span class="file-cell"><i class="file-icon">${icon("file", 17)}</i><span><b>${escapeHTML(d.file_name)}</b><small class="subline">${escapeHTML(d.mime_type || "Tệp đính kèm")}</small></span></span></td><td><b>${escapeHTML(d.order?.code || "—")}</b></td><td>${escapeHTML(d.note || "—")}</td><td>${formatSize(d.file_size)}</td><td>${dateText(d.created_at)}</td><td><div class="row-actions"><button class="icon-button" data-action="download-document" data-id="${d.id}" title="Tải xuống">${icon("download", 16)}</button><button class="icon-button danger" data-action="delete-document" data-id="${d.id}" title="Xóa">${icon("trash", 16)}</button></div></td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="document-note">${icon("shield", 18)} Chứng từ được lưu trong kho riêng tư. Chỉ tài khoản quản trị đã được phê duyệt mới có thể xem hoặc tải tệp.</div><section class="panel table-panel">${toolbar("Tìm tên tệp hoặc mã đơn...")}${table}</section>`;
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
  if (actionName === "refresh") { loadData().then(render).catch(fail); return; }
  if (actionName === "new-order") return orderModal();
  if (actionName === "edit-order") return orderModal(state.orders.find(o => o.id === id));
  if (actionName === "delete-order") return confirmDelete("đơn hàng", id, "orders");
  if (actionName === "new-customer") return customerModal();
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
    if (kind === "document") await uploadDocument(data);
    else {
      const record = Object.fromEntries(data.entries());
      if (kind === "order") { record.customer_id = record.customer_id || null; record.amount = Number(record.amount); record.expected_cost = Number(record.expected_cost || 0); }
      if (kind === "customer") { record.email = record.email || null; record.phone = record.phone || null; }
      if (kind === "transaction") { record.customer_id = record.customer_id || null; record.order_id = record.order_id || null; record.amount = Number(record.amount); }
      if (id) await api(`${kind === "order" ? "orders" : kind === "customer" ? "customers" : "transactions"}?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(record) });
      else await api(kind === "order" ? "orders" : kind === "customer" ? "customers" : "transactions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(record) });
    }
    closeModal(); await loadData(); render(); showToast("Đã lưu và đồng bộ dữ liệu.");
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
  try { await request(`/storage/v1/object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: [doc.storage_path] }) }); await api(`order_documents?id=eq.${id}`, { method: "DELETE" }); await loadData(); render(); showToast("Đã xóa chứng từ."); } catch (error) { fail(error); }
}
async function confirmDelete(label, id, table) {
  if (!confirm(`Bạn có chắc muốn xóa ${label} này? Hành động này không thể hoàn tác.`)) return;
  try { await api(`${table}?id=eq.${id}`, { method: "DELETE" }); await loadData(); render(); showToast(`Đã xóa ${label}.`); } catch (error) { fail(error); }
}

async function loadData() {
  if (!state.session) return;
  const [customers, orders, transactions, documents] = await Promise.all([
    api("customers?select=*&order=created_at.desc"),
    api("orders?select=*,customer:customers(name)&order=created_at.desc"),
    api("transactions?select=*,customer:customers(name),order:orders(code)&order=transaction_date.desc,created_at.desc"),
    api("order_documents?select=*,order:orders(code)&order=created_at.desc")
  ]);
  state.customers = customers || []; state.orders = orders || []; state.transactions = transactions || []; state.documents = documents || [];
}
async function checkAdmin() {
  try { const rows = await api(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(state.user.id)}&active=eq.true`); return rows.length > 0; }
  catch { return false; }
}
async function authRequest(route, body) { return request(`/auth/v1/${route}`, { method: "POST", body: JSON.stringify(body) }, false); }
async function signIn(email, password) {
  const session = await authRequest("token?grant_type=password", { email, password }); saveSession(session); state.user = session.user || null;
  const ok = await checkAdmin(); if (!ok) return renderPending(state.user?.email);
  await enterApp();
}
async function signUp(email, password) {
  const result = await authRequest("signup", { email, password });
  if (result.access_token) { saveSession(result); state.user = result.user || null; renderPending(state.user?.email); }
  else authShell("login", "Tài khoản đã được tạo. Hãy xác nhận email nếu hệ thống yêu cầu, sau đó đăng nhập. Quản trị viên sẽ cấp quyền truy cập.");
}
async function signOut() {
  try { if (state.session?.access_token) await request("/auth/v1/logout", { method: "POST" }); } catch { /* Local sign-out still completes when the server session expired. */ }
  saveSession(null); state.user = null; state.customers = []; state.orders = []; state.transactions = []; state.documents = []; authShell("login");
}
async function enterApp() {
  if (!(await checkAdmin())) return renderPending(state.user?.email);
  root.innerHTML = `<main class="loading-screen"><span class="loader"></span><p>Đang đồng bộ Hunda Logistics...</p></main>`;
  try { await loadData(); render(); } catch (error) { fail(error); authShell("login", `Không tải được dữ liệu: ${error.message}`); }
}
function bindAuth() {
  document.querySelectorAll("[data-auth-view]").forEach(b => b.addEventListener("click", () => authShell(b.dataset.authView)));
  document.querySelector("#auth-form")?.addEventListener("submit", async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const email = String(f.get("email")).trim().toLowerCase(); const password = String(f.get("password")); const isSignup = e.currentTarget.dataset.view === "signup";
    if (isSignup && password !== f.get("confirm")) return showToast("Mật khẩu nhập lại chưa khớp.", "error");
    const button = e.currentTarget.querySelector("button[type=submit]"); button.disabled = true; button.innerHTML = '<span class="spinner"></span> Đang xử lý';
    try { if (isSignup) await signUp(email, password); else await signIn(email, password); }
    catch (error) { authShell(isSignup ? "signup" : "login", error.message); }
  });
}
function bootstrap() {
  if (!DB_URL || !PUBLIC_KEY) return renderSetup();
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (hash.get("access_token") && hash.get("refresh_token")) {
    saveSession({ access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token"), token_type: hash.get("token_type") || "bearer", expires_in: Number(hash.get("expires_in") || 3600), expires_at: Number(hash.get("expires_at") || 0) });
    history.replaceState(null, "", location.pathname + location.search);
  }
  if (!state.session?.access_token) { authShell("login"); return; }
  state.user = state.session.user || null;
  request("/auth/v1/user").then(user => { state.user = user; return enterApp(); }).catch(async () => { if (await refreshSession()) { const user = await request("/auth/v1/user"); state.user = user; await enterApp(); } else { saveSession(null); authShell("login"); } });
}
document.addEventListener("click", e => { const btn = e.target.closest("[data-action]"); if (btn) action(btn.dataset.action, btn.dataset.id); });
window.addEventListener("storage", e => { if (e.key === SESSION_KEY) location.reload(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.session) loadData().then(render).catch(() => {}); });
setInterval(() => { if (!document.hidden && state.session) loadData().then(() => { if (document.querySelector(".app-shell")) render(); }).catch(() => {}); }, 45000);
bootstrap();
