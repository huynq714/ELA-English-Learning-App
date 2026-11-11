# ERD tổng quan — Week 3

ERD DBML đầy đủ 16 bảng/19 FK ở [ERD_OVERVIEW.dbml](./ERD_OVERVIEW.dbml), được sao từ `database/week3/English_Learning_ERD.dbml`; đối chiếu cột, FK và ON DELETE trực tiếp với `database/week3/schema.sql`. Mở DBML tại dbdiagram.io để xem toàn sơ đồ. DBML mô tả bảng/quan hệ; các CHECK, trigger và quy tắc lịch sử phải trình bày theo SQL vì DBML hiện không biểu diễn hết các quy tắc này.

## Góc nhìn theo nghiệp vụ

```mermaid
erDiagram
  users ||--o| user_profiles : profile
  users ||--o{ user_word_progress : studies
  users ||--o{ quiz_attempts : attempts
  users ||--o{ review_cards : owns
  users ||--o{ pronunciation_attempts : practices
  users ||--o{ conversation_sessions : speaks

  decks ||--o{ deck_words : contains
  words ||--o{ deck_words : linked
  words ||--o{ user_word_progress : progress
  words ||--o{ quiz_answers : tested
  words ||--o{ review_cards : reviewed
  review_cards ||--o{ review_logs : history
  decks ||--o{ quiz_attempts : quizzes
  quiz_attempts ||--o{ quiz_answers : answers

  ipa_sounds o|--o{ pronunciation_attempts : target
  words o|--o{ pronunciation_attempts : target

  conversation_scenarios o|--o{ conversation_sessions : optional_scenario
  conversation_sessions ||--o{ conversation_messages : contains
  conversation_messages ||--o| conversation_turn_feedback : feedback
```

`deck_words` là bảng nối N–N; PK ghép `(deck_id, word_id)`. `review_cards` có PK ghép `(user_id, word_id)` và `review_logs` tham chiếu lại đúng cặp đó bằng FK ghép. `conversation_turn_feedback.message_id` vừa NOT NULL vừa UNIQUE nên mỗi message có nhiều nhất một feedback. Ký hiệu Mermaid thể hiện bội số nghiệp vụ; xem SQL để phân biệt FK nullable và CHECK.

## Sáu nhóm

1. Users/Profile: `users`, `user_profiles`.
2. Vocabulary: `decks`, `words`, `deck_words`, `user_word_progress`.
3. Quiz: `quiz_attempts`, `quiz_answers`.
4. FSRS: `review_cards`, `review_logs`.
5. IPA: `ipa_sounds`, `pronunciation_attempts`.
6. AI Conversation: `conversation_scenarios`, `conversation_sessions`, `conversation_messages`, `conversation_turn_feedback`.
