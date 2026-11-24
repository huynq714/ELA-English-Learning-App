package com.englishlearning.fsrs;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable memory state of an FSRS card.
 * Compatible with PostgreSQL review_cards table:
 * (user_id, word_id, due_at, stability, difficulty, repetitions, lapses, fsrs_state, last_reviewed_at, scheduler_version)
 */
public record FsrsCard(
        Instant due,
        double stability,
        double difficulty,
        int repetitions,
        int lapses,
        FsrsCardState state,
        Instant lastReviewed,
        int step
) {
    public static final double MIN_STABILITY = 0.1;
    public static final double MAX_STABILITY = 36500.0;

    public FsrsCard {
        Objects.requireNonNull(due, "Due date cannot be null");
        Objects.requireNonNull(state, "Card state cannot be null");
        if (!Double.isFinite(stability) || !Double.isFinite(difficulty)) {
            throw new IllegalArgumentException("Stability and difficulty must be finite");
        }
        if (state == FsrsCardState.NEW) {
            if (stability != 0.0 || difficulty != 0.0 || step != 0) {
                throw new IllegalArgumentException("NEW cards must have zero memory state and step");
            }
        } else if (stability < MIN_STABILITY || stability > MAX_STABILITY || difficulty < 1.0 || difficulty > 10.0) {
            throw new IllegalArgumentException("Scheduled cards require stability in [0.1, 36500] and difficulty in [1, 10]");
        }
        if ((state == FsrsCardState.REVIEW && step != 0)) {
            throw new IllegalArgumentException("REVIEW cards must have step 0");
        }
        if (repetitions < 0) {
            throw new IllegalArgumentException("Repetitions cannot be negative: " + repetitions);
        }
        if (lapses < 0) {
            throw new IllegalArgumentException("Lapses cannot be negative: " + lapses);
        }
        if (step < 0) {
            throw new IllegalArgumentException("Step cannot be negative: " + step);
        }
    }

    /**
     * Factory for creating a brand-new card.
     */
    public static FsrsCard newCard(Instant now) {
        Objects.requireNonNull(now, "Now timestamp cannot be null");
        return new FsrsCard(now, 0.0, 0.0, 0, 0, FsrsCardState.NEW, null, 0);
    }

    /**
     * Helper to clone with modified values.
     */
    public FsrsCard with(
            Instant newDue,
            double newStability,
            double newDifficulty,
            int newRepetitions,
            int newLapses,
            FsrsCardState newState,
            Instant newLastReviewed,
            int newStep
    ) {
        return new FsrsCard(newDue, newStability, newDifficulty, newRepetitions, newLapses, newState, newLastReviewed, newStep);
    }
}
