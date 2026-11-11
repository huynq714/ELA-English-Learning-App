# English Learning App — hướng dẫn demo Backend/PostgreSQL/Postman

Tài liệu này dùng cho máy Windows mới và chỉ hướng dẫn PostgreSQL + Spring Boot + Postman + pgAdmin, không cần Expo. Nguồn thực tế: `database/week3/schema.sql`, `backend/src/main/resources/application.properties`, Controller/DTO/Service hiện hành.

## 1. Giới thiệu/phạm vi

Frontend React Native/Expo; Backend Java 21 + Spring Boot 4.1.2 + Maven; PostgreSQL. Database thiết kế sáu nhóm (Account/Profile, Vocabulary, Quiz, FSRS, IPA, AI Conversation). Backend demo thực tế hiện có Health, Deck và Profile test-local. Không tuyên bố bốn module Quiz/FSRS/IPA/AI đã có REST API hoàn chỉnh. Không có Authentication/RBAC.

## 2. Thư mục

- `database/week3/schema.sql`: PostgreSQL DDL, FK/CHECK/index/trigger. Chỉ chạy trên database trống.
- `database/week3/English_Learning_ERD.dbml`: sơ đồ bảng/FK; SQL là nguồn chi tiết cho trigger/CHECK.
- `backend/pom.xml`: Java 21, Boot 4.1.2, Web MVC, JPA, Validation, PostgreSQL, Test.
- `backend/src/main/java/com/englishlearning`: entrypoint và package feature.
- `vocabulary/controller|service|repository|entity|dto`: API Deck.
- `profile/controller|service|repository|entity|dto`: API Profile test-local.
- `common/exception`: định dạng lỗi API.
- `backend/src/main/resources/application.properties`: kết nối DB qua biến môi trường; `ddl-auto=validate`.

## 3. Yêu cầu và kiểm tra công cụ

Cài Java 21, Maven 3.9+, PostgreSQL 18.x, pgAdmin 4, Postman và Git. Các version đã quan sát trên máy dự án: Java 21.0.12.1, Maven 3.9.11, PostgreSQL 18.6; thành viên khác kiểm tra bằng:

```powershell
java -version
mvn -version
psql --version
git --version
```

Nếu `psql` không trong PATH, gọi trực tiếp `& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --version`.

## 4. PostgreSQL: cài schema an toàn

1. Mở PowerShell: `Get-Service *postgres*`; khởi động service nếu cần bằng quyền phù hợp. Kiểm tra port: `Get-NetTCPConnection -LocalPort 5432 -State Listen`.
2. Trong pgAdmin tạo database `english_learning_db` (encoding UTF8) nếu chưa có. **Trước khi chạy schema**, kết nối database và chạy truy vấn kiểm tra số bảng trong mục SQL dưới. Nếu có bảng/dữ liệu, không chạy lại schema v1.1 vì CREATE TABLE sẽ lỗi; sao lưu/đánh giá trước.
3. Chỉ trên database trống, Query Tool mở `database/week3/schema.sql` và Execute; file tự BEGIN/COMMIT, tạo extension pgcrypto, 16 bảng, FK, function, trigger.
4. Hibernate giữ `ddl-auto=validate`; không đổi thành create/update. Không chạy schema lại trên DB đã có bảng.

Truy vấn read-only kiểm tra cấu trúc:

```sql
SELECT current_database(), pg_encoding_to_char(encoding) AS encoding
FROM pg_database WHERE datname = current_database();
SELECT count(*) AS tables FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
SELECT count(*) AS foreign_keys FROM pg_constraint
WHERE connamespace='public'::regnamespace AND contype='f';
SELECT count(*) AS enabled_user_triggers FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled <> 'D';
SELECT
  count(*) FILTER (WHERE contype='p') AS primary_keys,
  count(*) FILTER (WHERE contype='u') AS unique_constraints,
  count(*) FILTER (WHERE contype='c') AS check_constraints,
  count(*) FILTER (WHERE contype='f') AS foreign_keys
FROM pg_constraint WHERE connamespace='public'::regnamespace;
SELECT CASE confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'r' THEN 'RESTRICT'
         WHEN 'n' THEN 'SET NULL' WHEN 'a' THEN 'NO ACTION' ELSE confdeltype::text END AS on_delete,
       count(*)
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace
GROUP BY confdeltype ORDER BY on_delete;
SELECT count(*) AS review_logs_composite_fk
FROM pg_constraint
WHERE connamespace='public'::regnamespace AND contype='f'
  AND conrelid='public.review_logs'::regclass
  AND cardinality(conkey)=2 AND cardinality(confkey)=2;
```

