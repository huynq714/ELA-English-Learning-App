# Kế hoạch kiểm thử tuần 5 — English Learning App

**Ngày lập:** 25/11/2026 (Asia/Bangkok)
**Phạm vi công việc:** Giai đoạn 1 của quy trình kiểm thử và sửa lỗi môn Lập trình Mobile. Các kịch bản dưới đây đang ở trạng thái **Chưa chạy**.

## 1. Hiện trạng dự án

Thư mục gốc là `<project-root>`, nằm dưới thư mục VS Code đang mở một cấp. Đã đối chiếu `AGENTS.md`, [README](../../README.md), tài liệu trong `docs/week3-demo/` (kể cả ERD và Postman JSON), `docs/week4-demo/`, `docs/week5-demo/`, `docs/handover/` và các thư mục mã nguồn, kiểm thử. Git for Windows 2.56.1 chạy qua đường dẫn tuyệt đối. `git status --short --branch` và `git rev-parse --show-toplevel` cùng báo không tìm thấy repository vì bản làm việc thiếu `.git`.

| Thành phần | Cấu trúc và dữ liệu |
| --- | --- |
| Mobile | Expo SDK 58 (`expo ~58.0.22`), React Native 0.88.1, TypeScript 6. `src/app/` khai báo route và bảo vệ theo phiên, `src/screens/` dựng màn hình, `src/features/` xử lý nghiệp vụ phía client. `src/services/api-client.ts` gắn Bearer JWT, chuẩn hóa lỗi và đặt timeout 10 giây. |
| API | Spring Boot 4.1.2, Java 21, Spring Security, JWT/BCrypt, JPA và JDBC. Có các nhóm Auth, Profile, Vocabulary, Quiz và FSRS. |
| Dữ liệu | PostgreSQL 18, schema tuần 3 gồm 16 bảng và extension `pgcrypto`. Tuần 4 thêm metadata học liệu, snapshot Quiz, catalog và OTP. Tuần 5 thêm từ đã lưu và trạng thái phiên FSRS. Seed A1/A2 tạo 6 Deck × 15 từ, 90 từ và 90 liên kết trên DB trống. |

### Mức độ triển khai qua đọc mã

| Mức độ | Chức năng thực tế |
| --- | --- |
| Đã có luồng mobile → API → DB | Đăng ký, đăng nhập email, xác minh phiên, quên mật khẩu qua Gmail OTP, đổi mật khẩu, xem/chỉnh hồ sơ, danh mục Deck A1/A2, Flashcard có tiến độ, Quiz, My Vocabulary và FSRS DUE/CRAM. Đăng xuất xóa phiên phía client. Home lấy tên, số từ đã học, đến hạn, ôn thêm và streak từ dữ liệu thật. Điều hướng và báo lỗi mạng được triển khai theo từng luồng. |
| Demo | Nút Google/Apple, lưới nguyên âm IPA và các thao tác IPA, Free Talk/Roleplay cùng nội dung giới thiệu hội thoại trên Home. CRUD Deck và thao tác Profile theo `userId` phục vụ demo backend với profile `local` qua loopback. |
| Chưa hoàn thành hoặc ngoài luồng hiện tại | OAuth Google/Apple, phụ âm/chi tiết/chấm phát âm IPA, hội thoại AI và lịch sử luyện nói. Profile cho chọn A1–C2, học liệu seed chỉ có A1/A2. Profile không có DELETE. |

README và bản bàn giao tổng quan còn mô tả FSRS chưa triển khai. Đối chiếu [demo FSRS](../week5-demo/FSRS_REVIEW.md), [bàn giao ngày 25/11](../handover/CODEX_HANDOVER_2026-11-25.md), `backend/.../fsrs/ReviewController.java` và `src/features/review/` cho thấy luồng FSRS đã được nối. Hướng dẫn import ba Deck A1 Core của tuần 4 ghi lại dữ liệu lịch sử. Catalog hiện tại dùng sáu Deck chủ đề. Các kết quả PASS trong tài liệu cũ là bằng chứng lịch sử.

## 2. Môi trường Windows đã kiểm tra

