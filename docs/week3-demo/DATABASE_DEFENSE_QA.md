# Câu hỏi phản biện Database/Backend — 40 câu

Lời đáp mẫu ngắn để nói miệng; phần **Giải thích/Bằng chứng** giúp trả lời câu hỏi nối tiếp. Dẫn chứng theo SQL v1.1, không suy từ sơ đồ alone.

## Cơ bản

### 1. Database có bao nhiêu bảng và chia module thế nào?
**Nói:** SQL có 16 bảng: tài khoản/profile, từ vựng, Quiz, FSRS, IPA và hội thoại AI. Đây là phạm vi thiết kế dữ liệu; Backend hiện mới triển khai Health, Deck và Profile test-local.
**Giải thích/Bằng chứng:** schema CREATE TABLE; xem `ERD_OVERVIEW.dbml`. **Tiếp:** module nào chạy API? — Deck/Profile, không phải toàn bộ sáu.

### 2. PK và FK khác nhau ra sao?
**Nói:** PK nhận diện duy nhất hàng; FK buộc giá trị con trỏ tới hàng cha hợp lệ hoặc NULL nếu cột nullable.
**Giải thích/Bằng chứng:** `users.id` PK; `quiz_attempts.user_id` NOT NULL FK. **Tiếp:** CHECK làm gì? kiểm tra điều kiện cùng hàng, không thay quan hệ.

### 3. Vì sao dùng UUID?
**Nói:** UUID giúp ID sinh độc lập trên nhiều nơi và không lộ số thứ tự dễ đoán; đổi lại dài hơn integer và cần cân nhắc index/storage.
**Giải thích/Bằng chứng:** phần lớn PK có DEFAULT `gen_random_uuid()` (pgcrypto). **Tiếp:** UUID chống truy cập trái phép không? Không; vẫn cần Auth/authorization.

### 4. Email có UNIQUE không?
**Nói:** Có unique expression index trên `lower(email)`, nên `A@x` và `a@x` được coi trùng. Gọi chính xác là unique index, không nhất thiết là UNIQUE constraint.
**Giải thích/Bằng chứng:** `uq_users_email_lower`. **Tiếp:** email được normalize trước lưu? Schema hiện không ép chữ thường; index chỉ bảo đảm uniqueness phân biệt hoa thường.

### 5. CHECK khác validation ở ứng dụng thế nào?
**Nói:** CHECK bảo vệ dữ liệu ở DB dù insert đến từ app nào; validation API trả lỗi thân thiện sớm. Hai lớp bổ sung nhau.
**Giải thích/Bằng chứng:** level enum, daily goal 5–240, Quiz status checks trong SQL; DTO có Jakarta Validation. **Tiếp:** CHECK có thể đếm answers không? Không, dùng deferred trigger.

### 6. Tại sao tách users và user_profiles?
**Nói:** Tách thông tin tài khoản khỏi thuộc tính học tập tùy chọn, giảm cột NULL và cho phép Profile chỉ tồn tại khi cần.
**Giải thích/Bằng chứng:** `user_profiles.user_id` vừa PK vừa FK. **Tiếp:** mỗi User có bắt buộc profile không? Không, 0 hoặc 1.

### 7. Vì sao user-profile là 1–0..1?
**Nói:** Một Profile chỉ gắn một User; PK trên `user_id` ngăn profile thứ hai. FK NOT NULL nghĩa mỗi profile có User, nhưng User không bắt buộc có profile.
**Giải thích/Bằng chứng:** PK/FK kép và CASCADE. **Tiếp:** muốn nhiều profile lịch sử? Thêm profile_id và model thời hạn/unique rule; cần đổi schema.

### 8. Vì sao cần deck_words?
**Nói:** Một Deck có nhiều Word, và một Word có thể tái sử dụng trong nhiều Deck. Bảng nối hiện thực N–N và lưu thứ tự từng Deck.
**Giải thích/Bằng chứng:** PK `(deck_id,word_id)`, `sort_order`. **Tiếp:** xóa link có xóa Word? Không; chỉ xóa hàng nối.

### 9. Tại sao PK ghép trong deck_words?
**Nói:** Cặp Deck–Word là danh tính liên kết và ngăn cùng một từ bị thêm hai lần vào cùng Deck.
**Giải thích/Bằng chứng:** PK ghép; Word vẫn có thể ở Deck khác. **Tiếp:** sort_order có unique không? Không, schema chỉ yêu cầu không âm.

### 10. `user_word_progress` khác review_cards thế nào?
**Nói:** Progress ghi nhận tiếp xúc/học cơ bản; review_cards lưu state scheduler FSRS và thời điểm đến hạn cho từng User–Word.
**Giải thích/Bằng chứng:** hai bảng và PK cặp riêng. **Tiếp:** có thể tạo progress mà chưa có card? Có, schema không FK giữa hai bảng.

