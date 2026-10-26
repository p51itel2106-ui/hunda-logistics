# Hunda Logistics

Ứng dụng web quản trị vận hành logistics, thiết kế cho Vercel ở giao diện và Supabase PostgreSQL/Storage ở máy chủ.

## Chức năng

- Đăng ký tài khoản bằng email và mật khẩu, đăng nhập/đăng xuất và duy trì phiên đăng nhập.
- Duyệt quyền admin riêng; tài khoản mới không thể tự cấp quyền xem dữ liệu tài chính.
- Quản lý khách hàng, đơn hàng, trạng thái vận chuyển, giao dịch thu/chi và ghi chú.
- Báo cáo dòng tiền theo tháng, nhóm giao dịch và chênh lệch thu trừ chi đã thanh toán.
- Tải chứng từ PDF, ảnh, Word và Excel lên Supabase Storage trong bucket riêng tư; tải xuống bằng liên kết tạm có thời hạn.
- Dữ liệu SQL dùng chung trên server. Trang làm mới khi mở lại và tự đồng bộ định kỳ khi đang hoạt động.
- Bố cục thích ứng với máy tính, máy tính bảng và điện thoại.

## Thiết lập Supabase

1. Tạo một Supabase project trong tổ chức cần dùng. Với người dùng ở Việt Nam, chọn vùng Singapore nếu vùng đó khả dụng cho gói của bạn.
2. Mở **SQL Editor** trong Supabase, dán toàn bộ nội dung `supabase/migrations/20261026_hunda_logistics.sql` và chạy một lần.
3. Mở **Authentication → Providers → Email** và bật đăng ký bằng email. Nên bật xác nhận email. Cấu hình Site URL và Redirect URLs cho địa chỉ Vercel.
4. Mở **Project Settings → API Keys**, lấy **Project URL** và **publishable key**. Điền hai giá trị vào `config.js`:

   ```js
   window.HUNDA_CONFIG = {
     supabaseUrl: "https://your-project-ref.supabase.co",
     publishableKey: "sb_publishable_..."
   };
   ```

   Chỉ đưa publishable key vào website. Không đưa `service_role` hoặc secret key vào mã nguồn trình duyệt.

5. Mở ứng dụng và chọn **Tạo tài khoản**. Xác nhận email nếu được yêu cầu.
6. Cấp quyền cho tài khoản đầu tiên trong SQL Editor. Thay email bên dưới bằng email vừa đăng ký:

   ```sql
   insert into public.admin_users (user_id, email)
   select id, email
   from auth.users
   where lower(email) = lower('admin@yourcompany.vn')
   on conflict (user_id) do update set active = true;
   ```

   Khi cần thêm quản trị viên, người quản trị hiện tại tạo tài khoản cho đồng nghiệp rồi chạy lại câu lệnh với email đó. Để thu hồi quyền, đặt `active = false` cho user tương ứng.

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

File nằm trong bucket riêng `hunda-documents`, giới hạn 15 MB mỗi file. SQL migration bật RLS cho dữ liệu nghiệp vụ và Storage; chỉ tài khoản được duyệt trong `admin_users` mới đọc/ghi dữ liệu hoặc tạo link tải tạm thời.
