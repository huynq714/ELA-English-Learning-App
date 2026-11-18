# Week 4 Task 02 — Authentication và Profile

## Audit ban đầu

| Trạng thái | Kết quả |
| --- | --- |
| ALREADY DONE | PostgreSQL có `users`, unique index trên `lower(email)` và bảng `user_profiles`. ProfileService và API CRUD nội bộ đã có. UI Login và mục Cá nhân có sẵn trong điều hướng. API Vocabulary đã chạy. |
| MISSING | Login và Cá nhân chỉ nối vào thao tác demo. Chưa có Register, JWT, Spring Security, endpoint `/users/me`, lưu phiên an toàn hay bảo vệ route. |
| BLOCKED | Phiên agent không có mật khẩu cho database phát triển. Kiểm thử có ghi dữ liệu dùng PostgreSQL cô lập. Thiết bị Expo Go cần xác nhận trực tiếp. |

## API và bảo mật

| API | Kết quả |
| --- | --- |
| `POST /api/v1/auth/register` | Kiểm tra `password` và `confirmPassword` trùng nhau. Tạo User bằng BCrypt và Profile mặc định A1/15 phút trong cùng giao dịch. Trả 201 cùng JWT và thông tin tài khoản để app mở Trang chủ. |
| `POST /api/v1/auth/login` | Trả JWT Bearer có hạn nếu tài khoản đang hoạt động và mật khẩu đúng. Trả 401 nếu thông tin không hợp lệ. |
| `GET /api/v1/users/me` | Trả ID, email, tên hiển thị của tài khoản trong JWT. |
| `GET /api/v1/users/me/profile` | Trả hồ sơ của tài khoản trong JWT. Tài khoản cũ chưa có hồ sơ nhận 404 và có thể tạo bằng PATCH. |
| `PATCH /api/v1/users/me/profile` | Lưu tên hiển thị, ảnh đại diện, trình độ A1–C2 và mục tiêu 5–240 phút cho tài khoản trong JWT. Ảnh từ thư viện được thu nhỏ thành JPEG và lưu vào `avatar_url` hiện có. |
| `PATCH /api/v1/users/me/password` | Kiểm tra mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới. Sau khi đổi thành công, cấp token thay thế và các token trước đó của tài khoản hết hiệu lực. |

JWT dùng HS256, issuer và audience riêng, mặc định hết hạn sau 1 giờ. Backend yêu cầu `AUTH_JWT_SECRET` là ít nhất 32 byte ngẫu nhiên được mã hóa Base64. Chỉ các yêu cầu loopback với profile `local` truy cập được các endpoint `/dev`. GET Health và Vocabulary tiếp tục là API công khai.

Expo lưu access token trên thiết bị bằng SecureStore. App xác minh phiên bằng `/users/me` khi mở lại, yêu cầu đăng nhập lại khi phiên hết hạn, và xóa phiên khi đăng xuất. Sau khi nâng cấp từ phiên bản cũ của Task 02, người dùng đang có phiên cũ cần đăng nhập lại một lần. Mất mạng khi khôi phục phiên có màn Thử lại. Logout xử lý phía client. Token đã phát hành hết hiệu lực sau khi hết hạn hoặc sau khi đổi mật khẩu. Google, Apple và khôi phục mật khẩu vẫn là mục demo của UI cũ. Expo Web dùng phiên trong bộ nhớ.

## Tệp chính

- Backend Auth trong `backend/src/main/java/com/englishlearning/auth/` và `profile/controller/CurrentUserController.java`. Tái sử dụng User, UserProfile, ProfileService và validation hồ sơ.
- Expo Auth/Profile trong `src/features/auth/` và `src/features/profile/`, màn Login/Register/Profile, route guard trong `src/app/_layout.tsx` và API client dùng chung.
- Cấu hình trong `backend/pom.xml`, `application.properties`, `package.json`, `app.json`, `.env.example` và `compose.yaml`.
- Kiểm thử HTTP và PostgreSQL trong `backend/scripts/test-auth-profile.ps1` và `backend/scripts/test_auth_profile.py`. Unit test trạng thái tài khoản trong `backend/src/test/java/com/englishlearning/auth/AuthServiceTest.java`.

## Kết quả kiểm thử

