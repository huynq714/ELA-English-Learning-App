package com.englishlearning.vocabulary.service;

public class SavedVocabularyGroupNotFoundException extends RuntimeException {
    public SavedVocabularyGroupNotFoundException() {
        super("Saved vocabulary group not found");
    }
}
