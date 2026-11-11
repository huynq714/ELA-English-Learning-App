# Giải thích Database — source of truth là `schema.sql`

Schema v1.1 có 16 bảng và 19 FK. DBML là biểu diễn ERD, nhưng SQL là nguồn đầy đủ hơn cho CHECK, trigger, DEFERRABLE, index và hành vi xóa. Thiết kế bao phủ sáu module; đó **không** có nghĩa cả sáu module đã có Backend API.

## 16 bảng: vai trò, khóa và quyết định

| Bảng | Nghiệp vụ / vì sao tách | Khóa, ràng buộc đáng chú ý | Ví dụ / nếu bỏ |
|---|---|---|---|
| `users` | Định danh tài khoản và thuộc tính đăng nhập chung. Tách Profile để phần hồ sơ học tập tùy chọn. | UUID PK sinh `gen_random_uuid`; email NOT NULL; unique index trên `lower(email)`; status ACTIVE/DISABLED; timestamps mặc định now. | `a@example.test`, ACTIVE. Bỏ thì mọi dữ liệu mất chủ sở hữu. |
| `user_profiles` | Tùy chọn mở rộng hồ sơ học tập 1–0..1, tránh nhồi cột tùy chọn vào tài khoản. | `user_id` đồng thời PK và FK `users`, CASCADE; level A1–C2; goal 5–240; default A1/15. | user X, B1, 20. Bỏ thì không có nơi lưu mục tiêu/avatar. |
| `decks` | Bộ nội dung có thể publish/ẩn, độc lập với từ gốc. | UUID PK; title NOT NULL ≤120; level CHECK; publish DEFAULT true; created_at. Không có unique title. | “Travel A1”. Bỏ thì không tổ chức nội dung. |
| `words` | Từ gốc dùng lại được nhiều Deck và hoạt động học. | UUID PK; headword ≤120; meaning_vi NOT NULL; IPA/examples/audio nullable. | `journey`, “hành trình”. Bỏ thì phải nhúng lặp từ vào từng Deck. |
| `deck_words` | Liên kết N–N Deck/Word, lưu thứ tự riêng trong từng Deck. | PK ghép `(deck_id, word_id)`; FK Deck CASCADE, Word RESTRICT; sort_order ≥0 default 0. | Deck A dùng journey ở vị trí 3. Bỏ thì không biểu diễn được nhiều Deck cùng dùng một Word. |
| `user_word_progress` | Ghi nhận người dùng đã gặp/ôn từ ở mức tiến độ chung. | PK `(user_id, word_id)`; user CASCADE, word RESTRICT; last_studied ≥ first_seen. | User X đã xem journey. Bỏ thì mất tiến độ cơ bản, nhưng vẫn cần phân biệt với FSRS. |
| `quiz_attempts` | Một lần làm Quiz, trạng thái và điểm tổng. | UUID PK; user CASCADE; deck RESTRICT; total_questions =5; trạng thái/điểm/thời gian CHECK. | User làm Deck A, IN_PROGRESS. Bỏ thì không nhóm được câu trả lời theo lần làm. |
| `quiz_answers` | Một đáp án theo câu hỏi trong attempt. Tách để mỗi câu là một hàng có thể FK/index/kiểm tra. | UUID PK; attempt CASCADE; word RESTRICT; question_no 1–5; UNIQUE `(attempt_id, question_no)`; answer, is_correct NOT NULL. | câu 1 chọn journey, đúng. JSON một cột khó kiểm tra số câu/FK/truy vấn. |
| `review_cards` | Trạng thái FSRS hiện tại cho mỗi cặp user–word. | PK ghép `(user_id, word_id)`; user CASCADE, word RESTRICT; state enum bằng CHECK; repetitions/lapses ≥0; ổn định/độ khó hữu hạn, ≥0. | user X–journey, REVIEW, due_at. Bỏ thì scheduler không có state hiện hành. |
| `review_logs` | Sự kiện review bất biến theo thời gian; khác card hiện tại. | UUID PK; FK ghép `(user_id, word_id)` → review_cards, CASCADE; rating CHECK; next_due_at ≥ reviewed_at; trigger chặn xóa trực tiếp. | GOOD lúc 10:00, lịch tiếp theo ngày mai. Bỏ thì không có audit/provenance. |
| `ipa_sounds` | Danh mục phoneme/âm chuẩn dùng lại. | UUID PK; `symbol` NOT NULL UNIQUE; `sound_type` VOWEL/CONSONANT. | /iː/ vowel. Bỏ thì phải nhập lại metadata âm ở mỗi attempt. |
| `pronunciation_attempts` | Lịch sử nhiều lần luyện/phát âm, không ghi đè lần trước. | UUID PK; user CASCADE; sound/word nullable SET NULL; score 0–100; result PENDING/PASSED/FAILED/ERROR; feedback JSONB; CHECK score/result. | attempt đọc từ `word`; xóa sound thì attempt vẫn còn, FK thành NULL. |
| `conversation_scenarios` | Nội dung mẫu Role-play độc lập với session. | UUID PK; title, initial_prompt; level CHECK; active default true. Không có user FK. | “Order coffee”. Bỏ thì phải lưu prompt lặp ở từng session. |
| `conversation_sessions` | Một phiên hội thoại, chế độ, trạng thái và report. | UUID PK; user CASCADE; scenario nullable RESTRICT; ROLE_PLAY bắt buộc scenario; hoàn thành cần ≥5 turns, ended_at, report_json; thời gian CHECK. | FREE_TALK in progress. Bỏ thì không phân nhóm messages thành phiên. |
| `conversation_messages` | Mỗi phát ngôn USER/AI theo thứ tự/thời gian. | UUID PK; session CASCADE; sender USER/AI; content NOT NULL; trigger validate số USER và khóa lịch sử hoàn tất. | Message thứ 1 của user. Bỏ thì không có transcript chuẩn hóa. |
| `conversation_turn_feedback` | Phản hồi gắn với một message người học. | UUID PK; message_id NOT NULL UNIQUE FK CASCADE; trigger chỉ cho sender USER. Feedback có thể là text và JSONB. | góp ý grammar cho message USER. Bỏ thì khó gắn feedback vào đúng lượt. |

