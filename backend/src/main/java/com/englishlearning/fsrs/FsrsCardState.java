package com.englishlearning.fsrs;

/**
 * State of a flashcard in the FSRS lifecycle.
 * Matches the PostgreSQL CHECK constraint:
 * CHECK (fsrs_state IN ('NEW','LEARNING','REVIEW','RELEARNING'))
 */
public enum FsrsCardState {
    NEW,
    LEARNING,
    REVIEW,
    RELEARNING;

    public static FsrsCardState fromName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Card state name cannot be null or blank");
        }
        return valueOf(name.trim().toUpperCase());
    }
}
