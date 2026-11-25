> **Máy mới, 25/11/2026 (Asia/Saigon):** dùng hiện trạng trong [ENVIRONMENT_CHECK_REPORT.md](ENVIRONMENT_CHECK_REPORT.md) và cách mở lại trong [PROGRESS.md](PROGRESS.md). Node22.19/npm10.9.3, Java21.0.7/Maven3.9.16, Python3.10.11, PostgreSQL17.11 và Android SDK đã có. Không cài lại các công cụ này. **PG17 thiếu pg_unicode_fast nên My Vocabulary bị chặn; PG18 vẫn cần xác nhận trước khi bổ sung.** Các hướng dẫn cài đặt bên dưới chỉ là tham khảo khi đã được phép, không phải lệnh tự động thực hiện. Phần “3A đã khởi chạy” cuối tài liệu thuộc máy cũ.
>
> Đã có dependencies tại node_modules và .artifacts/quiz-tools, build tại backend/target. Script `scripts/prepare-environment.ps1` nhận `-PostgresBin`, mặc định dùng PG17 có sẵn; chỉ nạp schema khi DB test trống. Dùng DB test riêng 55436, backend58125, Metro58126, proxy58127. `start-backend.ps1` giới hạn heap và tắt DEBUG; `start-web.ps1` đặt TEMP/TMP trên D và tối đa 2 worker. Không mở các suite JVM/Metro đồng thời trên máy hiện tại; ổ C có rất ít chỗ trống.
>
> API runner đã bổ sung V1_7; script Auth tương thích Python3.10. Các ví dụ cũ nói runner chỉ đến V1_6 là lịch sử trước thay đổi này. Giữ số cổng suite khác runtime chính. `run-database-checks.ps1` chỉ chạy một lần khi DB english_learning_test chưa tồn tại, không tự dọn hoặc phát lại fixture.
>
> Kiểm chứng Maven tích hợp: nhập credentials qua Import-Clixml cục bộ, đặt FSRS_TEST_JDBC_URL/USER/PASSWORD đúng DB english_learning_fsrs_test, tắt DEBUG và giới hạn JAVA_TOOL_OPTIONS, rồi chạy mvn test. Không đưa secret hoặc XML Surefire thô vào Git; dùng `scripts/collect-evidence.py` để xuất danh sách testcase và log đã chọn. [Kết quả thực thi](TEST_EXECUTION_REPORT.md) ghi rõ PARTIAL/BLOCKED và các lượt lỗi môi trường.

# Chuẩn bị môi trường kiểm thử tuần 5

Ngày 25/11/2026. Tài liệu dùng cho giai đoạn 3. Các lệnh cài đặt, tạo DB, migration, khởi động ứng dụng và kiểm thử dưới đây chỉ là hướng dẫn chuẩn bị.

Thư mục gốc dự án là `<project-root>`. Phiên giai đoạn 1 ghi nhận thiếu các công cụ chạy ứng dụng. Giai đoạn 2 sử dụng kết quả kiểm kê đó, tập trung thiết kế test case.

## Công cụ và phiên bản

