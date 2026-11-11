# English Learning App

Ứng dụng học tiếng Anh dùng React Native/Expo, Spring Boot và PostgreSQL. README này ưu tiên hướng dẫn thành viên trong nhóm tự chạy thử **Deck CRUD** và **Profile API** trên máy Windows.

## Phạm vi Backend hiện có

- Deck: API public đọc Deck đã publish; API tạo/sửa/ẩn Deck chỉ chạy trong Spring profile `local`.
- Profile: API dev đọc/tạo/cập nhật Profile cho một User đã có trong database.
- Chưa có đăng ký/đăng nhập hoặc Authentication/RBAC. Các route `/api/v1/dev/...` chỉ chạy local trên máy, không mở ra LAN hoặc production.
- Profile không có API DELETE. PUT tạo/thay thế Profile; PATCH cập nhật một phần. Deck DELETE là **soft delete** (`is_published=false`), không xóa hàng trong database.
- Quiz, FSRS, IPA và AI Conversation hiện có thiết kế database; chưa có REST CRUD Backend hoàn chỉnh.

## 1. Yêu cầu

- Windows 10/11, Git.
- Java 21 và Maven 3.9+ (`java -version`, `mvn -version`).
- PostgreSQL 18.x + pgAdmin 4.
- Postman để chạy collection có sẵn.

## 2. Chuẩn bị PostgreSQL (mỗi thành viên làm một lần)

1. Mở PostgreSQL/pgAdmin, kết nối tới server `localhost:5432`.
2. Tạo database `english_learning_db` với encoding UTF8 nếu chưa có.
3. **Chỉ khi database mới và trống**, mở Query Tool của database đó, mở và chạy [`database/week3/schema.sql`](database/week3/schema.sql). Schema tự tạo extension `pgcrypto`, 16 bảng, khóa và trigger. Không chạy lại trên database đã có bảng/dữ liệu.
4. Kiểm tra trong Query Tool:

   ```sql
   SELECT current_database(), pg_encoding_to_char(encoding) AS encoding
   FROM pg_database WHERE datname = current_database();
   SELECT count(*) AS tables FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE';
   ```

   Kết quả kỳ vọng: `english_learning_db`, `UTF8`, `16` bảng. Xem [`docs/week3-demo/README.md`](docs/week3-demo/README.md) để biết hướng dẫn đầy đủ và các truy vấn kiểm tra.

## 3. Chạy Backend (PowerShell)

Mở PowerShell tại thư mục dự án:

```powershell
cd "<đường-dẫn-tới-project>\backend"
$env:DB_USERNAME = "postgres"
$secure = Read-Host "Nhập mật khẩu PostgreSQL (không gửi vào chat hoặc lưu vào source)" -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new("", $secure).Password
$env:SPRING_PROFILES_ACTIVE = "local"
mvn clean test
mvn spring-boot:run
```

Nhập mật khẩu PostgreSQL tại prompt PowerShell của máy bạn. Không sửa `application.properties` để ghi mật khẩu. Ứng dụng mặc định chỉ bind `127.0.0.1:8080`; giữ nguyên khi test. Để endpoint ghi `/dev` hoạt động phải bật profile `local` như trên. Muốn dừng Backend, nhấn `Ctrl+C`.

Mở PowerShell khác để kiểm tra:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/v1/health
Invoke-RestMethod http://127.0.0.1:8080/api/v1/decks
```

Health trả `UP`; danh sách Deck có thể là `[]` nếu chưa có Deck publish. Health chỉ xác nhận ứng dụng phản hồi; gọi API Deck mới kiểm tra luồng tới database.

## 4. Thử Deck CRUD bằng Postman

Import hai file `docs/week3-demo/POSTMAN_COLLECTION.json` và `docs/week3-demo/POSTMAN_ENVIRONMENT.json`, chọn environment **English Learning App - Local Demo**, đặt `baseUrl` thành `http://127.0.0.1:8080`. Các request đã có sẵn trong collection.

1. **Create** — `POST {{baseUrl}}/api/v1/dev/decks`:

   ```json
   {
     "title": "Deck demo của nhóm",
     "description": "Dùng thử API Week 3",
     "level": "A1",
     "isPublished": true
   }
   ```

   Kỳ vọng `201 Created`. Lưu `id` trong response; collection POST tự ghi `deckId` vào environment.
