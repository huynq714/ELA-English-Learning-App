package com.englishlearning.vocabulary.service;

import com.englishlearning.vocabulary.dto.DeckWordResponse;
import com.englishlearning.vocabulary.repository.WordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class DeckWordsService {
    private final DeckService decks;
    private final WordRepository wordRepository;

    public DeckWordsService(DeckService decks, WordRepository wordRepository) {
        this.decks = decks;
        this.wordRepository = wordRepository;
    }

    @Transactional(readOnly = true)
    public List<DeckWordResponse> listPublishedDeckWords(UUID userId, UUID deckId) {
        decks.requirePublishedDeck(userId, deckId);
        return wordRepository.findAllForDeck(deckId).stream().map(DeckWordResponse::from).toList();
    }
}
