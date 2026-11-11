package com.englishlearning.vocabulary.controller;

import com.englishlearning.vocabulary.dto.DeckCreateRequest;
import com.englishlearning.vocabulary.dto.DeckPatchRequest;
import com.englishlearning.vocabulary.dto.DeckResponse;
import com.englishlearning.vocabulary.service.DeckService;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.UUID;

/** Local demonstration endpoints only; they provide no authentication or RBAC. */
@Profile("local")
@RestController
@RequestMapping("/api/v1/dev/decks")
public class DeckDevController {

    private final DeckService deckService;

    public DeckDevController(DeckService deckService) {
        this.deckService = deckService;
    }

    @PostMapping
    public ResponseEntity<DeckResponse> create(@Valid @RequestBody DeckCreateRequest request) {
        DeckResponse created = deckService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PatchMapping("/{id}")
    public DeckResponse update(@PathVariable UUID id, @Valid @RequestBody DeckPatchRequest request) {
        return deckService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDelete(@PathVariable UUID id) {
        deckService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