## Trung bình

### 11. Vì sao cần review_logs nếu đã có review_cards?
**Nói:** Card là trạng thái mới nhất; log là lịch sử từng lần review. Ghi đè card không thể trả lời người học đã review thế nào trước đây.
**Giải thích/Bằng chứng:** card chứa due/stability/state; log chứa rating và previous/next due. **Tiếp:** lịch sử xóa trực tiếp được không? Trigger chặn.

### 12. Vì sao review_logs có FK ghép?
**Nói:** FK `(user_id,word_id)` buộc log gắn với đúng card của đúng người; FK đơn lẻ có thể ghép nhầm card của user khác.
**Giải thích/Bằng chứng:** `review_cards` có PK cùng cặp; test integrity báo PASS invalid card bị từ chối. **Tiếp:** xóa card thì log? CASCADE FK nhưng trigger chặn xóa trực tiếp khi có history.

### 13. User có thể xóa thẳng review_cards không?
**Nói:** Không nếu có log và thao tác trực tiếp: trigger bảo vệ lịch sử. Xóa tài khoản là workflow cascade riêng; trigger kiểm tra `pg_trigger_depth()` để không cản cascade.
**Giải thích/Bằng chứng:** `protect_review_history`, `protect_review_logs`, `test_user_cascade.sql`. **Tiếp:** cascade account đã kiểm chưa? Script test isolated kiểm tra nhiều bảng phụ thuộc và đã được báo PASS trong lần chạy trước; đừng suy từ FK đơn lẻ.

### 14. Quiz lưu mỗi answer thành hàng vì sao?
**Nói:** Mỗi answer có question number, Word FK và correctness riêng; DB dễ enforce 1–5, chống trùng câu, đếm điểm và truy vấn lịch sử hơn JSON blob.
**Giải thích/Bằng chứng:** `quiz_answers`, UNIQUE `(attempt_id,question_no)`. **Tiếp:** JSON có ưu điểm gì? Payload linh hoạt nhưng khó FK/constraint.

### 15. Vì sao mỗi Quiz có đúng 5 câu?
**Nói:** Đây là quyết định MVP trong SQL: `total_questions=5`, question number 1–5 và trigger yêu cầu 5 answer lúc hoàn tất.
**Giải thích/Bằng chứng:** CHECK + deferred trigger. **Tiếp:** tăng lên 10 thế nào? Thay CHECK, trigger và API/business rule cùng migration.

### 16. Vì sao trigger Quiz deferred?
**Nói:** Khi hoàn tất, nhiều thay đổi phải tạo thành một transaction hợp lệ: attempt, năm answers, rồi score/status. Deferred trigger kiểm tra tại COMMIT sau khi toàn bộ thay đổi đã có.
**Giải thích/Bằng chứng:** hai `DEFERRABLE INITIALLY DEFERRED` constraint triggers. **Tiếp:** nếu COMMIT sai? RAISE làm transaction thất bại/rollback.

### 17. `correct_count` có thể sai so với answers không?
**Nói:** Không ở trạng thái completed sau COMMIT: trigger đếm `is_correct` và so với score; CHECK cũng giới hạn điểm 0–5.
**Giải thích/Bằng chứng:** `validate_completed_quiz()`, test mismatch đã được báo lỗi tại COMMIT. **Tiếp:** đang in progress? Score/completed_at phải NULL theo CHECK.

### 18. FK quiz_answers → quiz_attempts CASCADE có xóa lịch sử?
**Nói:** Xóa attempt cha xóa answers; nhưng completed attempts có trigger chặn direct delete. Khi account cascade, trigger cho phép thao tác lồng sâu.
**Giải thích/Bằng chứng:** `protect_completed_quiz_history`, `protect_completed_quiz`, cascade depth branch; `test_user_cascade.sql`. **Tiếp:** xóa Deck? `quiz_attempts.deck_id` RESTRICT; API dùng soft delete.

### 19. Tại sao delete Deck là soft delete?
**Nói:** Lịch sử Quiz tham chiếu Deck bằng RESTRICT. Soft delete ẩn Deck khỏi list public mà giữ lịch sử và khóa ngoại.
**Giải thích/Bằng chứng:** Service `softDelete()` đặt `published=false`; public repository lọc `PublishedTrue`. **Tiếp:** DB có cột deleted_at? Không, dùng `is_published`.

### 20. Xóa Word có thể bị từ chối ở đâu?
**Nói:** Deck links, progress, quiz answers, review cards đều RESTRICT tới Word. Điều này giữ từ còn truy vết được trong học tập/lịch sử.
**Giải thích/Bằng chứng:** 4 FK RESTRICT; test workflow báo Word có lịch sử không xóa được. **Tiếp:** IPA attempt? FK `word_id` SET NULL, nên không chặn.

