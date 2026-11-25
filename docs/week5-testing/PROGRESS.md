# Tiến độ tuần 5 — English Learning App

## Kết thúc phạm vi đại diện 3C–5 (25/11/2026)

Kết quả CSV hiện tại: **26 PASS, 0 FAIL, 14 PARTIAL, 2 BLOCKED, 21 NOT RUN**. Đã chọn 9 ca chưa hoàn tất cho Web: AUTH-04, HOME-01/03, UI-03/04/05, NET-01/02, FLASH-04. Log/JSON ghi chính xác phần chạy được; chỉ tăng lên PARTIAL, không đổi thành PASS native. Quiz/Flashcard được chạy lại bằng smoke script sẵn có để hồi quy.

Native: adb không có thiết bị; có AVD nhưng không mở trong phạm vi tài nguyên/hạn mức hạn chế. WHPX usable không chứng nhận app native. Xem MANUAL_TEST_GUIDE.md. Không cài hoặc nâng công cụ.

BUG-W5-001 đã sửa bằng CORS allowlist cấu hình rõ ràng, mặc định rỗng; từ chối wildcard, không gửi cookie credentials. Runtime local khai báo 3 origin loopback. Trước: OPTIONS401; sau: origin cho phép200, origin lạ/giả mạo403, endpoint thiếu JWT401, trình duyệt đọc được phản hồi API khác origin. Đây là lỗi cấu hình tích hợp trong ứng dụng; không phải lỗi mạng máy tính. Xem evidence/representative/cors-after.json.

Maven cuối package SUCCESS, **95/95 tests, 0 skip** (thêm một bài CORS; 19 bài tích hợp), lint/typecheck đạt. Quiz Web regression exit0. Lượt package đầu bị khóa JAR do backend đang chạy; đã dừng đúng backend test trước build lại. Các lần sửa locator/khởi động quá sớm của script 3C không tính PASS; log gốc nằm .artifacts. Không phát hiện thêm lỗi ứng dụng đã xác nhận trong phạm vi đại diện.

Tổng ghi nhận: 1 lỗi ứng dụng đã sửa trong lượt này, 2 vấn đề môi trường, 2 vấn đề script (1 đã sửa từ 3B, 1 còn mở). Không tính chúng thành 5 lỗi nghiệp vụ. Không nâng PG17, không sửa My Vocabulary để né blocker.

Các đoạn phía trên mô tả lượt 3B trước sửa (94 tests/CORS OPEN/26 PASS); mục này và CSV là trạng thái mới nhất. Hồ sơ báo cáo đủ 5 mục theo phạm vi giới hạn, không đồng nghĩa hoàn tất mọi test hay nghiệm thu native. Thực hiện commit/push đúng feat/week5-testing theo yêu cầu hiện tại.


## Lịch sử 3B trước lượt sửa CORS

Các trạng thái OPEN/chưa commit và số liệu phía dưới thuộc lượt trước. Trạng thái hiện tại xem mục đầu.

Cập nhật **25/11/2026, Asia/Saigon**, tại **D:\ELA-week5-testing** trên máy mới. Đã tiếp tục theo yêu cầu người dùng; trạng thái tạm dừng trong bàn giao cũ không còn áp dụng. Không làm lại giai đoạn 1–2.