Kỳ vọng 16/19/11 theo schema; snapshot trước đó có 16 PK, 3 UNIQUE constraints, 32 CHECK, 27 indexes, 9 trigger functions, FK delete action CASCADE 11 / RESTRICT 6 / SET NULL 2. `uq_users_email_lower` là unique index, vì vậy không tính trong `unique_constraints`. Đếm trigger nên loại internal triggers. Trước đây database test được báo cáo 16 bảng, 19 FK, 11 user trigger bật; đây là số liệu từ lần đo trước, không phải phép đo mới trên máy thành viên.

## 5. Cấu hình/chạy Backend

Properties có URL mặc định `jdbc:postgresql://localhost:5432/english_learning_db`; `DB_USERNAME`/`DB_PASSWORD` bắt buộc lấy từ environment, port 8080 và bind mặc định `127.0.0.1`. Tại PowerShell:

```powershell
cd "<project>\backend"
$env:DB_USERNAME = "postgres"
$secret = Read-Host "PostgreSQL password" -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new("", $secret).Password
# Local demo: bật endpoint ghi /dev, chỉ bind loopback.
$env:SPRING_PROFILES_ACTIVE = "local"
Remove-Item Env:SERVER_ADDRESS -ErrorAction SilentlyContinue
mvn clean test
mvn spring-boot:run
```

Không đưa mật khẩu vào chat, source, Postman, README hay commit. Mở terminal khác:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/v1/health
Invoke-RestMethod http://127.0.0.1:8080/api/v1/decks
```

Health trả `{"status":"UP"}` nhưng chỉ xác nhận ứng dụng phản hồi; nó không tự probe database. `GET /decks` chứng minh đường API/DB hoạt động.

**Profile mặc định:** không có `local`, các `/api/v1/dev/...` không được đăng ký. **Profile local:** Deck/Profile dev endpoints ghi được đăng ký, không có auth; chỉ dùng loopback. Không dùng local khi mở server ra LAN.

## 6. Chuẩn bị User thử nghiệm cho Profile

Không có API tạo User/Auth. Trên database demo (khuyến nghị `english_learning_test`; nếu dùng `english_learning_db`, tạo dữ liệu demo có chủ ý), chạy SQL dưới trong pgAdmin. Hash sinh ngẫu nhiên qua pgcrypto, email duy nhất ngẫu nhiên; lưu ID trả về cho Environment `userId`.

```sql
INSERT INTO users(email, password_hash, display_name)
VALUES ('profile.demo.' || replace(gen_random_uuid()::text,'-','') || '@example.test',
        crypt(encode(gen_random_bytes(32),'hex'), gen_salt('bf')),
        'Week 3 Demo User')
RETURNING id, email;
```

`password_hash` là hash test, không phải mật khẩu plaintext; API này không đăng nhập được và không có Auth để kiểm thử.

## 7. Postman API thực tế

Import `POSTMAN_COLLECTION.json` và `POSTMAN_ENVIRONMENT.json`. Chọn environment, đặt `baseUrl=http://127.0.0.1:8080`; POST Deck tự lưu `deckId`. Profile cần đặt `userId` thành UUID User đã tạo. Header JSON: `Content-Type: application/json`.

### Health

`GET {{baseUrl}}/api/v1/health` → 200 `{"status":"UP"}`. Không chứng minh DB một mình.

### Public Deck

- `GET {{baseUrl}}/api/v1/decks` → 200 array published Deck.
- `GET {{baseUrl}}/api/v1/decks/{{deckId}}` → 200 Deck hoặc 404 nếu ID thiếu/ẩn.
- Response thật: `{ "id": "uuid", "title": "...", "description": "...", "level": "A1", "isPublished": true, "createdAt": "...Z" }`. `description`/`level` có thể null.

### Deck dev (profile local only)

- `POST {{baseUrl}}/api/v1/dev/decks` → 201; `Location` và response DTO. Body:

```json
{"title":"Postman Demo Deck","description":"Deck dùng cho buổi demo","level":"A1","isPublished":true}
```

  `title` bắt buộc, tối đa 120; `level` tùy chọn A1–C2; ID/createdAt do server sinh.
- `PATCH {{baseUrl}}/api/v1/dev/decks/{{deckId}}` → 200; body chỉ trường đổi, ví dụ `{"title":"Updated Demo Deck"}`. Body rỗng/giá trị sai → 400.
- `DELETE {{baseUrl}}/api/v1/dev/decks/{{deckId}}` → 204; **soft delete** đặt `is_published=false`; public GET theo ID sau đó 404, hàng DB vẫn còn.
- Request ghi không có Auth/RBAC. Không expose local profile trên mạng.

