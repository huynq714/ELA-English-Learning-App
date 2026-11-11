-- Negative deferred-trigger test. Expected: COMMIT fails and the transaction rolls back.
-- Run only on english_learning_test.
BEGIN;
INSERT INTO users (id, email, password_hash, display_name)
VALUES ('10000000-0000-4000-8000-000000000003', 'quiz-missing-test@example.invalid', 'test-only-hash', 'Quiz Missing Test');
INSERT INTO quiz_attempts (id, user_id, deck_id)
VALUES ('40000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000011');
INSERT INTO quiz_answers (attempt_id, word_id, question_no, selected_answer, is_correct) VALUES
  ('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000011', 1, 'practice', TRUE),
  ('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000012', 2, 'progress', TRUE),
  ('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000011', 3, 'practice', TRUE),
  ('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000012', 4, 'progress', FALSE);
UPDATE quiz_attempts SET correct_count = 3, status = 'COMPLETED', completed_at = now()
WHERE id = '40000000-0000-4000-8000-000000000012';
COMMIT;