| Giai đoạn | Trạng thái hiện tại | Kết quả |
| --- | --- | --- |
| 1. Kế hoạch kiểm thử | Hoàn thành, giữ nguyên | [TEST_PLAN.md](TEST_PLAN.md). |
| 2. Thiết kế test case | Hoàn thành, giữ nguyên thiết kế | 63 ca, 15 cột; 34 Automated, 29 Manual. |
| 3A. Môi trường máy mới | Web/API khởi chạy; còn thiếu tương thích PostgreSQL 18 cho My Vocabulary | DB test riêng, V1_7 và seed đã xác minh; API và Web Login → Home hoạt động. PostgreSQL 17 không có pg_unicode_fast. |
| 3B. Thực thi tự động | Đã thực hiện, chưa hoàn tất mọi biến thể | **26 PASS, 6 PARTIAL, 2 BLOCKED** trong 34 ca dự kiến tự động. Maven **94/94**, trong đó **18 tích hợp PostgreSQL**, không skip; API Auth/Password Reset/Quiz đạt phần đã chạy; Web Quiz và FSRS đạt. |
| 3C. Mobile | Chưa thực hiện | SDK/ADB/Emulator có sẵn; AVD Medium_Phone API 35 được tìm thấy, chưa khởi chạy; không có device trong adb devices. |
| 4. Ghi nhận lỗi | Đã bắt đầu | [BUG_REPORT.md](BUG_REPORT.md): 1 lỗi CORS OPEN; trở ngại PG17, tài nguyên và vấn đề script được tách riêng. |
| 5. Sửa lỗi nghiệp vụ và kiểm thử lại | Chưa thực hiện | Giữ nguyên src và backend/src. Chỉ điều chỉnh script/môi trường kiểm thử sau khi lưu lỗi gốc. |

## Kết quả và minh chứng

[TEST_EXECUTION_REPORT.md](TEST_EXECUTION_REPORT.md) trình bày lệnh, phạm vi, kết quả, phần thiếu và cách tiếp tục. [TEST_CASES.csv](TEST_CASES.csv) đã điền kết quả thực tế cho 34 ca Automated. **29 ca Manual vẫn NOT RUN**, không dùng kết quả Web để chứng nhận native.

