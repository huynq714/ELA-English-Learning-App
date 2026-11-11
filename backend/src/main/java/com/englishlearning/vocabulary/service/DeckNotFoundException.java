package com.englishlearning.vocabulary.service;

import java.util.UUID;

public class DeckNotFoundException extends RuntimeException {

    public DeckNotFoundException(UUID id) {
        super("Deck not found: " + id);
    }
}
