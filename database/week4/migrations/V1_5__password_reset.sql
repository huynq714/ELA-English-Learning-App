BEGIN;

CREATE TABLE IF NOT EXISTS public.password_reset_challenges (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    credential_version TEXT NOT NULL,
    otp_hash BYTEA,
    otp_expires_at TIMESTAMPTZ NOT NULL,
    failed_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
    token_hash BYTEA,
    token_expires_at TIMESTAMPTZ,
    CHECK (otp_hash IS NULL OR octet_length(otp_hash) = 32),
    CHECK (token_hash IS NULL OR octet_length(token_hash) = 32),
    CHECK (
        (otp_hash IS NOT NULL AND token_hash IS NULL AND token_expires_at IS NULL)
        OR (otp_hash IS NULL AND token_hash IS NOT NULL AND token_expires_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.password_reset_limits (
    bucket TEXT NOT NULL,
    subject_hash BYTEA NOT NULL CHECK (octet_length(subject_hash) = 32),
    expires_at TIMESTAMPTZ NOT NULL,
    hits INTEGER NOT NULL CHECK (hits > 0),
    PRIMARY KEY (bucket, subject_hash)
);
CREATE INDEX IF NOT EXISTS password_reset_limits_expiry_idx ON public.password_reset_limits (expires_at);
CREATE INDEX IF NOT EXISTS password_reset_challenges_expiry_idx
    ON public.password_reset_challenges ((COALESCE(token_expires_at, otp_expires_at)));

COMMIT;
