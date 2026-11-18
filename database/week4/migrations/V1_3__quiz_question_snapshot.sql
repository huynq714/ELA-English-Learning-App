BEGIN;

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS question_snapshot JSONB;

-- Keep legacy attempts readable and freeze the score and snapshot of completed attempts.
CREATE OR REPLACE FUNCTION public.protect_completed_quiz_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'A completed quiz attempt cannot be updated';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER quiz_attempt_update_guard BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.protect_completed_quiz_update();

CREATE OR REPLACE FUNCTION public.keep_quiz_answer_in_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id THEN
    RAISE EXCEPTION 'Quiz answers cannot move between attempts';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER quiz_answer_attempt_guard BEFORE UPDATE OF attempt_id ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.keep_quiz_answer_in_attempt();

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_deck_started
  ON public.quiz_attempts (user_id, deck_id, started_at DESC, id DESC)
  WHERE question_snapshot IS NOT NULL;

COMMIT;
