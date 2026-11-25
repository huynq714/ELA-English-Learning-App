# Báo cáo môi trường tuần 5 — Máy mới

Cập nhật 25/11/2026, Asia/Saigon. Workspace **D:\ELA-week5-testing**. Bộ công cụ hệ thống được tái sử dụng; **không cài phần mềm hệ thống**, không đổi PATH/JAVA_HOME/ANDROID_HOME vĩnh viễn, không sửa Windows service hoặc dữ liệu PostgreSQL có sẵn.

## Hiện trạng xác minh

| Thành phần | Máy mới | Kết quả |
| --- | --- | --- |
| Node / npm | 22.19.0 / 10.9.3 tại D:\Git | npm ci theo package-lock, 805 package; không thay lockfile. |
| JDK | Temurin 21.0.7+6, C:\Program Files\Eclipse Adoptium\jdk-21.0.7.6-hotspot | javac và Maven xác nhận Java 21. |
| Maven | 3.9.16 tại D:\Downloads\Tools\apache-maven-3.9.16-bin\apache-maven-3.9.16 | Build JAR và 94 tests đạt; 18 tests PostgreSQL bật, 0 skip. |
| PostgreSQL | 17.11, C:\Program Files\PostgreSQL\17\bin | Binary có sẵn, chưa trên PATH. Cluster riêng khởi tạo/nạp được V1_7; **chưa đủ yêu cầu PG18 cho My Vocabulary**. |
| Service PostgreSQL có sẵn | postgresql-x64-17 Running, 5432, C:\Program Files\PostgreSQL\17\data | Chỉ kiểm tra service/process; không dùng credentials, không truy vấn hay ghi DB của service này. |
| Python / Git | 3.10.11 / 2.48.1.windows.1 | Script Auth được điều chỉnh định dạng Instant cho Python 3.10. |
| Expo | SDK 58.0.22 theo lockfile | CLI local khởi chạy Web; không nâng dependencies. Đã đọc docs SDK 58 và Expo CLI trước thao tác. |
| Edge / Chrome | Cả hai browser đã tồn tại ở Program Files | Playwright dùng Edge mặc định của script. |
| Playwright Core | 1.65.1 tại .artifacts/quiz-tools | Tooling cục bộ; không thêm vào package.json hoặc cài browser hệ thống. |
| Android SDK | %LOCALAPPDATA%\Android\Sdk | Có platform-tools, emulator, image API35; platform đã thấy android-37.0. Không trên PATH. |
| ADB / Emulator | ADB 37.0.1-15733141 / Emulator 37.1.11 | adb version, adb devices -l và emulator -list-avds chạy qua đường dẫn tuyệt đối; AVD Medium_Phone được liệt kê, chưa mở. |
| Android cmdline-tools | Chưa tìm thấy sdkmanager tại PATH hoặc SDK/cmdline-tools | Không cài bổ sung. Không có thiết bị trong adb devices -l. |

## Database và kết nối

Cluster **mới** ở .artifacts/week5-environment/pgdata, bind **127.0.0.1:55436**, xác thực SCRAM-SHA-256, database **english_learning_fsrs_test**, UTF8, user **ela_week5**. Đã xác minh data_directory trước tạo/nạp DB. Credentials DB/JWT mới tạo bằng số ngẫu nhiên mật mã, lưu SecureString qua DPAPI trong secrets.clixml; file mật khẩu initdb tạm đã được xóa.

Nạp schema → V1_2 → V1_3 → V1_4 → topic seed → V1_5 → pronunciations → bilingual examples → V1_6 → V1_7. Kết quả **23 bảng, 6 Deck, 90 từ, 90 liên kết**. Đã đối chiếu các bảng/cột, index và constraint của V1_7. Không phát lại V1_7 và không chạy backfill. Xem [database-setup.log](evidence/new-machine/database-setup.log) và [database-final.log](evidence/new-machine/database-final.log).

