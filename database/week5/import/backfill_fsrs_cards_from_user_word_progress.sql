-- OPTIONAL, idempotent backfill. Do not run on a shared/development database until a verified backup exists.
-- Run only after V1_7 is applied and the source user_word_progress rows have been reviewed.
-- This seeds NEW cards due at their last studied time; it creates no review_logs and changes no quiz/progress rows.
BEGIN;

WITH inserted AS (
    INSERT INTO review_cards (
        user_id, word_id, due_at, stability, difficulty, repetitions, lapses,
        fsrs_state, last_reviewed_at, scheduler_version, learning_step
    )
    SELECT p.user_id, p.word_id, p.last_studied_at, 0, 0, 0, 0,
           'NEW', NULL, 'uninitialized', 0
    FROM user_word_progress p
    ON CONFLICT (user_id, word_id) DO NOTHING
    RETURNING 1
)
SELECT count(*) AS review_cards_inserted FROM inserted;

COMMIT;
