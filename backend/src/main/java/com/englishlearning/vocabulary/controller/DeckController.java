package com.englishlearning.vocabulary.controller;

import com.englishlearning.vocabulary.dto.DeckResponse;
import com.englishlearning.vocabulary.dto.DeckWordResponse;
import com.englishlearning.vocabulary.service.DeckService;
import com.englishlearning.vocabulary.service.DeckWordsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/decks")
public class DeckController {

    private final DeckService deckService;
    private final DeckWordsService deckWordsService;

    public DeckController(DeckService deckService, DeckWordsService deckWordsService) {
        this.deckService = deckService;
        this.deckWordsService = deckWordsService;
    }

    @GetMapping
    public List<DeckResponse> listPublished() {
        return deckService.listPublished();
    }

    @GetMapping("/{id}")
    public DeckResponse getPublished(@PathVariable UUID id) {
        return deckService.getPublished(id);
    }

    @GetMapping("/{id}/words")
    public List<DeckWordResponse> listPublishedWords(@PathVariable UUID id) {
        return deckWordsService.listPublishedDeckWords(id);
    }
}