Backend **127.0.0.1:58125** đã kết nối Hikari/Hibernate validate; health UP, các request JWT đọc profile/catalog/review summary từ DB thật thành công. Web Metro **58126**, proxy **58127**; [Login → Home](evidence/new-machine/web-startup.json) nhận login 200/summary 200, không page error. API URL Web là http://127.0.0.1:58127. Các server chỉ mở loopback; chưa xác nhận LAN/native.

Schema khởi tạo được trên PG17 không chứng minh toàn app tương thích: My Vocabulary dùng pg_catalog.pg_unicode_fast, thiếu trên PG17 và gây HTTP500. Đã lưu lỗi/ảnh theo **ENV-W5-001**, không đổi source hoặc làm giả collation. Cần PG18 trước khi kết luận các ca liên quan. [BUG_REPORT.md](BUG_REPORT.md).

Các suite API dùng cluster riêng tạo ngẫu nhiên, cổng Auth 55446/58135, PasswordReset 55447/58145/SMTP58148, Quiz 55448/58155, MyVocabulary 55449/58165. Dịch vụ suite được dừng trong finally; dữ liệu/log giữ trong .artifacts. Suite legacy nạp Core trước topics nên có **115 words/133 links**, khác fixture seed chuẩn 90/90 của cluster chính. SQL constraint chạy trên **english_learning_test** tạo mới trong cluster 55436; bài âm xác nhận đúng thông báo/exit3 và rollback, không coi mọi lỗi SQL là PASS.

## Điều chỉnh môi trường và giới hạn

- Giữ PostgreSQL17 và dữ liệu hiện có. Yêu cầu xác nhận bổ sung PG18 đã được gửi; chưa có xác nhận thì không cài.
- C đã có thời điểm 0 byte trống, JVM bị thiếu native memory và Expo ENOSPC. Đã dùng heap/metaspace giới hạn, chạy suite tuần tự, TEMP/TMP trên D, Metro tối đa 2 worker. Không chỉnh pagefile hoặc xóa dữ liệu cá nhân.
- Các lượt lỗi gốc được giữ; kết quả cuối dùng đúng lượt đã kiểm chứng. Maven cuối exit0: 94/94, không skip; lint/typecheck exit0. [Báo cáo thực thi](TEST_EXECUTION_REPORT.md).
- CORS OPTIONS login trả401, thiếu allow-origin; proxy cùng origin giúp tiếp tục Web, **không đóng BUG-W5-001**.
- Gmail thật, thiết bị thật, AVD đang chạy và Expo Go SDK58 chưa kiểm chứng. SMTP loopback đạt không thay bằng chứng giao nhận Gmail.
- Lệnh mở Metro trực tiếp bằng Start-Process node bị bộ kiểm duyệt tự động từ chối với lý do `blocked by policy`. Đã dùng script npm run web hiện có trong terminal, hoạt động. Không yêu cầu thay chính sách hay quyền hệ thống.

Khởi động lại và việc còn lại: [PROGRESS.md](PROGRESS.md). Công việc hiện có **26 PASS / 6 PARTIAL / 2 BLOCKED / 29 NOT RUN**, không lấy minh chứng cũ làm kết quả máy mới.

---

## Bản ghi máy cũ — chỉ để đối chiếu lịch sử

Nội dung phía dưới được giữ từ commit bàn giao cf018aa. Các phiên bản, đường dẫn, kết luận đã cài và trạng thái 63 NOT RUN ở đây **thuộc máy cũ**, không phải hiện trạng máy mới.

# Báo cáo môi trường tuần 5 — Giai đoạn 3A

Cập nhật 25/11/2026 (Asia/Bangkok). Đã khởi chạy PostgreSQL test, Spring Boot và Expo Web, xác minh giao diện đăng nhập → Trang chủ với API thật. Giai đoạn 3A hoàn thành cho môi trường Web/API. Chuẩn bị native còn các điều kiện bên dưới. 63 test case vẫn NOT RUN.

## Công cụ thực tế và cách cài