Schema không đặt UNIQUE cho `decks.title` hoặc `words.headword`; không nên hứa rằng trùng tên/từ sẽ bị DB từ chối. `users.email` được unique theo chữ thường qua unique **index**, dù không khai báo `UNIQUE CONSTRAINT` thông thường.

## Truy vấn minh họa theo từng bảng

```sql
-- users
SELECT id,email,status FROM users WHERE lower(email)=lower('demo@example.test');
-- user_profiles
SELECT u.email,p.english_level,p.daily_goal_minutes FROM users u JOIN user_profiles p ON p.user_id=u.id;
-- decks
SELECT id,title,level FROM decks WHERE is_published ORDER BY created_at DESC;
-- words
SELECT id,headword,meaning_vi FROM words WHERE headword='journey';
-- deck_words
SELECT d.title,w.headword,dw.sort_order FROM deck_words dw JOIN decks d ON d.id=dw.deck_id JOIN words w ON w.id=dw.word_id WHERE d.id='<deck_uuid>' ORDER BY dw.sort_order;
-- user_word_progress
SELECT * FROM user_word_progress WHERE user_id='<user_uuid>' AND word_id='<word_uuid>';
-- quiz_attempts
SELECT id,status,correct_count,started_at FROM quiz_attempts WHERE user_id='<user_uuid>' ORDER BY started_at DESC;
-- quiz_answers
SELECT question_no,word_id,selected_answer,is_correct FROM quiz_answers WHERE attempt_id='<attempt_uuid>' ORDER BY question_no;
-- review_cards
SELECT word_id,fsrs_state,due_at FROM review_cards WHERE user_id='<user_uuid>' ORDER BY due_at;
-- review_logs
SELECT rating,reviewed_at,previous_due_at,next_due_at FROM review_logs WHERE user_id='<user_uuid>' AND word_id='<word_uuid>' ORDER BY reviewed_at;
-- ipa_sounds
SELECT symbol,sound_type,sample_word FROM ipa_sounds WHERE symbol='/iː/';
-- pronunciation_attempts
SELECT result,assessment_score,created_at FROM pronunciation_attempts WHERE user_id='<user_uuid>' ORDER BY created_at DESC;
-- conversation_scenarios
SELECT id,title,difficulty FROM conversation_scenarios WHERE is_active;
-- conversation_sessions
SELECT id,mode,status,valid_user_turns FROM conversation_sessions WHERE user_id='<user_uuid>' ORDER BY started_at DESC;
-- conversation_messages
SELECT sender,content,created_at FROM conversation_messages WHERE session_id='<session_uuid>' ORDER BY created_at,id;
-- conversation_turn_feedback
SELECT f.grammar_feedback,f.vocabulary_feedback FROM conversation_turn_feedback f WHERE f.message_id='<message_uuid>';
```