## Nâng cao

### 21. `ON DELETE CASCADE` nghĩa là luôn xóa được cha?
**Nói:** Không thể kết luận từ một FK. Phải xét mọi đường tham chiếu và trigger BEFORE/constraint; lịch sử có guard riêng. Workflow user cascade có test fixture chuyên biệt.
**Giải thích/Bằng chứng:** user cascade tới profile/progress/attempts/cards/sessions/attempts; nested delete guards dùng trigger depth; test cascade báo PASS lần trước. **Tiếp:** liệu dữ liệu dùng chung có bị xóa? Deck/Word/scenario không phải con cascade của User.

### 22. Scenario_id nullable nhưng Role-play cần scenario, sao?
**Nói:** Nullable cho FREE_TALK; CHECK `mode <> ROLE_PLAY OR scenario_id IS NOT NULL` áp yêu cầu role-play. Scenario đã được session dùng thì RESTRICT delete.
**Giải thích/Bằng chứng:** CHECK + FK RESTRICT; test scenario dùng bị xóa đã PASS. **Tiếp:** Free-talk có scenario không? SQL cho phép.

### 23. Conversation hoàn tất được xác minh thế nào?
**Nói:** CHECK yêu cầu ≥5 turns, ended_at và report_json; deferred triggers đếm message USER thật và bắt counter bằng số đó tại COMMIT.
**Giải thích/Bằng chứng:** `validate_completed_conversation()` trên session/messages; negative test commit thiếu turns. **Tiếp:** AI messages tính turn? Không, chỉ sender USER.

### 24. Vì sao feedback gắn message, không session?
**Nói:** Feedback phản hồi một phát ngôn cụ thể. FK UNIQUE cho tối đa một feedback/message; trigger chỉ cho message sender USER.
**Giải thích/Bằng chứng:** `conversation_turn_feedback.message_id`; update guard ngăn message có feedback đổi khỏi USER. **Tiếp:** session có nhiều feedback? Có, tối đa một cho mỗi message.

### 25. IPA attempt có bắt buộc word hoặc ipa_sound không?
**Nói:** Không theo SQL: cả hai FK nullable độc lập, mỗi FK SET NULL khi danh mục bị xóa. Schema cho phép cả hai cùng null hoặc cùng có; API cần quy định nếu nghiệp vụ muốn exactly one.
**Giải thích/Bằng chứng:** không có CHECK liên kết 2 cột. **Tiếp:** đây có phải bug? Không nhất thiết; là độ linh hoạt cần chốt nghiệp vụ.

### 26. Vì sao pronunciation_attempts lưu lịch sử?
**Nói:** Mỗi lần đọc có điểm/kết quả/feedback/audio riêng; lưu nhiều lần giúp theo dõi tiến bộ thay vì ghi đè lần gần nhất.
**Giải thích/Bằng chứng:** UUID attempt, user FK, created_at index. **Tiếp:** assessment engine có chưa? Không xác nhận Backend API trong source hiện tại.

### 27. JSONB được dùng chỗ nào và vì sao?
**Nói:** Feedback pronunciation, report hội thoại và feedback cấu trúc biến đổi; phần định danh/quan hệ vẫn là cột/FK để giữ toàn vẹn.
**Giải thích/Bằng chứng:** `feedback_json`, `report_json`. **Tiếp:** vì sao không JSON answers? Cần 5 FK, unique question, count/score check.

### 28. Schema có đạt 3NF không?
**Nói:** Thiết kế tách nhiều thực thể để giảm lặp và các bảng nối tuân theo khóa; nhưng em không khẳng định chứng minh hình thức 3NF cho mọi cột khi chưa lập đầy đủ phụ thuộc hàm.
**Giải thích/Bằng chứng:** user/profile, word/deck link, attempt/answers, card/log phân tách. Counter/report là snapshot/denormalization có kiểm tra. **Tiếp:** tradeoff? Dễ giữ dữ liệu nhất quán hơn, thêm join/trigger và chi phí.

### 29. Index là gì và vì sao 27 index?
**Nói:** Index giúp tìm/join/sort theo cột thường dùng; đổi lại chiếm storage và làm write chậm hơn. Con số 27 là phép đếm catalog đã báo ở lần kiểm chứng trước, không phải chỉ số hiệu năng.
**Giải thích/Bằng chứng:** FK, lịch sử theo user/thời gian, sort order; unique/PK cũng tạo index. **Tiếp:** cần benchmark gì? EXPLAIN ANALYZE trên truy vấn thật.