| Hạng mục | Kết quả phiên này | Điều kiện để chạy |
| --- | --- | --- |
| Node.js, npm, npx | Không tìm thấy lệnh trong PATH, không có Node tại đường dẫn chuẩn đã kiểm tra. | Node.js 22 LTS từ 22.13 theo README, npm đi kèm. |
| Expo, TypeScript, ESLint | `package.json` khai báo Expo SDK 58, có lockfile. Thiếu `node_modules` và CLI trong phiên này. Lint và typecheck dừng ngay vì không tìm thấy `npm.cmd`/`npx.cmd`. | `npm.cmd ci` rồi dùng Expo CLI local qua `npx.cmd`. Kiểm tra Expo Go tương thích SDK 58 trên thiết bị mục tiêu. |
| Java, Maven | Không tìm thấy `java`, `javac`, `mvn.cmd` hay `JAVA_HOME`/`MAVEN_HOME`. Chưa thấy Maven Wrapper hoặc `backend/target/`. | JDK 21 và Maven 3.9+ cho backend native và JUnit. |
| PostgreSQL | Không thấy `psql`, đường dẫn PostgreSQL 18 mặc định, Windows service PostgreSQL, hay listener 5432/5433 trong kiểm tra phiên này. Cổng API 8080 cũng không có listener. | PostgreSQL 18.x với DB kiểm thử riêng, hoặc Docker Compose. Xác minh schema trước khi chạy ca tích hợp. |
| Android SDK, ADB, Emulator | Không thấy `sdkmanager`, `adb`, `emulator`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, SDK chuẩn hoặc thư mục AVD chuẩn. Chưa xác minh thiết bị thật. | Android Studio/SDK, Platform-Tools và AVD cho emulator. Có thể kiểm thử Expo Go trên điện thoại chung Wi-Fi. |
| Công cụ phụ trợ | Windows PowerShell 5.1, Python 3.11.9 qua `py`. Script PowerShell gọi `python`, hiện lệnh đó chưa khả dụng. Chưa tìm thấy Docker CLI, Postman CLI hoặc Edge tại đường dẫn mặc định của các script web. | Đặt Python vào PATH cho bộ script. Với web smoke, chuẩn bị Edge và `playwright-core`. PowerShell `Invoke-RestMethod` thay được Postman. |

## 3. Cách khởi chạy cho giai đoạn sau

### PostgreSQL và backend

- **Native** — Dùng PostgreSQL 18.x tại `localhost:5432`. Trên **database kiểm thử mới, cô lập**, nạp theo thứ tự đang được khai báo trong [compose.yaml](../../compose.yaml): `schema.sql` (tuần 3) → V1_2 → V1_3 → V1_4 → `apply_topic_decks.sql` → V1_5 → `apply_pronunciations.sql` → `apply_topic_examples.sql` → V1_6. Bổ sung V1_7 trong DB kiểm thử để có FSRS và thống kê Home. V1_4 là điều kiện của import topic. Backfill FSRS là tùy chọn, summary đã tính tiến độ cũ và phiên có thể khởi tạo thẻ còn thiếu.
- **Docker** — Từ gốc dự án, chuẩn bị `.env` theo `.env.example` và README, chọn tên project/volume kiểm thử riêng, đặt JWT secret Base64 ngẫu nhiên (ít nhất 32 byte trước khi mã hóa). Lệnh theo tài liệu là `docker compose up --build -d` và `docker compose logs -f backend`, với cùng tên project kiểm thử ở cả hai bước. DB container dùng 5432, host mặc định là `127.0.0.1:5433`. API host mặc định là `127.0.0.1:8080`. SQL mount vào `docker-entrypoint-initdb.d` chỉ chạy lúc khởi tạo volume trống. **Compose hiện dừng tại V1_6**, nên khi cần FSRS hãy chuẩn bị V1_7 riêng trên DB thử nghiệm đã xác nhận. Giữ nguyên volume hiện có.
- **Chạy Spring Boot native** — Trong `backend/`, đặt `DB_USERNAME`, `DB_PASSWORD`, `AUTH_JWT_SECRET` và dùng `SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:<port>/<DB-kiểm-thử>` để trỏ đích rõ ràng. Sau đó chạy `mvn.cmd spring-boot:run`. Bind mặc định `127.0.0.1:8080`. Chỉ dùng `SPRING_PROFILES_ACTIVE=local` cho demo `/dev` trên loopback. Khi thử qua LAN, đặt `SERVER_ADDRESS` là IPv4 Wi-Fi của máy và chạy với profile mặc định. Với Docker, đặt `API_BIND_ADDRESS` là IPv4 Wi-Fi của máy theo README. Dùng `MAIL_USERNAME` và `MAIL_APP_PASSWORD` để thử Gmail SMTP 587/STARTTLS, hoặc dùng SMTP loopback trong suite PasswordReset. Giữ mật khẩu và secret ngoài mã nguồn và log.
- **Xác minh** — Dùng `SELECT current_database();` trên DB thử nghiệm, đối chiếu seed và sự hiện diện của `user_saved_words`, `review_sessions`, `review_session_items`, `review_idempotency`, `user_streaks` và `review_cards.learning_step`. Spring Boot dùng `ddl-auto=validate`. Gọi `GET /api/v1/health` (kỳ vọng `200` và `status=UP`), rồi kiểm tra endpoint có JWT và truy cập DB như `/api/v1/decks` và `/api/v1/review/summary`. Health chỉ xác nhận HTTP của backend.

