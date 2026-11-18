package com.englishlearning.profile.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CurrentProfileResponse(
        UUID userId,
        String displayName,
        String englishLevel,
        int dailyGoalMinutes,
        String avatarUrl,
        OffsetDateTime updatedAt
) {
    public static CurrentProfileResponse from(ProfileResponse profile, String displayName) {
        return new CurrentProfileResponse(profile.userId(), displayName, profile.englishLevel(),
                profile.dailyGoalMinutes(), profile.avatarUrl(), profile.updatedAt());
    }
}
