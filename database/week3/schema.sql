-- English Learning App | PostgreSQL | Week 3 finalized schema v1.1
-- Apply to an empty development database. Runtime business rules remain in the API.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  english_level VARCHAR(8) NOT NULL DEFAULT 'A1' CHECK (english_level IN ('A1','A2','B1','B2','C1','C2')),
  daily_goal_minutes SMALLINT NOT NULL DEFAULT 15 CHECK (daily_goal_minutes BETWEEN 5 AND 240),
  avatar_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL,
  description TEXT,
  level VARCHAR(8) CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headword VARCHAR(120) NOT NULL,
  ipa VARCHAR(120),
  meaning_vi TEXT NOT NULL,
  example_en TEXT,
  example_vi TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deck_words (
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE RESTRICT,
  sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (deck_id, word_id)
);
CREATE INDEX idx_deck_words_sort ON deck_words(deck_id, sort_order);

CREATE TABLE user_word_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE RESTRICT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_studied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word_id),
  CHECK (last_studied_at >= first_seen_at)
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE RESTRICT,
  total_questions SMALLINT NOT NULL DEFAULT 5 CHECK (total_questions = 5),
  correct_count SMALLINT CHECK (correct_count BETWEEN 0 AND 5),
  status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','COMPLETED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK ((status = 'IN_PROGRESS' AND correct_count IS NULL AND completed_at IS NULL)
      OR (status = 'COMPLETED' AND correct_count IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id, started_at DESC);

CREATE TABLE quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE RESTRICT,
  question_no SMALLINT NOT NULL CHECK (question_no BETWEEN 1 AND 5),
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  UNIQUE (attempt_id, question_no)
);

CREATE TABLE review_cards (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE RESTRICT,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stability DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (stability >= 0 AND stability < 'Infinity'::double precision),
  difficulty DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (difficulty >= 0 AND difficulty < 'Infinity'::double precision),
  repetitions INT NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  lapses INT NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  fsrs_state VARCHAR(16) NOT NULL DEFAULT 'NEW' CHECK (fsrs_state IN ('NEW','LEARNING','REVIEW','RELEARNING')),
  last_reviewed_at TIMESTAMPTZ,
  scheduler_version VARCHAR(32) NOT NULL DEFAULT 'uninitialized',
  PRIMARY KEY (user_id, word_id),
  CHECK (last_reviewed_at IS NULL OR last_reviewed_at <= due_at)
);
CREATE INDEX idx_review_cards_due ON review_cards(user_id, due_at);

CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  word_id UUID NOT NULL,
  rating VARCHAR(8) NOT NULL CHECK (rating IN ('AGAIN','HARD','GOOD','EASY')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_due_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (user_id, word_id) REFERENCES review_cards(user_id, word_id) ON DELETE CASCADE,
  CHECK (next_due_at >= reviewed_at)
);
CREATE INDEX idx_review_logs_user ON review_logs(user_id, reviewed_at DESC);

-- Keep review history if a card is removed directly; account deletion may erase it by cascade.
CREATE FUNCTION protect_review_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() <= 1
     AND EXISTS (SELECT 1 FROM review_logs WHERE user_id = OLD.user_id AND word_id = OLD.word_id) THEN
    RAISE EXCEPTION 'A review card with history cannot be deleted directly';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER review_card_history_guard BEFORE DELETE ON review_cards
  FOR EACH ROW EXECUTE FUNCTION protect_review_history();
CREATE FUNCTION protect_review_logs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() <= 1 THEN RAISE EXCEPTION 'Review history cannot be deleted directly'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER review_logs_immutable BEFORE DELETE ON review_logs
  FOR EACH ROW EXECUTE FUNCTION protect_review_logs();

CREATE TABLE ipa_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(24) NOT NULL UNIQUE,
  sound_type VARCHAR(12) NOT NULL CHECK (sound_type IN ('VOWEL','CONSONANT')),
  description_vi TEXT,
  sample_word VARCHAR(120),
  audio_url TEXT
);

CREATE TABLE pronunciation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ipa_sound_id UUID REFERENCES ipa_sounds(id) ON DELETE SET NULL,
  word_id UUID REFERENCES words(id) ON DELETE SET NULL,
  target_text VARCHAR(255) NOT NULL,
  assessment_score NUMERIC(5,2) CHECK (assessment_score BETWEEN 0 AND 100),
  result VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (result IN ('PENDING','PASSED','FAILED','ERROR')),
  feedback_json JSONB,
  audio_object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((result IN ('PASSED','FAILED') AND assessment_score IS NOT NULL)
      OR result IN ('PENDING','ERROR') OR assessment_score IS NULL)
);
CREATE INDEX idx_pronunciation_user ON pronunciation_attempts(user_id, created_at DESC);

CREATE TABLE conversation_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL,
  description TEXT,
  difficulty VARCHAR(8) CHECK (difficulty IN ('A1','A2','B1','B2','C1','C2')),
  initial_prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES conversation_scenarios(id) ON DELETE RESTRICT,
  mode VARCHAR(12) NOT NULL CHECK (mode IN ('FREE_TALK','ROLE_PLAY')),
  input_mode VARCHAR(8) NOT NULL DEFAULT 'TEXT' CHECK (input_mode IN ('TEXT','VOICE')),
  status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','COMPLETED','ABANDONED')),
  valid_user_turns INT NOT NULL DEFAULT 0 CHECK (valid_user_turns >= 0),
  report_json JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  CHECK (mode <> 'ROLE_PLAY' OR scenario_id IS NOT NULL),
  CHECK (status <> 'COMPLETED' OR (valid_user_turns >= 5 AND ended_at IS NOT NULL AND report_json IS NOT NULL)),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX idx_conversation_sessions_user ON conversation_sessions(user_id, started_at DESC);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  sender VARCHAR(8) NOT NULL CHECK (sender IN ('USER','AI')),
  content TEXT NOT NULL,
  audio_object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversation_messages_session ON conversation_messages(session_id, created_at, id);