| Công cụ | Phiên bản / vị trí | Trạng thái |
| --- | --- | --- |
| Node.js | 22.23.5, C:\Program Files\nodejs | Cài MSI thành công, exit 0. node -v xác nhận. |
| npm | 10.9.9 | npm -v xác nhận, npm ci thành công với 805 packages. |
| Temurin JDK | 21.0.9+10, C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot | MSI exit 0, java -version xác nhận. |
| Maven | 3.9.11, %LOCALAPPDATA%\ELA-Tools\apache-maven-3.9.11 | Giải nén binary ZIP, mvn -v xác nhận dùng Java 21.0.9. |
| PostgreSQL | 18.6, bộ phát hành EDB 18.6-4, C:\Program Files\PostgreSQL\18 | Dùng installer --extract-only 1, server và commandlinetools, exit 0. psql --version xác nhận. Cluster test quản lý bằng pg_ctl, chưa đăng ký Windows service. |
| Python | 3.11.9 | Tái sử dụng bản đã cài. py --version và python --version xác nhận. |
| Git | 2.56.1.windows.1 | Tái sử dụng bản đã cài. git --version xác nhận. Bản dự án hiện tại thiếu .git. |
| Expo | SDK 58.0.22 từ lockfile | CLI local hoạt động qua npm run web. |
| Playwright Core | 1.65.1, .artifacts/quiz-tools/node_modules | Cài dependency cục bộ, dùng Chrome có sẵn để kiểm tra khởi động. |
| Chrome | Bản có sẵn tại C:\Program Files\Google\Chrome\Application\chrome.exe | Mở headless bằng Playwright, chụp ảnh Login/Home thành công. |
| Edge | WebView2 Runtime 158.0.4370.33 có sẵn | Chưa xác nhận Edge browser ở đường dẫn các script test cũ yêu cầu. |
| Android Studio / SDK / ADB / Emulator | Chưa tìm thấy trong PATH hoặc vị trí chuẩn | Chưa cài theo giới hạn người dùng. |
| Docker Desktop / WinGet | Chưa tìm thấy bản cài khả dụng trong lượt kiểm kê | Dùng native và installer chính thức để hoàn thành 3A. |

PATH User được bổ sung từng mục còn thiếu cho Node, JDK bin, Maven bin, PostgreSQL bin. Các mục Python và Git đã có được giữ lại. JAVA_HOME User trỏ JDK 21.0.9.10-hotspot. Các lệnh xác minh chạy được sau khi terminal nạp Machine PATH + User PATH. VS Code đang mở có thể cần khởi động lại để terminal mới nhận môi trường đã lưu.

## Nguồn tải và xác minh

Đã tải lại manifest từ kho Microsoft WinGet, đối chiếu URL chính thức và checksum trước khi cài. Cả Node MSI, Temurin MSI và PostgreSQL EXE có Authenticode Status=Valid, lần lượt ký bởi OpenJS Foundation, Eclipse.org Foundation và EnterpriseDB Corporation.

| Bộ cài | Nguồn | Hash đã đối chiếu |
| --- | --- | --- |
| Node 22.23.5 x64 | nodejs.org/dist/v22.23.5/node-v22.23.5-x64.msi | SHA256 963A110509ECA7E0D6CC009095CCB4117E26D59287876A056B79293AE3FEF238 |
| Temurin 21.0.9+10 x64 | github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.9+10/OpenJDK21U-jdk_x64_windows_hotspot_21.0.9_10.msi | SHA256 E97F44C7915866C3127565A91373D03ADB639916186B24FC5E0F818A3BDE8D3F |
| PostgreSQL 18.6-4 | get.enterprisedb.com/postgresql/postgresql-18.6-4-windows-x64.exe | SHA256 A98074954015F3D733DBB92315BD06E01A381778F0A8AE4CEBF9CB199D73AAB0 |
| Maven 3.9.11 | repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip | SHA512 03e2d65d4483a3396980629f260e25cac0d8b6f7f2791e4dc20bc83f9514db8d0f05b0479e699a5f34679250c49c8e52e961262ded468a20de0be254d8207076 |

Apache Archive không kết nối được trong lần tải đầu, nên đã dùng Maven Central và file .sha512 cùng artifact. Các phiên bản được xác nhận đều tồn tại, giữ nguyên bộ phiên bản người dùng duyệt. Node phù hợp engines của Expo/RN trong lockfile, Java 21 theo pom và Maven trùng Dockerfile.

