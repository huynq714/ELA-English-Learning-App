# Kiểm thử danh mục từ vựng A1/A2

## Dữ liệu đã xác minh

| Level | Chủ đề | Số từ | Căn cứ phân loại |
| --- | --- | ---: | --- |
| A1 | Thời gian và tần suất | 15 | Ứng dụng nhóm các mục A1 của CEFR-J |
| A1 | Vị trí và di chuyển | 15 | Ứng dụng nhóm các mục A1 của CEFR-J |
| A1 | Giao tiếp và cảm xúc | 15 | Ứng dụng nhóm các mục A1 của CEFR-J |
| A2 | Học tập | 15 | CEFR-J • Education |
| A2 | Công việc và nghề nghiệp | 15 | CEFR-J • Work and jobs |
| A2 | Thành phố và mua sắm | 15 | CEFR-J • Things in the town, shops and shopping |

Đối chiếu 90 mục theo dòng trong workbook, từ, POS và level. Tái sử dụng 18 mục A1 từ Task 01. Với 72 mục mới, chọn nghĩa Việt có trong mục từ đúng POS và khớp với nghĩa Anh đã chọn. Mỗi Deck có 15 từ và 15 đáp án phân biệt được. Các mục thiếu dẫn chứng phù hợp nằm ngoài tập import. [Bảng rà soát từng từ](../../database/week4/import/data/topic_word_review.csv)

