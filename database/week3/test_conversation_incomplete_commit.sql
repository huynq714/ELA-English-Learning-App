-- Negative deferred-trigger test. Expected: the first update is rejected by CHECK;
-- COMMIT is then rejected because only four USER messages exist for five counted turns.
-- Run only on english_learning_test.
BEGIN;
INSERT INTO users (id, email, password_hash, display_name)
VALUES ('10000000-0000-4000-8000-000000000005', 'conversation-test@example.invalid', 'test-only-hash', 'Conversation Test');
INSERT INTO conversation_sessions (id, user_id, mode)
VALUES ('60000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000005', 'FREE_TALK');
INSERT INTO conversation_messages (id, session_id, sender, content) VALUES
  ('70000000-0000-4000-8000-000000000021', '60000000-0000-4000-8000-000000000013', 'USER', 'Test turn one.'),
  ('70000000-0000-4000-8000-000000000022', '60000000-0000-4000-8000-000000000013', 'USER', 'Test turn two.'),
  ('70000000-0000-4000-8000-000000000023', '60000000-0000-4000-8000-000000000013', 'USER', 'Test turn three.'),
  ('70000000-0000-4000-8000-000000000024', '60000000-0000-4000-8000-000000000013', 'USER', 'Test turn four.');
DO $$
BEGIN
  BEGIN
    UPDATE conversation_sessions SET status = 'COMPLETED', valid_user_turns = 4,
      report_json = '{"test": true}'::jsonb, ended_at = now()
    WHERE id = '60000000-0000-4000-8000-000000000013';
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'FAIL: completed session with fewer than five turns was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: CHECK rejects completed session with fewer than five counted turns';
  END;
END $$;
UPDATE conversation_sessions SET status = 'COMPLETED', valid_user_turns = 5,
  report_json = '{"test": true}'::jsonb, ended_at = now()
WHERE id = '60000000-0000-4000-8000-000000000013';
COMMIT;