2. **Read** — `GET {{baseUrl}}/api/v1/decks` hoặc `GET {{baseUrl}}/api/v1/decks/{{deckId}}`; kỳ vọng `200 OK` và Deck vừa tạo.
3. **Update** — `PATCH {{baseUrl}}/api/v1/dev/decks/{{deckId}}` với body `{"title":"Deck demo đã sửa"}`; kỳ vọng `200 OK`.
4. **Delete** — `DELETE {{baseUrl}}/api/v1/dev/decks/{{deckId}}`; kỳ vọng `204 No Content`. Đây là soft delete. GET public theo ID sau đó trả `404`, còn hàng vẫn nằm trong PostgreSQL với `is_published=false`.

Xác minh trong pgAdmin, database `english_learning_db`:

```sql
SELECT id, title, is_published, created_at
FROM decks ORDER BY created_at DESC LIMIT 10;
```

Nếu `/api/v1/dev/decks` trả 404, kiểm tra `SPRING_PROFILES_ACTIVE=local` trong đúng cửa sổ PowerShell đang chạy Backend rồi khởi động lại.

## 5. Thử Profile bằng Postman

Profile cần `userId` đã tồn tại trong `users`. Hiện chưa có API đăng ký User, nên mỗi thành viên cần chọn User test có sẵn hoặc tạo một User test bằng pgAdmin.

Trong Query Tool của **`english_learning_db`**, trước tiên tìm User có thể dùng lại:

```sql
SELECT id, email, display_name, status
FROM users ORDER BY created_at DESC;
```

Nếu chưa có User test, tạo một User giả bằng hash thử nghiệm (không dùng email, mật khẩu thật):

```sql
INSERT INTO users (email, password_hash, display_name)
VALUES (
  'demo.' || replace(gen_random_uuid()::text, '-', '') || '@example.test',
  crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')),
  'Week 3 Demo User'
)
RETURNING id, email;
```

Sao chép `id` trả về và đặt giá trị `userId` trong Postman environment. Hash chỉ để thỏa schema; không phải tài khoản đăng nhập.

Dùng base path `{{baseUrl}}/api/v1/dev/users/{{userId}}/profile`:

1. **Create/replace** — `PUT` với body:

   ```json
   { "englishLevel": "A2", "dailyGoalMinutes": 20, "avatarUrl": "https://example.test/avatar.png" }
   ```

   Kỳ vọng `200 OK` và JSON Profile. PUT tạo Profile nếu chưa có, hoặc thay các trường được phép nếu đã có.
2. **Read** — `GET` cùng URL; kỳ vọng `200 OK` và dữ liệu đã lưu.
3. **Update** — `PATCH` cùng URL với body `{"dailyGoalMinutes":45}`; kỳ vọng `200 OK`. GET lại để thấy giá trị mới.
4. `dailyGoalMinutes` hợp lệ từ 5 đến 240; `englishLevel` là `A1`, `A2`, `B1`, `B2`, `C1` hoặc `C2`. Profile gắn với User không tồn tại sẽ bị từ chối.

Xác minh bằng pgAdmin:

```sql
SELECT user_id, english_level, daily_goal_minutes, avatar_url, updated_at
FROM user_profiles WHERE user_id = '<dán userId của bạn>';
```

**Lưu ý:** Profile test route nhận UUID trực tiếp, không chứng minh danh tính người dùng. Chỉ dùng profile `local` trên `127.0.0.1`; chưa có API xóa Profile/User hoặc Authentication.

## 6. Kiểm tra mã nguồn và Postman

- Chạy test Backend: `cd backend; mvn clean test`.
- Collection/environment: [`docs/week3-demo/POSTMAN_COLLECTION.json`](docs/week3-demo/POSTMAN_COLLECTION.json), [`docs/week3-demo/POSTMAN_ENVIRONMENT.json`](docs/week3-demo/POSTMAN_ENVIRONMENT.json).
- Tài liệu chuẩn bị demo, các truy vấn và xử lý lỗi: [`docs/week3-demo/README.md`](docs/week3-demo/README.md).
- Schema: [`database/week3/schema.sql`](database/week3/schema.sql); ERD: [`database/week3/English_Learning_ERD.dbml`](database/week3/English_Learning_ERD.dbml).

## 7. Chạy ứng dụng Expo (tùy chọn)

```powershell
npm install
npx expo start
```

Điện thoại và máy chạy Metro cần kết nối cùng mạng. Khi thử API trên điện thoại thật, `EXPO_PUBLIC_API_BASE_URL` phải là địa chỉ LAN của máy Backend; không dùng `127.0.0.1` của điện thoại. Phần này không cần để kiểm thử Deck/Profile bằng Postman.
