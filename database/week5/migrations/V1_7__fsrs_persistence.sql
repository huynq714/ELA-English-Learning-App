-- English Learning App | Week 5 | FSRS persistence
-- Apply manually to a backed-up database. This migration does not backfill review cards.
BEGIN;

ALTER TABLE review_cards
    ADD COLUMN learning_step SMALLINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_review_cards_learning_step_nonnegative CHECK (learning_step >= 0);

-- These fields are nullable for pre-V1_7 history: the original table did not retain them,
-- so historical values must not be fabricated during migration.
ALTER TABLE review_logs
    ADD COLUMN state_before VARCHAR(16)
        CHECK (state_before IS NULL OR state_before IN ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING')),
    ADD COLUMN elapsed_days DOUBLE PRECISION
        CHECK (elapsed_days IS NULL OR (elapsed_days >= 0 AND elapsed_days < 'Infinity'::double precision)),
    ADD COLUMN scheduled_days INT CHECK (scheduled_days IS NULL OR scheduled_days >= 0);

CREATE TABLE review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(8) NOT NULL CHECK (session_type IN ('DUE', 'CRAM')),
    status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
    target_count SMALLINT NOT NULL CHECK (target_count BETWEEN 1 AND 500),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (user_id, id),
    CHECK ((status = 'IN_PROGRESS' AND finished_at IS NULL)
        OR (status IN ('COMPLETED', 'ABANDONED') AND finished_at IS NOT NULL))
);
CREATE INDEX idx_review_sessions_user_active
    ON review_sessions(user_id, started_at DESC) WHERE status = 'IN_PROGRESS';

CREATE TABLE review_session_items (
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    word_id UUID NOT NULL,
    queue_position BIGINT NOT NULL CHECK (queue_position > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
    again_count INT NOT NULL DEFAULT 0 CHECK (again_count >= 0),
    last_rating VARCHAR(8) CHECK (last_rating IS NULL OR last_rating IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
    presented_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, word_id),
    UNIQUE (session_id, queue_position),
    UNIQUE (user_id, session_id, word_id),
    FOREIGN KEY (user_id, session_id) REFERENCES review_sessions(user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, word_id) REFERENCES review_cards(user_id, word_id) ON DELETE CASCADE,
    CHECK (status <> 'COMPLETED' OR answered_at IS NOT NULL)
);
CREATE INDEX idx_review_session_items_queue
    ON review_session_items(user_id, session_id, status, queue_position);

CREATE TABLE review_idempotency (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_token UUID NOT NULL,
    session_id UUID NOT NULL,
    word_id UUID NOT NULL,
    rating VARCHAR(8) NOT NULL CHECK (rating IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
    request_hash BYTEA NOT NULL CHECK (octet_length(request_hash) = 32),
    state VARCHAR(12) NOT NULL CHECK (state IN ('PROCESSING', 'COMPLETED')),
    http_status SMALLINT,
    stored_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    PRIMARY KEY (user_id, request_token),
    FOREIGN KEY (user_id, session_id, word_id)
        REFERENCES review_session_items(user_id, session_id, word_id) ON DELETE CASCADE,
    CHECK (expires_at > created_at),
    CHECK (
        (state = 'PROCESSING' AND http_status IS NULL AND stored_response IS NULL AND completed_at IS NULL)
        OR
        (state = 'COMPLETED' AND http_status IS NOT NULL AND http_status BETWEEN 200 AND 299
            AND stored_response IS NOT NULL AND completed_at IS NOT NULL)
    )
);
CREATE INDEX idx_review_idempotency_expiry ON review_idempotency(expires_at);

CREATE TABLE user_streaks (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    longest_streak INT NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
    last_eligible_study_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (longest_streak >= current_streak)
);

COMMIT;
