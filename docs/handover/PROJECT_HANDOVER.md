# TÀI LIỆU BÀN GIAO DỰ ÁN — ENGLISH LEARNING APP (ELA)
**Chuyển giao từ Codex sang Google Antigravity / Gemini**
*Thời điểm thực hiện: Tháng 11/2026*
*Tác giả / Vai trò: Senior Full-stack Engineer*

---

## 1. TỔNG QUAN DỰ ÁN & KIẾN TRÚC HỆ THỐNG (PROJECT ARCHITECTURE)

### 1.1. Tech Stack
- **Frontend**: React Native 0.88.1, Expo SDK 58, Expo Router v4 (file-based routing), TypeScript 6.0, MVVM architecture.
- **Backend**: Spring Boot 4.1.2, Java 21, Spring Security (Stateless OAuth2 Resource Server / JWT HMAC-SHA256, BCrypt), Spring Data JPA + Spring JDBC (`JdbcClient`), Spring Mail.
- **Database**: PostgreSQL 18.x (chạy native hoặc containerized qua Docker Compose), phần mở rộng `pgcrypto`.
- **Môi trường phát triển**: Windows 11, Expo Go trên iPhone thật kết nối LAN Wi-Fi đến laptop host Backend/PostgreSQL.

### 1.2. Kiến trúc phân tầng (Layers)

```
[ React Native View (Expo Router Screens) ]
                   │
                   ▼
       [ ViewModel (Custom Hooks) ]
                   │
                   ▼
  [ Feature Repositories (TypeScript) ]
                   │
                   ▼
  [ Shared API Client (fetch + timeout) ]
                   │  HTTP REST (Bearer JWT)
                   ▼
     [ Spring MVC RestControllers ]
                   │
                   ▼
  [ Service Layer (@Transactional rules) ]
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
 [ Spring Data JPA ]   [ Spring JdbcClient ]
         └─────────┬─────────┘
                   ▼
  [ PostgreSQL 18 (Schema + Triggers) ]
```

- **Frontend Client Architecture**:
  - `src/app/*`: File-based routes (Expo Router). Các route không chứa business logic hay direct state manipulation.
  - `src/screens/*`: Pure Screen components, hiển thị UI và map interactions tới ViewModels.
  - `src/features/*`: Phân theo feature domain (`auth`, `profile`, `vocabulary`, `quiz`).
    - `view-model/` hoặc `hooks/`: Quản lý state, side-effects, lifecycle (`useFocusEffect`), caching logic.
    - `repositories/`: Giao tiếp API qua `apiClient`, parse & validate schema dữ liệu trả về từ Backend.
    - `models/`: Interface định nghĩa kiểu dữ liệu chuẩn phía client.
  - `src/services/api-client.ts`: Wrapper `fetch` chuẩn hóa timeout 10 giây (AbortController), gắn Bearer token, handle lỗi HTTP và tự động bóc tách payload lỗi.
  - `src/features/auth/repositories/session-storage.ts`: Lưu trữ JWT token an toàn bằng `expo-secure-store`.

- **Backend Architecture**:
  - `com.englishlearning.auth`: Quản lý đăng ký, đăng nhập, JWT, Security filter chain, khôi phục mật khẩu OTP.
  - `com.englishlearning.profile`: Hồ sơ cá nhân (`user_profiles`), trình độ CEFR, avatar, mục tiêu học tập.
  - `com.englishlearning.vocabulary`: Bộ từ vựng, Decks A1/A2, chi tiết từ, câu ví dụ, nguồn học liệu, từ vựng cá nhân (`user_saved_words`).
  - `com.englishlearning.quiz`: Tiến trình học thẻ (`user_word_progress`), sinh đề trắc nghiệm 5 câu, chấm điểm trực tiếp, snapshot đề thi và kiểm soát điều kiện thi lại.
  - `com.englishlearning.common.exception`: Global exception handler (`@ControllerAdvice`), chuẩn hóa `ApiError`.
  - Spring Profiles:
    - `local`: Kích hoạt các endpoint phát triển `/api/v1/dev/**` phục vụ dev qua loopback (`127.0.0.1`, `::1`).
    - `default`/Docker: Chỉ mở các endpoint chính thức, yêu cầu Bearer JWT hợp lệ.

