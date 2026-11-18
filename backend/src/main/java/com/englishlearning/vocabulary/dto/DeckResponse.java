package com.englishlearning.vocabulary.dto;

import com.englishlearning.vocabulary.entity.Deck;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DeckResponse(
        UUID id,
        String title,
        String description,
        String level,
        String topicKey,
        String topic,
        String topicSource,
        String topicSourceLabel,
        boolean isPublished,
        OffsetDateTime createdAt
) {

    public static DeckResponse from(Deck deck) {
        return new DeckResponse(
                deck.getId(),
                deck.getTitle(),
                deck.getDescription(),
                deck.getLevel(),
                deck.getTopicKey(),
                deck.getTopic(),
                deck.getTopicSource(),
                deck.getTopicSourceLabel(),
                deck.isPublished(),
                deck.getCreatedAt()
        );
    }
}
