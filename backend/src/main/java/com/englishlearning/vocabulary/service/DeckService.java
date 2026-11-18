package com.englishlearning.vocabulary.service;

import com.englishlearning.profile.entity.UserProfile;
import com.englishlearning.profile.repository.UserProfileRepository;
import com.englishlearning.vocabulary.dto.DeckCreateRequest;
import com.englishlearning.vocabulary.dto.DeckPatchRequest;
import com.englishlearning.vocabulary.dto.DeckResponse;
import com.englishlearning.vocabulary.entity.Deck;
import com.englishlearning.vocabulary.repository.DeckRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class DeckService {

    private final DeckRepository deckRepository;
    private final UserProfileRepository profiles;

    public DeckService(DeckRepository deckRepository, UserProfileRepository profiles) {
        this.deckRepository = deckRepository;
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public List<DeckResponse> listPublished(UUID userId) {
        return deckRepository.findAllByPublishedTrueAndLevelAndTopicKeyIsNotNullOrderByTopicKey(profileLevel(userId)).stream()
                .map(DeckResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public Deck requirePublishedDeck(UUID userId, UUID id) {
        return deckRepository.findByIdAndPublishedTrueAndLevelAndTopicKeyIsNotNull(id, profileLevel(userId))
                .orElseThrow(() -> new DeckNotFoundException(id));
    }

    private String profileLevel(UUID userId) {
        return profiles.findById(userId).map(UserProfile::getEnglishLevel)
                .filter(level -> !level.isBlank())
                .orElseThrow(ProfileLevelRequiredException::new);
    }

    @Transactional
    public DeckResponse create(DeckCreateRequest request) {
        String title = normalizeTitle(request.title());
        Deck deck = Deck.create(
                title,
                request.description(),
                request.level(),
                request.isPublished() == null || request.isPublished()
        );
        return DeckResponse.from(deckRepository.save(deck));
    }

    @Transactional
    public DeckResponse update(UUID id, DeckPatchRequest request) {
        if (!request.hasChanges()) {
            throw new IllegalArgumentException("At least one editable field is required");
        }
        if (request.title() != null && request.title().isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }

        Deck deck = deckRepository.findById(id)
                .orElseThrow(() -> new DeckNotFoundException(id));
        if (deck.getTopicKey() != null && request.level() != null && !request.level().equals(deck.getLevel())) {
            throw new IllegalArgumentException("The level of an imported topic deck is fixed by its source");
        }
        deck.update(
                request.title() == null ? null : request.title().trim(),
                request.description(),
                request.level(),
                request.isPublished()
        );
        return DeckResponse.from(deckRepository.save(deck));
    }

    @Transactional
    public void softDelete(UUID id) {
        Deck deck = deckRepository.findById(id)
                .orElseThrow(() -> new DeckNotFoundException(id));
        deck.unpublish();
        deckRepository.save(deck);
    }

    private String normalizeTitle(String title) {
        String normalized = title.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("title must not be blank");
        }
        return normalized;
    }

}