| Công cụ | Phiên bản / mục đích | Kiểm tra trong PowerShell |
| --- | --- | --- |
| Node.js và npm | Node 22.x từ 22.13 theo README, npm đi kèm. Giữ phiên bản dependencies theo package-lock.json. | `node --version`, `npm.cmd --version`, `npx.cmd --version` |
| Expo | Dự án khai báo Expo ~58.0.22, Router ~58.0.29, RN 0.88.1, React 19.3.0, TypeScript ~6.0.3. Dùng CLI local và Expo Go hỗ trợ SDK 58. | Sau khi cài dependencies ở giai đoạn 3, `npx.cmd --no-install expo --version`; kiểm tra phiên bản Expo Go trên thiết bị. |
| JDK | Java 21 theo backend/pom.xml. | `java -version`, `javac -version`, `$env:JAVA_HOME` |
| Maven | 3.9+ theo README. Dockerfile dùng 3.9.11. Cần cho JUnit và script điều phối native. | `mvn.cmd -version` |
| PostgreSQL | 18.x, gồm psql, initdb, pg_ctl, pg_dump, pg_restore. Compose chọn postgres:18.6. | `psql --version`, `pg_dump --version`, `Get-Service *postgres*` |
| Python | Python 3.11 là bản đã thấy ở giai đoạn 1, scripts dùng thư viện chuẩn. Phải gọi được tên python. | `py -0p`, `python --version` |
| Android Studio / SDK | Android Studio với SDK Platform-Tools, Emulator, system image và AVD. Dự án chưa chốt API level AVD trong tài liệu, chọn image chạy được Expo Go SDK 58 rồi ghi API level thực tế. | `adb version`, `adb devices -l`, `emulator -list-avds`, `sdkmanager --list_installed` |
| Thiết bị thật | Android hoặc iPhone, Expo Go hỗ trợ SDK 58, cùng mạng LAN. | Ghi model/OS/Expo Go và mở health từ trình duyệt điện thoại. |
| Edge / Playwright | Script require playwright-core ở .artifacts/quiz-tools/node_modules/playwright-core. package.json chưa khai báo dependency này. | `Test-Path '.artifacts/quiz-tools/node_modules/playwright-core'`; `Test-Path "${env:ProgramFiles(x86)}/Microsoft/Edge/Application/msedge.exe"` |
| PowerShell / Postman | PowerShell 5.1 hiện có. Postman tùy chọn cho API, Invoke-RestMethod cũng dùng được. | `$PSVersionTable.PSVersion` |
| Docker Desktop | Tùy chọn thay backend/DB native. JUnit và bộ PowerShell dựng PostgreSQL vẫn có yêu cầu riêng ở trên. | `docker version`, `docker compose version` |

## Cài đặt và bổ sung PATH trên Windows

