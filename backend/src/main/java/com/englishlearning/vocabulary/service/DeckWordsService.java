package com.englishlearning.vocabulary.service;

import com.englishlearning.vocabulary.dto.DeckWordResponse;
import com.englishlearning.vocabulary.repository.DeckRepository;
import com.englishlearning.vocabulary.repository.WordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class DeckWordsService {
    private final DeckRepository deckRepository;
    private final WordRepository wordRepository;

    public DeckWordsService(DeckRepository deckRepository, WordRepository wordRepository) {
        this.deckRepository = deckRepository;
        this.wordRepository = wordRepository;
    }

    @Transactional(readOnly = true)
    public List<DeckWordResponse> listPublishedDeckWords(UUID deckId) {
        if (deckRepository.findByIdAndPublishedTrue(deckId).isEmpty()) {
            throw new DeckNotFoundException(deckId);
        }
        return wordRepository.findAllForDeck(deckId).stream().map(DeckWordResponse::from).toList();
    }
}
