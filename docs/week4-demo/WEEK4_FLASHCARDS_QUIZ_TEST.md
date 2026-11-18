# Week 4 · Flashcards và Quiz

## Audit

| Trạng thái | Kết quả |
| --- | --- |
| ALREADY DONE | Flashcards tải Word từ API Deck công bố, có IPA nếu có, ví dụ song ngữ, lật thẻ và điều hướng trước/sau. JWT đã xác thực tài khoản. Schema Week 3 có `user_word_progress`, `quiz_attempts`, `quiz_answers` và trigger kiểm tra 5 đáp án, điểm đúng tại COMMIT. |
| MISSING trước Task 03 | Lưu vị trí học theo tài khoản, tạo đề, API nộp và đọc kết quả, bảo vệ bản ghi hoàn thành, UI Quiz và ôn lại trước khi thi lại. |
| BLOCKED trên database phát triển | PostgreSQL native đang chạy. Phiên kiểm thử thiếu thông tin kết nối an toàn của `english_learning_db`. Các bước ghi và kiểm chứng dùng PostgreSQL 18 cô lập, nạp dữ liệu thật từ script import đã có. |

## Nghiệp vụ

- Mặt trước Flashcard hiện từ và IPA, với ví dụ tiếng Anh bên dưới. Chạm vào khung thẻ để xoay sang mặt nghĩa và xem bản dịch ví dụ nếu có. Thẻ kế tiếp luôn mở ở mặt trước. Nút loa dùng giọng tiếng Anh của thiết bị cho từ và câu ví dụ. Nghĩa tiếng Việt cần trạng thái `VERIFIED`; nếu thiếu thì dùng định nghĩa tiếng Anh khi có.
- **Again** đưa thẻ về cuối lượt. **Hard**, **Good** và **Easy** ghi lượt học vào `user_word_progress` và chuyển sang thẻ kế tiếp. Khi mở lại, lượt học ưu tiên các thẻ chưa học hoặc cần ôn. Khi hết thẻ, app hiện màn **Đã học xong** với nút **Làm Quiz** cho Deck đủ điều kiện. Backend kiểm tra tiến độ theo tài khoản và lấy từ có bản dịch `VERIFIED` để sinh 5 câu, mỗi câu có 4 lựa chọn.
- Lần đầu hỏi Anh → Việt. Đề mới đảo chiều và xáo trộn câu, phương án. Nếu điểm dưới 3/5, người học phải đánh giá lại các thẻ của bài vừa làm còn trong Deck sau thời điểm nộp để mở lượt thi tiếp. Trong bộ 5 từ, các lượt cùng dùng đủ 5 từ và đổi thứ tự.
- Backend cấp đề theo JWT. Bản lưu đề trong `quiz_attempts.question_snapshot` giữ nguyên câu, thứ tự lựa chọn và đáp án. Khi người học chọn, Backend lưu lựa chọn đầu tiên vào `quiz_answers` rồi trả phản hồi để app hiện đúng, sai và đáp án đúng dưới các lựa chọn. API chỉ trả đáp án đúng cho các câu đã được người học trả lời.
- PASS khi từ 3/5. Khi nộp, Backend kiểm tra đủ 5 đáp án và đối chiếu các câu đã chấm trước khi lưu điểm. Nộp lại cùng attempt trả kết quả đã lưu. Khi mở lại Quiz đang làm, Backend trả đề và các câu đã chấm để app tiếp tục. Nếu mất mạng khi chấm một câu, app cho thử lại cùng lựa chọn.

## API

Các endpoint dưới đây dùng `Authorization: Bearer <jwt>`.

| Phương thức và đường dẫn | Hành vi |
| --- | --- |
| `GET /api/v1/decks/{id}/study-progress` | Trả `lastStudiedWordId`, `unstudiedWordIds` và `remainingReviewWordIds`. |
| `POST /api/v1/decks/{id}/study-progress` | Ghi lượt học với body `{"wordId":"<id>"}`. Chỉ nhận từ thuộc Deck công bố. |
| `POST /api/v1/quiz/attempts` | Nhận `{"deckId":"<id>"}`. Trả đề đang làm và phản hồi đã chấm hoặc tạo đề mới. HTTP 409 khi còn thẻ chưa học hoặc cần ôn lại, 422 khi thiếu từ/phương án, 404 khi Deck không khả dụng. |
| `POST /api/v1/quiz/attempts/{id}/answers` | Nhận một cặp `questionNo` (1–5) và `optionIndex` (0–3). Trả lựa chọn đã lưu, đáp án đúng và trạng thái đúng/sai cho câu đó. |
| `POST /api/v1/quiz/attempts/{id}/submit` | Nhận đủ 5 lựa chọn. Câu đã chấm phải khớp lựa chọn đã lưu. Backend trả số câu đúng, tỷ lệ và trạng thái đạt. |
| `GET /api/v1/quiz/attempts/{id}/result` | Đọc kết quả của tài khoản hiện tại. Attempt đang làm trả 409. Attempt của tài khoản khác trả 404. |

## Tệp liên quan