CREATE TABLE conversation_turn_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL UNIQUE REFERENCES conversation_messages(id) ON DELETE CASCADE,
  grammar_feedback TEXT,
  vocabulary_feedback TEXT,
  suggested_reply TEXT,
  feedback_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure a completed quiz has exactly five answers and a matching score.
CREATE FUNCTION validate_completed_quiz() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_attempt_id UUID; v_status VARCHAR(16); v_score SMALLINT; v_count INT; v_correct INT;
BEGIN
  IF TG_TABLE_NAME = 'quiz_attempts' THEN
    v_attempt_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_attempt_id := COALESCE(NEW.attempt_id, OLD.attempt_id);
  END IF;
  SELECT status, correct_count INTO v_status, v_score FROM quiz_attempts WHERE id = v_attempt_id;
  IF NOT FOUND OR v_status <> 'COMPLETED' THEN RETURN NULL; END IF;
  SELECT count(*), count(*) FILTER (WHERE is_correct) INTO v_count, v_correct
    FROM quiz_answers WHERE attempt_id = v_attempt_id;
  IF v_count <> 5 OR v_score <> v_correct THEN
    RAISE EXCEPTION 'Completed quiz % must have five answers and a matching score (answers %, score %, correct %)', v_attempt_id, v_count, v_score, v_correct;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER quiz_completion_valid_attempt
  AFTER INSERT OR UPDATE ON quiz_attempts DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_completed_quiz();
CREATE CONSTRAINT TRIGGER quiz_completion_valid_answers
  AFTER INSERT OR UPDATE OR DELETE ON quiz_answers DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_completed_quiz();

-- Completed quiz records and their answers are immutable; delete user/account remains cascade-able.
CREATE FUNCTION protect_completed_quiz() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status VARCHAR(16); v_attempt_id UUID;
BEGIN
  v_attempt_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.attempt_id ELSE NEW.attempt_id END;
  -- Let parent-row cascades remove a user's history while protecting direct edits.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  SELECT status INTO v_status FROM quiz_attempts WHERE id = v_attempt_id;
  IF v_status = 'COMPLETED' THEN RAISE EXCEPTION 'Answers of a completed quiz are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quiz_answers_immutable BEFORE INSERT OR UPDATE OR DELETE ON quiz_answers
  FOR EACH ROW EXECUTE FUNCTION protect_completed_quiz();
CREATE FUNCTION protect_completed_quiz_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'A completed quiz attempt cannot be deleted directly';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER quiz_attempt_history_guard BEFORE DELETE ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION protect_completed_quiz_history();

-- A completed conversation's counter must match its persisted USER messages.
CREATE FUNCTION validate_completed_conversation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_session_id UUID; v_status VARCHAR(16); v_turns INT; v_user_messages INT;
BEGIN
  IF TG_TABLE_NAME = 'conversation_sessions' THEN
    v_session_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_session_id := COALESCE(NEW.session_id, OLD.session_id);
  END IF;
  SELECT status, valid_user_turns INTO v_status, v_turns FROM conversation_sessions WHERE id = v_session_id;
  IF NOT FOUND OR v_status <> 'COMPLETED' THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_user_messages FROM conversation_messages WHERE session_id = v_session_id AND sender = 'USER';
  IF v_turns < 5 OR v_turns <> v_user_messages THEN
    RAISE EXCEPTION 'Completed conversation % must have at least five USER messages and a matching turn count', v_session_id;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER conversation_completion_valid_session
  AFTER INSERT OR UPDATE ON conversation_sessions DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_completed_conversation();
CREATE CONSTRAINT TRIGGER conversation_completion_valid_messages
  AFTER INSERT OR UPDATE OR DELETE ON conversation_messages DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_completed_conversation();

-- Do not let direct edits invalidate the turn count after completion. Parent cascades remain allowed.
CREATE FUNCTION protect_completed_conversation_messages() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_session_id UUID; v_status VARCHAR(16);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_session_id := NEW.session_id;
  ELSE
    v_session_id := OLD.session_id;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.session_id <> OLD.session_id THEN
    RAISE EXCEPTION 'A conversation message cannot be moved between sessions';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.sender <> 'USER'
     AND EXISTS (SELECT 1 FROM conversation_turn_feedback WHERE message_id = OLD.id) THEN
    RAISE EXCEPTION 'A message with learner feedback must remain a USER message';
  END IF;
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  SELECT status INTO v_status FROM conversation_sessions WHERE id = v_session_id;
  IF v_status = 'COMPLETED' THEN RAISE EXCEPTION 'Messages in a completed conversation are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conversation_messages_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON conversation_messages
  FOR EACH ROW EXECUTE FUNCTION protect_completed_conversation_messages();

CREATE FUNCTION protect_completed_conversation_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'A completed conversation session is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conversation_session_immutable
  BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION protect_completed_conversation_session();

-- Feedback is only meaningful for a learner message.
CREATE FUNCTION require_user_message_feedback() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversation_messages WHERE id = NEW.message_id AND sender = 'USER') THEN
    RAISE EXCEPTION 'Turn feedback must reference a USER message';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER feedback_only_for_user_message BEFORE INSERT OR UPDATE ON conversation_turn_feedback
  FOR EACH ROW EXECUTE FUNCTION require_user_message_feedback();

COMMIT;
