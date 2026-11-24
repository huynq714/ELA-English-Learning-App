package com.englishlearning.fsrs;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable log record of an FSRS review event.
 * Compatible with PostgreSQL review_logs table:
 * (id, user_id, word_id, rating, reviewed_at, previous_due_at, next_due_at)
 */
public record FsrsReviewLog(
        FsrsRating rating,
        FsrsCardState stateBeforeReview,
        Instant reviewedAt,
        double elapsedDays,
        Instant previousDue,
        Instant nextDue,
        int scheduledDays
) {
    public FsrsReviewLog {
        Objects.requireNonNull(rating, "Rating cannot be null");
        Objects.requireNonNull(stateBeforeReview, "State before review cannot be null");
        Objects.requireNonNull(reviewedAt, "ReviewedAt cannot be null");
        Objects.requireNonNull(nextDue, "NextDue cannot be null");
        if (nextDue.isBefore(reviewedAt)) {
            throw new IllegalArgumentException("Next due date (" + nextDue + ") cannot be before reviewedAt (" + reviewedAt + ")");
        }
        if (!Double.isFinite(elapsedDays) || elapsedDays < 0.0) {
            throw new IllegalArgumentException("Elapsed days must be finite and non-negative: " + elapsedDays);
        }
        if (scheduledDays < 0) {
            throw new IllegalArgumentException("Scheduled days cannot be negative: " + scheduledDays);
        }
    }
}