### Expo

Từ gốc dự án, đặt URL trước khi khởi động Expo. Thay host và cổng theo môi trường.

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://<IPv4-Wi-Fi-cua-may>:8080"
npm.cmd ci
npx.cmd expo start --go --lan --port 0
```

- **Điện thoại** — Cùng Wi-Fi, mở URL health trên điện thoại, kiểm tra firewall mạng riêng và quét QR bằng Expo Go.
- **Android Emulator** — Sau khi cài SDK và tạo AVD, kiểm tra `emulator -list-avds`, `adb devices -l`. Với AVD Android Studio truy cập backend host bind loopback, dùng host `10.0.2.2` trong API URL và mở app bằng `a` tại Expo CLI hoặc `npm.cmd run android`. Kiểm tra health từ emulator. Trên Windows, dùng thiết bị iOS thật để kiểm tra hành vi native iOS.
- **Web** — Dùng `http://127.0.0.1:8080` nếu API chạy cùng máy, sau đó `npm.cmd run web`. Web phục vụ smoke UI và mô phỏng mạng. Xác minh SecureStore, thư viện ảnh, âm thanh và thao tác Back trên native.

## 4. Ma trận kiểm thử

**Môi trường** — **API/DB** là Spring Boot và PostgreSQL test cô lập, gọi qua PowerShell/Postman/script. **Android** là emulator hoặc điện thoại Android. **iOS** là iPhone Expo Go. **Web** là Expo Web, có thể dùng Playwright. **P0** ưu tiên luồng chặn sử dụng hoặc ảnh hưởng dữ liệu. **P1** ưu tiên hồi quy chức năng, thiết bị và giao diện.

