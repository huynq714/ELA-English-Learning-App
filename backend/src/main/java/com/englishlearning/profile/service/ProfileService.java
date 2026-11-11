package com.englishlearning.profile.service;

import com.englishlearning.profile.dto.ProfilePatchRequest;
import com.englishlearning.profile.dto.ProfilePutRequest;
import com.englishlearning.profile.dto.ProfileResponse;
import com.englishlearning.profile.entity.User;
import com.englishlearning.profile.entity.UserProfile;
import com.englishlearning.profile.repository.UserProfileRepository;
import com.englishlearning.profile.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Accepts a user id from the dev controller; production callers must source it from Authentication. */
@Service
public class ProfileService {

    private static final String DEFAULT_LEVEL = "A1";
    private static final int DEFAULT_DAILY_GOAL = 15;

    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;

    public ProfileService(UserRepository userRepository, UserProfileRepository profileRepository) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
    }

    @Transactional(readOnly = true)
    public ProfileResponse get(UUID userId) {
        requireUser(userId);
        return profileRepository.findById(userId).map(ProfileResponse::from)
                .orElseThrow(() -> new ProfileNotFoundException(userId));
    }

    /** PUT creates a profile if absent and replaces its editable values if present. */
    @Transactional
    public ProfileResponse put(UUID userId, ProfilePutRequest request) {
        User user = requireUser(userId);
        var existing = profileRepository.findById(userId);
        UserProfile profile;
        if (existing.isPresent()) {
            profile = existing.get();
            profile.update(request.englishLevel(), request.dailyGoalMinutes(), request.avatarUrl(), true);
        } else {
            profile = UserProfile.create(user, request.englishLevel(),
                    request.dailyGoalMinutes(), request.avatarUrl());
        }
        return ProfileResponse.from(profileRepository.save(profile));
    }

    /** PATCH initializes missing profiles from the database defaults, then applies supplied fields. */
    @Transactional
    public ProfileResponse patch(UUID userId, ProfilePatchRequest request) {
        if (!request.hasChanges()) {
            throw new IllegalArgumentException("At least one profile field is required");
        }
        if (request.isEnglishLevelProvided() && request.getEnglishLevel() == null) {
            throw new IllegalArgumentException("englishLevel cannot be null");
        }
        if (request.isDailyGoalMinutesProvided() && request.getDailyGoalMinutes() == null) {
            throw new IllegalArgumentException("dailyGoalMinutes cannot be null");
        }

        User user = requireUser(userId);
        UserProfile profile = profileRepository.findById(userId)
                .orElseGet(() -> UserProfile.create(user, DEFAULT_LEVEL, DEFAULT_DAILY_GOAL, null));
        profile.update(
                request.getEnglishLevel(),
                request.getDailyGoalMinutes(),
                request.getAvatarUrl(),
                request.isAvatarUrlProvided()
        );
        return ProfileResponse.from(profileRepository.save(profile));
    }

    private User requireUser(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> new UserNotFoundException(userId));
    }
}
