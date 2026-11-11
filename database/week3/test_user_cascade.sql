-- Run once on english_learning_test after test_integrity_workflows.sql succeeds.
-- This intentionally deletes only the isolated workflow-test user and dependent history.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = '10000000-0000-4000-8000-000000000002')
     OR NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE id = '40000000-0000-4000-8000-000000000011')
     OR NOT EXISTS (SELECT 1 FROM review_logs WHERE id = '90000000-0000-4000-8000-000000000011')
     OR NOT EXISTS (SELECT 1 FROM conversation_sessions WHERE id = '60000000-0000-4000-8000-000000000012') THEN
    RAISE EXCEPTION 'FAIL: expected workflow-test fixtures are missing; user deletion was not attempted';
  END IF;
  RAISE NOTICE 'PASS: isolated user and dependent test fixtures found';
END $$;

DELETE FROM users WHERE id = '10000000-0000-4000-8000-000000000002';
COMMIT;

SELECT CASE WHEN
  NOT EXISTS (SELECT 1 FROM users WHERE id = '10000000-0000-4000-8000-000000000002')
  AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = '10000000-0000-4000-8000-000000000002')
  AND NOT EXISTS (SELECT 1 FROM user_word_progress WHERE user_id = '10000000-0000-4000-8000-000000000002')
  AND NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE user_id = '10000000-0000-4000-8000-000000000002')
  AND NOT EXISTS (SELECT 1 FROM quiz_answers WHERE attempt_id = '40000000-0000-4000-8000-000000000011')
  AND NOT EXISTS (SELECT 1 FROM review_cards WHERE user_id = '10000000-0000-4000-8000-000000000002')
  AND NOT EXISTS (SELECT 1 FROM review_logs WHERE user_id = '10000000-0000-4000-8000-000000000002')
  AND NOT EXISTS (SELECT 1 FROM conversation_sessions WHERE user_id = '10000000-0000-4000-8000-000000000002')
  AND NOT EXISTS (SELECT 1 FROM conversation_messages WHERE session_id IN ('60000000-0000-4000-8000-000000000011','60000000-0000-4000-8000-000000000012'))
  AND NOT EXISTS (SELECT 1 FROM conversation_turn_feedback WHERE message_id = '70000000-0000-4000-8000-000000000011')
  THEN 'PASS: user and dependent personal history deleted by cascade'
  ELSE 'FAIL: dependent records remain'
END AS cascade_test;