---

## 2. TRẠNG THÁI CHI TIẾT CÁC MODULE (MODULE STATUS)

| Module / Tính năng | Trạng thái | Chi tiết triển khai thực tế trong Source Code |
| :--- | :---: | :--- |
| **Authentication & Session** | **DONE** | Đăng ký, đăng nhập, cấp JWT token (HMAC-SHA256, 32-byte secret), mã hóa BCrypt, kiểm tra tài khoản ACTIVE. `expo-secure-store` duy trì phiên trên thiết bị. |
| **Password Reset (Gmail OTP)** | **DONE** | 3 bước: `/forgot-password` (gửi OTP 6 chữ số), `/verify-reset-otp` (xác thực OTP nhận reset token), `/reset-password` (đổi mật khẩu bằng reset token). Rate-limiting, hash SHA-256 trong `password_reset_challenges` & `password_reset_limits`. |
| **User Profile & CEFR Level** | **DONE** | Lấy và cập nhật hồ sơ (`/api/v1/users/me/profile`). Đổi mật khẩu trong phiên đăng nhập (`/api/v1/users/me/password`). Phân cấp trình độ A1, A2, B1, B2, C1, C2. |
| **Vocabulary Decks (A1/A2)** | **DONE** | 6 Decks chủ đề chuẩn (3 Decks A1, 3 Decks A2), 15 từ mỗi Deck (tổng 90 từ chuẩn CEFR-J Wordlist v1.6). API tự động lọc Decks theo trình độ người học. |
| **Source Attribution & Provenance** | **DONE** | Metadata `words.source_metadata` lưu nguồn Free Dictionary API, Vietnamese Wiktionary, CEFR-J, giấy phép CC-BY-SA. Frontend có modal hiển thị minh bạch nguồn gốc từng từ và âm thanh. |
| **Audio Pronunciation** | **DONE** | Phát âm từ điển từ URL Wikimedia/Dictionary API bằng `expo-audio`. Fallback sang phát âm hệ thống với `expo-speech` (TTS) cho từ và câu ví dụ. |
| **Study Progress & Flashcards** | **DONE** | Lật thẻ flashcard 2 mặt, điều hướng từ, theo dõi tiến độ học Deck lưu vào `user_word_progress`. Nút Again đưa thẻ về cuối phiên học trên UI; Hard/Good/Easy ghi nhận vào database. |
| **Quiz Engine** | **DONE** | Sinh 5 câu trắc nghiệm (4 phương án) đảo chiều Anh-Việt / Việt-Anh. Lưu snapshot đề vào `quiz_attempts.question_snapshot`. Chấm ngay từng câu, lưu vào `quiz_answers`. Yêu cầu đạt 3/5 để PASS. Nếu FAIL, bắt buộc ôn lại các từ trong đề trước khi cho phép thi lại. Database trigger kiểm tra tính toàn vẹn 5 câu và điểm số tại thời điểm COMMIT. |
| **My Vocabulary (Từ vựng của tôi)** | **DONE** | Bookmark từ vựng (`POST/DELETE /api/v1/my-vocabulary/{wordId}`). Xem danh sách phân trang, tìm kiếm từ/nghĩa, lọc cấp độ A1/A2, gom nhóm theo Deck gốc (`/groups`), xem chi tiết thư mục, học lại bằng Flashcards riêng biệt. |
| **Review SRS (Thuật toán FSRS)** | **MISSING** | **Chưa có code Backend và Logic Frontend.** Đã có sẵn cấu trúc bảng `review_cards` và `review_logs` kèm database trigger bảo vệ lịch sử trong schema tuần 3. Màn hình `review-screen.tsx` hiện chỉ hiển thị mock data Figma (`demo.ts`) và thông báo alert. |
| **IPA Pronunciation Practice** | **MISSING** | Đã có bảng `ipa_sounds` và `pronunciation_attempts` trong schema tuần 3. Chưa có REST API, chưa có logic chấm điểm phát âm. Màn hình `ipa-screen.tsx` chỉ hiển thị grid tĩnh từ `demo.ts`. |
| **AI Conversation (Free Talk / Roleplay)** | **MISSING** | Đã có schema bảng `conversation_*` trong DB. Chưa có REST API/WebSocket backend, chưa có tích hợp Gemini/LLM. Màn hình `ai-screen.tsx` chỉ là placeholder. |
| **Speaking History & Statistics** | **MISSING** | Chưa có backend endpoint thống kê học tập. Màn hình Home (`home-screen.tsx`) đang dùng biến tĩnh `learningSummary` (streak 12, learned 320, due 24) từ `demo.ts`. |