### 30. Email unique index có được đếm là UNIQUE constraint?
**Nói:** Catalog có thể báo 3 UNIQUE constraints, còn index `lower(email)` là unique index riêng. Cả hai enforce uniqueness nhưng catalog object type khác nhau.
**Giải thích/Bằng chứng:** `CREATE UNIQUE INDEX uq_users_email_lower`. **Tiếp:** đếm total enforcement? Kể thêm unique symbol, quiz question pair, feedback message.

## Tình huống khó / nghiệp vụ

### 31. Deck demo POST trả 201, DB thay đổi thế nào?
**Nói:** Controller validate DTO, Service trim/kiểm tra title, Repository lưu `decks`, trả DTO; response có ID và Location. DB generation/time phụ thuộc mapping server hiện tại.
**Giải thích/Bằng chứng:** DeckDevController→DeckService→JpaRepository; schema title/level/publish. **Tiếp:** SQL xác nhận? `SELECT id,title,is_published FROM decks WHERE id=...`.

### 32. API public có trả Deck chưa publish?
**Nói:** Không; `findAllByPublishedTrue...` và `findByIdAndPublishedTrue` lọc ở Repository. Dev DELETE chỉ đặt false.
**Giải thích/Bằng chứng:** DeckRepository/DeckService. **Tiếp:** database row bị xóa? Không.

### 33. Profile API có tạo User không?
**Nói:** Không. ProfileService tìm User trước; nếu không có thì 404 và không save Profile. FK cũng là lớp bảo vệ cuối.
**Giải thích/Bằng chứng:** `requireUser()` trong ProfileService; User chuẩn bị bằng SQL demo vì chưa có Auth/registration. **Tiếp:** Profile PUT khác PATCH? PUT upsert full fields; PATCH partial, khởi tạo A1/15 nếu thiếu.

### 34. `PUT /profile` trả 200 hay 201?
**Nói:** Source hiện trả DTO trực tiếp nên Spring trả 200. Đây là contract demo đang có; có thể cân nhắc 201 khi tạo mới nếu muốn phân biệt, nhưng chưa tuyên bố API hiện làm vậy.
**Giải thích/Bằng chứng:** ProfileDevController. **Tiếp:** id từ đâu? Path userId; không phải danh tính authenticated.

### 35. `/dev` an toàn chưa?
**Nói:** Không có Authentication/RBAC; chỉ đăng ký `@Profile("local")` để demo loopback. Không bật profile này khi mở LAN hay production.
**Giải thích/Bằng chứng:** hai DevController `@Profile("local")`; test context xác nhận bean vắng khi profile off. **Tiếp:** profile có thay thế Auth? Không.

### 36. Có thể nói sáu module đã hoàn thành không?
**Nói:** Không. Schema có sáu nhóm; API triển khai thật trong code là Health, Deck và Profile demo. Quiz/FSRS/IPA/Conversation hiện mới có mô hình dữ liệu/ràng buộc, chưa có REST flows đầy đủ.
**Giải thích/Bằng chứng:** source Controller hiện tại. **Tiếp:** kế hoạch? Từng module service/API, Auth, migration và integration tests.

### 37. Vì sao không để React Native kết nối PostgreSQL?
**Nói:** Ứng dụng mobile không nên giữ DB credentials/SQL quyền rộng. Backend kiểm tra quyền/validation, gom transaction, che schema và cung cấp API ổn định.
**Giải thích/Bằng chứng:** API client → Spring MVC → Service/Repository. **Tiếp:** offline thì sao? SQLite cache/outbox + sync, không thay server source of truth.

### 38. Vì sao JPA `ddl-auto=validate`?
**Nói:** Schema được quản lý SQL; Hibernate chỉ kiểm tra entity đã map khớp, không tự tạo/sửa bảng. Giảm nguy cơ drift phá database.
**Giải thích/Bằng chứng:** `application.properties`. **Tiếp:** validate toàn 16 bảng? Không, chỉ các Entity đã map (Deck/User/Profile).

### 39. Quiz score lệch bị bắt lúc nào; có thể lưu nửa transaction không?
**Nói:** Deferred trigger kiểm tra khi COMMIT; nếu exception thì transaction không commit. Negative SQL test tách transaction để chứng minh commit thất bại.
**Giải thích/Bằng chứng:** `test_quiz_missing_answer_commit.sql`, `test_quiz_score_mismatch_commit.sql`. **Tiếp:** API có hiện thực Quiz chưa? Chưa.

### 40. Điểm yếu lớn nhất khi bảo vệ hôm nay?
**Nói:** API hiện chưa có Auth, các `/dev` chỉ phục vụ local và mới triển khai một phần module. Em sẽ không gọi thiết kế đủ sáu module là hệ thống hoàn chỉnh.
**Giải thích/Bằng chứng:** Controller/README; `@Profile("local")`. **Tiếp:** production bước kế? Auth/authorization, secret management, schema migration có version, integration/security tests, APIs từng nghiệp vụ.