- PARTIAL: TC-PASSWORD-04/05/08, TC-HOME-01, TC-FLASH-02, TC-FSRS-02. Mỗi hàng ghi rõ biến thể chưa kiểm.
- BLOCKED: TC-SAVED-02/05 do **ENV-W5-001**, PostgreSQL 17 thiếu collation mà dự án yêu cầu ở PostgreSQL 18. Không tính HTTP 500 trên môi trường không đáp ứng yêu cầu thành lỗi nghiệp vụ đã xác nhận trên PG18.
- [JUnit](evidence/new-machine/junit-summary.json), [API bổ sung](evidence/new-machine/additional-api.json), [SQL](evidence/new-machine/database-tests.log), [Web Quiz](evidence/new-machine/quiz-web-final.log), [Web FSRS](evidence/new-machine/review-web-final.log).
- [Login](evidence/new-machine/web-login.png), [Home](evidence/new-machine/web-home.png), [My Vocabulary bị chặn](evidence/new-machine/saved-vocabulary-postgres17.png), ảnh Flashcard trong cùng thư mục.
- Minh chứng máy cũ ở evidence/ cấp trên được giữ nguyên làm lịch sử. Minh chứng mới nằm riêng trong **evidence/new-machine/**. Log gốc, dependencies, database và credentials DPAPI nằm trong **.artifacts/**, bị Git ignore.

## Máy mới và địa chỉ đang dùng

| Hạng mục | Đã xác minh |
| --- | --- |
| Git | Nhánh feat/week5-testing; HEAD cf018aab276318ea094dc953eb27163d1f9ce29f; upstream origin/feat/week5-testing; đầu phiên sạch, ahead/behind 0/0 theo refs local. Không fetch, commit hay push. |
| Node / npm | 22.19.0 / 10.9.3, tái sử dụng; npm ci theo lockfile, 805 package. |
| Java / Maven | Temurin 21.0.7+6 / Maven 3.9.16, tái sử dụng. |
| PostgreSQL | 17.11 tại C:\Program Files\PostgreSQL\17\bin; không cài PostgreSQL 18. Service postgresql-x64-17 tại 5432 giữ nguyên. |
| Python / Git | 3.10.11 / 2.48.1.windows.1, tái sử dụng. |
| Android | SDK tại %LOCALAPPDATA%\Android\Sdk, ADB 37.0.1, Emulator 37.1.11; AVD Medium_Phone dùng image API 35. Chưa tìm thấy sdkmanager/cmdline-tools. |
| Test DB | 127.0.0.1:55436, english_learning_fsrs_test, user ela_week5; dữ liệu tại .artifacts/week5-environment/pgdata. |
| Backend | http://127.0.0.1:58125 — health UP; Hikari/Hibernate validate thành công. |
| Expo / Web | Metro 58126; mở **http://127.0.0.1:58127/login** qua proxy hiện có. |
| Browser tooling | Edge có sẵn; playwright-core 1.65.1 cài cục bộ trong .artifacts/quiz-tools. |

Database chính kiểm thử có **23 bảng, 6 Deck, 90 từ, 90 liên kết**, V1_7 gồm bảng/index/constraint đã xác minh; không chạy backfill. DB english_learning_test được tạo mới trong cùng cluster riêng để chạy SQL constraint, không phải database phát triển. Các suite API dùng cluster ngẫu nhiên khác ở cổng 55446–55449, giữ log/data sau khi dừng dịch vụ suite; seed legacy của suite có 115 từ/133 liên kết nên không dùng số đó thay số seed chuẩn 90/90.

## Khởi động lại

Từ gốc repo, kiểm tra cổng và trạng thái trước. Các tiến trình hiện hoạt động trong phiên terminal; có thể dừng khi đóng VS Code hoặc khởi động lại máy.

```powershell
git status --short --branch
Get-NetTCPConnection -LocalPort 55436,58125,58126,58127 -State Listen -ErrorAction SilentlyContinue
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D '.artifacts/week5-environment/pgdata' status
powershell.exe -NoProfile -File docs/week5-testing/scripts/prepare-environment.ps1
```

prepare-environment chỉ nạp SQL khi DB test trống, không phát lại migration trên schema đã có. Script dùng credentials DPAPI của máy mới; không thể mang file này sang tài khoản Windows khác. Nếu runtime đã chạy, không mở thêm tiến trình trùng cổng. Nếu cần mở lại, dùng ba terminal riêng:

```powershell
powershell.exe -NoProfile -File docs/week5-testing/scripts/start-backend.ps1
powershell.exe -NoProfile -File docs/week5-testing/scripts/start-web.ps1
node docs/week5-testing/scripts/web-proxy.cjs
```

start-backend đã giới hạn heap/metaspace và tắt DEBUG thừa kế. start-web đặt TEMP/TMP trên D và tối đa 2 worker. Giữ terminal Web mở. C không còn đủ dung lượng cho cache/bộ cài lớn; không tự dọn dữ liệu cá nhân.

## Việc tiếp theo

1. Có PostgreSQL 18 cho cluster test riêng sau khi người dùng xác nhận bổ sung công cụ, hoặc dùng bản 18 sẵn có được cung cấp; giữ nguyên service/data PG17. Chưa có xác nhận, không cài.
2. Chạy lại My Vocabulary API, rà locator Web theo UI hiện tại rồi kiểm lại TC-SAVED-02/05. Không thay collation bằng alias giả để lấy PASS.
3. Thực thi các biến thể còn thiếu trong 6 ca PARTIAL; chỉ đổi thành PASS khi đủ bằng chứng.
4. Kiểm mobile, quyền ảnh, âm thanh, SecureStore, Back/keyboard, mạng trên thiết bị; Gmail thật chưa cấu hình. Chưa chạy AVD hay cài Expo Go.
5. Xử lý BUG-W5-001 trong giai đoạn sửa lỗi sau khi thống nhất phạm vi, giữ minh chứng trước sửa và tái kiểm thử/hồi quy sau sửa.

Lint và typecheck cuối phiên đều exit **0**. Chỉ làm việc trên feat/week5-testing; tài liệu và script đang ở working tree để người dùng review, chưa commit/push.