---

## 3. TỔNG QUAN CƠ SỞ DỮ LIỆU (DATABASE OVERVIEW)

Database bao gồm **19 bảng** (16 bảng baseline Tuần 3 + 3 bảng qua các migration Tuần 4, Tuần 5).

### 3.1. Danh sách bảng và vai trò
1. `users`: Tài khoản, email (unique lower), password_hash, status (ACTIVE/DISABLED).
2. `user_profiles`: 1-1 với users, `english_level` (A1..C2), `daily_goal_minutes`, `avatar_url`.
3. `decks`: Bộ từ vựng, title, description, level, `is_published`, `topic_key`, `topic`, `topic_source`.
4. `words`: Từ vựng, `headword`, `ipa`, `meaning_vi`, `example_en`, `example_vi`, `audio_url`, `part_of_speech`, `cefr_level`, `definition_en`, `import_key`, `source_metadata` (JSONB).
5. `deck_words`: Quan hệ nhiều-nhiều giữa decks và words, có `sort_order`.
6. `user_word_progress`: Tiến độ học từ của user, `first_seen_at`, `last_studied_at`.
7. `quiz_attempts`: Lịch sử làm bài trắc nghiệm, `total_questions` (5), `correct_count`, `status`, `question_snapshot` (JSONB).
8. `quiz_answers`: Câu trả lời của từng attempt, `question_no` (1..5), `selected_answer`, `is_correct`.
9. `review_cards`: Thẻ ôn tập FSRS của từng user và word, `due_at`, `stability`, `difficulty`, `repetitions`, `lapses`, `fsrs_state` (NEW/LEARNING/REVIEW/RELEARNING), `last_reviewed_at`, `scheduler_version`.
10. `review_logs`: Lịch sử đánh giá FSRS, `rating` (AGAIN/HARD/GOOD/EASY), `reviewed_at`, `previous_due_at`, `next_due_at`.
11. `ipa_sounds`: Danh mục âm IPA, `symbol`, `sound_type`, `sample_word`, `audio_url`.
12. `pronunciation_attempts`: Lịch sử luyện phát âm IPA, điểm số `assessment_score`, `feedback_json`.
13. `conversation_scenarios`: Kịch bản đàm thoại AI, `initial_prompt`, `difficulty`.
14. `conversation_sessions`: Phiên hội thoại, `mode` (FREE_TALK/ROLE_PLAY), `valid_user_turns`, `report_json`.
15. `conversation_messages`: Tin nhắn trong phiên (USER/AI), `content`, `audio_object_key`.
16. `conversation_turn_feedback`: Đánh giá ngữ pháp, từ vựng của từng lượt chat của USER.
17. `password_reset_challenges`: Lưu trữ OTP khôi phục mật khẩu (hash SHA-256, 5 phút, 5 lần thử sai).
18. `password_reset_limits`: Rate limiting cho yêu cầu OTP theo địa chỉ email và IP.
19. `user_saved_words`: Danh mục từ vựng được người dùng đánh dấu bookmark / lưu trữ cá nhân.

