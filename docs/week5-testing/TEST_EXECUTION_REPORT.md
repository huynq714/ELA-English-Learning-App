# Báo cáo thực thi kiểm thử tuần 5 — Máy mới

## Kết thúc phạm vi đại diện 3C–5 (25/11/2026)

Kết quả CSV hiện tại: **26 PASS, 0 FAIL, 14 PARTIAL, 2 BLOCKED, 21 NOT RUN**. Đã chọn 9 ca chưa hoàn tất cho Web: AUTH-04, HOME-01/03, UI-03/04/05, NET-01/02, FLASH-04. Log/JSON ghi chính xác phần chạy được; chỉ tăng lên PARTIAL, không đổi thành PASS native. Quiz/Flashcard được chạy lại bằng smoke script sẵn có để hồi quy.

Native: adb không có thiết bị; có AVD nhưng không mở trong phạm vi tài nguyên/hạn mức hạn chế. WHPX usable không chứng nhận app native. Xem MANUAL_TEST_GUIDE.md. Không cài hoặc nâng công cụ.

BUG-W5-001 đã sửa bằng CORS allowlist cấu hình rõ ràng, mặc định rỗng; từ chối wildcard, không gửi cookie credentials. Runtime local khai báo 3 origin loopback. Trước: OPTIONS401; sau: origin cho phép200, origin lạ/giả mạo403, endpoint thiếu JWT401, trình duyệt đọc được phản hồi API khác origin. Đây là lỗi cấu hình tích hợp trong ứng dụng; không phải lỗi mạng máy tính. Xem evidence/representative/cors-after.json.

Maven cuối package SUCCESS, **95/95 tests, 0 skip** (thêm một bài CORS; 19 bài tích hợp), lint/typecheck đạt. Quiz Web regression exit0. Lượt package đầu bị khóa JAR do backend đang chạy; đã dừng đúng backend test trước build lại. Các lần sửa locator/khởi động quá sớm của script 3C không tính PASS; log gốc nằm .artifacts. Không phát hiện thêm lỗi ứng dụng đã xác nhận trong phạm vi đại diện.

Tổng ghi nhận: 1 lỗi ứng dụng đã sửa trong lượt này, 2 vấn đề môi trường, 2 vấn đề script (1 đã sửa từ 3B, 1 còn mở). Không tính chúng thành 5 lỗi nghiệp vụ. Không nâng PG17, không sửa My Vocabulary để né blocker.

Các đoạn phía trên mô tả lượt 3B trước sửa (94 tests/CORS OPEN/26 PASS); mục này và CSV là trạng thái mới nhất. Hồ sơ báo cáo đủ 5 mục theo phạm vi giới hạn, không đồng nghĩa hoàn tất mọi test hay nghiệm thu native. Thực hiện commit/push đúng feat/week5-testing theo yêu cầu hiện tại.


## Lịch sử 3B trước lượt sửa CORS

Các trạng thái OPEN/chưa commit và số liệu phía dưới thuộc lượt trước. Trạng thái hiện tại xem mục đầu.

**Ngày:** 25/11/2026, Asia/Saigon. **Workspace:** `D:\ELA-week5-testing`. **Nhánh:** `feat/week5-testing`. **Source HEAD:** `cf018aab276318ea094dc953eb27163d1f9ce29f`. Không commit/push trong phiên này. Tài liệu kế hoạch và thiết kế ca giữ nguyên; chỉ điền kết quả thực thi và thêm script hỗ trợ môi trường/kiểm thử.

## 1. Kết quả của bộ 63 ca

| Trạng thái | Automated | Manual | Tổng |
| --- | ---: | ---: | ---: |
| PASS | 26 | 0 | 26 |
| PARTIAL | 6 | 0 | 6 |
| BLOCKED | 2 | 0 | 2 |
| NOT RUN | 0 | 29 | 29 |
| FAIL của ca đã thực thi đủ trên môi trường yêu cầu | 0 | 0 | 0 |