| Kiểm tra | Trạng thái |
| --- | --- |
| Maven | PASS · 22 tests, 0 lỗi. Bao gồm tài khoản DISABLED bị từ chối login và truy cập. |
| HTTP + PostgreSQL cô lập | PASS · 42 ca. Bao gồm xác nhận mật khẩu khi đăng ký, dùng JWT ngay sau đăng ký, chặn đọc hoặc sửa hồ sơ của người khác, lưu tên và ảnh, đổi mật khẩu, từ chối mật khẩu và token cũ. SQL xác nhận 3 mật khẩu BCrypt, 3 hồ sơ, 1 hồ sơ có tên và ảnh đã đổi, cùng 43 từ và 43 liên kết Vocabulary. |
| TypeScript và ESLint | PASS. |
| Expo | PASS ở mức build. Metro trả manifest iOS và bundle chứa Auth/Profile. Bản export iOS cũng build được. |
| Expo Go trên thiết bị thật | NOT TESTED với bản chỉnh sửa mới. Cần kiểm tra Đăng ký → Trang chủ, chọn ảnh, lưu hồ sơ và đổi mật khẩu. |
| Expo Go — môi trường thật | Cần khởi động lại Backend với JWT secret. `english_learning_db` của demo chưa được dùng để chạy các ca ghi dữ liệu kiểm thử. |

## Kịch bản demo bằng Expo Go

1. Dừng Backend cũ bằng Ctrl+C trong cửa sổ PowerShell đang chạy Backend. Giữ các biến PostgreSQL hiện có và tạo JWT secret một lần nếu biến chưa có.

   ```powershell
   if (-not $env:AUTH_JWT_SECRET) {
     $key = [byte[]]::new(32)
     $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
     try { $rng.GetBytes($key) } finally { $rng.Dispose() }
     $env:AUTH_JWT_SECRET = [Convert]::ToBase64String($key)
   }
   $env:SERVER_ADDRESS = "<IPv4-Wi-Fi-của-laptop>"
   $env:SPRING_PROFILES_ACTIVE = "default"
   Set-Location "<thư-mục-dự-án>\backend"
   mvn spring-boot:run
   ```

2. Dừng Metro cũ, rồi đặt URL API và chạy Expo từ thư mục gốc trên laptop. Điện thoại dùng cùng Wi-Fi tin cậy và dùng thông tin đăng nhập dành riêng cho demo. Kiểm tra `/api/v1/health` từ điện thoại trước khi quét QR.

   ```powershell
   $env:EXPO_PUBLIC_API_BASE_URL = "http://<IPv4-Wi-Fi-của-laptop>:8080"
   npx.cmd expo start --go --lan --clear
   ```

   Nếu Expo báo `UnexpectedServerError` khi chuẩn bị manifest, thử đặt `$env:EXPO_OFFLINE = "1"` rồi chạy lại cùng lệnh. Laptop vẫn cần kết nối Wi-Fi để điện thoại truy cập Metro và Backend.

3. Chọn **Bắt đầu → Đăng ký**, nhập tên hiển thị, email mới và mật khẩu ít nhất 8 ký tự, có chữ và số. Nhập cùng mật khẩu vào ô **Xác nhận mật khẩu** rồi bấm **Đăng ký**. App mở thẳng Trang chủ.
4. Vào **Cá nhân**. Đổi tên hiển thị, chọn ảnh từ thư viện, chọn **B1** và nhập **30** phút. Bấm **Lưu thay đổi**. Mở lại app để kiểm tra thông tin và ảnh đã lưu.
5. Trong pgAdmin kiểm tra dữ liệu đã lưu với email vừa đăng ký. Truy vấn chỉ trả cờ nhận diện định dạng BCrypt.

   ```sql
   SELECT u.email, u.display_name, p.english_level, p.daily_goal_minutes,
          p.avatar_url IS NOT NULL AS has_avatar,
          u.password_hash LIKE '$2a$%' AS bcrypt_format
   FROM public.users u
   JOIN public.user_profiles p ON p.user_id = u.id
   WHERE lower(u.email) = lower('email-demo@example.test');
   ```

6. Chọn **Đổi mật khẩu**, nhập mật khẩu hiện tại, mật khẩu mới và xác nhận. Sau khi lưu, đăng xuất rồi đăng nhập bằng mật khẩu mới.
7. Trong khi đang đăng nhập, đóng và mở lại app khi mạng bị ngắt. Kết nối lại và bấm **Thử lại** để xác minh khôi phục phiên.

### Chạy lại kiểm thử Backend cô lập

```powershell
mvn -f backend/pom.xml test
& .\backend\scripts\test-auth-profile.ps1
```

Script dùng PostgreSQL 18 và Python, tạo database riêng dưới `.artifacts/`, dùng cổng kiểm thử riêng rồi dừng các tiến trình do script khởi động. Kịch bản demo qua LAN là cấu hình phát triển. Triển khai xác thực ra môi trường thật cần HTTPS.