### 3.2. Cơ chế ràng buộc & Trigger quan trọng
- **Bảo toàn dữ liệu FSRS**: Trigger `protect_review_history()` và `protect_review_logs()` chặn lệnh `DELETE` trực tiếp vào `review_cards` (khi đã có log) và `review_logs`. Chỉ cho phép xóa khi tài khoản user bị xóa (Cascade delete).
- **Tính toàn vẹn bài Quiz**: Constraint trigger `validate_completed_quiz()` là DEFERRED trigger: khi cập nhật trạng thái `COMPLETED`, bắt buộc phải có đúng 5 bản ghi câu trả lời trong `quiz_answers` và `correct_count` phải khớp chính xác số câu đúng thực tế.
- **Tính bất biến của kết quả Quiz**: Triggers `quiz_answers_immutable`, `quiz_attempt_history_guard`, `protect_completed_quiz_update()` ngăn chặn sửa đổi hoặc xóa điểm số, đề thi và câu trả lời sau khi bài thi đã hoàn thành.

---

## 4. TÍCH HỢP FRONTEND - BACKEND (INTEGRATION STATUS)

### 4.1. Luồng xác thực & State Management
- Token JWT được cấp phát khi gọi `POST /api/v1/auth/login` hoặc `/register`.
- Phía client, `SessionProvider` lưu thông tin phiên vào bộ nhớ và đồng bộ với SecureStore. Mọi API request đều tự động đính kèm `Authorization: Bearer <token>`.
- Client bóc tách mã lỗi `ApiError` từ HTTP status hoặc JSON body `{code, message}`.

### 4.2. Các màn hình đã tích hợp API thật
- **Đăng ký / Đăng nhập / Đổi mật khẩu**: Giao tiếp trực tiếp với `CurrentUserController` và `AuthController`.
- **Quên mật khẩu (OTP)**: Luồng 3 bước hoàn chỉnh giao tiếp với `PasswordResetController`.
- **Hồ sơ cá nhân**: Đọc và cập nhật trình độ tiếng Anh, tên hiển thị, đồng bộ hóa với Decks.
- **Từ vựng (Decks List)**: Lấy danh sách Decks theo cấp độ profile hiện tại, hỗ trợ tìm kiếm và lọc theo chủ đề.
- **Học Flashcard**: Tải danh sách từ của Deck, ghi nhận tiến độ học vào `user_word_progress` qua `POST /api/v1/decks/{id}/study-progress`.
- **Làm Quiz**: Kiểm tra điều kiện hoàn thành thẻ, sinh đề 5 câu, ghi nhận câu trả lời từng bước, nộp bài, đọc kết quả và điều hướng học lại nếu thi trượt.
- **Bộ từ vựng của tôi**: Bookmark/Bỏ bookmark từ Flashcard, xem danh sách phân trang, tìm kiếm, lọc theo level, mở chi tiết folder, học lại danh sách đã lưu.

### 4.3. Các màn hình còn dùng Mock Data / Chưa tích hợp
- **Màn hình Trang chủ (`src/screens/home-screen.tsx`)**: Streak (12 ngày), Số từ đã học (320), Số từ cần ôn (24) đang lấy từ `src/data/demo.ts`.
- **Màn hình Ôn tập hôm nay (`src/screens/review-screen.tsx`)**: Số từ cần ôn, danh mục Từ mới / Đang học / Đã thuộc đang đọc từ `src/data/demo.ts`. Bấm nút "Bắt đầu ôn tập" chỉ hiện thông báo demo.
- **Màn hình IPA (`src/screens/ipa-screen.tsx`)**: Bảng nguyên âm tĩnh, bấm vào chỉ mở alert demo.
- **Màn hình AI Conversation (`src/screens/ai-screen.tsx`)**: Giao diện thẻ Free Talk / Roleplay tĩnh, bấm vào chỉ mở alert demo.