**Chưa hoàn tất giai đoạn 3B và chưa nghiệm thu dự án.** PASS chỉ áp dụng môi trường/phạm vi thực sự đã chạy, không chứng nhận Android/iOS. PARTIAL nghĩa là đã chạy một phần nhưng chưa đủ mọi biến thể của hàng CSV; không tính là PASS. BLOCKED là chưa thể thực thi đầy đủ do trở ngại môi trường đã xác minh. HTTP 500 của My Vocabulary trên PG17 được lưu nguyên trạng và gắn ENV-W5-001, không biến thành PASS hoặc suy luận thất bại trên PG18.

Chi tiết từng ca ở [TEST_CASES.csv](TEST_CASES.csv), [case-results.json](evidence/new-machine/case-results.json). Các con số JUnit, assertion bổ sung và test case CSV thuộc các cấp khác nhau, **không cộng thành một tổng test case**.

## 2. Git và công cụ

Đầu phiên: đúng branch, working tree sạch, upstream `origin/feat/week5-testing`, ahead/behind **0/0 theo refs local**. Không fetch nên không khẳng định đã đối chiếu trạng thái GitHub theo thời gian thực. Chỉ thay đổi working tree của nhánh hiện tại.

Tái sử dụng Node **22.19.0**, npm **10.9.3**, Temurin Java **21.0.7+6**, Maven **3.9.16**, PostgreSQL **17.11**, Python **3.10.11**, Git **2.48.1.windows.1**, Edge **158.0.4370.33**. Android SDK/ADB/Emulator và AVD `Medium_Phone` API35 có sẵn nhưng chưa kiểm mobile. `adb devices -l` không có device; chưa tìm thấy sdkmanager. Không cài phần mềm hệ thống hoặc sửa PATH lưu vĩnh viễn.

Đã chạy `npm ci --no-audit --no-fund` theo lockfile, cài **805 package** vào dự án; tooling `playwright-core@1.65.1` chỉ ở `.artifacts/quiz-tools`. Không nâng dependencies hoặc đổi package.json/lockfile. [Kiểm kê thực tế](evidence/new-machine/environment-audit.json), [báo cáo môi trường](ENVIRONMENT_CHECK_REPORT.md).

## 3. Dữ liệu và dịch vụ

- Giữ nguyên service `postgresql-x64-17` và cluster có sẵn tại 5432. Không kết nối vào DB phát triển, không dùng mật khẩu của service này, không xóa dữ liệu hiện có.
- Tạo cluster test mới tại `.artifacts/week5-environment/pgdata`, loopback **55436**, SCRAM-SHA-256, DB **english_learning_fsrs_test**. Đã xác minh data_directory và DB đích trước nạp schema/fixtures.
- Schema tuần 3 → V1_2/V1_3/V1_4 → topic seed → V1_5 → pronunciation/examples → V1_6/V1_7. Đếm **23 bảng, 6 Deck, 90 words, 90 links**; đối chiếu cột, index và constraint V1_7. Không backfill. [Log nạp](evidence/new-machine/database-setup.log), [truy vấn cuối](evidence/new-machine/database-final.log).
- API **58125**, Metro **58126**, Web/API cùng origin qua proxy **58127**. Hikari và Hibernate validate thành công; health UP; JWT đọc profile/decks/summary từ DB thật. [Web startup](evidence/new-machine/web-startup.json) có login200, summary200, pageErrors rỗng.
- Các suite PowerShell tạo cluster ngẫu nhiên riêng trong `.artifacts/week4-auth-*`, không dùng cluster dịch vụ 5432. Cổng DB/API Auth **55446/58135**, PasswordReset **55447/58145**, Quiz **55448/58155**, MyVocabulary **55449/58165**; SMTP loopback **58148**. Suite dừng process của mình trong finally, giữ log/data. Seed lịch sử của runner gồm **115 từ/133 liên kết**, khác seed chuẩn 90/90 của runtime chính.
- Các bài SQL tuần 3 chạy trong DB **english_learning_test** tạo mới ở cluster 55436, chỉ dùng schema gốc và fixture của chúng. Bài cascade chỉ xóa user test vừa tạo của suite; không tác động DB/data có trước phiên này.