| ID | Chức năng / mục tiêu | Nội dung kiểm thử | Tiêu chí đạt | Phương pháp / môi trường |
| --- | --- | --- | --- | --- |
| AUTH-01 · P0 | Đăng ký và tạo hồ sơ | Đăng ký A1/A2, email có khoảng trắng và khác hoa thường, email trùng, bỏ trống trường, CEFR sai, mật khẩu thiếu chữ/số, biên 7/8 và 72/73, xác nhận khác. | Hợp lệ trả 201, tạo đúng một user và profile, mục tiêu mặc định 15 phút, JWT dùng được và mở Home. Dữ liệu sai được báo rõ và không phát sinh user. DB lưu BCrypt. | Tay Android/iOS, tự động Auth HTTP + SQL; dùng tài khoản test riêng cho mỗi lượt. |
| AUTH-02 · P0 | Đăng nhập, duy trì phiên và đăng xuất | Mật khẩu đúng/sai, tài khoản DISABLED, JWT hết hạn, mở lại app, logout rồi Back/deep link vào màn bảo vệ, đăng nhập tài khoản thứ hai. | Tài khoản hợp lệ vào Home. Lỗi xác thực giữ người dùng ở luồng đăng nhập. Native khôi phục phiên hợp lệ và xóa phiên cục bộ khi logout. Không hiện dữ liệu tài khoản trước. Web lưu phiên trong bộ nhớ. | Auth HTTP/JUnit, tay Android/iOS và Web. |
| AUTH-03 · P0 | Quên mật khẩu Gmail OTP | Gửi OTP đến hộp thư test, email chưa đăng ký, mã thiếu số/sai/hết hạn sau 5 phút, giới hạn gửi/thử, reset token hết hạn sau 10 phút hoặc đã dùng, mật khẩu mới sai xác nhận. | API phản hồi chung khi yêu cầu OTP. Mã hợp lệ cho phép đổi một lần, mã/token sai bị từ chối, yêu cầu gửi bị giới hạn vẫn trả 202 và không gửi thêm thư, còn vượt ngưỡng tần suất xác minh/đặt lại trả 429. Mật khẩu cũ và JWT cũ mất hiệu lực sau reset, mật khẩu mới đăng nhập được. | Suite PasswordReset dùng SMTP loopback và PostgreSQL test. Tay Android/iOS với hộp thư Gmail do nhóm kiểm soát. |
| AUTH-04 · P0 | Đổi mật khẩu trong phiên | Mật khẩu hiện tại sai, mật khẩu mới trùng cũ, xác nhận lệch, đổi hợp lệ, đăng nhập lại và kiểm tra phiên cũ. | Lỗi giữ thông tin xác thực cũ. Thành công cấp JWT thay thế, JWT cũ bị từ chối và mật khẩu mới dùng được. | Auth HTTP + tay Android/iOS. |
| PRO-01 · P0 | Đọc và cập nhật đúng hồ sơ | Đổi tên, chọn/hủy ảnh, quyền ảnh bị từ chối, đổi A1↔A2. Kiểm tra PATCH mục tiêu qua API ở biên 5/240 và ngoài biên. Mở lại hồ sơ và đổi tài khoản. | Lưu đúng trường hợp lệ, tên và ảnh còn sau mở lại, lỗi hiển thị rõ, dữ liệu thuộc đúng tài khoản. Deck đổi theo level đã lưu. | Auth/JUnit và API/DB, tay Android/iOS với ảnh test. |
| HOME-01 · P0 | Hiển thị số liệu thật theo tài khoản | User mới, user có tiến độ và bookmark, sau khi học một từ/hoàn tất DUE, phiên dở, mất mạng và đổi tài khoản. Nhấn các ô và đường dẫn SRS. | Tên đúng. Số đã học/đến hạn/ôn thêm/streak khớp summary, bookmark đơn thuần không tăng số đã học. Có trạng thái tải/lỗi và dấu gạch khi chưa có số liệu. Điều hướng đúng, không hiện số liệu tài khoản cũ. | Tay Android/iOS/Web, đối chiếu `/review/summary` và SQL chỉ đọc trên DB test đã có V1_7. |
| VOC-01 · P0 | Danh mục, tìm kiếm và dữ liệu học liệu | A1/A2, đổi level trong cùng phiên, B1–C2, tìm theo tiêu đề/tên chủ đề và kết hợp bộ lọc chủ đề, Deck rỗng hoặc đã ẩn, mở Deck của cấp khác qua API. | Mỗi cấp A1/A2 có ba Deck × 15 từ trên seed chuẩn, đúng thứ tự. Các cấp ngoài catalog có trạng thái rỗng. Kết quả tìm phù hợp và Deck ngoài quyền truy cập bị từ chối. | Deck JUnit, API/DB, tay Android/iOS/Web. |
| FLASH-01 · P0 | Lật thẻ, nghe và lưu tiến độ | Lật hai mặt, nghĩa/câu dịch, quay lại và chuyển thẻ, nút loa bản ghi/TTS, lỗi audio, nguồn học liệu, Again và Hard/Good/Easy, mở lại Deck đã học một phần. | Nghĩa và dịch xuất hiện ở mặt sau. Thẻ mới mở ở mặt trước. Nút loa/nguồn hoạt động đúng dữ liệu, có báo lỗi khi audio hỏng. Again đưa thẻ về cuối lượt, ba mức còn lại lưu tiến độ, hoàn tất mở Quiz đủ điều kiện. | Tay Android/iOS, web smoke Quiz và API/DB. |
| QUIZ-01 · P0 | Sinh đề, tiếp tục, chấm điểm và thi lại | Mở khi chưa đủ tiến độ; sinh 5 câu × 4 lựa chọn; nhận phản hồi từng câu; đóng/mở giữa bài; điểm 0/2/3/5; nộp lại sau mất phản hồi; ôn lại sau FAIL. | Chặn Quiz khi chưa đủ điều kiện. Đề và đáp án đã chấm được giữ khi tiếp tục. 2/5 FAIL, 3/5 PASS. Nộp lại cùng attempt trả kết quả đã lưu. Sau FAIL cần ôn từ trong đề trước khi làm lại. Điểm và 5 hàng đáp án khớp. | Suite Quiz HTTP/SQL và Web, tay Android/iOS; đối chiếu trigger COMMIT trên DB test. |
| MYVOC-01 · P1 | Lưu, tìm, phân nhóm và ôn từ cá nhân | Lưu/bỏ lưu lặp, danh sách rỗng, tìm từ/nghĩa, lọc A1/A2, phân trang, nhóm Deck và chi tiết nhóm, đổi cấp/đổi user, Flashcards đã lưu và lỗi mạng khi bỏ lưu. | POST/DELETE thành công trả 204, mỗi từ lưu một lần theo user. Tổng và nhóm nhất quán, từ đã lưu còn sau đổi level/đăng nhập lại. Phiên Flashcards đã lưu giữ tiến độ trong phiên và không ghi tiến độ Quiz/FSRS/streak. | Suite MyVocabulary HTTP + Web, tay Android/iOS và đối chiếu DB test V1_6+. |
| FSRS-01 · P0 | Xác minh lịch ôn, cập nhật phiên và streak | User chưa học/chỉ bookmark; từ đến hạn và chưa đến hạn; >10 từ; DUE/CRAM; lật và chấm Again/Hard/Good/Easy; chờ và tiếp tục phiên; hoàn tất lại cùng ngày; mất phản hồi sau rating, gửi lại. | DUE lấy từ đã học đủ điều kiện, CRAM có thể chọn từ đã học chưa đến hạn. Tối đa 10 từ/phiên dù summary có thể lớn hơn. Lịch và trạng thái phù hợp rating, phiên tiếp tục đúng. DUE hoàn tất cập nhật streak theo ngày, CRAM giữ nguyên. Gửi lại cùng thao tác ghi tối đa một review log. | JUnit engine/service và tích hợp PostgreSQL V1_7; web smoke API giả lập; tay Android/iOS và đối chiếu log DB test. |
| UI-01 · P1 | Điều hướng và khả dụng trên mobile | Welcome/Login/Register/OTP, tab Home/Từ vựng/IPA/AI/Hồ sơ, back phần cứng, deep link, safe area, bàn phím, màn nhỏ, cỡ chữ lớn, giảm chuyển động. Mở các mục demo. | Route và trạng thái tab đúng, các màn bảo vệ yêu cầu phiên, nút thao tác nhìn thấy khi có bàn phím và nội dung có thể cuộn. Demo hiển thị thông báo phù hợp. | Tay Android/iOS ở ít nhất hai kích cỡ màn hình; Web viewport nhỏ để smoke. |
| NET-01 · P0 | Chẩn đoán lỗi và khôi phục mạng | Thiếu URL, sai IP/cổng, mất Wi-Fi khi khôi phục phiên/tải Deck, timeout khoảng 10 giây, 401/404/500, mất phản hồi khi ghi Bookmark/Quiz/FSRS. | Có trạng thái chờ/lỗi và cơ chế thử lại phù hợp từng màn. 401 hết hiệu lực xử lý theo luồng phiên. Nối mạng rồi đọc lại được. Retry Quiz/FSRS không tạo bản ghi nghiệp vụ trùng. | Android/iOS đổi Wi-Fi hoặc chế độ máy bay; Web mô phỏng offline/delay/lỗi HTTP; kiểm tra API/DB test. |

