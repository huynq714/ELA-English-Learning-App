# English Learning App

README này hướng dẫn thành viên trong nhóm chạy Backend và thử Deck/Profile trên Windows. Chọn **một** cách chạy PostgreSQL bên dưới: cài PostgreSQL trực tiếp hoặc dùng Docker. Hai cách đều chạy cùng schema và cùng API.

Thành viên đã có repo chạy `git pull --ff-only origin master` từ thư mục dự án. Thành viên mới có thể dùng [Docker Compose](#chọn-b--docker-compose) để tự tạo PostgreSQL và nạp sẵn **3 Deck A1 và 3 Deck A2, mỗi Deck 15 từ**. Mỗi bạn đăng ký tài khoản test trên database của mình sau khi khởi động.

## Backend hiện có

- Danh mục Deck: đọc bằng JWT, lọc theo trình độ trong Profile. Xem [hướng dẫn sáu Deck A1/A2](docs/week4-demo/WEEK4_TOPIC_DECKS_TEST.md). Tạo, cập nhật và soft-delete Deck demo qua profile `local`.
- Auth và Profile: đăng ký, đăng nhập bằng email, JWT và cập nhật hồ sơ của tài khoản đang đăng nhập. Xem [kịch bản demo Week 4](docs/week4-demo/WEEK4_AUTH_PROFILE_TEST.md).
- Quên mật khẩu qua Gmail: [cài đặt SMTP và kiểm thử trên Expo Go](docs/week4-demo/WEEK4_PASSWORD_RESET.md).
- Các API `/api/v1/dev/...` chỉ phục vụ Backend chạy native với profile `local` và yêu cầu đến từ loopback.
- Profile chưa có API DELETE. Deck DELETE đặt `is_published=false`, không xóa hàng khỏi database.
- Flashcards lưu vị trí học. Quiz xếp đề, chấm điểm và lưu kết quả theo tài khoản. Xem [kịch bản Flashcards và Quiz](docs/week4-demo/WEEK4_FLASHCARDS_QUIZ_TEST.md).
- FSRS, IPA và AI Conversation hiện có thiết kế database, chưa có REST API hoàn chỉnh.

## Yêu cầu chung

- Git.
- Postman để import bộ request có sẵn; có thể dùng PowerShell thay Postman.
- **Nếu chọn Docker:** Docker Desktop đã cài và Engine đang chạy. Không cần cài Java, Maven hoặc PostgreSQL trên máy.
- **Nếu chọn PostgreSQL native:** PostgreSQL 18.x, pgAdmin 4, Java 21 và Maven 3.9+.

## Chọn A — PostgreSQL native

### A1. Tạo database và nạp schema (làm một lần)

1. Mở pgAdmin và kết nối tới server PostgreSQL tại `localhost:5432`.
2. Tạo database `english_learning_db`, encoding UTF8, nếu database chưa có.
3. Trong Query Tool của database mới/trống, mở và chạy [`database/week3/schema.sql`](database/week3/schema.sql). Script tạo extension `pgcrypto`, 16 bảng, FK, constraint và trigger.
4. Không chạy lại schema trên database đã có bảng/dữ liệu; không drop database có dữ liệu cần giữ.
5. Với database mới, chạy thêm [migration Vocabulary Week 4](database/week4/migrations/V1_2__source_vocabulary_fields.sql) một lần để Backend xác thực schema.
6. Áp dụng [migration Quiz Week 4](database/week4/migrations/V1_3__quiz_question_snapshot.sql) nếu database chưa có cột `quiz_attempts.question_snapshot`.
7. Chạy [lệnh sao lưu và nạp danh mục A1/A2](docs/week4-demo/WEEK4_TOPIC_DECKS_TEST.md#nạp-vào-postgresql) trước khi khởi động Backend.
8. Áp dụng [migration khôi phục mật khẩu](database/week4/migrations/V1_5__password_reset.sql) để dùng Gmail OTP.

Kiểm tra:

```sql
SELECT current_database(), pg_encoding_to_char(encoding) AS encoding
FROM pg_database WHERE datname = current_database();
SELECT count(*) AS tables FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
```

Kết quả mong đợi là `english_learning_db`, `UTF8` và 18 bảng sau migration khôi phục mật khẩu (16 bảng gốc và 2 bảng mới).

### A2. Chạy Backend

Mở PowerShell tại thư mục dự án:

```powershell
cd "<đường-dẫn-project>\backend"
$env:DB_USERNAME = "postgres"
$secure = Read-Host "Mật khẩu PostgreSQL" -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new("", $secure).Password
$key = [byte[]]::new(32)
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($key) } finally { $rng.Dispose() }
$env:AUTH_JWT_SECRET = [Convert]::ToBase64String($key)
$env:SPRING_PROFILES_ACTIVE = "local"
mvn clean test
mvn spring-boot:run
```

Nhập mật khẩu trong prompt trên máy cá nhân. Backend mặc định bind `127.0.0.1:8080`. Để dừng server nhấn `Ctrl+C`. Khi chạy lại trong cùng cửa sổ, giữ nguyên `AUTH_JWT_SECRET` để các phiên hiện có tiếp tục hoạt động.

## Chọn B — Docker Compose

Sau khi cài Docker Desktop và bật Docker Engine, nếu chưa clone repo thì chạy ở thư mục cha nơi bạn muốn lưu project:

```powershell
git clone https://github.com/huynq714/ELA-English-Learning-App.git
cd ELA-English-Learning-App
```

Mở PowerShell ở thư mục gốc repo. Khối lệnh sau tạo `.env` nếu cần và lưu khóa JWT ngẫu nhiên trên máy để dùng lại khi khởi động:

```powershell
$envPath = Join-Path (Get-Location) '.env'
if (-not (Test-Path $envPath)) { Copy-Item .env.example $envPath }
$settings = [IO.File]::ReadAllText($envPath)
if ($settings -notmatch '(?m)^AUTH_JWT_SECRET=[^\r\n]*\S[^\r\n]*\r?$') {
  $key = [byte[]]::new(32)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($key) } finally { $rng.Dispose() }
  $jwt = [Convert]::ToBase64String($key)
  $settings = $settings -replace '(?m)^AUTH_JWT_SECRET=[^\r\n]*(\r?\n|$)', ''
  [IO.File]::WriteAllText($envPath, $settings.TrimEnd() + "`r`nAUTH_JWT_SECRET=$jwt`r`n", [Text.UTF8Encoding]::new($false))
}
docker compose up --build -d
docker compose logs -f backend
```

Docker tự build Backend, tạo PostgreSQL và nạp schema khi khởi tạo volume database lần đầu. Chờ log báo Spring Boot đã khởi động. Bộ cấu hình demo dùng database riêng trong Docker; không cần sửa `application.properties`.

Volume Docker mới tự nạp sáu Deck khi khởi tạo. Với volume có sẵn từ phiên bản cũ, xem [cập nhật volume giữ dữ liệu](docs/week4-demo/WEEK4_TOPIC_DECKS_TEST.md#cập-nhật-volume-docker-đã-có-dữ-liệu).

- API: `http://127.0.0.1:8080`
- PostgreSQL từ pgAdmin: host `127.0.0.1`, port `5433`, database/user/password xem trong file `.env` vừa tạo.
- Mật khẩu mẫu trong `.env.example` chỉ dành cho database local demo. `.env` bị Git ignore; không dùng cấu hình này cho production.
- Nếu port 8080 hoặc 5433 bị chiếm, đổi `API_PORT` hoặc `POSTGRES_PORT` trong `.env`.
- `docker compose down` dừng app và giữ database. **Không dùng `docker compose down -v` nếu cần giữ dữ liệu**, vì `-v` xóa volume.

Compose dùng các endpoint Auth/Profile thật. Để chạy các ví dụ `/dev` Week 3, chọn Backend native ở trên.

### Chạy Expo Go trên điện thoại với Docker

Kết nối laptop và điện thoại vào cùng Wi-Fi. Mở PowerShell ở thư mục gốc, chạy `ipconfig`, rồi nhập IPv4 của **laptop** khi được hỏi. Đoạn lệnh công bố riêng API trên địa chỉ Wi-Fi đó. PostgreSQL vẫn truy cập qua localhost.

```powershell
$laptopIp = Read-Host 'IPv4 cua laptop tren Wi-Fi'
$env:API_BIND_ADDRESS = $laptopIp
docker compose up -d backend
$env:EXPO_PUBLIC_API_BASE_URL = "http://${laptopIp}:8080"
Invoke-RestMethod "$env:EXPO_PUBLIC_API_BASE_URL/api/v1/health"
```

Khi Health trả `UP`, dùng Node.js 22 LTS từ 22.13, cài dependencies theo lockfile và mở Expo. Nếu đã đổi `API_PORT` trong `.env`, dùng cổng đó trong URL.

```powershell
npm.cmd ci
npx.cmd expo start --go --lan --port 0
```

Quét QR trong Expo Go, đăng ký tài khoản test, chọn A1 hoặc A2 và mở **Từ vựng** để kiểm tra ba Deck của cấp đã chọn.

## Kiểm tra Backend

Với cả hai cách trên, mở PowerShell thứ hai:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/v1/health
```

Health trả `UP`. Để kiểm tra danh mục từ PostgreSQL, đăng nhập và gửi Bearer token khi gọi `GET /api/v1/decks`. Profile đã lưu A1 hoặc A2 sẽ nhận ba Deck của cấp tương ứng. [Kịch bản API](docs/week4-demo/WEEK4_TOPIC_DECKS_TEST.md#kiểm-thử-api-và-app)

## Thử Deck CRUD bằng Postman

Import [`docs/week3-demo/POSTMAN_COLLECTION.json`](docs/week3-demo/POSTMAN_COLLECTION.json) và [`docs/week3-demo/POSTMAN_ENVIRONMENT.json`](docs/week3-demo/POSTMAN_ENVIRONMENT.json). Chọn environment **English Learning App - Local Demo**, đặt `baseUrl` là `http://127.0.0.1:8080`. Backend cần chạy với profile `local`.

1. **Create:** `POST {{baseUrl}}/api/v1/dev/decks`

   ```json
   {
     "title": "Deck demo của nhóm",
     "description": "Dùng thử API Week 3",
     "level": "A1",
     "isPublished": true
   }
   ```

   Kỳ vọng `201 Created`. Request trong collection tự lưu `id` vào biến `deckId`.
2. **Read:** Xem Deck demo vừa tạo bằng truy vấn SQL bên dưới. Các request GET trong collection Tuần 3 phục vụ ca đọc cũ. API hiện tại đọc danh mục theo trình độ và yêu cầu Bearer token.
3. **Update:** `PATCH {{baseUrl}}/api/v1/dev/decks/{{deckId}}` với body `{"title":"Deck demo đã sửa"}` → `200 OK`.
4. **Delete:** `DELETE {{baseUrl}}/api/v1/dev/decks/{{deckId}}` → `204 No Content`. Truy vấn SQL xác nhận hàng vẫn còn với `is_published=false`.

Xác minh trong pgAdmin/Query Tool:

```sql
SELECT id, title, is_published, created_at
FROM decks ORDER BY created_at DESC LIMIT 10;
```

Nếu endpoint `/api/v1/dev/decks` trả `404`, kiểm tra Backend được chạy với `SPRING_PROFILES_ACTIVE=local` rồi khởi động lại.

## Thử Profile bằng Postman

Các request Profile demo bên dưới cần `userId` của một hàng có thật trong bảng `users`. Thành viên có thể tạo tài khoản qua app hoặc dùng User test có sẵn.

### Tạo/chọn User test

- **PostgreSQL native:** chạy SQL trong pgAdmin Query Tool của `english_learning_db`.
- **Docker:** chạy `docker compose exec db psql -U english_learning_dev -d english_learning_db`, rồi dán SQL tại dấu nhắc `psql`. Hoặc kết nối pgAdmin tới `127.0.0.1:5433` bằng thông tin trong `.env`.

Tìm User có thể dùng lại:

```sql
SELECT id, email, display_name, status FROM users ORDER BY created_at DESC;
```

Nếu database chưa có User test, tạo User giả (không dùng email/mật khẩu thật):

```sql
INSERT INTO users (email, password_hash, display_name)
VALUES (
  'demo.' || replace(gen_random_uuid()::text, '-', '') || '@example.test',
  crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')),
  'Week 3 Demo User'
)
RETURNING id, email;
```

Sao chép `id` trả về và đặt vào biến `userId` trong Postman environment. `password_hash` ở đây là hash ngẫu nhiên chỉ để thỏa schema; không phải tài khoản đăng nhập.

### Gọi Profile API

Base URL: `{{baseUrl}}/api/v1/dev/users/{{userId}}/profile`.

1. **Create/replace:** `PUT` với body:

   ```json
   { "englishLevel": "A2", "dailyGoalMinutes": 20, "avatarUrl": "https://example.test/avatar.png" }
   ```

   Kỳ vọng `200 OK`. PUT tạo Profile nếu chưa có hoặc thay các trường cho phép nếu đã có.
2. **Read:** `GET` cùng URL → `200 OK`.
3. **Update:** `PATCH` cùng URL với body `{"dailyGoalMinutes":45}` → `200 OK`; GET lại để xem kết quả.
4. Giới hạn hợp lệ: `dailyGoalMinutes` 5–240; `englishLevel`: A1, A2, B1, B2, C1 hoặc C2. User không tồn tại bị từ chối.

Xác minh trong Query Tool:

```sql
SELECT user_id, english_level, daily_goal_minutes, avatar_url, updated_at
FROM user_profiles WHERE user_id = '<dán userId của bạn>';
```

Profile API hiện không có DELETE. Các endpoint dev không xác thực `userId`, chỉ dùng local trên laptop, không mở ra LAN/production.

## Tài liệu khác

- Hướng dẫn cài đặt, truy vấn kiểm chứng và xử lý lỗi: [`docs/week3-demo/README.md`](docs/week3-demo/README.md).
- ERD: [`database/week3/English_Learning_ERD.dbml`](database/week3/English_Learning_ERD.dbml); schema PostgreSQL: [`database/week3/schema.sql`](database/week3/schema.sql).
- Kịch bản demo, kiến trúc và câu hỏi bảo vệ: thư mục [`docs/week3-demo/`](docs/week3-demo/).
- Ứng dụng Expo tùy chọn: cài Node.js, chạy `npm install` rồi `npx expo start`. Không cần Expo để kiểm thử CRUD bằng Postman.