## 4. Lệnh và kết quả thực tế

| Bộ kiểm tra | Kết quả cuối | Minh chứng |
| --- | --- | --- |
| Maven `package -DskipTests` | Build JAR thành công; đây là build, không tính test PASS | Log gốc `.artifacts/week5-environment/backend-build.log` |
| Maven `test`, bật FSRS_TEST_JDBC_* | **94 tests, 0 failure/error/skip, exit0**; **18** tích hợp PG thật (16 Repository + 2 Controller), **76** bài còn lại | [JUnit tổng hợp](evidence/new-machine/junit-summary.json), [log chọn lọc](evidence/new-machine/maven-test.log) |
| `-Suite Auth` | **Exit0** sau điều chỉnh tương thích Python3.10; xác nhận BCrypt/profile/seed SQL | [Auth](evidence/new-machine/suite-Auth-retry.log) |
| `-Suite PasswordReset` | **Exit0**, HTTP/SQL/SMTP loopback; không phải giao nhận Gmail | [Password Reset](evidence/new-machine/suite-PasswordReset.log) |
| `-Suite Quiz -Web` lần đầu | HTTP/SQL before-restart và after-restart hoàn tất; Web lỗi do Expo/ổ C. **Toàn lệnh exit1**, không gọi suite này PASS toàn bộ | [Log đầy đủ](evidence/new-machine/suite-Quiz.log) |
| `test-quiz-web.cjs` chạy riêng sau khôi phục Metro | **Exit0**: Home/profile, Flashcard/nguồn/audio giả lập, Quiz, retry mất phản hồi, FAIL → ôn lại → 3/5 PASS, 401 đóng màn bảo vệ | [Web Quiz](evidence/new-machine/quiz-web-final.log) |
| `-Suite MyVocabulary` chạy lại có giới hạn bộ nhớ | **Exit1**, GET saved words500, PostgreSQL thiếu collation; suite dừng tại assertion này | [API My Vocabulary](evidence/new-machine/suite-MyVocabulary-retry.log), [SQL error](evidence/new-machine/postgres17-collation-error.log) |
| `test-my-vocabulary-web.cjs` | **Exit1**, timeout chờ UI danh sách rỗng; UI thực tế lỗi500. Script cũng có locator/hành trình cũ cần rà | [Web My Vocabulary](evidence/new-machine/saved-web-final.log), [ảnh lỗi](evidence/new-machine/saved-vocabulary-postgres17.png) |
| `test-review-web.cjs` | **Exit0**, 2 rating requests giữ nguyên token/body qua mở lại; API giả lập | [Web FSRS](evidence/new-machine/review-web-final.log) |
| `test_additional_api.py` | **84/84 kiểm tra bổ sung đạt, exit0**: validation, profile boundaries, catalog/ownership, saved write/group, FSRS empty/invalid/cap0/1/9/10/11 | [Kết quả từng assertion](evidence/new-machine/additional-api.json), [log](evidence/new-machine/additional-api.log) |
| `run-database-checks.ps1` | **Exit0**. Sáu script SQL hoàn tất đúng kỳ vọng: basic, workflows, 3 ca COMMIT âm, cascade | [SQL](evidence/new-machine/database-tests.log) |
| `test_import_builder.py` | **5 tests OK, exit0**, chỉ kiểm builder Core lịch sử | [Import builder](evidence/new-machine/import-builder-final.log) |
| `npm run lint -- --no-cache` | **Exit0** | [Lint](evidence/new-machine/lint-final.log) |
| `npx --no-install tsc --noEmit` | **Exit0** | [Typecheck](evidence/new-machine/typecheck-final.log) |

