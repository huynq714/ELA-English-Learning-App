package com.englishlearning.auth;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
class PasswordResetStore {
    private final JdbcClient jdbc;

    PasswordResetStore(JdbcClient jdbc) { this.jdbc = jdbc; }

    boolean allow(String bucket, byte[] subject, int maxHits, int seconds) {
        return jdbc.sql("""
                INSERT INTO password_reset_limits AS rate (bucket, subject_hash, expires_at, hits)
                VALUES (:bucket, :subject, statement_timestamp() + :seconds * interval '1 second', 1)
                ON CONFLICT (bucket, subject_hash) DO UPDATE
                    SET hits = CASE WHEN rate.expires_at <= statement_timestamp() THEN 1 ELSE rate.hits + 1 END,
                        expires_at = CASE WHEN rate.expires_at <= statement_timestamp()
                                          THEN EXCLUDED.expires_at ELSE rate.expires_at END
                    WHERE rate.expires_at <= statement_timestamp() OR rate.hits < :maxHits
                """).param("bucket", bucket).param("subject", subject).param("seconds", seconds)
                .param("maxHits", maxHits).update() == 1;
    }

    boolean start(UUID user, String credentialVersion, byte[] otpHash) {
        return jdbc.sql("""
                INSERT INTO password_reset_challenges AS active (user_id, credential_version, otp_hash, otp_expires_at)
                VALUES (:user, :version, :hash, statement_timestamp() + interval '5 minutes')
                ON CONFLICT (user_id) DO UPDATE SET credential_version = EXCLUDED.credential_version,
                    otp_hash = EXCLUDED.otp_hash, otp_expires_at = EXCLUDED.otp_expires_at,
                    failed_attempts = 0, token_hash = NULL, token_expires_at = NULL
                WHERE active.credential_version <> EXCLUDED.credential_version
                    OR active.token_expires_at IS NULL OR active.token_expires_at <= statement_timestamp()
                """).param("user", user).param("version", credentialVersion).param("hash", otpHash).update() == 1;
    }

    Optional<Challenge> find(UUID user, String credentialVersion) {
        return jdbc.sql("""
                SELECT otp_hash, token_hash, failed_attempts,
                       otp_expires_at > statement_timestamp() AS otp_live,
                       token_expires_at > statement_timestamp() AS token_live
                FROM password_reset_challenges WHERE user_id = :user AND credential_version = :version
                FOR UPDATE
                """).param("user", user).param("version", credentialVersion)
                .query((rs, row) -> new Challenge(rs.getBytes("otp_hash"), rs.getBytes("token_hash"),
                        rs.getInt("failed_attempts"), rs.getBoolean("otp_live"), rs.getBoolean("token_live")))
                .optional();
    }

    void recordFailure(UUID user) {
        jdbc.sql("UPDATE password_reset_challenges SET failed_attempts = failed_attempts + 1 WHERE user_id = :user")
                .param("user", user).update();
    }

    void issueToken(UUID user, byte[] hash) {
        jdbc.sql("""
                UPDATE password_reset_challenges SET otp_hash = NULL, token_hash = :hash,
                    token_expires_at = statement_timestamp() + interval '10 minutes'
                WHERE user_id = :user
                """).param("user", user).param("hash", hash).update();
    }

    void consume(UUID user) {
        jdbc.sql("DELETE FROM password_reset_challenges WHERE user_id = :user").param("user", user).update();
    }

    void purgeExpired() {
        jdbc.sql("DELETE FROM password_reset_limits WHERE expires_at <= statement_timestamp()").update();
        jdbc.sql("""
                DELETE FROM password_reset_challenges
                WHERE COALESCE(token_expires_at, otp_expires_at) <= statement_timestamp()
                """).update();
    }

    record Challenge(byte[] otpHash, byte[] tokenHash, int failures, boolean otpLive, boolean tokenLive) {}
}
