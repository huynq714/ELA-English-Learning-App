package com.englishlearning.profile.controller;

import com.englishlearning.profile.dto.ProfilePatchRequest;
import com.englishlearning.profile.dto.ProfilePutRequest;
import com.englishlearning.profile.dto.ProfileResponse;
import com.englishlearning.profile.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Local-only profile test endpoints; userId is not authenticated identity. */
@Profile("local")
@RestController
@RequestMapping("/api/v1/dev/users/{userId}/profile")
public class ProfileDevController {

    private final ProfileService profileService;

    public ProfileDevController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ProfileResponse get(@PathVariable UUID userId) {
        return profileService.get(userId);
    }

    @PutMapping
    public ProfileResponse put(@PathVariable UUID userId, @Valid @RequestBody ProfilePutRequest request) {
        return profileService.put(userId, request);
    }

    @PatchMapping
    public ProfileResponse patch(@PathVariable UUID userId, @Valid @RequestBody ProfilePatchRequest request) {
        return profileService.patch(userId, request);
    }
}
