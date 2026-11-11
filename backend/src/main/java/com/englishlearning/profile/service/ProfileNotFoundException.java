package com.englishlearning.profile.service;

import java.util.UUID;

public class ProfileNotFoundException extends RuntimeException {
    public ProfileNotFoundException(UUID userId) {
        super("Profile not found for user: " + userId);
    }
}
