# English Learning App

README này hướng dẫn thành viên trong nhóm chạy Backend và thử Deck/Profile trên Windows. Chọn **một** cách chạy PostgreSQL bên dưới: cài PostgreSQL trực tiếp hoặc dùng Docker. Hai cách đều chạy cùng schema và cùng API.

## Backend hiện có

- Deck: đọc Deck đã publish; tạo, cập nhật và soft-delete Deck trong profile `local`.
- Profile: đọc/tạo/cập nhật Profile cho User đã tồn tại.
- Chưa có đăng ký/đăng nhập hoặc Authentication/RBAC. Các API `/api/v1/dev/...` nhận ID trực tiếp, chỉ dùng local trên máy, không mở ra mạng hoặc production.
- Profile chưa có API DELETE. Deck DELETE đặt `is_published=false`, không xóa hàng khỏi database.
- Quiz, FSRS, IPA và AI Conversation hiện có thiết kế database, chưa có REST API hoàn chỉnh.

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

Kiểm tra:

```sql
SELECT current_database(), pg_encoding_to_char(encoding) AS encoding
FROM pg_database WHERE datname = current_database();
SELECT count(*) AS tables FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
```

Kết quả mong đợi: `english_learning_db`, `UTF8`, `16`.

### A2. Chạy Backend

Mở PowerShell tại thư mục dự án:

```powershell
cd "<đường-dẫn-project>\backend"
$env:DB_USERNAME = "postgres"
$secure = Read-Host "Mật khẩu PostgreSQL" -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new("", $secure).Password
$env:SPRING_PROFILES_ACTIVE = "local"
mvn clean test
mvn spring-boot:run
```

Nhập mật khẩu trong prompt trên máy cá nhân; không ghi mật khẩu vào source hoặc chat. Backend mặc định bind `127.0.0.1:8080`. Để dừng server nhấn `Ctrl+C`.

## Chọn B — Docker Compose

Sau khi cài Docker Desktop và bật Docker Engine, nếu chưa clone repo thì chạy ở thư mục cha nơi bạn muốn lưu project:

```powershell
git clone https://github.com/huynq714/ELA-English-Learning-App.git
cd ELA-English-Learning-App
```

Nếu repo đã được clone sẵn, chỉ cần mở PowerShell ở thư mục gốc repo. Trong cả hai trường hợp, chạy tiếp:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up --build
```

Docker tự build Backend, tạo PostgreSQL và nạp schema khi khởi tạo volume database lần đầu. Chờ log báo Spring Boot đã khởi động. Bộ cấu hình demo dùng database riêng trong Docker; không cần sửa `application.properties`.

- API: `http://127.0.0.1:8080`
- PostgreSQL từ pgAdmin: host `127.0.0.1`, port `5433`, database/user/password xem trong file `.env` vừa tạo.
- Mật khẩu mẫu trong `.env.example` chỉ dành cho database local demo. `.env` bị Git ignore; không dùng cấu hình này cho production.
- Nếu port 8080 hoặc 5433 bị chiếm, đổi `API_PORT` hoặc `POSTGRES_PORT` trong `.env`.
- `docker compose down` dừng app và giữ database. **Không dùng `docker compose down -v` nếu cần giữ dữ liệu**, vì `-v` xóa volume.

Các cổng chỉ bind vào loopback để bảo vệ những endpoint dev chưa có xác thực. Vì vậy dùng Postman/PowerShell trên cùng laptop; Expo Go trên điện thoại thật không truy cập API Docker mặc định.

## Kiểm tra Backend

Với cả hai cách trên, mở PowerShell thứ hai:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/v1/health
Invoke-RestMethod http://127.0.0.1:8080/api/v1/decks
```

Health trả `UP`; danh sách Deck có thể trả `[]` nếu chưa có Deck publish. Health chỉ xác nhận app phản hồi; gọi API Deck mới kiểm tra kết nối tới database.

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
2. **Read:** `GET {{baseUrl}}/api/v1/decks` hoặc `GET {{baseUrl}}/api/v1/decks/{{deckId}}` → `200 OK`.
3. **Update:** `PATCH {{baseUrl}}/api/v1/dev/decks/{{deckId}}` với body `{"title":"Deck demo đã sửa"}` → `200 OK`.
4. **Delete:** `DELETE {{baseUrl}}/api/v1/dev/decks/{{deckId}}` → `204 No Content`. Đây là soft delete; GET public theo ID trả `404`, hàng vẫn còn với `is_published=false`.

Xác minh trong pgAdmin/Query Tool:

```sql
SELECT id, title, is_published, created_at
FROM decks ORDER BY created_at DESC LIMIT 10;
```

Nếu endpoint `/api/v1/dev/decks` trả `404`, kiểm tra Backend được chạy với `SPRING_PROFILES_ACTIVE=local` rồi khởi động lại.

## Thử Profile bằng Postman

Profile cần `userId` của một hàng có thật trong bảng `users`. Chưa có API đăng ký User; mỗi thành viên dùng User test có sẵn hoặc tự tạo User test một lần.

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