Thay các giá trị `<...>` bằng UUID thật trước khi chạy. Tránh lệnh ghi/xóa trên dữ liệu demo quan trọng.

## Đầy đủ 19 Foreign Keys

| # | Cha ← con FK | Bội số / bắt buộc | ON DELETE | Lý do và lưu ý |
|---:|---|---|---|---|
|1|users ← user_profiles.user_id|1–0..1, FK NOT NULL + PK|CASCADE|Profile phụ thuộc vòng đời User. |
|2|decks ← deck_words.deck_id|1–0..N, NOT NULL|CASCADE|Xóa Deck xóa liên kết, không xóa Words. |
|3|words ← deck_words.word_id|1–0..N, NOT NULL|RESTRICT|Không xóa Word còn trong Deck. |
|4|users ← user_word_progress.user_id|1–0..N, NOT NULL|CASCADE|Tiến độ thuộc tài khoản. |
|5|words ← user_word_progress.word_id|1–0..N, NOT NULL|RESTRICT|Bảo vệ tiến độ học. |
|6|users ← quiz_attempts.user_id|1–0..N, NOT NULL|CASCADE|Attempt thuộc User. Trigger cho phép cascade cha. |
|7|decks ← quiz_attempts.deck_id|1–0..N, NOT NULL|RESTRICT|Bảo vệ ngữ cảnh Quiz. |
|8|quiz_attempts ← quiz_answers.attempt_id|1–0..N, NOT NULL|CASCADE|Đáp án thuộc attempt. |
|9|words ← quiz_answers.word_id|1–0..N, NOT NULL|RESTRICT|Bảo vệ tham chiếu câu hỏi. |
|10|users ← review_cards.user_id|1–0..N, NOT NULL|CASCADE|Card riêng từng user. |
|11|words ← review_cards.word_id|1–0..N, NOT NULL|RESTRICT|Bảo vệ state ôn từ. |
|12|review_cards ← review_logs.(user_id,word_id)|1–0..N, cả 2 NOT NULL|CASCADE|FK ghép chỉ cho phép log của đúng card. Trigger chặn direct delete nhưng bỏ qua cascade sâu. |
|13|users ← pronunciation_attempts.user_id|1–0..N, NOT NULL|CASCADE|Lịch sử thuộc User. |
|14|ipa_sounds ← pronunciation_attempts.ipa_sound_id|1–0..N, nullable|SET NULL|Giữ attempt nếu danh mục âm bị xóa. |
|15|words ← pronunciation_attempts.word_id|1–0..N, nullable|SET NULL|Giữ attempt độc lập với Word. |
|16|users ← conversation_sessions.user_id|1–0..N, NOT NULL|CASCADE|Session thuộc User. |
|17|conversation_scenarios ← conversation_sessions.scenario_id|1–0..N, nullable|RESTRICT|Scenario có thể không dùng; nếu đang được dùng thì không xóa. |
|18|conversation_sessions ← conversation_messages.session_id|1–0..N, NOT NULL|CASCADE|Message thuộc session. |
|19|conversation_messages ← feedback.message_id|1–0..1, NOT NULL + UNIQUE|CASCADE|Tối đa một feedback/message; trigger buộc message USER. |

Deck–Word là N–N vì một Deck có nhiều Word và một Word có thể nằm trong nhiều Deck. `deck_words` không nhân bản nghĩa/IPA; PK ghép cấm liên kết trùng cùng một cặp, `sort_order` là vị trí trong Deck.

`users`–`user_profiles` không đảm bảo mỗi user đã có profile: 0 hoặc 1. PK/FK kép ngăn hai Profile cho cùng user. Muốn nhiều hồ sơ theo thời điểm phải đổi PK, thêm surrogate ID và UNIQUE có điều kiện/business key; đó là thay đổi nghiệp vụ/schema.

## FK ghép FSRS: vì sao quan trọng?

`review_cards` PK `(user_id, word_id)` nghĩa là card là trạng thái duy nhất cho mỗi User–Word. `review_logs` lưu lại đúng cặp. Nếu log chỉ FK `word_id`, log có thể ghi nhận card của user khác; nếu chỉ FK `user_id`, không chứng minh Word có card đó. PK cha và FK con cùng hai cột ngăn trạng thái/lịch sử lệch nhau.

## Quiz/Conversation: constraints và deferred triggers