Các bài COMMIT âm chỉ đạt khi **đúng lỗi dự kiến** và psql exit **3**; đã kiểm fixture transaction rollback về 0. Không coi một lỗi FK/thiếu fixture bất kỳ là đạt. [Thiếu đáp án](evidence/new-machine/test_quiz_missing_answer_commit.sql.log), [điểm lệch](evidence/new-machine/test_quiz_score_mismatch_commit.sql.log), [conversation thiếu lượt](evidence/new-machine/test_conversation_incomplete_commit.sql.log).

## 5. Sáu ca còn thiếu biến thể

| Ca | Đã kiểm chứng | Cần làm tiếp trước khi PASS cả hàng |
| --- | --- | --- |
| TC-PASSWORD-04 | Sai OTP 5 lần, khóa sau lần5, OTP hết hạn/OTP mới hợp lệ | Mã đúng sau 4 lần sai và sát hai phía mốc 5 phút |
| TC-PASSWORD-05 | API cooldown/resend, ngưỡng gửi email5/6, giới hạn IP | Verify-email quota30/31, UI resend trước60s |
| TC-PASSWORD-08 | Current password sai, reuse, xác nhận lệch, reset yếu | Từng trường rỗng riêng ở cả PATCH/reset và kiểm mật khẩu gốc giữ nguyên |
| TC-HOME-01 | Summary mới/bookmark-only =0, không phiên/log giả; Home mới hiển thị0 | Home sau bookmark và đối chiếu summary trong cùng luồng |
| TC-FLASH-02 | Again cuối hàng, Good ghi progress, Quiz gate | Hard/Easy riêng, mở lại Deck kiểm thứ tự còn lại |
| TC-FSRS-02 | 0/1/9/10/11 từ, queue cap10, summary không cap | dueAt trước/bằng/sau trên cùng Clock cố định |

Hai ca BLOCKED là **TC-SAVED-02/05**, ENV-W5-001. 29 ca Manual chưa thực hiện, gồm native lifecycle, quyền ảnh/âm thanh, Gmail thật, bàn phím/Back/safe area và mạng native. VAL-01–VAL-04 chưa đủ bằng chứng để gắn lỗi đã xác nhận.

## 6. Lỗi và các lượt không thành công

[BUG_REPORT.md](BUG_REPORT.md) ghi **BUG-W5-001 OPEN**: OPTIONS login khác origin401, thiếu allow-origin. Proxy chỉ giúp tiếp tục kiểm thử cùng origin; chưa sửa ứng dụng.

**ENV-W5-001:** PostgreSQL17 không đáp ứng collation của dự án PG18. Không cài PG18 khi chưa được xác nhận, không tạo collation giả hoặc thay query nghiệp vụ. **ENV-W5-002:** nhiều JVM/Metro cùng lúc thiếu native memory; C có lúc hết dung lượng, Expo ENOSPC. Sau đó giới hạn heap/metaspace, giảm worker, dùng TEMP/TMP trên D và chạy suite tuần tự.

Các lượt lỗi gốc được giữ ở `.artifacts/week5-environment/`: Maven đầu báo94/94 nhưng shell wrapper exit1; lượt xác minh kế tiếp JVM không cấp phát được bộ nhớ; lượt cuối có giới hạn bộ nhớ báo94/94 và exit0. `maven-confirm.exit=1` là lượt lỗi môi trường, không phải kết quả cuối. Các bài Web treo khi Metro dừng đã được dừng đúng process tree kiểm thử và chạy lại; `web-startup-retry.exit=-1` thuộc lượt bị dừng, không được tính PASS. [Các exit code đã lưu](evidence/new-machine/exit-codes.json).

**TEST-W5-001** đã sửa trong script test sau lưu lỗi: Python3.10 không đọc Java Instant có nanosecond/Z. **TEST-W5-002** chưa sửa: Web script My Vocabulary còn locator cũ. Script API runner được bổ sung V1_7 cho DB suite mới. Lượt đầu script API bổ sung dùng fixture Deck thiếu topic và kỳ vọng nhầm401 cho token DISABLED; log/JSON đầu giữ trong `.artifacts`, sau đó sửa fixture và kỳ vọng403 theo hợp đồng rồi chạy lại84 kiểm tra. Đây là điều chỉnh bộ kiểm thử, không phải sửa app hoặc che lỗi nghiệp vụ.