- `backend/src/main/java/com/englishlearning/quiz/` chứa Controller, Service, Repository, bộ sinh câu hỏi và DTO.
- `database/week4/migrations/V1_3__quiz_question_snapshot.sql` lưu đề và bảo vệ điểm, đáp án của bài đã chấm. Migration chạy bên cạnh schema Week 3 và migration Vocabulary.
- `src/screens/flashcard-screen.tsx`, `src/screens/quiz-screen.tsx`, `src/features/quiz/` và hook `use-study-progress.ts` nối API với giao diện Expo Router.
- `backend/scripts/test-auth-profile.ps1`, `test_quiz.py`, `test-quiz-web.cjs` chạy PostgreSQL, Backend và kịch bản HTTP/SQL hoặc trình duyệt.

## Kết quả kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Maven | PASS · 22 test hiện có. |
| API và PostgreSQL 18 cô lập | PASS · Chặn tạo Quiz khi còn thẻ chưa học, kể cả với tài khoản khác. Đã kiểm tra đúng/sai từng câu, giữ lựa chọn đầu tiên khi gửi lại, từ chối nộp đáp án đã bị thay đổi, điểm 0/2/3/5, ôn lại sau FAIL và nộp đồng thời. |
| PostgreSQL COMMIT | PASS · Giao dịch đánh dấu COMPLETED với một đáp án bị chặn tại COMMIT; kiểm tra lại còn IN_PROGRESS và 0 đáp án. UPDATE điểm hoặc đáp án đã chấm bị chặn. |
| Khởi động lại Backend | PASS · Đọc lại 4 lần làm đã hoàn thành với 20 đáp án, cùng đề đang làm với 1 câu đã chấm. Cơ sở dữ liệu cô lập vẫn có 43 từ Vocabulary. |
| TypeScript và ESLint | PASS · `npx.cmd tsc --noEmit`, `npx.cmd expo lint`. |
| Flashcards và Quiz trên Edge | PASS · Kiểm tra hiệu ứng xoay, ẩn nghĩa và bản dịch ở mặt trước, hiện chúng ở mặt sau rồi đặt lại khi chuyển thẻ. Again đưa thẻ đầu về cuối lượt. Đã chạy cả luồng làm Quiz, ôn và thi lại. |
| Lỗi mạng và HTTP trên giao diện | PASS · Mô phỏng mất mạng, 404, 500 khi tải và 401 để kiểm tra phiên. Đã ngắt phản hồi sau khi Backend nhận và lưu bài. App giữ đáp án, gửi lại và nhận kết quả lần nộp trước. |
| Expo export iOS | PASS ở bản Task 03 trước khi bổ sung mở khóa và phản hồi từng câu. |
| Expo Go trên điện thoại | Chưa chạy với Task 03. |

Lượt E2E đầu phát hiện Expo Router chọn tab AI sau khi đăng nhập trên web. Nhóm route khách đã được đặt đích cố định về Trang chủ khi có phiên.

### Chạy lại bộ kiểm thử

```powershell
mvn.cmd -o -f backend/pom.xml test
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/scripts/test-auth-profile.ps1 -Suite Quiz
```

Script dùng PostgreSQL 18 native và Python, tự tạo database cô lập. Để chạy thêm UI trên Microsoft Edge headless, cài Playwright vào thư mục tạm rồi chạy cùng suite với `-Web`.

```powershell
npm.cmd install --no-save --prefix .artifacts/quiz-tools playwright-core
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/scripts/test-auth-profile.ps1 -Suite Quiz -Web
```

### Demo với pgAdmin và Expo Go

1. Trong Query Tool của `english_learning_db`, chạy toàn bộ [migration Quiz](../../database/week4/migrations/V1_3__quiz_question_snapshot.sql). Database mới cần schema Week 3, migration V1_2 và [dữ liệu Vocabulary](VOCABULARY_IMPORT_GUIDE.md). Kiểm tra endpoint Health sau khi khởi động Backend.
2. Khởi động Backend và Expo theo [hướng dẫn chạy qua LAN](WEEK4_AUTH_PROFILE_TEST.md#kịch-bản-demo-bằng-expo-go). Đăng nhập và mở **Từ vựng → A1 – Core Vocabulary 03**. Chạm vào khung thẻ để xem nghĩa. Nghe từ và ví dụ bằng nút loa. Bấm **Again** để đưa thẻ về cuối, hoặc **Hard**, **Good**, **Easy** để lưu và chuyển tiếp. Khi hiện **Đã học xong**, chọn **Làm Quiz → Bắt đầu**.
3. Chọn thử một đáp án đúng và một đáp án sai để kiểm tra phản hồi ngay dưới lựa chọn. Bấm **Tiếp theo**, rồi **Nộp bài** ở câu cuối. Thử một lượt dưới 3 câu đúng. Bấm **Ôn lại Flashcards** rồi đánh giá hết các thẻ được đưa ra. Khi đủ, mở lại Quiz và kiểm tra chiều Việt → Anh. Đạt từ 3 câu đúng để thử nút **Hoàn thành**.
4. Chạy câu SQL sau trong pgAdmin để đối chiếu kết quả và số đáp án. Thay email mẫu bằng email dùng trong app.

```sql
SELECT qa.id, d.title, qa.status, qa.correct_count, qa.total_questions,
       qa.completed_at,
       (SELECT count(*) FROM quiz_answers a WHERE a.attempt_id = qa.id) AS saved_answers
FROM quiz_attempts qa
JOIN users u ON u.id = qa.user_id
JOIN decks d ON d.id = qa.deck_id
WHERE lower(u.email) = lower('EMAIL_DA_DANG_NHAP')
ORDER BY qa.started_at DESC;
```
