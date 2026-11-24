package com.englishlearning.fsrs;

import java.util.Objects;

/**
 * Result of scheduling an FSRS card evaluation.
 */
public record FsrsSchedulingResult(
        FsrsCard card,
        FsrsReviewLog reviewLog
) {
    public FsrsSchedulingResult {
        Objects.requireNonNull(card, "Card cannot be null");
        Objects.requireNonNull(reviewLog, "ReviewLog cannot be null");
    }
}
