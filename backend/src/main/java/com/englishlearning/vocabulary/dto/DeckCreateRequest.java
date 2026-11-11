package com.englishlearning.vocabulary.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DeckCreateRequest(
        @NotBlank(message = "title is required")
        @Size(max = 120, message = "title must be at most 120 characters")
        String title,

        String description,

        @Pattern(regexp = "A1|A2|B1|B2|C1|C2", message = "level must be one of A1, A2, B1, B2, C1, C2")
        String level,

        Boolean isPublished
) {
}
