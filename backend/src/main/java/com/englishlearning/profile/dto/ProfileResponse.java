package com.englishlearning.profile.dto;

import com.englishlearning.profile.entity.UserProfile;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ProfileResponse(
        UUID userId,
        String englishLevel,
        int dailyGoalMinutes,
        String avatarUrl,
        OffsetDateTime updatedAt
) {
    public static ProfileResponse from(UserProfile profile) {
        return new ProfileResponse(profile.getUserId(), profile.getEnglishLevel(),
                profile.getDailyGoalMinutes(), profile.getAvatarUrl(), profile.getUpdatedAt());
    }
}