Từ, POS và level theo *The CEFR-J Wordlist Version 1.6*, Yukio Tono, Tokyo University of Foreign Studies. Định nghĩa tiếng Anh lấy từ Free Dictionary API hoặc English Wiktionary. Nghĩa Việt lấy từ Vietnamese Wiktionary qua bản trích xuất Kaikki ngày 2026-10-02. Mỗi từ lưu URL, vị trí nghĩa và giấy phép trong `source_metadata`. Các ví dụ đã duyệt của Task 01 đi theo 18 mục tái sử dụng. [CEFR-J](https://cefr-j.org/download_eng) · [Kaikki](https://kaikki.org/viwiktionary/rawdata.html) · [Nguồn và giấy phép](VOCABULARY_SOURCE.md)

## Nạp vào PostgreSQL

Từ PowerShell tại thư mục gốc, dùng lệnh dưới đây cho PostgreSQL native. Nhập mật khẩu trực tiếp trong cửa sổ PowerShell.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\week4\import\apply_topic_decks.ps1 -Apply
```

Script kiểm tra schema Tuần 3 và migrations V1_2/V1_3, tạo bản sao lưu trong `.artifacts/week4-topic-backups/`, chạy dry-run đến `ROLLBACK` rồi mới nạp V1_4 và dữ liệu trong một transaction. Bỏ `-Apply` để chỉ chạy dry-run. Volume Docker mới tự nạp migration và dữ liệu khi khởi tạo.

Để chạy bằng pgAdmin, sao lưu database, mở Query Tool đúng database và chạy [migration V1_4](../../database/week4/migrations/V1_4__topic_deck_catalog.sql). Mở [script import](../../database/week4/import/data/apply_topic_decks.sql), đổi `COMMIT;` cuối file thành `ROLLBACK;` để dry-run. Khi thấy đủ sáu dòng với 15 từ mỗi Deck, mở lại file gốc rồi chạy với `COMMIT;`. Sau đó khởi động lại Backend để Hibernate xác thực schema mới.

```sql
SELECT d.level, d.topic, d.topic_source, d.topic_source_label,
       count(w.id) AS words,
       count(*) FILTER (WHERE w.source_metadata #>> '{vietnamese,reviewStatus}' = 'VERIFIED') AS verified_words,
       min(dw.sort_order) AS first_word, max(dw.sort_order) AS last_word
FROM public.decks d
JOIN public.deck_words dw ON dw.deck_id = d.id
JOIN public.words w ON w.id = dw.word_id
WHERE d.topic_key IS NOT NULL AND d.is_published
GROUP BY d.id
ORDER BY d.level, d.topic;
```

Kết quả mong đợi gồm 3 dòng A1 và 3 dòng A2. Mỗi dòng có `words = verified_words = 15` và thứ tự 1–15. Catalog dùng `topic_key` định danh Deck và `import_key` định danh từ. Các Deck cũ nằm ngoài danh mục nhưng các hàng, liên kết và lịch sử của chúng vẫn được lưu.

Database mới từ import chủ đề có 90 từ và 90 liên kết Deck–Word. Không cần nạp ba Deck A1 Core cũ để chạy catalog hiện tại; database đã có chúng vẫn giữ nguyên, không bị xóa. User, bookmark và tiến độ học không được chia sẻ giữa các thành viên.

### Cập nhật volume Docker đã có dữ liệu

Docker chỉ chạy SQL khởi tạo khi volume trống. Khi cập nhật volume cũ, lệnh dưới đây sao lưu rồi áp dụng V1_4 và import idempotent cho sáu Deck chủ đề. Chạy lại không xóa Deck, Word, liên kết hay lịch sử hiện có. Đổi username hoặc tên database trong đoạn lệnh nếu bạn đã tùy chỉnh chúng trong `.env`. Nếu thiếu V1_2 hoặc V1_3, dùng bản sao lưu và áp dụng các migration còn thiếu theo thứ tự trước khi chạy import. [Tài liệu image PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/README.md)

```powershell
docker compose up -d --wait db
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL chưa khởi động được' }

$pg = @('-U', 'english_learning_dev', '-d', 'english_learning_db')
$backupDir = '.artifacts/week4-topic-backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupName = 'english_learning_db-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '.backup'
docker compose exec -T db pg_dump @pg -Fc -f "/tmp/$backupName"
if ($LASTEXITCODE -ne 0) { throw 'Sao lưu thất bại' }
docker compose exec -T db pg_restore -l "/tmp/$backupName" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Không đọc được bản sao lưu' }
docker compose cp "db:/tmp/$backupName" "$backupDir/$backupName"
if ($LASTEXITCODE -ne 0) { throw 'Không sao chép được bản sao lưu về máy' }

$migration = Get-Content -Raw -Encoding UTF8 'database/week4/migrations/V1_4__topic_deck_catalog.sql'
$catalogue = Get-Content -Raw -Encoding UTF8 'database/week4/import/data/apply_topic_decks.sql'
$sql = "BEGIN;`n" + ($migration -replace '(?m)^BEGIN;\s*|COMMIT;\s*$', '') +
  "`n" + ($catalogue -replace '(?m)^BEGIN;\s*|COMMIT;\s*$', '')
$previousEncoding = $OutputEncoding
try {
  $OutputEncoding = [Text.UTF8Encoding]::new($false)
  ($sql + "`nROLLBACK;") | docker compose exec -T db psql @pg -X -v ON_ERROR_STOP=1 -f -
  if ($LASTEXITCODE -ne 0) { throw 'Dry-run thất bại' }
  ($sql + "`nCOMMIT;") | docker compose exec -T db psql @pg -X -v ON_ERROR_STOP=1 -f -
  if ($LASTEXITCODE -ne 0) { throw 'Cập nhật danh mục thất bại' }
} finally {
  $OutputEncoding = $previousEncoding
}
docker compose up -d --build backend
```

## Kiểm thử API và app

1. Khởi động Backend, đăng nhập và dùng `accessToken` dưới dạng Bearer token. Profile đã lưu A1 hoặc A2 trả về đúng 3 Deck qua `GET /api/v1/decks`. Profile B1–C2 trả danh sách rỗng vì gói này chỉ có A1/A2. Tài khoản thiếu Profile nhận `409 PROFILE_LEVEL_REQUIRED`.
2. `GET /api/v1/decks/{id}` và `GET /api/v1/decks/{id}/words` trả `200` với Deck đúng level. Gọi bằng ID khác level ở hai endpoint này, hoặc gửi ID đó vào `POST /api/v1/quiz/attempts`, đều nhận `404`.
3. Trong app, mở **Từ vựng → Chủ đề**, chọn một chủ đề rồi nhập từ khóa viết hoa hoặc thường. Lọc và tìm kiếm đồng thời giới hạn kết quả trong danh mục hiện tại. Mở Flashcards và lật thẻ để kiểm tra nghĩa.
4. Vào **Cá nhân**, đổi A1 ↔ A2, lưu và quay về Từ vựng. Kiểm tra danh sách và chủ đề đổi ngay trong phiên đang đăng nhập.
5. Để thử trên Expo Go, đặt `EXPO_PUBLIC_API_BASE_URL` bằng địa chỉ LAN của máy chạy Backend trước khi khởi động Expo. Dùng cùng mạng và chạy Backend với profile mặc định khi mở cổng cho điện thoại.

## Kết quả nghiệm thu

| Kiểm thử | Kết quả |
| --- | --- |
| 6 Deck, 90 từ, thứ tự và nguồn, `meaning_vi` có dữ liệu | PASS trên PostgreSQL 18.6 cô lập |
| Backup, dry-run, rollback dữ liệu lỗi, chạy lại | PASS trên PostgreSQL cô lập. ID Deck cũ và liên kết giữ nguyên. |
| JWT, đúng 3 Deck mỗi level, từ chối truy cập chéo, đổi level cùng JWT, Profile bị thiếu | PASS qua HTTP thật với Spring Boot và PostgreSQL cô lập |
| Flashcards, tạo Quiz 5 câu ở cả sáu Deck, giữ kết quả Quiz và lịch sử FSRS qua import lại | PASS qua HTTP và đối chiếu SQL cô lập |
| Hồi quy Quiz sau khi khởi động lại Backend | PASS. PostgreSQL giữ 4 bài đã hoàn thành, 20 đáp án và 1 đáp án của bài đang làm trong kịch bản thử. |
| Hồi quy Auth và Profile | PASS qua HTTP và PostgreSQL cô lập, gồm cập nhật Profile, đổi mật khẩu và đọc danh mục sau đăng ký. |
| Tìm kiếm kết hợp chủ đề, lật thẻ, đổi Profile A1 → A2 trong cùng phiên | PASS trên React Native Web với Edge và API thật |
| Maven, import builder, TypeScript, ESLint, Expo web export | PASS với 23 test Maven và 5 test import builder |
| Docker Compose với volume mới | Cấu hình hiện tại nạp 6 Deck chủ đề, migrations và dữ liệu nguồn. Chưa chạy lại Docker Engine sau lần cập nhật cấu hình này. |
| Cập nhật volume Docker cũ | Quy trình trước đây đã PASS trên volume kiểm thử V1_3. Lượt cập nhật này không thêm hoặc xóa Deck Core; chưa chạy lại trên Docker Engine. |
| Nạp database phát triển `english_learning_db` | PASS theo log PowerShell người dùng gửi. Script tạo bản sao lưu, dry-run kết thúc bằng `ROLLBACK` và lần nạp kết thúc bằng `COMMIT`. Đã thêm 6 Deck, 72 từ mới và 90 liên kết. Cả 6 Deck có 15 từ đã xác minh. |
| Expo Go trên điện thoại | Chưa chạy trong lượt này |

Phiên web hiện được giữ trong bộ nhớ. Mở URL Flashcards bằng lượt tải trang mới đưa người dùng chưa có phiên về màn hình chào. Trường hợp có JWT hợp lệ nhưng Deck khác cấp độ đã được kiểm chứng bằng HTTP trực tiếp.

Log PowerShell trên máy phát triển hiển thị tên chủ đề sai dấu. Dùng truy vấn trong phần nạp PostgreSQL để đối chiếu tên trực tiếp trong pgAdmin.
