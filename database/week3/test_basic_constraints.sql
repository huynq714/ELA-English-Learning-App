-- Basic PostgreSQL checks for English Learning App.
-- Run only on english_learning_test. All successful fixture writes are rolled back.
BEGIN;

INSERT INTO users (id, email, password_hash, display_name)
VALUES ('10000000-0000-4000-8000-000000000001', 'dbtest@example.invalid', 'test-only-hash', 'DB Test User');
INSERT INTO user_profiles (user_id, english_level, daily_goal_minutes)
VALUES ('10000000-0000-4000-8000-000000000001', 'B1', 20);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = '10000000-0000-4000-8000-000000000001' AND english_level = 'B1') THEN
    RAISE EXCEPTION 'FAIL: User/Profile create and read';
  END IF;
  RAISE NOTICE 'PASS: User/Profile create and read';
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO users (email, password_hash, display_name)
    VALUES ('DBTEST@example.invalid', 'test-only-hash', 'Duplicate Email Test');
    RAISE EXCEPTION 'FAIL: case-insensitive duplicate email was accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS: case-insensitive duplicate email rejected';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO deck_words (deck_id, word_id, sort_order)
    VALUES ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 0);
    RAISE EXCEPTION 'FAIL: missing parent FK was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: missing parent FK rejected';
  END;
END $$;

INSERT INTO decks (id, title, level) VALUES
  ('20000000-0000-4000-8000-000000000001', 'DB Test Deck A', 'A1'),
  ('20000000-0000-4000-8000-000000000002', 'DB Test Deck B', 'A2');
INSERT INTO words (id, headword, meaning_vi) VALUES
  ('30000000-0000-4000-8000-000000000001', 'testword', 'từ thử nghiệm'),
  ('30000000-0000-4000-8000-000000000002', 'sampleword', 'từ mẫu');
INSERT INTO deck_words (deck_id, word_id, sort_order) VALUES
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 0),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 1),
  ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 0);
DO $$
BEGIN
  IF (SELECT count(*) FROM deck_words WHERE word_id = '30000000-0000-4000-8000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'FAIL: a word could not be linked to multiple decks';
  END IF;
  RAISE NOTICE 'PASS: Deck-Word many-to-many relationship';
  BEGIN
    INSERT INTO deck_words (deck_id, word_id, sort_order)
    VALUES ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 2);
    RAISE EXCEPTION 'FAIL: duplicate Deck-Word link was accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS: duplicate Deck-Word link rejected';
  END;
END $$;

ROLLBACK;
SELECT 'Fixture transaction rolled back' AS cleanup_status;
