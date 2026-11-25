# Tiến độ tuần 5 — English Learning App

Cập nhật 25/11/2026 (Asia/Bangkok). Công việc kiểm thử đang tạm dừng theo yêu cầu người dùng. Nhánh bàn giao là `feat/week5-testing`, xuất phát từ `origin/master` tại `034f392a7ac7dd5a9213a9a05da1b18475e99fcd`.

| Giai đoạn | Trạng thái | Kết quả |
| --- | --- | --- |
| 1. Phân tích và lập kế hoạch | Hoàn thành | Phân tích dự án, tài liệu, API và công cụ. [TEST_PLAN.md](TEST_PLAN.md) bao phủ 13 nhóm. |
| 2. Thiết kế Test Case | Hoàn thành | [TEST_CASES.csv](TEST_CASES.csv) có 63 ca, 15 cột, UTF-8 BOM. |
| 3A. Chuẩn bị và khởi chạy | Hoàn thành DB/backend/Expo Web | PostgreSQL, schema/seed/V1_7, Spring Boot và Web đã hoạt động trong phiên chuẩn bị. |
| 3B | Chưa thực hiện | Chờ yêu cầu tiếp tục, thực thi kiểm thử và ghi kết quả. |
| 3C | Chưa thực hiện | Chờ phạm vi của yêu cầu tiếp theo. |
| 4. Sửa lỗi và tái kiểm thử | Chưa thực hiện | Chưa sửa chức năng nghiệp vụ. |
| 5. Hồi quy và báo cáo | Chưa thực hiện | Chưa có báo cáo kết quả của bộ 63 ca. |

## Test case và kết quả hiện có

- 34 ca dự kiến tự động, 29 ca thủ công. Tất cả 63 ca hiện vẫn **NOT RUN**. Kết quả thực tế, Bug ID và minh chứng trong CSV để trống.
- Phân bố module REG 7, AUTH 4, PASSWORD 9, PROFILE 5, HOME 3, VOCAB 4, FLASH 4, QUIZ 5, SAVED 5, FSRS 6, UI 5, NET 6. PASSWORD chứa cả nhóm OTP và đổi mật khẩu.
- Các nhãn có giao nhau, gồm Hợp lệ 39, Không hợp lệ 30, Để trống 7 và Dữ liệu biên 17. Một hàng có nhiều biến thể cần ghi kết quả từng biến thể khi thực thi.
- 3A đã xác minh Maven package -DskipTests, TypeScript noEmit, lint exit 0, API health và giao diện Login → Home qua API thật. [Bằng chứng khởi động](evidence/web-startup.json) thuộc bước chuẩn bị môi trường.
- Các quan sát validation VAL-01–VAL-04 trong [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) cần kiểm chứng ở giai đoạn 3B, chưa xác nhận lỗi.

## Môi trường đã chuẩn bị

| Hạng mục | Giá trị |
| --- | --- |
| Node.js / npm | 22.23.5 / 10.9.9 |
| Temurin JDK / Maven | 21.0.9+10 / 3.9.11 |
| PostgreSQL | 18.6, bộ cài 18.6-4, quản lý cluster test bằng pg_ctl |
| Python / Git | 3.11.9 / 2.56.1.windows.1 |
| Database test | english_learning_fsrs_test |
| PostgreSQL port | 55436, bind 127.0.0.1 |
| Backend port | 58125, http://127.0.0.1:58125 |
| Expo Metro port | 58126 |
| Expo Web qua proxy | 58127, http://127.0.0.1:58127/login |
| API URL cho Web | http://127.0.0.1:58127 |

Database test đã nạp schema tuần 3, migrations/seed tuần 4 và V1_6/V1_7. Đã xác nhận 23 bảng, 6 Deck, 90 từ, 90 liên kết và bốn bảng phiên FSRS cùng review_cards.learning_step. Chưa chạy backfill. V1_7 đã áp dụng trên DB test, cần kiểm tra schema trước khi quyết định nạp lại.

Web dùng [proxy local](scripts/web-proxy.cjs) vì backend hiện trả 401 cho CORS preflight khác origin. Proxy và các server chỉ mở loopback. Mật khẩu/JWT/app smoke lưu local bằng Windows DPAPI. Cluster, credentials, dependencies, build output, installer và log nằm ngoài phạm vi Git.

Android SDK và Emulator chưa cài. Thiết bị thật chưa kiểm chứng. Gmail SMTP thật chưa cấu hình. Cần xác minh hỗ trợ ảo hóa trước khi chuẩn bị AVD, và có yêu cầu riêng trước khi cài Android Studio/SDK. Lượt Web chưa xác nhận hành vi native.

## Khởi động lại trên máy đã chuẩn bị

Mở thư mục clone có nhánh feat/week5-testing trong VS Code. Các dữ liệu runtime của máy hiện tại được giữ tại thư mục ZIP ban đầu và tham chiếu bằng junction local ở .artifacts/week5-environment. node_modules và backend/target cũng được tham chiếu local để tái sử dụng dependencies/build đã có. Các junction bị Git ignore và không đưa lên GitHub. Thông tin đường dẫn cụ thể chỉ nằm trong .artifacts/WEEK5_LOCAL_HANDOVER.txt trên máy.

