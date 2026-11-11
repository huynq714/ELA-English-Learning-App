package com.englishlearning.profile;

import com.englishlearning.profile.dto.ProfilePatchRequest;
import com.englishlearning.profile.dto.ProfilePutRequest;
import com.englishlearning.profile.entity.User;
import com.englishlearning.profile.entity.UserProfile;
import com.englishlearning.profile.repository.UserProfileRepository;
import com.englishlearning.profile.repository.UserRepository;
import com.englishlearning.profile.service.ProfileService;
import com.englishlearning.profile.service.UserNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProfileServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserProfileRepository profileRepository = mock(UserProfileRepository.class);
    private final ProfileService profileService = new ProfileService(userRepository, profileRepository);
    private final UUID userId = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private User user;

    @BeforeEach
    void setUp() {
        user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    }

    @Test
    void putCreatesProfileForExistingUser() {
        when(profileRepository.findById(userId)).thenReturn(Optional.empty());
        when(profileRepository.save(any(UserProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = profileService.put(userId, new ProfilePutRequest("B1", 30, null));

        assertEquals(userId, response.userId());
        assertEquals("B1", response.englishLevel());
        assertEquals(30, response.dailyGoalMinutes());
        verify(profileRepository).save(any(UserProfile.class));
    }

    @Test
    void missingUserCannotGetProfileCreated() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class,
                () -> profileService.put(userId, new ProfilePutRequest("A1", 15, null)));
        verify(profileRepository, never()).save(any());
    }

    @Test
    void patchChangesDailyGoalAndKeepsOtherValues() {
        UserProfile profile = UserProfile.create(user, "A2", 20, "https://example.test/avatar.png");
        when(profileRepository.findById(userId)).thenReturn(Optional.of(profile));
        when(profileRepository.save(any(UserProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ProfilePatchRequest patch = new ProfilePatchRequest();
        patch.setDailyGoalMinutes(60);

        var response = profileService.patch(userId, patch);

        assertEquals("A2", response.englishLevel());
        assertEquals(60, response.dailyGoalMinutes());
        assertEquals("https://example.test/avatar.png", response.avatarUrl());
    }

    @Test
    void patchInitializesMissingProfileFromSchemaDefaults() {
        when(profileRepository.findById(userId)).thenReturn(Optional.empty());
        when(profileRepository.save(any(UserProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ProfilePatchRequest patch = new ProfilePatchRequest();
        patch.setDailyGoalMinutes(45);

        var response = profileService.patch(userId, patch);

        assertEquals("A1", response.englishLevel());
        assertEquals(45, response.dailyGoalMinutes());
        assertEquals(userId, response.userId());
    }
}
