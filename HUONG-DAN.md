# Paris 27: chuyển sang app riêng (PWA)

App mới mở toàn màn hình từ icon, không còn thanh Safari. Giao diện và tính năng giữ nguyên. Thêm: đăng nhập, lưu được khi mất mạng (tự đồng bộ khi có mạng lại), sao lưu/khôi phục JSON.

Chi phí: 0 đ (GitHub Pages + Supabase gói Free).

## Bạn cần làm (khoảng 20 phút)

### 1. GitHub: nơi chứa app
1. Tạo tài khoản ở github.com (nếu chưa có).
2. Tạo repository mới, tên `paris27`, chọn **Public**, không thêm README.
3. Kết nối GitHub với Claude: https://claude.ai/connect-github , và cho Claude quyền vào repo `paris27` (https://github.com/apps/claude/installations/select_target).
4. Nhắn mình: `tên-github/paris27`.

Sau khi mình đẩy code lên: repo → Settings → Pages → Source: *Deploy from a branch*, Branch: `main`, thư mục `/ (root)` → Save. Địa chỉ app sẽ là `https://tên-github.github.io/paris27/`.

### 2. Supabase: nơi lưu dữ liệu
1. Đăng ký ở supabase.com → **New project**. Region: *West EU (Paris)* hoặc gần nhất. Mật khẩu database: tự giữ, không gửi ai.
2. Menu trái → **SQL Editor** → New query → dán toàn bộ nội dung file `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: tắt *Confirm email* (để tạo tài khoản xong là dùng được ngay).
4. Lấy **Project URL** (nút *Connect* ở trang chủ project, hoặc Project Settings → Data API) và **anon public key** (Project Settings → API Keys, tab *Legacy API Keys*; nếu không có tab đó thì lấy *publishable key*). Hai giá trị này công khai theo thiết kế, có thể nhắn cho mình.
5. **Không bao giờ** gửi *service_role key* / *secret key* hay mật khẩu database vào chat.

### 3. Cho buổi xem lại Chủ nhật (làm khi chuyển hẳn)
Project hiện chạy trên môi trường mặc định, không có cài đặt. Để Claude đọc được Supabase:
1. Mở [Project settings](#project-settings/environment) → Cloud environment → **Add cloud environment**.
2. Network access: thêm `tên-project.supabase.co` vào *Allowed domains* (giữ ô *Allow package managers*).
3. Thêm service_role key: ở *Network secrets* (sau khi lưu, nút bánh răng cạnh môi trường) nếu có, nếu không thì biến môi trường tên `SUPABASE_SERVICE_KEY`.

## Chuyển dữ liệu (khi app mới đã chạy)
1. App cũ (claude.ai) → **Outils → Tout télécharger (JSON)** → Lưu vào Tệp.
2. Mở địa chỉ app mới bằng Safari → nút Chia sẻ → **Thêm vào màn hình chính**.
3. Mở app từ icon mới → **Créer le compte** (email + mật khẩu ≥ 8 ký tự).
4. **Outils → Restaurer (JSON)** → chọn file vừa lưu.
5. Kiểm tra vài ngày đã nhập, rồi xoá icon cũ.

Lưu ý: đăng nhập phải làm trong app mở từ icon (iPhone tách bộ nhớ của app màn hình chính với Safari).

## Giới hạn cần biết
- Supabase Free tạm dừng project sau 7 ngày không có truy cập. Dùng hằng ngày thì không bị; nếu nghỉ lâu, vào supabase.com bấm *Restore*.
- Repo public: ai có link repo xem được mã nguồn, **không** xem được dữ liệu (dữ liệu nằm ở Supabase, khoá theo tài khoản).
- Không có thông báo đẩy (push). Nếu sau này cần, làm thêm được.

## Các file
- `index.html`: app
- `db.js`: kết nối Supabase, lưu tạm trên máy khi mất mạng
- `config.js`: Project URL + anon key (mình điền)
- `sw.js`, `manifest.webmanifest`, `icons/`: chạy toàn màn hình, icon, offline
- `vendor/supabase.js`: thư viện supabase-js 2.45.4 (MIT)
- `supabase/schema.sql`: bảng dữ liệu + quyền truy cập
