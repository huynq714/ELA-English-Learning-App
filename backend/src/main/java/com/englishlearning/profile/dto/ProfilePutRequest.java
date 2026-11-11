package com.englishlearning.profile.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record ProfilePutRequest(
        @NotBlank(message = "englishLevel is required")
        @Pattern(regexp = "A1|A2|B1|B2|C1|C2", message = "englishLevel must be A1, A2, B1, B2, C1, or C2")
        String englishLevel,

        @NotNull(message = "dailyGoalMinutes is required")
        @Min(value = 5, message = "dailyGoalMinutes must be between 5 and 240")
        @Max(value = 240, message = "dailyGoalMinutes must be between 5 and 240")
        Integer dailyGoalMinutes,

        String avatarUrl
) {
}
