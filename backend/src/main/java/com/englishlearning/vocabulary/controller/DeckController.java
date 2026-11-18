package com.englishlearning.vocabulary.controller;

import com.englishlearning.auth.AuthService;
import com.englishlearning.vocabulary.dto.DeckResponse;
import com.englishlearning.vocabulary.dto.DeckWordResponse;
import com.englishlearning.vocabulary.service.DeckService;
import com.englishlearning.vocabulary.service.DeckWordsService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
    private final AuthService auth;

    public DeckController(DeckService deckService, DeckWordsService deckWordsService, AuthService auth) {
        this.deckService = deckService;
        this.deckWordsService = deckWordsService;
        this.auth = auth;
    }

    @GetMapping
    public List<DeckResponse> listPublished(@AuthenticationPrincipal Jwt jwt) {
        return deckService.listPublished(auth.requireActiveUser(jwt).id());
    }

    @GetMapping("/{id}")
    public DeckResponse getPublished(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return DeckResponse.from(deckService.requirePublishedDeck(auth.requireActiveUser(jwt).id(), id));
    }

    @GetMapping("/{id}/words")
    public List<DeckWordResponse> listPublishedWords(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return deckWordsService.listPublishedDeckWords(auth.requireActiveUser(jwt).id(), id);
    }
}
