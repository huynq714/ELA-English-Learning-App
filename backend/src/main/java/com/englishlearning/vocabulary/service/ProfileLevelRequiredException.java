package com.englishlearning.vocabulary.service;

public class ProfileLevelRequiredException extends RuntimeException {
    public ProfileLevelRequiredException() {
        super("Choose your English level in your profile to view vocabulary decks");
    }
}