Bằng chứng tải/checksum ở .artifacts/week5-environment/installers/verification.json, cùng manifest và log cài Node/JDK. [Manifest Node](https://github.com/microsoft/winget-pkgs/tree/master/manifests/o/OpenJS/NodeJS/22/22.23.5), [manifest JDK](https://github.com/microsoft/winget-pkgs/tree/master/manifests/e/EclipseAdoptium/Temurin/21/JDK/21.0.9.10), [manifest PostgreSQL](https://github.com/microsoft/winget-pkgs/tree/master/manifests/p/PostgreSQL/PostgreSQL/18/18.6-4), [Maven Central](https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/).

## Database độc lập

- Cluster mới ở .artifacts/week5-environment/pgdata, bind 127.0.0.1:55436, DB english_learning_fsrs_test, UTF8, xác thực SCRAM-SHA-256. pg_ctl khởi động thành công.
- Đã xác nhận current_database, địa chỉ, cổng và DB trống trước khi nạp. Chỉ nạp vào cluster mới này. Dữ liệu mẫu gồm 23 bảng, 6 Deck, 90 từ và 90 liên kết Deck–Word.
- Đã nạp schema tuần 3 → V1_2 → V1_3 → V1_4 → apply_topic_decks → V1_5 → apply_pronunciations → apply_topic_examples → V1_6 → V1_7. Log ở .artifacts/week5-environment/database-setup.log.
- Đã xác nhận review_sessions, review_session_items, review_idempotency, user_streaks và review_cards.learning_step tồn tại. Chưa chạy backfill. V1_7 đã áp dụng, không chạy lại nguyên file.
- Tạo một tài khoản app smoke riêng để xác minh khởi động, trình độ A1. Chưa ghi tiến độ học, Quiz hoặc review log bằng bộ 63 ca.
- Credentials DB/JWT/app smoke được lưu dạng SecureString trong secrets.clixml bằng Windows DPAPI, thuộc tài khoản Windows hiện tại. File mật khẩu tạm cho initdb đã được dọn. Báo cáo không chứa mật khẩu hay token.

## Backend và frontend đang chạy

| Thành phần | Địa chỉ truy cập | Xác minh |
| --- | --- | --- |
| PostgreSQL | 127.0.0.1:55436 | Truy vấn định danh DB và số liệu schema/seed thành công. |
| Spring Boot 4.1.2 | http://127.0.0.1:58125 | Hikari kết nối PostgreSQL 18.6; Hibernate ddl-auto=validate khởi tạo thành công; health UP. |
| Expo/Metro | http://localhost:58126 | Trang /login trả HTTP 200, bundle Web và SSR biên dịch thành công. |
| Web + API cùng origin | http://127.0.0.1:58127/login | URL sử dụng để đăng nhập Web. Proxy chuyển /api/v1/* tới backend 58125, các đường khác tới Expo 58126. |

Frontend dùng EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:58127. Proxy chỉ bind loopback. Backend cũng chỉ bind loopback và chạy profile default.

Kiểm tra khởi động API cho thấy decks khi thiếu JWT trả 401, tài khoản smoke đăng ký được, profile A1 đọc được, danh mục trả ba Deck A1, summary FSRS trả số học/đến hạn/ôn thêm đều 0 cho user mới. Kiểm tra trình duyệt đi từ Login đến Home nhận login 200 và summary 200, pageErrors rỗng. Đây là kiểm tra khởi động môi trường, chưa ghi kết quả cho các test case.

## Lỗi gặp phải và xử lý

1. Máy chủ Apache Archive timeout. Đổi sang artifact Maven Central với checksum chính thức.
2. Terminal Process PATH chưa nhận Python/Git dù đã có trong cấu hình lưu. Bổ sung công cụ còn thiếu vào User PATH và nạp lại môi trường khi chạy lệnh.
3. Bộ kiểm duyệt tự động chặn hai lệnh mở Expo bằng đường dẫn CLI trực tiếp, chỉ trả lý do blocked by policy. Chạy qua script npm run web của dự án được chấp nhận và Metro đã hoạt động.
4. Web gọi API khác origin bị chặn. OPTIONS login trả 401, không có Access-Control-Allow-Origin. Đã cấu hình reverse proxy local trong .artifacts/week5-environment/web-proxy.cjs để cùng origin. Không sửa SecurityConfig hoặc mã nghiệp vụ, không vô hiệu hóa bảo mật trình duyệt.
5. Expo cảnh báo có bản cập nhật 58.0.22 → ~58.0.26 và một số package khác. npm báo ESLint 9.39.5 deprecated. Giữ dependencies theo lockfile hiện tại, ghi nhận để xem xét sau.
6. PowerShell 5.1 ConvertFrom-Json không đọc được cấu trúc lockfile, dùng Python json để đọc và xác nhận engines.

Maven package với -DskipTests thành công. TypeScript noEmit và npm run lint -- --no-cache đều exit 0. Chưa chạy Maven test hay bộ script chức năng. Build log ở .artifacts/week5-environment/backend-build.log.

## Bằng chứng và cách khởi động lại

Ảnh đã kiểm tra trực quan ở [Login](evidence/web-login.png) và [Home](evidence/web-home.png). Kết quả kỹ thuật ở [API smoke](evidence/api-smoke.json) và [Web startup](evidence/web-startup.json).

Các process đang chạy trong phiên Terminal. Khi máy khởi động lại, từ gốc dự án thực hiện theo thứ tự, mỗi server ở terminal riêng. Chỉ chạy pg_ctl start nếu cluster đang dừng và kiểm tra port trước khi mở lại.

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe' -D '.artifacts/week5-environment/pgdata' status
& 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe' -D '.artifacts/week5-environment/pgdata' -l '.artifacts/week5-environment/postgres.log' -o '-p 55436 -h 127.0.0.1' -w start
powershell.exe -NoProfile -File docs/week5-testing/scripts/start-backend.ps1
powershell.exe -NoProfile -File docs/week5-testing/scripts/start-web.ps1
node docs/week5-testing/scripts/web-proxy.cjs
```

Các script khởi chạy dùng credentials DPAPI local đã tạo, cần cùng tài khoản Windows. Dừng backend/Expo/proxy bằng Ctrl+C tại terminal tương ứng. Dừng cluster bằng pg_ctl -D '.artifacts/week5-environment/pgdata' -w stop, dữ liệu được giữ lại.

## Điều kiện native và trở ngại còn lại

Môi trường Windows báo các cờ ảo hóa CPU chưa sẵn sàng trong khi có hypervisor. Cần kiểm tra hỗ trợ ảo hóa của máy/host trước khi tạo AVD.

Chưa cài Android Studio, SDK, ADB, Emulator hoặc công cụ hệ thống khác ngoài bộ đã được duyệt. Khi người dùng yêu cầu chuẩn bị Emulator, cần xác nhận cài Android Studio/SDK riêng. Với điện thoại thật cần Expo Go tương thích SDK 58, thiết bị và máy cùng mạng, kiểm tra kết nối LAN. Backend/Metro/proxy hiện chỉ mở local, nên trước kiểm thử điện thoại cần cấu hình bind LAN và API URL tương ứng rồi xác minh firewall mạng riêng. Chưa thử trên thiết bị thật.

Gmail OTP thật còn cần người dùng cung cấp cấu hình SMTP tại máy. Chưa cấu hình Gmail credentials. Các script web cũ mặc định Edge cần Edge browser hoặc cấu hình đường dẫn tương thích phù hợp trước khi chạy giai đoạn 3B.

Phạm vi thay đổi gồm cài bộ công cụ đã duyệt, bổ sung môi trường User, dependencies, build output, cluster test, proxy và script local trong .artifacts, các tài liệu tuần 5. Source nghiệp vụ được giữ nguyên. Windows Firewall/Defender giữ nguyên cấu hình. 63 ca vẫn NOT RUN, chưa chuyển giai đoạn 3B.
