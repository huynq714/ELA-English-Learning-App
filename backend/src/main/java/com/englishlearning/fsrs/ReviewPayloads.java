package com.englishlearning.fsrs;

import com.englishlearning.vocabulary.dto.DeckWordResponse;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

final class ReviewPayloads {
    static final String UUID_PATTERN = "(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    record Start(@NotNull @Pattern(regexp = "DUE|CRAM") String type) {}
    record Rate(@NotNull @Pattern(regexp = UUID_PATTERN) String wordId,
                @NotNull @Pattern(regexp = "AGAIN|HARD|GOOD|EASY") String rating,
                @NotNull @Pattern(regexp = UUID_PATTERN) String clientRequestToken) {}
    record Session(FsrsService.SessionView session, List<DeckWordResponse> words) {}
    record Error(String code, String message, Instant nextDueAt) {}
}
