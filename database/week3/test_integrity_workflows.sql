-- Run once on english_learning_test after test_basic_constraints.sql.
-- This commits isolated fixtures so the deferred Quiz/Conversation triggers run at COMMIT.
BEGIN;

INSERT INTO users (id, email, password_hash, display_name)
VALUES ('10000000-0000-4000-8000-000000000002', 'workflow-test@example.invalid', 'test-only-hash', 'Workflow Test User');
INSERT INTO user_profiles (user_id, english_level, daily_goal_minutes)
VALUES ('10000000-0000-4000-8000-000000000002', 'A2', 15);
INSERT INTO decks (id, title, level) VALUES
  ('20000000-0000-4000-8000-000000000011', 'Workflow Deck A', 'A1'),
  ('20000000-0000-4000-8000-000000000012', 'Workflow Deck B', 'A2');
INSERT INTO words (id, headword, meaning_vi) VALUES
  ('30000000-0000-4000-8000-000000000011', 'practice', 'luyện tập'),
  ('30000000-0000-4000-8000-000000000012', 'progress', 'tiến bộ');
INSERT INTO deck_words (deck_id, word_id, sort_order) VALUES
  ('20000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000011', 0),
  ('20000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000012', 1),
  ('20000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000011', 0);
INSERT INTO user_word_progress (user_id, word_id)
VALUES ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000011');

INSERT INTO review_cards (user_id, word_id, due_at, stability, difficulty, repetitions, fsrs_state, scheduler_version)
VALUES ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000011', now() + interval '1 day', 1.2, 5.0, 1, 'REVIEW', 'test-fixture');
INSERT INTO review_logs (id, user_id, word_id, rating, previous_due_at, next_due_at)
VALUES ('90000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000011', 'GOOD', now(), now() + interval '1 day');

DO $$
BEGIN
  BEGIN
    INSERT INTO review_logs (user_id, word_id, rating, next_due_at)
    VALUES ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000012', 'GOOD', now() + interval '1 day');
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'FAIL: invalid composite FSRS reference accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: review_logs composite FK rejects a missing card';
  END;
  BEGIN
    DELETE FROM words WHERE id = '30000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'FAIL: word with learning history deleted';
  EXCEPTION WHEN restrict_violation OR foreign_key_violation THEN
    RAISE NOTICE 'PASS: word with learning history cannot be deleted';
  END;
END $$;

INSERT INTO conversation_scenarios (id, title, initial_prompt)
VALUES ('50000000-0000-4000-8000-000000000011', 'Test Role Play', 'Test-only prompt');
INSERT INTO conversation_sessions (id, user_id, scenario_id, mode)
VALUES ('60000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000011', 'ROLE_PLAY');
DO $$
BEGIN
  BEGIN
    DELETE FROM conversation_scenarios WHERE id = '50000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'FAIL: in-use Role-play scenario deleted';
  EXCEPTION WHEN restrict_violation OR foreign_key_violation THEN
    RAISE NOTICE 'PASS: scenario used by Role-play cannot be deleted';
  END;
END $$;

INSERT INTO conversation_sessions (id, user_id, mode, status, valid_user_turns, report_json, ended_at)
VALUES ('60000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 'FREE_TALK', 'IN_PROGRESS', 0, NULL, NULL);
INSERT INTO conversation_messages (id, session_id, sender, content) VALUES
  ('70000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000012', 'USER', 'I like learning English.'),
  ('70000000-0000-4000-8000-000000000012', '60000000-0000-4000-8000-000000000012', 'USER', 'I practice every day.'),
  ('70000000-0000-4000-8000-000000000013', '60000000-0000-4000-8000-000000000012', 'USER', 'I learned a new word.'),
  ('70000000-0000-4000-8000-000000000014', '60000000-0000-4000-8000-000000000012', 'USER', 'The lesson was useful.'),
  ('70000000-0000-4000-8000-000000000015', '60000000-0000-4000-8000-000000000012', 'USER', 'I will continue tomorrow.'),
  ('70000000-0000-4000-8000-000000000016', '60000000-0000-4000-8000-000000000012', 'AI', 'Great work.');
INSERT INTO conversation_turn_feedback (id, message_id, grammar_feedback)
VALUES ('80000000-0000-4000-8000-000000000011', '70000000-0000-4000-8000-000000000011', 'Test feedback for learner message.');
DO $$
BEGIN
  BEGIN
    INSERT INTO conversation_turn_feedback (message_id, grammar_feedback)
    VALUES ('70000000-0000-4000-8000-000000000016', 'Invalid feedback for AI message.');
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'FAIL: feedback for AI message accepted';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'PASS: feedback for AI message rejected';
  END;
END $$;
UPDATE conversation_sessions
SET valid_user_turns = 5, report_json = '{"test": true}'::jsonb,
    ended_at = now(), status = 'COMPLETED'
WHERE id = '60000000-0000-4000-8000-000000000012';

INSERT INTO quiz_attempts (id, user_id, deck_id)
VALUES ('40000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000011');
INSERT INTO quiz_answers (attempt_id, word_id, question_no, selected_answer, is_correct) VALUES
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000011', 1, 'practice', TRUE),
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000012', 2, 'progress', TRUE),
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000011', 3, 'practice', TRUE),
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000012', 4, 'progress', FALSE),
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000011', 5, 'practice', FALSE);
UPDATE quiz_attempts
SET correct_count = 3, status = 'COMPLETED', completed_at = now()
WHERE id = '40000000-0000-4000-8000-000000000011';

-- Deferred constraints are verified when this transaction commits.
COMMIT;
SELECT 'Workflow fixtures committed; valid deferred Quiz and Conversation triggers passed' AS result;