Ở máy khác, chuẩn bị công cụ theo [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md), dùng npm ci và Maven build, tạo cluster test riêng theo quy trình trong tài liệu. File DPAPI hiện tại chỉ đọc được bằng tài khoản Windows đã tạo nó, nên cần tạo credentials riêng trên máy mới.

Các lệnh dưới đây chạy từ gốc clone. Xem trạng thái/cổng trước, chỉ khởi động dịch vụ đang dừng. Mỗi server dùng một Terminal riêng.

```powershell
git status --short --branch
git branch --show-current
pg_ctl -D ".artifacts/week5-environment/pgdata" status
Get-NetTCPConnection -LocalPort 55436,58125,58126,58127 -State Listen -ErrorAction SilentlyContinue
```

Nếu cluster đang dừng, khởi động lại với dữ liệu hiện có.

```powershell
pg_ctl -D ".artifacts/week5-environment/pgdata" -l ".artifacts/week5-environment/postgres.log" -o "-p 55436 -h 127.0.0.1" -w start
```

Trong ba Terminal riêng, mở backend, Expo và proxy.

```powershell
powershell.exe -NoProfile -File docs/week5-testing/scripts/start-backend.ps1
powershell.exe -NoProfile -File docs/week5-testing/scripts/start-web.ps1
node docs/week5-testing/scripts/web-proxy.cjs
```

Backend script đọc credentials từ local .artifacts/week5-environment/secrets.clixml. Có thể dùng -StateDirectory để chỉ thư mục state riêng. Chưa có file đó trên máy khác thì chuẩn bị credentials trước theo hướng dẫn môi trường.

Kiểm tra khởi động.

```powershell
Invoke-RestMethod http://127.0.0.1:58125/api/v1/health
Start-Process http://127.0.0.1:58127/login
```

## Các lệnh chuẩn bị tiếp tục Prompt 3B

Các lệnh bên dưới chưa được thực hiện trong bước bàn giao này. Đọc lại phạm vi của Prompt 3B trước khi chạy và chỉ chạy trên môi trường test.

```powershell
Get-Content -Encoding UTF8 AGENTS.md
Get-Content -Encoding UTF8 docs/week5-testing/TEST_PLAN.md
Get-Content -Encoding UTF8 docs/week5-testing/ENVIRONMENT_SETUP.md
Get-Content -Encoding UTF8 docs/week5-testing/ENVIRONMENT_CHECK_REPORT.md
Import-Csv -Encoding UTF8 docs/week5-testing/TEST_CASES.csv | Group-Object "Trạng thái"
mvn.cmd -f backend/pom.xml test
```

Sau Maven test, các suite HTTP/SQL có thể điều phối bằng lệnh dưới, chọn từng suite theo ca trong CSV.

```powershell
powershell.exe -NoProfile -File backend/scripts/test-auth-profile.ps1 -Suite Auth
powershell.exe -NoProfile -File backend/scripts/test-auth-profile.ps1 -Suite PasswordReset
powershell.exe -NoProfile -File backend/scripts/test-auth-profile.ps1 -Suite Quiz
powershell.exe -NoProfile -File backend/scripts/test-auth-profile.ps1 -Suite MyVocabulary
```

Lưu ý trước khi thực thi.

- Script điều phối mặc định dùng DB 55436/API 58125/Web 58126, đang trùng port của môi trường 3A. Chọn các port trống riêng qua -DatabasePort, -ApiPort, -WebPort và -SmtpPort trước khi chạy suite. Suite tạo cluster riêng trong .artifacts.
- Script điều phối hiện chuẩn bị đến V1_6. Rà yêu cầu FSRS/Home trước khi thực thi, tránh giả định cluster do suite tạo đã có V1_7.
- JUnit PostgreSQL FSRS chỉ bật khi có FSRS_TEST_JDBC_URL, FSRS_TEST_JDBC_USER và FSRS_TEST_JDBC_PASSWORD, dùng DB test đã xác minh. Nhập secret tại máy, giữ khỏi báo cáo, phân biệt tests skipped.
- Script Playwright hiện có mặc định Edge. Cần cấu hình trình duyệt khả dụng phù hợp trước khi dùng -Web. Playwright Core đã cài local, Chrome đã được dùng xác minh khởi động.
- Khi thực thi, cập nhật từng hàng CSV theo kết quả quan sát và lưu minh chứng đã bỏ dữ liệu nhạy cảm. Chưa có kết quả mới trong bước lưu GitHub.

## Bàn giao Git

Chỉ đưa tài liệu tuần 5, script khởi chạy/proxy và minh chứng khởi động đã review lên feat/week5-testing. Bản clone dựa trên lịch sử origin/master, 311 file source có sẵn khớp bản ZIP tại thời điểm đối chiếu. Tài liệu được điều chỉnh để loại đường dẫn cá nhân/thông tin phần cứng và cấu hình riêng không cần chia sẻ. Source nghiệp vụ được giữ nguyên.

Công việc tạm dừng tại đây. Giai đoạn 3B, 3C, 4 và 5 chờ yêu cầu tiếp theo.