- CHECK thực thi tức thì các điều kiện một hàng: Quiz có đúng 5 câu thiết kế, status/score/completed_at phù hợp; `question_no` 1–5; Conversation ROLE_PLAY phải có scenario, hoàn tất cần tối thiểu 5 turns/report/ended_at.
- CHECK không đếm được hàng con. Hai constraint trigger deferred cho Quiz kiểm tra tại COMMIT: có đúng 5 answers và `correct_count` bằng số `is_correct`. Vì kiểm tra sau toàn bộ transaction, có thể insert attempt, 5 answers, rồi mark completed.
- Hai constraint trigger deferred Conversation kiểm tra COMMIT: session completed có ít nhất 5 message USER và `valid_user_turns` bằng số message USER.
- Trigger bảo vệ attempt/answer đã hoàn thành, message/session đã hoàn thành khỏi sửa/xóa trực tiếp. Các trigger dùng `pg_trigger_depth()` để cascade xóa toàn tài khoản không bị chặn bởi guard lịch sử. `test_user_cascade.sql` là bằng chứng workflow test chuyên biệt; khi trình bày, nói cả FK actions lẫn trigger exception, không nói “CASCADE tự động chắc chắn đủ”.
- `protect_review_history` chặn xóa card có log trực tiếp; `protect_review_logs` chặn xóa log trực tiếp; nested cascade account được bỏ qua theo trigger depth.

## Các quyết định nghiệp vụ quan trọng

- Xóa Deck qua API là soft delete: `is_published=false`. Điều này giữ FK và lịch sử Quiz đang `RESTRICT` tới Deck. Không phải quy tắc DB bắt buộc; đó là hành vi Service/API.
- Word được `RESTRICT` ở deck_words/progress/quiz_answers/review_cards để không làm mất lịch sử học hoặc nội dung. Xóa liên kết Deck–Word chỉ xóa hàng `deck_words`.
- Role-play cần scenario, Free-talk có thể NULL scenario; CHECK không cấm Free-talk có scenario.
- IPA attempt có hai FK nullable độc lập; schema cho phép cả hai cùng NULL hoặc cùng có giá trị. Nếu business muốn exactly-one-target, cần thêm CHECK ở phiên bản schema sau; hiện chưa có.
- JSONB chỉ ở feedback/report/AI assessment nơi cấu trúc kết quả có thể biến đổi; các quan hệ và dữ liệu cần FK vẫn ở cột/bảng chuẩn hóa.

## Chuẩn hóa và đánh đổi

- 1NF: mỗi hàng giữ giá trị nguyên tử cho các trường nghiệp vụ; transcript/answers không gói thành danh sách trong một cột. JSONB là ngoại lệ có chủ đích cho payload linh hoạt, không dùng để thay quan hệ FK.
- 2NF: bảng nối dùng PK ghép; `sort_order` phụ thuộc vào liên kết Deck–Word (vị trí của Word trong Deck), còn metadata của Word ở `words`, không phụ thuộc một phần khóa nối.
- 3NF: thông tin Profile, danh mục âm, Scenario và nội dung từ tách khỏi các fact học/review/session để giảm lặp. Có snapshot/report JSON nếu cần giữ kết quả tại thời điểm hoàn thành; đó là chủ ý lưu kết quả, không phải chuẩn hóa mọi thứ tuyệt đối.
- Không tuyên bố chứng minh 3NF hình thức cho mọi cột nếu chưa lập đầy đủ phụ thuộc hàm. Các cột tổng hợp như `correct_count`, `valid_user_turns` được lặp có kiểm soát, trigger đối chiếu nguồn chi tiết để tránh lệch.
- Index phục vụ tìm FK/thứ tự/thời gian hay dùng; index cũng làm tăng chi phí INSERT/UPDATE và lưu trữ. Triggers/constraints tăng toàn vẹn nhưng thêm độ phức tạp transaction.

## Các lỗi bảo vệ thường gặp

1. “Schema có 6 module tức là backend đã có đủ 6 API” — sai. API triển khai hiện chỉ Health, Deck, Profile demo; phần còn lại mới là schema/nghiệp vụ thiết kế.
2. “Email có UNIQUE constraint” — chính xác hơn: unique expression index `lower(email)`; biểu diễn ERD có thể ghi index unique.
3. “Mọi pronunciation attempt bắt buộc có một target” — không đúng với SQL hiện tại.
4. “Deleted Deck đã mất khỏi database” — không; API chỉ unpublish, dữ liệu còn.
5. “1 user chắc chắn có 1 Profile” — tối đa một, Profile có thể chưa tồn tại.
6. “Xóa User chắc chắn do FK cascade” — phải nêu cascade paths và trigger depth; test cascade file kiểm tra kết quả trên isolated fixtures.