## 5. Công cụ và trình tự đề xuất

| Công cụ hiện có trong dự án | Phạm vi và điều kiện |
| --- | --- |
| JUnit 5 / Maven | Auth, Health, Profile, Deck/Word, My Vocabulary, FSRS Engine/Service/Repository. Chạy `mvn.cmd -f backend/pom.xml test`. Hai lớp tích hợp FSRS bật khi khai báo `FSRS_TEST_JDBC_URL`, `FSRS_TEST_JDBC_USER`, `FSRS_TEST_JDBC_PASSWORD` cho DB cô lập tên chính xác là `english_learning_fsrs_test`, đã nạp schema và V1_7. Suite tạo và dọn fixture trong DB này. Ghi số skip riêng. |
| Script PowerShell + Python | `backend/scripts/test-auth-profile.ps1` điều phối `test_auth_profile.py`, `test_password_reset.py`, `test_quiz.py`, `test_my_vocabulary.py` bằng `-Suite Auth|PasswordReset|Quiz|MyVocabulary` (chọn một tên). Cần Maven test trước để có báo cáo Surefire/classpath, binaries PostgreSQL 18, lệnh `python` và cổng trống. Script tạo cluster riêng trong `.artifacts`, mặc định DB 55436/API 58125/Web 58126/SMTP 58128, chuẩn bị đến V1_6. |
| Edge / Playwright | `test-quiz-web.cjs`, `test-my-vocabulary-web.cjs` chạy với `-Web` ở suite tương ứng. `test-review-web.cjs` chạy riêng từ gốc khi Expo Web đã lên (`REVIEW_WEB_URL`, mặc định `http://127.0.0.1:58157`), giả lập API để kiểm tra gửi lại rating. Cả ba cần `.artifacts/quiz-tools/node_modules/playwright-core` và Edge (`QUIZ_EDGE_PATH` nếu khác mặc định). |
| Postman và PowerShell | Collection/environment trong `docs/week3-demo/` cho demo Deck/Profile. Các request đọc cũ cần đối chiếu route hiện tại và bổ sung Bearer token. Dùng `Invoke-RestMethod` hoặc Postman kiểm tra API chính thức. |
| SQL và import builder | `database/week3/test_*.sql` kiểm tra constraint, workflow, cascade và trigger tại COMMIT. Suite có thao tác ghi và tình huống dự kiến báo lỗi, chỉ dùng DB thử nghiệm. `database/week4/import/test_import_builder.py` kiểm tra kế hoạch import, dữ liệu đã duyệt và SQL sinh ra. |
| Kiểm tra tĩnh | Từ gốc chạy `npm.cmd run lint -- --no-cache`, `npx.cmd tsc --noEmit`; `npx.cmd expo-doctor` hỗ trợ chẩn đoán cấu hình sau khi có dependencies. |

Thứ tự dự kiến là kiểm tra công cụ và health → lint/typecheck và JUnit → HTTP/SQL cô lập → web smoke → thử mobile và mạng → tái kiểm thử sau sửa lỗi. Dùng hai tài khoản riêng (A1/A2), một hộp thư test và fixture từ đã học/chưa học/đã lưu/đến hạn. Tạo fixture trên DB thử nghiệm riêng.

Với mỗi ca, ghi ID, thiết bị/OS, cấu hình, dữ liệu đầu vào, bước tái hiện, kỳ vọng, thực tế và trạng thái **Đạt / Không đạt / Bị chặn / Chưa chạy**. Lưu log hoặc ảnh đã bỏ JWT, mật khẩu, OTP và dữ liệu cá nhân. Đánh dấu Giai đoạn 1 hoàn thành khi có đủ ma trận, cách chạy và trạng thái môi trường. Mục tiêu nghiệm thu sau các giai đoạn kế tiếp là các ca P0 đạt, không còn lỗi chặn hoặc lỗi dữ liệu chưa xử lý, và mọi ca chưa chạy đều có lý do cùng môi trường đã xác nhận.
