# Kịch bản bảo vệ Week 3 — 8 phút (có thể rút còn 6 phút)

## Chuẩn bị trước buổi demo (10 phút trước)

- PostgreSQL Service chạy; pgAdmin mở `english_learning_db` và `english_learning_test` đúng tab.
- Backend chạy loopback `127.0.0.1:8080`, profile `local` chỉ cho demo trực tiếp trên máy; DB env đúng; không Expo/iPhone.
- Maven `mvn clean test` đã chạy trước; Postman import collection/environment; mở `ERD_OVERVIEW.dbml` dbdiagram.io và `ARCHITECTURE.md`.
- Tạo Deck demo qua POST nếu cần. Đọc ID từ Environment hoặc SQL, không học thuộc UUID.
- Không trình diễn xóa account, xóa Word, test destructive trên dữ liệu dev.

## Timeline và lời thoại

### 0:00–0:50 — Giới thiệu hệ thống

**Mở:** `ARCHITECTURE.md`.

**Nói:** “Ứng dụng mobile gọi REST API; Spring Controller nhận HTTP, Service giữ nghiệp vụ/transaction, Repository dùng JPA tới PostgreSQL. Không để app mobile cầm credential DB. Hôm nay tập trung Backend, DB và Postman.”

**Mong đợi:** Giảng viên thấy rõ pipeline, không nhầm với ERD.

### 0:50–2:35 — ERD/quan hệ

**Mở:** `ERD_OVERVIEW.dbml` tại dbdiagram.io; zoom groups users/profile, deck_words, review_cards/logs.

**Nói:** “SQL có 16 bảng/19 FK. User–Profile là 1–0..1 vì user_id vừa PK vừa FK. Deck–Word là N–N qua deck_words, khóa ghép chống link trùng. FSRS card là state hiện tại; review_logs là các sự kiện và FK ghép bảo đảm log của đúng user-word card.”

**Mong đợi:** Có thể chỉ cột PK/FK và ON DELETE trong SQL. Nhắc DBML không thể hiện hết deferred triggers/checks.

### 2:35–3:30 — Backend layers

**Mở:** VS Code `DeckController`, `DeckService`, `DeckRepository`, DTO.

**Nói:** “Controller nhận request/HTTP; DTO validate input; Service kiểm tra nghiệp vụ và transaction; Repository query/update. Response là DTO. Deck DELETE là unpublish để không phá Quiz history đang RESTRICT.”

**Nếu hỏi Auth:** “/dev chỉ có profile local, chưa có Auth/RBAC, không dùng production.”

### 3:30–6:00 — Postman Deck CRUD

1. GET `{{baseUrl}}/api/v1/health` → 200 `UP` (app health thôi, không phải probe DB).
2. POST `/api/v1/dev/decks` body hợp lệ → 201; Collection tự lưu `deckId`.
3. GET `/api/v1/decks/{{deckId}}` → 200 và DTO.
4. PATCH `/api/v1/dev/decks/{{deckId}}` `{"title":"Updated Demo Deck"}` → 200.
5. DELETE cùng dev URL → 204.
6. GET public theo ID → 404 vì Deck đã ẩn.

**Nói:** “API không xóa hàng; query DB sẽ cho thấy is_published=false.”

### 6:00–7:10 — PostgreSQL minh chứng/validation

Trong pgAdmin chạy:

```sql
SELECT id,title,is_published,created_at FROM decks ORDER BY created_at DESC;
```

**Mong đợi:** Deck vừa demo vẫn tồn tại và is_published=false. Nếu còn thời gian gửi POST với `{"title":" ","level":"C9"}` → 400 do DTO; không cần sửa DB.

### 7:10–8:00 — Profile và giới hạn

Nếu còn thời gian: GET/PUT/PATCH `/api/v1/dev/users/{{userId}}/profile`; cần User đã tạo trong DB trước. SQL:

```sql
SELECT user_id,english_level,daily_goal_minutes,avatar_url
FROM user_profiles WHERE user_id='<dán UUID userId từ Postman>';
```

**Kết:** “Đã triển khai/test API Deck và Profile demo, đã kiểm thử schema và trigger trên DB test trước đó. Bốn module Quiz/FSRS/IPA/AI mới ở database design; Authentication chưa có.”

## Nếu demo gặp sự cố

- DB/backend down: dừng, chạy `Get-Service *postgres*`, kiểm tra env/port; không đợi sửa schema trước lớp.
- 8080 bị chiếm: dùng PowerShell `Get-NetTCPConnection -LocalPort 8080`; dừng backend demo cũ đúng process, không kill ngẫu nhiên.
- 500: mở terminal Backend, đọc `ERROR`/`Caused by`; không đoán từ Postman generic body.
- Deck đã bị ẩn: query DB/POST một Deck mới trong profile local; không UPDATE DB thủ công giữa bài demo.
- Quên ID: Postman Environment hoặc `SELECT id,title,is_published FROM decks ORDER BY created_at DESC LIMIT 10;`.
- Hết giờ: bỏ Profile; giữ kiến trúc, ba quan hệ ERD, Deck POST/soft-delete/SQL.
- Hỏi cascade User: chỉ giải thích bằng FK paths + trigger-depth bypass + isolated `test_user_cascade.sql` đã được báo PASS trước đó; không chạy xóa tài khoản tại demo.
- Hỏi xóa Word: chỉ giải thích RESTRICT; không chạy DELETE trên DB dev.
- Hỏi “module đã xong chưa”: phân biệt database design và API. Không nhận Quiz/FSRS/IPA/AI đã hoàn thiện.

## Checklist ngày demo

- [ ] Máy có Java 21/Maven/Postgres/pgAdmin/Postman và file SQL/ERD.
- [ ] DB đúng `english_learning_db`; backend đúng DB; env password kín.
- [ ] Endpoint `/dev` chỉ chạy local trên loopback.
- [ ] Collection/environment import; `baseUrl` và User ID đúng.
- [ ] Mở ERD, architecture, SQL verification query trước.
- [ ] Câu trả lời trung thực: không Auth; 4 module chưa API.
