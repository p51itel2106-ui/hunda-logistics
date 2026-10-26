# Hunda Logistics

Ứng dụng web quản trị vận hành logistics, thiết kế cho Vercel ở giao diện và Supabase PostgreSQL/Storage ở máy chủ.

## Chức năng

- Đăng ký tài khoản bằng email và mật khẩu, đăng nhập/đăng xuất và duy trì phiên đăng nhập.
- Tài khoản mới vào không gian khách hàng; quyền admin được cấp riêng trong `admin_users`.
- Khách chỉ gửi yêu cầu vận chuyển, theo dõi trạng thái và tải chứng từ cho đơn của chính mình. Giá trị đơn nội bộ, chi phí, thu chi và báo cáo chỉ dành cho admin.
- Admin có nút chuyển sang không gian khách hàng để xem luồng đặt đơn; thao tác này tạo hồ sơ khách hàng xem thử cho admin nếu chưa có.
- Quản lý khách hàng, đơn hàng, trạng thái vận chuyển, giao dịch thu/chi và ghi chú.
- Báo cáo dòng tiền theo tháng, nhóm giao dịch và chênh lệch thu trừ chi đã thanh toán.
- Tải chứng từ PDF, ảnh, Word và Excel lên Supabase Storage trong bucket riêng tư; tải xuống bằng liên kết tạm có thời hạn.
- Nhật ký admin ghi người thao tác, thời điểm, đối tượng, loại thay đổi, tên trường, địa chỉ IP và user agent khi máy chủ nhận được các header này. Thời gian trên màn hình hiển thị theo múi giờ Việt Nam UTC+7.
- Nhật ký nhận thay đổi qua Supabase Realtime; nếu kết nối realtime tạm gián đoạn, trang vẫn làm mới dự phòng. Không lưu giá trị cũ/mới chứa thông tin cá nhân vào nhật ký.
- Dữ liệu SQL dùng chung trên server; trạng thái trong không gian khách hàng tự làm mới định kỳ trên thiết bị đang mở.
- Bố cục thích ứng với máy tính, máy tính bảng và điện thoại.

## Thiết lập Supabase

1. Tạo một Supabase project trong tổ chức cần dùng. Với người dùng ở Việt Nam, chọn vùng Singapore nếu vùng đó khả dụng cho gói của bạn.
2. Mở **SQL Editor** trong Supabase và áp dụng lần lượt các file trong `supabase/migrations/` theo thứ tự tên. Những migration hiện có: `20261026_hunda_logistics.sql`, `20261026_hunda_activity_log.sql`, `20261026_hunda_customer_workspace.sql`, `20261026_hunda_rpc_security.sql`, `20261026_hunda_customer_order_rpc.sql`.
3. Mở **Authentication → Providers → Email** và bật đăng ký bằng email. Nên bật xác nhận email. Cấu hình Site URL và Redirect URLs cho địa chỉ Vercel.
4. Mở **Project Settings → API Keys**, lấy **Project URL** và **publishable key**. Điền hai giá trị vào `config.js`:

   ```js
   window.HUNDA_CONFIG = {
     supabaseUrl: "https://your-project-ref.supabase.co",
     publishableKey: "sb_publishable_..."
   };
   ```

   Chỉ đưa publishable key vào website. Không đưa `service_role` hoặc secret key vào mã nguồn trình duyệt.

5. Mở ứng dụng và chọn **Tạo tài khoản**. Xác nhận email nếu được yêu cầu. Hồ sơ khách hàng được tạo tự động; khách chỉ có quyền với đơn hàng của mình.
6. Cấp quyền admin trong SQL Editor. Thay email bên dưới bằng email tài khoản cần quản trị:

   ```sql
   insert into public.admin_users (user_id, email)
   select id, email
   from auth.users
   where lower(email) = lower('admin@yourcompany.vn')
   on conflict (user_id) do update set active = true;
   ```

   Người quản trị có thể thêm tài khoản đã đăng ký bằng cách chạy lại câu lệnh với email đó. Để thu hồi quyền, đặt `active = false` cho user tương ứng.

## Triển khai Vercel

Đưa nội dung thư mục này lên một repository GitHub, sau đó import repository vào Vercel. Đây là ứng dụng tĩnh: chọn framework **Other**, để trống Build Command và Output Directory, rồi triển khai thư mục gốc repository.

Vercel cần phục vụ `config.js` cùng mã nguồn. File này chỉ chứa Project URL và publishable key, quyền truy cập được kiểm soát bằng RLS ở Supabase. Không ghi secret hoặc service role key vào file này.

## Chạy tại máy

Phục vụ thư mục này bằng một HTTP server tĩnh (không mở `index.html` bằng `file://`). Ví dụ nếu máy đã có Python:

```powershell
python -m http.server 4173
```

Sau đó mở `http://localhost:4173/`.

## Cách tính báo cáo

Dashboard và báo cáo tính thu/chi từ giao dịch có trạng thái **Đã thanh toán**; giao dịch đang chờ không được cộng vào dòng tiền. “Kết quả thu − chi” là tổng quan theo dòng tiền thực nhận/thực trả, chưa thay thế báo cáo kế toán dồn tích hoặc báo cáo thuế.

## Lưu trữ chứng từ

File nằm trong bucket riêng `hunda-documents`, giới hạn 15 MB mỗi file. Admin có quyền quản lý toàn bộ chứng từ. Khách chỉ đọc/tải hoặc xóa chứng từ gắn với đơn của họ; đường dẫn tải xuống là liên kết tạm thời.
