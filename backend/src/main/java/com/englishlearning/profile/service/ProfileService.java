package com.englishlearning.profile.service;

import com.englishlearning.profile.dto.CurrentProfilePatchRequest;
import com.englishlearning.profile.dto.CurrentProfileResponse;
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

/** The current-user controller supplies the authenticated account ID. */
@Service
public class ProfileService {

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
        return applyPatch(requireUser(userId), request);
    }

    @Transactional
    public CurrentProfileResponse patchCurrent(UUID userId, CurrentProfilePatchRequest request) {
        var user = requireUser(userId);
        if (request.isAvatarUrlProvided()) AvatarImage.validate(request.getAvatarUrl());
        if (request.isDisplayNameProvided()) {
            String name = request.getDisplayName();
            if (name == null || name.isBlank()) {
                throw new IllegalArgumentException("displayName cannot be blank");
            }
            user.changeDisplayName(name.strip());
        }
        return CurrentProfileResponse.from(applyPatch(user, request), user.getDisplayName());
    }

    private ProfileResponse applyPatch(User user, ProfilePatchRequest request) {
        if (!request.hasChanges()) {
            throw new IllegalArgumentException("At least one profile field is required");
        }
        if (request.isEnglishLevelProvided() && request.getEnglishLevel() == null) {
            throw new IllegalArgumentException("englishLevel cannot be null");
        }
        if (request.isDailyGoalMinutesProvided() && request.getDailyGoalMinutes() == null) {
            throw new IllegalArgumentException("dailyGoalMinutes cannot be null");
        }

        UserProfile profile = profileRepository.findById(user.getId())
                .orElseGet(() -> UserProfile.createDefault(user));
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
