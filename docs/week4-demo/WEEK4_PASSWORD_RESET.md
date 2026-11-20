# Khôi phục mật khẩu qua Gmail OTP

## PostgreSQL native và Spring Boot

Dừng Backend cũ bằng Ctrl+C. Từ PowerShell ở thư mục gốc, chạy migration một lần vào database hiện tại. Có thể mở cùng file trong pgAdmin Query Tool của `english_learning_db` và bấm Execute.

```powershell
Set-Location "D:\My Project\Project 6 - Mobile\English Learning App"
& "$env:ProgramFiles\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d english_learning_db -W -v ON_ERROR_STOP=1 -f .\database\week4\migrations\V1_5__password_reset.sql
```

Trong cửa sổ PowerShell chạy Backend, giữ các biến PostgreSQL và `AUTH_JWT_SECRET` của máy. Thiết lập Gmail bằng thông tin nhập tại chỗ. `MAIL_USERNAME` là địa chỉ Gmail đã tạo App Password ELA và cũng là địa chỉ gửi.

```powershell
$env:MAIL_USERNAME = (Read-Host "Dia chi Gmail gui OTP").Trim()
$mailSecure = Read-Host "Google App Password ELA" -AsSecureString
$env:MAIL_APP_PASSWORD = [System.Net.NetworkCredential]::new("", $mailSecure).Password -replace '\s', ''
Remove-Variable mailSecure
$env:SPRING_PROFILES_ACTIVE = "default"
$env:SERVER_ADDRESS = "127.0.0.1"
Set-Location "D:\My Project\Project 6 - Mobile\English Learning App\backend"
mvn.cmd spring-boot:run
```

Spring Boot kết nối `smtp.gmail.com:587` qua STARTTLS. Khi thiếu biến Gmail, API khôi phục trả HTTP 503. API gửi mã trả HTTP 202 giống nhau cho email có tài khoản, email chưa đăng ký và yêu cầu đã bị giới hạn. Nếu hộp thư chưa có mã, kiểm tra thư rác và log Backend để biết SMTP có báo lỗi gửi hay không. [Cấu hình Gmail SMTP chính thức](https://support.google.com/a/answer/176600?hl=en)

### Docker Compose hiện có

Với volume đã khởi tạo, chạy `docker compose up -d db`, rồi chạy từ thư mục gốc bằng PowerShell:

```powershell
Get-Content -Raw .\database\week4\migrations\V1_5__password_reset.sql |
  docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Đặt hai biến Gmail bằng lệnh nhập an toàn ở trên trong cùng cửa sổ chạy `docker compose up --build -d backend`. Volume mới áp dụng migration khi khởi tạo.

## Expo Go trên iPhone

Laptop và iPhone cần truy cập được nhau qua mạng LAN tin cậy. Dùng `ipconfig` để lấy IPv4 của laptop. Trước khi chạy Spring Boot, đặt `SERVER_ADDRESS` thành IP đó và giữ `SPRING_PROFILES_ACTIVE=default`. Trong cửa sổ PowerShell khác ở thư mục gốc:

```powershell
$laptopIp = Read-Host "IPv4 LAN cua laptop"
$env:EXPO_PUBLIC_API_BASE_URL = "http://${laptopIp}:8080"
Invoke-RestMethod "$env:EXPO_PUBLIC_API_BASE_URL/api/v1/health"
npx.cmd expo start --go --lan --clear
```

Mở URL `http://IP-LAPTOP:8080/api/v1/health` bằng Safari trên iPhone trước khi quét QR. Sau khi thấy `UP`, mở Expo Go và chọn **Đăng nhập → Quên mật khẩu?**. Khi dùng LAN, chỉ dùng tài khoản kiểm thử do URL HTTP chưa mã hóa giữa điện thoại và Backend.

## Kiểm thử

- Dùng email của tài khoản thử nghiệm mà bạn kiểm soát. Kiểm tra thư OTP, thử một mã sai, nhập mã đúng, đặt mật khẩu mới và đăng nhập lại.
- Mỗi mã có hiệu lực 5 phút và mất hiệu lực sau 5 lần nhập sai. Nút gửi lại mở sau 60 giây. Reset token hết hạn sau 10 phút và dùng một lần.
- Giữ JWT thử nghiệm được cấp trước khi đổi mật khẩu trong Postman, rồi gọi `GET /api/v1/users/me/profile` với JWT cũ sau khi đổi. Kết quả mong đợi là 401. Mật khẩu cũ cũng phải bị từ chối ở endpoint login.
- Bộ kiểm thử cục bộ dùng PostgreSQL riêng và SMTP loopback. Từ thư mục gốc, chạy `mvn.cmd -f backend/pom.xml test`, sau đó chạy `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\test-auth-profile.ps1 -Suite PasswordReset`.
