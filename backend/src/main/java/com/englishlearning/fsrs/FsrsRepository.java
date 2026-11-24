package com.englishlearning.fsrs;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * PostgreSQL persistence for FSRS cards, review sessions, items, logs, idempotency and streak state.
 * All methods include user ownership predicates. Callers own transaction boundaries; methods with
 * {@code FOR UPDATE} must be called inside the same transaction as subsequent writes.
 * Rating transactions should acquire locks in this order: owned session, idempotency token,
 * session item, then review card. Keep that order in the future service to reduce deadlock risk.
 */
@Repository
public class FsrsRepository {
    private static final String CARD_COLUMNS = "user_id, word_id, due_at, stability, difficulty, repetitions, "
            + "lapses, fsrs_state, last_reviewed_at, scheduler_version, learning_step";

    private final JdbcClient jdbc;

    public FsrsRepository(JdbcClient jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc);
    }

    /** Serializes start/resume decisions per account; callers must hold a write transaction. */
    public boolean lockUser(UUID userId) {
        return jdbc.sql("SELECT id FROM users WHERE id = :user FOR UPDATE").param("user", userId)
                .query(UUID.class).optional().isPresent();
    }

    public boolean userExists(UUID userId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM users WHERE id = :user)").param("user", userId)
                .query(Boolean.class).single();
    }

    /** Lazy, evidence-based initialization: only words with an existing study-progress row qualify. */
    public int initializeCardsForStudiedWords(UUID userId, Instant at) {
        return jdbc.sql("""
                INSERT INTO review_cards (user_id, word_id, due_at)
                SELECT progress.user_id, progress.word_id, :at
                FROM user_word_progress progress
                WHERE progress.user_id = :user
                  AND NOT EXISTS (SELECT 1 FROM review_cards card
                                  WHERE card.user_id = progress.user_id AND card.word_id = progress.word_id)
                ON CONFLICT (user_id, word_id) DO NOTHING
                """).param("user", userId).param("at", dbTime(at)).update();
    }

    public CardSummary summarizeCards(UUID userId, Instant at) {
        return jdbc.sql("""
                SELECT COUNT(*) AS total_count,
                       COUNT(*) FILTER (WHERE card.word_id IS NULL OR card.fsrs_state = 'NEW') AS new_count,
                       COUNT(*) FILTER (WHERE fsrs_state = 'LEARNING') AS learning_count,
                       COUNT(*) FILTER (WHERE fsrs_state = 'REVIEW') AS review_count,
                       COUNT(*) FILTER (WHERE fsrs_state = 'RELEARNING') AS relearning_count,
                       COUNT(*) FILTER (WHERE card.word_id IS NULL OR card.due_at <= :at) AS due_count
                FROM user_word_progress progress
                LEFT JOIN review_cards card ON card.user_id = progress.user_id AND card.word_id = progress.word_id
                WHERE progress.user_id = :user
                """).param("user", userId).param("at", dbTime(at)).query((rs, row) -> new CardSummary(
                rs.getInt("due_count"), rs.getInt("new_count"), rs.getInt("learning_count"),
                rs.getInt("review_count"), rs.getInt("relearning_count"), rs.getInt("total_count"))).single();
    }

    /** Number of unique words with study progress; bookmarks alone do not qualify. */
    public int learnedCount(UUID userId) {
        return jdbc.sql("SELECT COUNT(DISTINCT word_id) FROM user_word_progress WHERE user_id = :user")
                .param("user", userId).query(Integer.class).single();
    }

    /** Effective CRAM population: startOrResume first creates cards for every studied word, then applies
     * findCramEligibleCards' studied-word predicate. Counting progress therefore avoids mutating in summary. */
    public int cramEligibleCount(UUID userId) {
        return jdbc.sql("SELECT COUNT(DISTINCT word_id) FROM user_word_progress WHERE user_id = :user")
                .param("user", userId).query(Integer.class).single();
    }

    public Optional<ReviewCard> findReviewCard(UUID userId, UUID wordId) {
        return jdbc.sql("SELECT " + CARD_COLUMNS + " FROM review_cards WHERE user_id = :user AND word_id = :word")
                .param("user", userId).param("word", wordId).query(FsrsRepository::mapReviewCard).optional();
    }

    /** Inserts a NEW card if absent, then reads the user's existing or newly created card. */
    public ReviewCard findOrCreateReviewCard(UUID userId, UUID wordId) {
        jdbc.sql("""
                INSERT INTO review_cards (user_id, word_id)
                VALUES (:user, :word)
                ON CONFLICT (user_id, word_id) DO NOTHING
                """).param("user", userId).param("word", wordId).update();
        return findReviewCard(userId, wordId)
                .orElseThrow(() -> new IllegalStateException("Review card was not created or visible"));
    }

    public List<ReviewCard> findDueCards(UUID userId, Instant dueBy, int limit) {
        requireLimit(limit);
        return jdbc.sql("SELECT " + CARD_COLUMNS + " FROM review_cards "
                        + "WHERE user_id = :user AND due_at <= :dueBy ORDER BY due_at, word_id LIMIT :limit")
                .param("user", userId).param("dueBy", dbTime(dueBy)).param("limit", limit)
                .query(FsrsRepository::mapReviewCard).list();
    }

    public List<ReviewCard> findDueEligibleCards(UUID userId, Instant dueBy, int limit) {
        requireLimit(limit);
        return jdbc.sql("SELECT " + CARD_COLUMNS + " FROM review_cards card "
                        + "WHERE card.user_id = :user AND card.due_at <= :dueBy "
                        + "AND EXISTS (SELECT 1 FROM user_word_progress p WHERE p.user_id = card.user_id AND p.word_id = card.word_id) "
                        + "ORDER BY card.due_at, card.word_id LIMIT :limit")
                .param("user", userId).param("dueBy", dbTime(dueBy)).param("limit", limit)
                .query(FsrsRepository::mapReviewCard).list();
    }

    public List<ReviewCard> findCramEligibleCards(UUID userId, int limit) {
        requireLimit(limit);
        return jdbc.sql("SELECT " + CARD_COLUMNS + " FROM review_cards card "
                        + "WHERE card.user_id = :user "
                        + "AND EXISTS (SELECT 1 FROM user_word_progress p WHERE p.user_id = card.user_id AND p.word_id = card.word_id) "
                        + "ORDER BY card.due_at, card.word_id LIMIT :limit")
                .param("user", userId).param("limit", limit).query(FsrsRepository::mapReviewCard).list();
    }

    /** Locks one owned card. Keep the lock until card, log, item and idempotency writes commit. */
    public Optional<ReviewCard> lockReviewCard(UUID userId, UUID wordId) {
        return jdbc.sql("SELECT " + CARD_COLUMNS + " FROM review_cards "
                        + "WHERE user_id = :user AND word_id = :word FOR UPDATE")
                .param("user", userId).param("word", wordId).query(FsrsRepository::mapReviewCard).optional();
    }

    /** Updates every persisted FsrsCard field, including learning_step. Never inserts implicitly. */
    public void saveReviewCard(UUID userId, UUID wordId, FsrsCard card, String schedulerVersion) {
        Objects.requireNonNull(card, "card");
        if (schedulerVersion == null || schedulerVersion.isBlank() || schedulerVersion.length() > 32) {
            throw new IllegalArgumentException("Scheduler version must contain 1 to 32 characters");
        }
        if (card.step() > Short.MAX_VALUE) throw new IllegalArgumentException("learning_step exceeds PostgreSQL SMALLINT range");
        int updated = jdbc.sql("""
                UPDATE review_cards SET due_at = :due, stability = :stability, difficulty = :difficulty,
                    repetitions = :repetitions, lapses = :lapses, fsrs_state = :state,
                    last_reviewed_at = :lastReviewed, scheduler_version = :schedulerVersion,
                    learning_step = :step
                WHERE user_id = :user AND word_id = :word
                """).param("due", dbTime(card.due())).param("stability", card.stability())
                .param("difficulty", card.difficulty()).param("repetitions", card.repetitions())
                .param("lapses", card.lapses()).param("state", card.state().name())
                .param("lastReviewed", dbTimeOrNull(card.lastReviewed())).param("schedulerVersion", schedulerVersion)
                .param("step", card.step()).param("user", userId).param("word", wordId).update();
        if (updated != 1) throw new IllegalStateException("Owned review card does not exist");
    }

    public UUID insertReviewLog(UUID userId, UUID wordId, FsrsReviewLog log) {
        Objects.requireNonNull(log, "log");
        return jdbc.sql("""
                INSERT INTO review_logs (user_id, word_id, rating, reviewed_at, previous_due_at, next_due_at,
                                         state_before, elapsed_days, scheduled_days)
                VALUES (:user, :word, :rating, :reviewedAt, :previousDue, :nextDue,
                        :stateBefore, :elapsedDays, :scheduledDays)
                RETURNING id
                """).param("user", userId).param("word", wordId).param("rating", log.rating().name())
                .param("reviewedAt", dbTime(log.reviewedAt())).param("previousDue", dbTimeOrNull(log.previousDue()))
                .param("nextDue", dbTime(log.nextDue())).param("stateBefore", log.stateBeforeReview().name())
                .param("elapsedDays", log.elapsedDays()).param("scheduledDays", log.scheduledDays())
                .query(UUID.class).single();
    }

    public List<PersistedReviewLog> findReviewLogs(UUID userId, UUID wordId, int limit) {
        requireLimit(limit);
        return jdbc.sql("""
                SELECT id, user_id, word_id, rating, reviewed_at, previous_due_at, next_due_at,
                       state_before, elapsed_days, scheduled_days
                FROM review_logs WHERE user_id = :user AND word_id = :word
                ORDER BY reviewed_at DESC, id DESC LIMIT :limit
                """).param("user", userId).param("word", wordId).param("limit", limit)
                .query(FsrsRepository::mapReviewLog).list();
    }

    public ReviewSession createSession(UUID userId, SessionType type, SessionStatus status,
                                       int targetCount, String metadataJson) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(status, "status");
        if (status != SessionStatus.IN_PROGRESS) throw new IllegalArgumentException("New sessions must be IN_PROGRESS");
        if (targetCount < 1 || targetCount > 500) throw new IllegalArgumentException("targetCount must be 1..500");
        String metadata = metadataJson == null ? "{}" : metadataJson;
        return jdbc.sql("""
                INSERT INTO review_sessions (user_id, session_type, status, target_count, metadata)
                VALUES (:user, :type, :status, :targetCount, CAST(:metadata AS jsonb))
                RETURNING id, user_id, session_type, status, target_count, started_at, finished_at, metadata::text AS metadata_json
                """).param("user", userId).param("type", type.name()).param("status", status.name())
                .param("targetCount", targetCount).param("metadata", metadata)
                .query(FsrsRepository::mapSession).single();
    }

    public Optional<ReviewSession> findSession(UUID userId, UUID sessionId) {
        return jdbc.sql("""
                SELECT id, user_id, session_type, status, target_count, started_at, finished_at, metadata::text AS metadata_json
                FROM review_sessions WHERE user_id = :user AND id = :session
                """).param("user", userId).param("session", sessionId)
                .query(FsrsRepository::mapSession).optional();
    }

    public Optional<ReviewSession> findActiveSession(UUID userId) {
        return jdbc.sql("""
                SELECT id, user_id, session_type, status, target_count, started_at, finished_at, metadata::text AS metadata_json
                FROM review_sessions WHERE user_id = :user AND status = 'IN_PROGRESS'
                ORDER BY started_at DESC, id DESC LIMIT 1
                """).param("user", userId).query(FsrsRepository::mapSession).optional();
    }

    /** Ownership-scoped session lock; must be called in the write transaction. */
    public Optional<ReviewSession> lockSession(UUID userId, UUID sessionId) {
        return jdbc.sql("""
                SELECT id, user_id, session_type, status, target_count, started_at, finished_at, metadata::text AS metadata_json
                FROM review_sessions WHERE user_id = :user AND id = :session FOR UPDATE
                """).param("user", userId).param("session", sessionId)
                .query(FsrsRepository::mapSession).optional();
    }

    public ReviewSessionItem addSessionItem(UUID userId, UUID sessionId, UUID wordId, long queuePosition) {
        if (queuePosition < 1) throw new IllegalArgumentException("queuePosition must be positive");
        return jdbc.sql("""
                INSERT INTO review_session_items (user_id, session_id, word_id, queue_position)
                VALUES (:user, :session, :word, :position)
                RETURNING user_id, session_id, word_id, queue_position, status, again_count, last_rating,
                          presented_at, answered_at, updated_at
                """).param("user", userId).param("session", sessionId).param("word", wordId)
                .param("position", queuePosition).query(FsrsRepository::mapSessionItem).single();
    }

    public List<ReviewSessionItem> findSessionItems(UUID userId, UUID sessionId) {
        return jdbc.sql("""
                SELECT user_id, session_id, word_id, queue_position, status, again_count, last_rating,
                       presented_at, answered_at, updated_at
                FROM review_session_items WHERE user_id = :user AND session_id = :session
                ORDER BY queue_position, word_id
                """).param("user", userId).param("session", sessionId)
                .query(FsrsRepository::mapSessionItem).list();
    }

    public List<ReviewSessionItem> findPendingSessionItems(UUID userId, UUID sessionId) {
        return jdbc.sql("""
                SELECT user_id, session_id, word_id, queue_position, status, again_count, last_rating,
                       presented_at, answered_at, updated_at
                FROM review_session_items
                WHERE user_id = :user AND session_id = :session AND status = 'PENDING'
                ORDER BY queue_position, word_id
                """).param("user", userId).param("session", sessionId)
                .query(FsrsRepository::mapSessionItem).list();
    }

    public Optional<ReviewSessionItem> lockSessionItem(UUID userId, UUID sessionId, UUID wordId) {
        return jdbc.sql("""
                SELECT user_id, session_id, word_id, queue_position, status, again_count, last_rating,
                       presented_at, answered_at, updated_at
                FROM review_session_items
                WHERE user_id = :user AND session_id = :session AND word_id = :word FOR UPDATE
                """).param("user", userId).param("session", sessionId).param("word", wordId)
                .query(FsrsRepository::mapSessionItem).optional();
    }

    /** Non-locking membership check, used before reserving an idempotency row whose FK targets this item. */
    public boolean hasSessionItem(UUID userId, UUID sessionId, UUID wordId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM review_session_items "
                        + "WHERE user_id = :user AND session_id = :session AND word_id = :word)")
                .param("user", userId).param("session", sessionId).param("word", wordId)
                .query(Boolean.class).single();
    }

    /**
     * Completes only after the caller's FSRS policy says the card graduated to REVIEW. Otherwise it remains
     * pending and returns to the queue tail. The caller must lock the owning session before this update.
     */
    public Optional<ReviewSessionItem> recordSessionItemRating(UUID userId, UUID sessionId, UUID wordId,
                                                               FsrsRating rating, boolean completed,
                                                               Instant reviewedAt) {
        Objects.requireNonNull(rating, "rating");
        boolean again = rating == FsrsRating.AGAIN;
        return jdbc.sql("""
                WITH tail AS (
                    SELECT COALESCE(MAX(queue_position), 0) + 1 AS position
                    FROM review_session_items WHERE user_id = :user AND session_id = :session
                )
                UPDATE review_session_items item
                SET queue_position = CASE WHEN :completed THEN item.queue_position ELSE (SELECT position FROM tail) END,
                    status = CASE WHEN :completed THEN 'COMPLETED' ELSE 'PENDING' END,
                    again_count = item.again_count + CASE WHEN :again THEN 1 ELSE 0 END,
                    last_rating = :rating,
                    presented_at = COALESCE(item.presented_at, :reviewedAt),
                    answered_at = :reviewedAt,
                    updated_at = :reviewedAt
                WHERE item.user_id = :user AND item.session_id = :session AND item.word_id = :word
                  AND item.status = 'PENDING'
                RETURNING item.user_id, item.session_id, item.word_id, item.queue_position, item.status,
                          item.again_count, item.last_rating, item.presented_at, item.answered_at, item.updated_at
                """).param("user", userId).param("session", sessionId).param("word", wordId)
                .param("completed", completed).param("again", again).param("rating", rating.name()).param("reviewedAt", dbTime(reviewedAt))
                .query(FsrsRepository::mapSessionItem).optional();
    }

    public List<QueueEntry> findSessionQueue(UUID userId, UUID sessionId) {
        return jdbc.sql("""
                SELECT item.user_id, item.session_id, item.word_id, item.queue_position, item.status,
                       item.again_count, item.last_rating, item.presented_at, item.answered_at, item.updated_at,
                       card.due_at, card.fsrs_state, card.learning_step
                FROM review_session_items item
                JOIN review_cards card ON card.user_id = item.user_id AND card.word_id = item.word_id
                WHERE item.user_id = :user AND item.session_id = :session
                ORDER BY item.queue_position, item.word_id
                """).param("user", userId).param("session", sessionId)
                .query((rs, row) -> new QueueEntry(mapSessionItem(rs, row),
                        toInstant(rs.getObject("due_at", OffsetDateTime.class)),
                        FsrsCardState.valueOf(rs.getString("fsrs_state")), rs.getInt("learning_step"))).list();
    }

    public UserStreak recordDueCompletion(UUID userId, LocalDate studyDate, Instant updatedAt) {
        return jdbc.sql("""
                INSERT INTO user_streaks (user_id, current_streak, longest_streak,
                                          last_eligible_study_date, updated_at)
                VALUES (:user, 1, 1, :studyDate, :updatedAt)
                ON CONFLICT (user_id) DO UPDATE SET
                    current_streak = CASE
                        WHEN user_streaks.last_eligible_study_date IS NULL THEN 1
                        WHEN user_streaks.last_eligible_study_date >= EXCLUDED.last_eligible_study_date
                            THEN user_streaks.current_streak
                        WHEN user_streaks.last_eligible_study_date = EXCLUDED.last_eligible_study_date - 1
                            THEN user_streaks.current_streak + 1
                        ELSE 1
                    END,
                    longest_streak = GREATEST(user_streaks.longest_streak, CASE
                        WHEN user_streaks.last_eligible_study_date IS NULL THEN 1
                        WHEN user_streaks.last_eligible_study_date >= EXCLUDED.last_eligible_study_date
                            THEN user_streaks.current_streak
                        WHEN user_streaks.last_eligible_study_date = EXCLUDED.last_eligible_study_date - 1
                            THEN user_streaks.current_streak + 1
                        ELSE 1
                    END),
                    last_eligible_study_date = GREATEST(
                        COALESCE(user_streaks.last_eligible_study_date, EXCLUDED.last_eligible_study_date),
                        EXCLUDED.last_eligible_study_date),
                    updated_at = EXCLUDED.updated_at
                RETURNING user_id, current_streak, longest_streak, last_eligible_study_date, updated_at
                """).param("user", userId).param("studyDate", studyDate).param("updatedAt", dbTime(updatedAt))
                .query(FsrsRepository::mapStreak).single();
    }

    public Optional<ReviewSession> finishSession(UUID userId, UUID sessionId, SessionStatus terminalStatus,
                                                  Instant finishedAt) {
        if (terminalStatus == SessionStatus.IN_PROGRESS) throw new IllegalArgumentException("Terminal status required");
        return jdbc.sql("""
                UPDATE review_sessions SET status = :status, finished_at = :finishedAt
                WHERE user_id = :user AND id = :session AND status = 'IN_PROGRESS'
                RETURNING id, user_id, session_type, status, target_count, started_at, finished_at, metadata::text AS metadata_json
                """).param("status", terminalStatus.name()).param("finishedAt", dbTime(finishedAt))
                .param("user", userId).param("session", sessionId)
                .query(FsrsRepository::mapSession).optional();
    }

    /**
     * Reserves an idempotency token inside the caller's transaction. true means this call owns the reservation;
     * false means a non-expired token already exists and should be compared/replayed via findIdempotency().
     */
    public boolean reserveIdempotency(UUID userId, UUID token, UUID sessionId, UUID wordId, FsrsRating rating,
                                      byte[] requestHash) {
        if (requestHash == null || requestHash.length != 32) throw new IllegalArgumentException("requestHash must be SHA-256");
        return jdbc.sql("""
                INSERT INTO review_idempotency (user_id, request_token, session_id, word_id, rating, request_hash, state)
                VALUES (:user, :token, :session, :word, :rating, :hash, 'PROCESSING')
                ON CONFLICT (user_id, request_token) DO UPDATE SET
                    session_id = EXCLUDED.session_id, word_id = EXCLUDED.word_id, rating = EXCLUDED.rating,
                    request_hash = EXCLUDED.request_hash, state = 'PROCESSING', http_status = NULL,
                    stored_response = NULL, created_at = now(), completed_at = NULL,
                    expires_at = now() + interval '30 days'
                WHERE review_idempotency.expires_at <= now()
                """).param("user", userId).param("token", token).param("session", sessionId)
                .param("word", wordId).param("rating", rating.name()).param("hash", requestHash).update() == 1;
    }

    public Optional<IdempotencyRecord> findIdempotency(UUID userId, UUID token) {
        return jdbc.sql("""
                SELECT user_id, request_token, session_id, word_id, rating, request_hash, state,
                       http_status, stored_response::text AS response_json, created_at, completed_at, expires_at
                FROM review_idempotency
                WHERE user_id = :user AND request_token = :token AND expires_at > now()
                """).param("user", userId).param("token", token)
                .query(FsrsRepository::mapIdempotency).optional();
    }

    public void completeIdempotency(UUID userId, UUID token, byte[] requestHash, int httpStatus,
                                    String responseJson) {
        if (httpStatus < 200 || httpStatus > 299) throw new IllegalArgumentException("Only successful responses are persisted");
        int updated = jdbc.sql("""
                UPDATE review_idempotency SET state = 'COMPLETED', http_status = :status,
                    stored_response = CAST(:response AS jsonb), completed_at = now()
                WHERE user_id = :user AND request_token = :token AND request_hash = :hash AND state = 'PROCESSING'
                """).param("status", httpStatus).param("response", responseJson).param("user", userId)
                .param("token", token).param("hash", requestHash).update();
        if (updated != 1) throw new IllegalStateException("Idempotency reservation was not owned by this request");
    }

    public int purgeExpiredIdempotency() {
        return jdbc.sql("DELETE FROM review_idempotency WHERE expires_at <= now()").update();
    }

    public Optional<UserStreak> findStreak(UUID userId) {
        return jdbc.sql("""
                SELECT user_id, current_streak, longest_streak, last_eligible_study_date, updated_at
                FROM user_streaks WHERE user_id = :user
                """).param("user", userId).query(FsrsRepository::mapStreak).optional();
    }

    public UserStreak saveStreak(UUID userId, int currentStreak, int longestStreak,
                                LocalDate lastEligibleStudyDate, Instant updatedAt) {
        if (currentStreak < 0 || longestStreak < currentStreak) {
            throw new IllegalArgumentException("Streak values are inconsistent");
        }
        return jdbc.sql("""
                INSERT INTO user_streaks (user_id, current_streak, longest_streak,
                                          last_eligible_study_date, updated_at)
                VALUES (:user, :current, :longest, :lastDate, :updatedAt)
                ON CONFLICT (user_id) DO UPDATE SET current_streak = EXCLUDED.current_streak,
                    longest_streak = EXCLUDED.longest_streak,
                    last_eligible_study_date = EXCLUDED.last_eligible_study_date,
                    updated_at = EXCLUDED.updated_at
                RETURNING user_id, current_streak, longest_streak, last_eligible_study_date, updated_at
                """).param("user", userId).param("current", currentStreak).param("longest", longestStreak)
                .param("lastDate", lastEligibleStudyDate).param("updatedAt", dbTime(updatedAt))
                .query(FsrsRepository::mapStreak).single();
    }

    static ReviewCard mapReviewCard(ResultSet rs, int row) throws SQLException {
        OffsetDateTime lastReviewed = rs.getObject("last_reviewed_at", OffsetDateTime.class);
        return new ReviewCard(rs.getObject("user_id", UUID.class), rs.getObject("word_id", UUID.class),
                new FsrsCard(toInstant(rs.getObject("due_at", OffsetDateTime.class)), rs.getDouble("stability"),
                        rs.getDouble("difficulty"), rs.getInt("repetitions"), rs.getInt("lapses"),
                        FsrsCardState.valueOf(rs.getString("fsrs_state")), toInstant(lastReviewed),
                        rs.getInt("learning_step")), rs.getString("scheduler_version"));
    }

    static PersistedReviewLog mapReviewLog(ResultSet rs, int row) throws SQLException {
        String state = rs.getString("state_before");
        Integer scheduledDays = rs.getObject("scheduled_days", Integer.class);
        Double elapsedDays = rs.getObject("elapsed_days", Double.class);
        return new PersistedReviewLog(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                rs.getObject("word_id", UUID.class), FsrsRating.valueOf(rs.getString("rating")),
                toInstant(rs.getObject("reviewed_at", OffsetDateTime.class)),
                toInstant(rs.getObject("previous_due_at", OffsetDateTime.class)),
                toInstant(rs.getObject("next_due_at", OffsetDateTime.class)),
                state == null ? null : FsrsCardState.valueOf(state), elapsedDays, scheduledDays);
    }

    private static ReviewSession mapSession(ResultSet rs, int row) throws SQLException {
        return new ReviewSession(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                SessionType.valueOf(rs.getString("session_type")), SessionStatus.valueOf(rs.getString("status")),
                rs.getInt("target_count"), toInstant(rs.getObject("started_at", OffsetDateTime.class)),
                toInstant(rs.getObject("finished_at", OffsetDateTime.class)), rs.getString("metadata_json"));
    }

    private static ReviewSessionItem mapSessionItem(ResultSet rs, int row) throws SQLException {
        String rating = rs.getString("last_rating");
        return new ReviewSessionItem(rs.getObject("user_id", UUID.class), rs.getObject("session_id", UUID.class),
                rs.getObject("word_id", UUID.class), rs.getLong("queue_position"),
                ItemStatus.valueOf(rs.getString("status")), rs.getInt("again_count"),
                rating == null ? null : FsrsRating.valueOf(rating),
                toInstant(rs.getObject("presented_at", OffsetDateTime.class)),
                toInstant(rs.getObject("answered_at", OffsetDateTime.class)),
                toInstant(rs.getObject("updated_at", OffsetDateTime.class)));
    }

    private static IdempotencyRecord mapIdempotency(ResultSet rs, int row) throws SQLException {
        Short status = rs.getObject("http_status", Short.class);
        return new IdempotencyRecord(rs.getObject("user_id", UUID.class), rs.getObject("request_token", UUID.class),
                rs.getObject("session_id", UUID.class), rs.getObject("word_id", UUID.class),
                FsrsRating.valueOf(rs.getString("rating")), rs.getBytes("request_hash"),
                IdempotencyState.valueOf(rs.getString("state")), status == null ? null : status.intValue(),
                rs.getString("response_json"), toInstant(rs.getObject("created_at", OffsetDateTime.class)),
                toInstant(rs.getObject("completed_at", OffsetDateTime.class)),
                toInstant(rs.getObject("expires_at", OffsetDateTime.class)));
    }

    private static UserStreak mapStreak(ResultSet rs, int row) throws SQLException {
        return new UserStreak(rs.getObject("user_id", UUID.class), rs.getInt("current_streak"),
                rs.getInt("longest_streak"), rs.getObject("last_eligible_study_date", LocalDate.class),
                toInstant(rs.getObject("updated_at", OffsetDateTime.class)));
    }

    private static OffsetDateTime dbTime(Instant instant) {
        // PostgreSQL TIMESTAMPTZ stores microseconds; normalize before binding to keep round-trips deterministic.
        return Objects.requireNonNull(instant, "instant").truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC);
    }

    private static OffsetDateTime dbTimeOrNull(Instant instant) {
        return instant == null ? null : dbTime(instant);
    }

    private static Instant toInstant(OffsetDateTime value) {
        return value == null ? null : value.toInstant();
    }

    private static void requireLimit(int limit) {
        if (limit < 1 || limit > 500) throw new IllegalArgumentException("limit must be 1..500");
    }

    public enum SessionType { DUE, CRAM }
    public enum SessionStatus { IN_PROGRESS, COMPLETED, ABANDONED }
    public enum ItemStatus { PENDING, COMPLETED }
    public enum IdempotencyState { PROCESSING, COMPLETED }

    public record ReviewCard(UUID userId, UUID wordId, FsrsCard card, String schedulerVersion) {}

    public record PersistedReviewLog(UUID id, UUID userId, UUID wordId, FsrsRating rating, Instant reviewedAt,
                                     Instant previousDue, Instant nextDue, FsrsCardState stateBefore,
                                     Double elapsedDays, Integer scheduledDays) {}

    public record ReviewSession(UUID id, UUID userId, SessionType type, SessionStatus status, int targetCount,
                                Instant startedAt, Instant finishedAt, String metadataJson) {}

    public record ReviewSessionItem(UUID userId, UUID sessionId, UUID wordId, long queuePosition, ItemStatus status,
                                    int againCount, FsrsRating lastRating, Instant presentedAt, Instant answeredAt,
                                    Instant updatedAt) {}

    public record IdempotencyRecord(UUID userId, UUID requestToken, UUID sessionId, UUID wordId, FsrsRating rating,
                                    byte[] requestHash, IdempotencyState state, Integer httpStatus,
                                    String responseJson, Instant createdAt, Instant completedAt, Instant expiresAt) {
        public IdempotencyRecord {
            requestHash = requestHash == null ? null : requestHash.clone();
        }

        @Override
        public byte[] requestHash() {
            return requestHash == null ? null : requestHash.clone();
        }

        public boolean matches(UUID expectedSession, UUID expectedWord, FsrsRating expectedRating, byte[] expectedHash) {
            return sessionId.equals(expectedSession) && wordId.equals(expectedWord) && rating == expectedRating
                    && requestHash != null && expectedHash != null && MessageDigest.isEqual(requestHash, expectedHash);
        }
    }

    public record UserStreak(UUID userId, int currentStreak, int longestStreak,
                             LocalDate lastEligibleStudyDate, Instant updatedAt) {}

    public record CardSummary(int dueCount, int newCount, int learningCount, int reviewCount,
                              int relearningCount, int totalCards) {}

    public record QueueEntry(ReviewSessionItem item, Instant dueAt, FsrsCardState cardState, int learningStep) {}
}