## 7. Tái chạy và bảo quản minh chứng

Khởi động runtime theo [PROGRESS.md](PROGRESS.md). Với Maven tích hợp, trong terminal riêng nhập cấu hình từ credentials local, không ghi secret vào lệnh được chia sẻ:

```powershell
$state = '.artifacts/week5-environment'
$secret = Import-Clixml "$state/secrets.clixml"
$env:FSRS_TEST_JDBC_URL = 'jdbc:postgresql://127.0.0.1:55436/english_learning_fsrs_test'
$env:FSRS_TEST_JDBC_USER = 'ela_week5'
$env:FSRS_TEST_JDBC_PASSWORD = [Net.NetworkCredential]::new('', $secret.DbPassword).Password
$env:DEBUG = 'false'
$env:JAVA_TOOL_OPTIONS = '-Xms64m -Xmx384m -XX:MaxMetaspaceSize=256m'
$env:TEMP = Join-Path (Get-Location) "$state/tmp"
$env:TMP = $env:TEMP
mvn.cmd -f backend/pom.xml -B -ntp test
```

Chạy từng suite API với `-PostgresBin 'C:/Program Files/PostgreSQL/17/bin'` và các cổng riêng ở mục3; chỉ dùng PG17 cho các kiểm tra đã xác định khả dụng, không coi đó là môi trường PG18 hoàn chỉnh. Khi có PG18 phải dùng binary/cluster mới riêng, giữ cluster17 hiện có. Runner tạo cluster mới mỗi lượt; không chạy nhiều suite đồng thời. `run-database-checks.ps1` từ chối chạy lại khi english_learning_test đã tồn tại để giữ dữ liệu/fixture đã có.

Web script có thể dùng Metro chung để tránh nhiều bundler:

```powershell
$env:AUTH_SMOKE_PORT = '58125'
$env:QUIZ_WEB_PORT = '58126'
$env:QUIZ_SMOKE_PASSWORD = 'Web7-' + [guid]::NewGuid().ToString('N')
$env:QUIZ_SMOKE_STATE = Join-Path (Get-Location) '.artifacts/week5-environment/quiz-state.json'
node backend/scripts/test-quiz-web.cjs
$env:REVIEW_WEB_URL = 'http://127.0.0.1:58127'
node backend/scripts/test-review-web.cjs
```

Ảnh và JSON mới nằm trong [evidence/new-machine](evidence/new-machine/README.md). Không sử dụng ảnh/log máy cũ làm bằng chứng thực thi mới. `collect-evidence.py` chỉ xuất summary JUnit và log chọn lọc, loại ANSI/JWT/BCrypt; không sao chép XML Surefire thô, credentials DPAPI hoặc JVM crash dump vào Git. Ảnh Login/Home/Flashcard và màn lỗi saved words đã được kiểm tra trực quan.

Ảnh nguồn của script cũ bắt trong lúc modal fade nên có nội dung chồng tạm thời; đã kiểm lại sau1500ms với reduced motion, dialog opacity1/nền trắng và nội dung đọc được: [ảnh ổn định](evidence/new-machine/flashcard-sources-stable-web.png), [quan sát DOM](evidence/new-machine/source-dialog-observation.json). Không ghi lỗi nghiệp vụ/giao diện từ khung hình chuyển cảnh này.

Điều kiện hoàn tất tiếp theo: có PG18 được phép dùng, thực thi hai ca BLOCKED và sáu ca PARTIAL, kiểm mobile/Gmail thật; sau đó mới đánh giá đầy đủ lỗi cần sửa và hồi quy. Không thay đổi source nghiệp vụ trong lượt này.