### Profile dev (profile local only)

Base path `{{baseUrl}}/api/v1/dev/users/{{userId}}/profile`.

- GET → 200 DTO `{userId, englishLevel, dailyGoalMinutes, avatarUrl, updatedAt}`; User/Profile không tồn tại → 404.
- PUT → 200, tạo hoặc thay thế fields cho User tồn tại:

```json
{"englishLevel":"A2","dailyGoalMinutes":20,"avatarUrl":"https://example.test/avatar.png"}
```

- PATCH → 200; ví dụ `{"dailyGoalMinutes":45}`. Profile chưa có sẽ khởi tạo từ A1/15 rồi áp dụng patch. Có thể gửi `avatarUrl:null` để xóa avatar. level A1–C2, goal 5–240. Trường email/password/status không nằm trong DTO.
- Không có `DELETE user`, đăng ký hay đăng nhập API.

## 8. Kiểm tra PostgreSQL

```sql
-- Deck vừa tạo/đã patch:
SELECT id,title,description,level,is_published,created_at FROM decks ORDER BY created_at DESC;
-- Hàng Deck sau DELETE vẫn còn và bị ẩn:
SELECT id,title,is_published FROM decks WHERE id='<deckId>';
-- Profile:
SELECT user_id,english_level,daily_goal_minutes,avatar_url,updated_at
FROM user_profiles WHERE user_id='<userId>';
-- Không xóa User/Deck để dọn demo; Deck DELETE API chỉ unpublish.
```

## 9. Troubleshooting

| Lỗi | Kiểm tra | Cách xử lý |
|---|---|---|
| PostgreSQL service stopped / connection refused | `Get-Service *postgres*`; cổng 5432 | Khởi động service, kiểm tra host/port/database. |
| Sai password/authentication failed | Prompt psql bằng `-W`; biến DB hiện tại | Đặt lại DB_USERNAME/DB_PASSWORD trong đúng PowerShell chạy Maven; không gửi secret. |
| Port 5432 bị chiếm | `Get-NetTCPConnection -LocalPort 5432 -State Listen` | Xác định service; không kill/xóa dữ liệu tùy tiện. |
| Port 8080 in use | `Get-NetTCPConnection -LocalPort 8080 -State Listen` | Dừng đúng backend demo cũ hoặc cấu hình port khác cho riêng lần chạy. |
| Missing DB_USERNAME/DB_PASSWORD | Log Spring báo placeholder | Khai báo env vars trong cùng shell trước `mvn spring-boot:run`. |
| Maven compile/test lỗi | `mvn clean test`; Java version | Kiểm tra Java 21, dependency download, đọc lỗi đầu tiên. |
| Hibernate validate lỗi | startup log, table/column/type | So sánh Entity đã ánh xạ với schema; không đổi ddl-auto sang update/create. |
| HTTP 400 | JSON, field name, Validation | title nonblank ≤120; level đúng enum; goal 5–240; Content-Type JSON. |
| HTTP 404 | URL/method/UUID, GET published, User tồn tại | Deck ẩn không public; Profile user_id phải có; dev endpoint cần local profile. |
| HTTP 405 | Method và URL | GET/POST/PATCH/DELETE phải đúng routes ở trên. |
| HTTP 500 | Backend terminal `ERROR`/`Caused by` | Đọc nguyên nhân log; không đưa stack trace/user data nhạy cảm vào tài liệu. |
| `/dev` 404 | Profile có `local` không | Chỉ demo trên localhost: set `SPRING_PROFILES_ACTIVE=local`, restart. Không bật khi bind LAN. |
| Postman thành công nhưng pgAdmin không thấy | pgAdmin tab DB và `current_database()`; datasource URL | API và Query Tool phải vào cùng database. Kiểm tra `is_published` khi tìm Deck public. |

## 10. Checklist thành viên

- [ ] PostgreSQL service/5432 hoạt động; DB UTF8, schema cài một lần trên DB trống.
- [ ] `mvn clean test` PASS; env DB set; backend local chạy loopback.
- [ ] Health 200 và GET Deck 200.
- [ ] Postman POST→GET→PATCH→DELETE; DELETE trả 204 và SQL cho thấy hàng còn, unpublished.
- [ ] Tạo test User bằng SQL; PUT/Get/PATCH Profile thành công; SQL xác nhận FK/values.
- [ ] Biết `/dev` không auth, không production; Quiz/FSRS/IPA/AI mới ở schema.