---

## 5. HIỆN TRẠNG MODULE FSRS (FSRS DEEP DIVE)

### 5.1. Cơ sở dữ liệu: Đã sẵn sàng 100%
Bảng `review_cards` và `review_logs` đã được định nghĩa từ baseline Tuần 3 với đầy đủ các thuộc tính cốt lõi của giải thuật FSRS:
- `stability`: Độ bền vững của trí nhớ ($S \ge 0$).
- `difficulty`: Độ khó của thẻ từ ($D \ge 0$).
- `repetitions`: Số lần ôn tập thành công liên tiếp.
- `lapses`: Số lần quên (chọn Again).
- `fsrs_state`: Trạng thái thẻ (`NEW`, `LEARNING`, `REVIEW`, `RELEARNING`).
- `due_at`: Thời điểm đến hạn ôn tập tiếp theo.
- `rating`: Đánh giá của người học (`AGAIN`, `HARD`, `GOOD`, `EASY`).
- `scheduler_version`: Phiên bản thuật toán scheduler.

### 5.2. Backend: Hoàn toàn chưa có mã nguồn (0%)
- Chưa có Entity JPA / Record model cho `review_cards` và `review_logs`.
- Chưa có Repository truy vấn thẻ đến hạn (`due_at <= now()`).
- Chưa có Service tính toán công thức FSRS (các hệ số $w_0, \dots, w_{18}$, cập nhật $S, D$, tính interval và `next_due_at`).
- Chưa có REST Controller cung cấp API ôn tập cho mobile client.

### 5.3. Frontend: Giao diện giả lập (Mock UI)
- `ReviewScreen` hiển thị dữ liệu tĩnh từ `demo.ts`.
- Màn hình Flashcard tuy có 4 nút `Again`, `Hard`, `Good`, `Easy`, nhưng:
  - `Again` chỉ đẩy ID từ vào mảng `deferredIds` trong state React của client để lặp lại trong phiên hiện tại.
  - `Hard`, `Good`, `Easy` đều gọi chung endpoint `/api/v1/decks/{id}/study-progress` chỉ cập nhật trường `user_word_progress.last_studied_at`. Xếp loại đánh giá không được gửi lên server và không tác động đến FSRS.

---

## 6. RỦI RO KỸ THUẬT & TECHNICAL DEBT (RISKS & DEBT)

1. **Phiên bản Spring Boot 4.1.2 & Java 21**:
   - Dự án dùng Spring Boot 4.1.2 (dựa trên Spring 7). Phải đặc biệt cẩn trọng với các thư viện bên ngoài; ví dụ Jackson phải import từ `tools.jackson.databind.*` thay vì `com.fasterxml.jackson.*`. Không tự ý nâng cấp hay thêm starter không tương thích.
2. **Quy tắc bất biến Schema Baseline**:
   - Yêu cầu bắt buộc là không sửa đổi schema baseline Tuần 3. Khi triển khai FSRS, phải tận dụng nguyên vẹn cấu trúc các cột trong `review_cards` và `review_logs`.
3. **Ràng buộc Trigger PostgreSQL**:
   - Bất kỳ thao tác xóa thẻ `review_cards` (nếu có lịch sử) hoặc `review_logs` bằng code Java sẽ bị trigger `protect_review_history()` ném lỗi SQL Exception. Logic nghiệp vụ chỉ được cập nhật trạng thái (`UPDATE`), không được xóa vật lý.
4. **Tách biệt giữa Tiến độ học sơ khởi (Deck Progress) và Ôn tập ngắt quãng (FSRS Review)**:
   - Hiện tại `user_word_progress` dùng để xác định người học đã "học xong" 15 từ của Deck để mở khóa Quiz.
   - Thẻ FSRS `review_cards` phục vụ việc ôn tập đường dài cho tất cả các từ đã học. Cần xây dựng cơ chế tự động khởi tạo bản ghi `review_cards` (trạng thái `NEW` hoặc `LEARNING`) khi người học hoàn thành lần học đầu tiên trên Flashcard của Deck.
