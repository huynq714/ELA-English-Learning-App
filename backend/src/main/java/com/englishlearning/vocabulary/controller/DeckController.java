package com.englishlearning.vocabulary.controller;

import com.englishlearning.vocabulary.dto.DeckResponse;
import com.englishlearning.vocabulary.service.DeckService;
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

    public DeckController(DeckService deckService) {
        this.deckService = deckService;
    }

    @GetMapping
    public List<DeckResponse> listPublished() {
        return deckService.listPublished();
    }

    @GetMapping("/{id}")
    public DeckResponse getPublished(@PathVariable UUID id) {
        return deckService.getPublished(id);
    }
}