1. Tải Windows Installer Node 22.x từ trang Node chính thức, chọn thêm PATH. Mở terminal mới và chạy các lệnh kiểm tra. Chọn nhánh theo README của dự án. [Tải Node.js](https://nodejs.org/en/download)
2. Cài JDK 21 từ nhà phân phối JDK, đặt biến người dùng JAVA_HOME đến thư mục JDK, thêm `%JAVA_HOME%\bin` vào Path. Giải nén Maven binary zip và thêm thư mục `apache-maven-<version>\bin` vào Path. Kiểm tra Maven hiển thị Java 21. [Cài Maven](https://maven.apache.org/install.html)
3. Cài PostgreSQL 18 và command line tools bằng Windows installer. Thêm `C:\Program Files\PostgreSQL\18\bin` vào Path. Tên service/đường dẫn có thể khác theo lựa chọn lúc cài. [PostgreSQL cho Windows](https://www.postgresql.org/download/windows/)
4. Với Python đã cài, thêm thư mục chứa python.exe của Python 3.11 vào Path qua giao diện Environment Variables. Kiểm tra `Get-Command python` trỏ đúng interpreter vì script điều phối gọi python.
5. Cài Android Studio và hoàn thành Setup Wizard. Trong SDK Manager chọn Platform-Tools, Emulator, Command-line Tools và system image. Trong Device Manager tạo AVD. Đặt ANDROID_HOME theo SDK Location thực tế, thường `%LOCALAPPDATA%\Android\Sdk`; thêm `%ANDROID_HOME%\platform-tools`, `%ANDROID_HOME%\emulator`, `%ANDROID_HOME%\cmdline-tools\latest\bin` vào Path. Nếu đã có ANDROID_SDK_ROOT, đối chiếu cùng SDK Location. [Cài Android Studio](https://developer.android.com/studio/install)
6. Bổ sung từng mục Path bằng Windows Search → Edit environment variables for your account → Environment Variables → User variables → Path → New. Giữ các mục hiện có, mở lại terminal/VS Code sau khi lưu.
7. Khi bước chuẩn bị giai đoạn 3 được thực hiện, từ gốc dự án dùng `npm.cmd ci` để nạp dependencies theo lockfile. Cài riêng playwright-core vào `.artifacts/quiz-tools` nếu cần chạy script web, dùng `npm.cmd install --prefix .artifacts/quiz-tools --no-save --package-lock=false playwright-core` và ghi phiên bản thực tế đã chọn. Cài Edge hoặc đặt QUIZ_EDGE_PATH tới Edge sẵn có. Chẩn đoán Expo bằng `npx.cmd expo-doctor` sau khi có dependencies. [Tài liệu Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)

## Database kiểm thử độc lập và V1_7

Chọn cluster native hoặc Docker volume mới có tên test riêng. Dùng tài khoản DB test, cổng trống và tên DB rõ ràng. Hai lớp tích hợp FSRS kiểm tra tên DB chính xác là `english_learning_fsrs_test`.

Ví dụ tạo DB ở giai đoạn 3 bằng psql trên server test đã xác minh, với user/host/port của server đó.

```powershell
psql -X -h 127.0.0.1 -p <test-port> -U <test-admin> -d postgres -W -c "CREATE DATABASE english_learning_fsrs_test ENCODING 'UTF8';"
```

Với DB mới/trống, nạp theo thứ tự trong compose.yaml và bổ sung FSRS.

1. database/week3/schema.sql
2. database/week4/migrations/V1_2__source_vocabulary_fields.sql
3. database/week4/migrations/V1_3__quiz_question_snapshot.sql
4. database/week4/migrations/V1_4__topic_deck_catalog.sql
5. database/week4/import/data/apply_topic_decks.sql
6. database/week4/migrations/V1_5__password_reset.sql
7. database/week4/import/data/apply_pronunciations.sql
8. database/week4/import/data/apply_topic_examples.sql
9. database/week5/migrations/V1_6__user_saved_words.sql
10. database/week5/migrations/V1_7__fsrs_persistence.sql

Mỗi file dùng `psql -X -v ON_ERROR_STOP=1 -h <test-host> -p <test-port> -U <test-user> -d english_learning_fsrs_test -W -f <file>` sau khi xác minh kết nối. Các biến dạng <...> cần thay bằng cấu hình thật. Tạo hai tài khoản app A1/A2 riêng và hộp thư do nhóm kiểm soát. Seed mới kỳ vọng 6 Deck, 90 từ và 90 liên kết. Tiến độ, bookmark và dữ liệu đến hạn cần fixture riêng cho từng ca.

Trước khi quyết định áp dụng V1_7 trên một DB đã có dữ liệu, dùng truy vấn chỉ đọc sau.

```sql
SELECT current_database(), inet_server_addr(), inet_server_port(), current_user;
SELECT to_regclass('public.review_sessions'),
       to_regclass('public.review_session_items'),
       to_regclass('public.review_idempotency'),
       to_regclass('public.user_streaks');
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND ((table_name='review_cards' AND column_name='learning_step')
    OR (table_name='review_logs'
        AND column_name IN ('state_before','elapsed_days','scheduled_days')));
```

Đối chiếu cả constraint và index trong file V1_7. File dùng ALTER TABLE ADD COLUMN và CREATE TABLE, nên chạy lại nguyên file khi đã áp dụng sẽ lỗi. Nếu trạng thái chỉ có một phần migration, ghi rõ và điều tra trước khi chuẩn bị lại DB test. Với DB có dữ liệu cần giữ, tạo dump `pg_dump -Fc`, kiểm tra `pg_restore -l` và thử phục hồi vào DB kiểm chứng riêng trước bước áp dụng sau này. Giai đoạn 3 ưu tiên DB test cô lập. Backfill là tùy chọn và chưa cần để chạy summary với tiến độ đã học. Database phát triển hiện tại nằm ngoài các bước nạp này.

Compose hiện chỉ mount đến V1_6. Khi chọn Docker cho giai đoạn 3, dùng tên project test riêng bằng `docker compose -p ela-week5-test ...` cùng DB/API port trống qua cấu hình test. Kiểm tra volume đích, chờ db healthy rồi chuẩn bị V1_7 qua psql trên DB test như trên. Tránh dùng volume phát triển hiện có cho fixture. Mọi lệnh docker compose tiếp theo phải giữ cùng project và cấu hình test.

## Thứ tự khởi chạy

1. Khởi động PostgreSQL test, xác nhận host/port/DB và schema.
2. Trong terminal backend, cấu hình dưới đây với secret riêng nhập tại chỗ. Giữ profile local tắt khi mở LAN. JWT secret phải là Base64 của ít nhất 32 byte ngẫu nhiên.

```powershell
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:<test-port>/english_learning_fsrs_test"
$env:DB_USERNAME = "<test-user>"
$dbSecure = Read-Host "Mat khau DB test" -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new("", $dbSecure).Password
$env:AUTH_JWT_SECRET = Read-Host "JWT secret Base64 cua moi truong test"
$env:SERVER_ADDRESS = "<IPv4-Wi-Fi-cua-may>"
mvn.cmd -f backend/pom.xml spring-boot:run
```

Cho emulator truy cập qua 10.0.2.2 có thể giữ SERVER_ADDRESS=127.0.0.1. API mặc định port 8080. Gmail thật cần MAIL_USERNAME và MAIL_APP_PASSWORD theo WEEK4_PASSWORD_RESET.md. Bộ PasswordReset tự động dùng SMTP loopback.

3. Terminal thứ hai gọi `Invoke-RestMethod http://<api-host>:8080/api/v1/health`, sau đó dùng tài khoản test kiểm tra decks và review/summary. Health trả UP vẫn cần kiểm tra luồng truy vấn DB.
4. Tại gốc dự án, đặt URL trước khi mở Expo.

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://<api-host>:8080"
npx.cmd expo start --go --lan --port 0
```

## Emulator, thiết bị và mạng

- AVD cần phần cứng ảo hóa được bật và cấu hình tăng tốc theo Android Studio. Sau khi AVD lên, `adb devices -l` phải hiện device. API host từ AVD Android Studio dùng 10.0.2.2. Mở app bằng phím a ở Expo CLI.
- Điện thoại dùng IPv4 LAN của máy chạy backend, cùng Wi-Fi và truy cập được TCP 8080 cùng Metro ở cổng Expo in ra. Kiểm tra firewall Windows trên mạng riêng khi chưa kết nối được. Ghi model, OS, Expo Go vào kết quả ca.
- Chọn mẫu màn hình nhỏ 320×568, phổ thông 390×844, lớn 430×932 theo đơn vị logical. Ghi kích thước và mật độ thật của thiết bị/AVD. Đây là mẫu kiểm thử giao diện.
- Tải bundle trước khi mô phỏng mất mạng để phân biệt lỗi Metro với lỗi API. Dùng proxy hoặc fault injection web để tái hiện mất phản hồi sau khi server đã nhận ghi. Thực hiện lại trên mobile để có bằng chứng native.

## Đối chiếu tự động hóa và khoảng trống cần kiểm chứng

CSV có 63 ca, gồm 34 ca hướng tới chạy tự động bằng công cụ đã có và 29 ca thực hiện Manual. Cột Ghi chú chỉ ra script/lớp test và phần cần kiểm chứng bổ sung. Một ca Automated có nhiều biến thể có thể chỉ được script bao phủ một phần. Trước khi ghi kết quả cho cả ca, phải xác minh đủ từng biến thể. Các biến thể thiếu assertion có thể gửi bằng PowerShell/Python trong giai đoạn thực thi. Mọi hàng hiện có trạng thái NOT RUN.

- JUnit trong backend/src/test/java chạy bằng `mvn.cmd -f backend/pom.xml test`. Tích hợp FSRS cần FSRS_TEST_JDBC_URL/USER/PASSWORD trỏ DB english_learning_fsrs_test đã có schema. Ghi riêng tests skipped.
- backend/scripts/test-auth-profile.ps1 điều phối -Suite Auth, PasswordReset, Quiz hoặc MyVocabulary, với -Web khi có hỗ trợ. Script tạo cluster .artifacts riêng, mặc định DB 55436/API 58125/Web 58126/SMTP 58128 và đọc classpath từ Surefire của lượt Maven trước. Setup này nạp đến V1_6. Đối chiếu nhu cầu API mới trước lượt chạy giai đoạn 3.
- test-review-web.cjs dùng API giả lập và REVIEW_WEB_URL mặc định http://127.0.0.1:58157. Kết quả web không thay thế xác nhận ghi log thật bằng FsrsRepositoryPostgresTest.
- database/week3/test_*.sql có thao tác ghi/COMMIT và có ca kỳ vọng COMMIT bị từ chối. Dùng DB riêng. test_import_builder.py kiểm tra bộ Core 43 từ lịch sử, cần kiểm đếm riêng seed 90 từ chủ đề.
- Lint và typecheck được dành cho giai đoạn 3 theo phạm vi người dùng yêu cầu. Giai đoạn 2 chỉ xác minh cấu trúc tài liệu.

Các điểm validation cần kiểm chứng, chưa gán Bug ID.

| Mã quan sát | Đối chiếu source | Ca liên quan |
| --- | --- | --- |
| VAL-01 | password-validation.ts/use-auth-form.ts kiểm length <=72; AuthService.validateNewPassword kiểm UTF-8 <=72 byte. Mật khẩu Unicode ngắn theo length có thể vượt byte. | TC-REG-06, TC-PASSWORD-09 |
| VAL-02 | avatar-picker.ts so độ dài Base64 với 4*ceil(204800/3). AvatarImage.java kiểm số byte giải mã <=204800. Payload 204801 byte có thể cùng độ dài Base64. | TC-PROFILE-05 |
| VAL-03 | Frontend dùng regex email có dấu chấm phần domain; backend dùng @Email, cần xác minh địa chỉ dạng an@localhost và khoảng trắng trước chuẩn hóa. Chưa kết luận hành vi @Email của phiên bản đang dùng. | TC-REG-04 |
| VAL-04 | OTP UI lọc chỉ số và maxLength=6, backend từ chối payload sai bằng regex [0-9]{6}. Dữ liệu không thể nhập ở UI cần gửi API trực tiếp. Đây là khác biệt lớp kiểm soát cần ghi lại. | TC-PASSWORD-03 |

Số ca theo loại được đếm theo nhãn, có giao nhau. Hợp lệ 39, Không hợp lệ 30, Để trống 7, Dữ liệu biên 17. Một hàng tham số hóa phải ghi kết quả từng biến thể khi chạy, chỉ đánh dấu hoàn tất khi đủ tất cả biến thể. Các ô kết quả thực tế, Bug ID và minh chứng đang để trống.

## Môi trường 3A đã khởi chạy ngày 25/11/2026

Node 22.23.5/npm 10.9.9, Temurin 21.0.9+10, Maven 3.9.11 và PostgreSQL 18.6-4 đã được xác minh nguồn/checksum và cài theo xác nhận của người dùng. PostgreSQL được giải nén chỉ với server và commandlinetools, cluster test quản lý bằng pg_ctl. Python/Git được tái sử dụng. PATH User đã bổ sung các mục còn thiếu, JAVA_HOME User trỏ JDK 21. Các mục PATH hiện có được giữ lại.

Từ gốc dự án, dùng [báo cáo hiện trạng](ENVIRONMENT_CHECK_REPORT.md) và các bước khởi động lại trong đó. Địa chỉ đang dùng như sau.

| Thành phần | Địa chỉ |
| --- | --- |
| PostgreSQL test | 127.0.0.1:55436, DB english_learning_fsrs_test |
| Backend | http://127.0.0.1:58125 |
| Expo/Metro | http://localhost:58126 |
| Web và API cùng origin | http://127.0.0.1:58127/login |

Database test có 23 bảng, 6 Deck, 90 từ và 90 liên kết, đã áp dụng V1_7. Chỉ áp dụng vào DB test mới tạo trong .artifacts/week5-environment/pgdata. Chưa chạy backfill.

Cấu hình thực tế của Web dùng EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:58127. Các hướng dẫn URL API trực tiếp ở phần trên vẫn dùng được cho native/API, còn Web cần đi qua proxy local do backend hiện chưa cho phép preflight CORS. Proxy chỉ bind 127.0.0.1 và nằm trong .artifacts/week5-environment/web-proxy.cjs. Source nghiệp vụ được giữ nguyên.

npm ci hoàn tất, Maven package -DskipTests hoàn tất, typecheck và lint đều exit 0. Playwright Core 1.65.1 cài riêng trong .artifacts/quiz-tools, dùng Chrome có sẵn kiểm tra Login → Home và response API thật. Lượt này là kiểm tra khởi động môi trường. 63 test case vẫn NOT RUN.

Các script local start-backend.ps1 và start-web.ps1 ở .artifacts/week5-environment giúp mở lại server ở terminal riêng. secrets.clixml dùng Windows DPAPI, cần cùng tài khoản Windows. Sau khi khởi động lại Windows cần chạy lại cluster/backend/Expo/proxy theo báo cáo.

Android Studio/SDK/ADB/Emulator chưa cài và vẫn cần xác nhận riêng. Windows WMI báo HypervisorPresent=true nhưng các cờ ảo hóa CPU false, cần kiểm tra hỗ trợ ảo hóa lồng trước khi tạo AVD. Với thiết bị thật, cần Expo Go hỗ trợ SDK 58, mạng LAN và cấu hình bind/API URL tương ứng. Các server hiện chỉ mở loopback. Chưa cấu hình Gmail SMTP thật.