5. **Thiếu kiểm thử tự động trên Frontend**:
   - Frontend hoàn toàn chưa cài đặt Jest / React Native Testing Library. Toàn bộ xác thực phía client hiện phụ thuộc vào `tsc --noEmit` và `expo lint`.

---

## 7. ĐỀ XUẤT KẾ HOẠCH TRIỂN KHAI FSRS (RECOMMENDED PLAN)

Khi được USER phê duyệt bắt đầu code, thứ tự triển khai FSRS tối ưu như sau:

### Bước 1: Backend Domain & Thuật toán FSRS
1. Tạo package `com.englishlearning.fsrs`.
2. Tạo Entity hoặc Record mapping với 2 bảng `review_cards` và `review_logs`.
3. Tạo `FsrsAlgorithmService`: Hiện thực công thức tính toán chuẩn FSRS (Memory Stability, Difficulty, Retrievability, Scheduling Intervals dựa trên 4 ratings: AGAIN, HARD, GOOD, EASY).
4. Tạo `FsrsRepository` (sử dụng `JdbcClient` hoặc Spring Data JPA) với các truy vấn:
   - Lấy danh sách thẻ đến hạn ôn tập (`due_at <= now()`) của user, sắp xếp theo độ ưu tiên.
   - Lấy thống kê số lượng thẻ theo trạng thái (Due, New, Learning, Review).
   - Ghi nhận lượt ôn tập vào `review_logs` và cập nhật `review_cards`.
   - Khởi tạo hoặc cập nhật `review_cards` khi từ vựng được học.
5. Viết unit tests chuyên biệt cho thuật toán FSRS đảm bảo tính chính xác toán học.

### Bước 2: Backend REST APIs
1. Xây dựng `FsrsController` với các endpoint chuẩn:
   - `GET /api/v1/fsrs/summary`: Trả về số lượng từ cần ôn hôm nay, số từ mới, đang học, đã thuộc.
   - `GET /api/v1/fsrs/cards/due`: Lấy danh sách các từ vựng đến hạn cần ôn tập (kèm đầy đủ thông tin từ vựng, audio, ví dụ).
   - `POST /api/v1/fsrs/cards/{wordId}/review`: Gửi đánh giá (`AGAIN`, `HARD`, `GOOD`, `EASY`), tính toán và trả về kết quả interval mới + ngày đến hạn tiếp theo.
2. Tích hợp kiểm tra quyền qua Bearer JWT (`@AuthenticationPrincipal Jwt jwt`).

### Bước 3: Frontend Integration & UI FSRS
1. Tạo `src/features/fsrs/`:
   - `models/fsrs.ts`: Types cho ReviewCard, ReviewLog, ReviewRating, FsrsSummary.
   - `repositories/fsrs-repository.ts`: Giao tiếp với các endpoint FSRS.
   - `hooks/use-fsrs-review-view-model.ts`: Quản lý state của phiên ôn tập SRS (danh sách thẻ đến hạn, lật thẻ, tính điểm, ghi nhận kết quả).
2. Nối màn hình `src/screens/review-screen.tsx` với API thật: hiển thị số thẻ cần ôn thật thay vì số mock `24`.
3. Xây dựng luồng ôn tập chi tiết khi người dùng nhấn "Bắt đầu ôn tập": hiển thị flashcard ôn tập kèm 4 nút rating gửi API thật về Backend.
4. Cập nhật thẻ "Ôn tập SRS" và widget thống kê trên `src/screens/home-screen.tsx` để hiển thị số lượng từ đến hạn thực tế từ Backend.

---
*Báo cáo kiểm toán & bàn giao đã sẵn sàng. Hệ thống dừng chờ phản hồi và phê duyệt từ USER.*
