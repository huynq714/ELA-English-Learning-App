package com.englishlearning.vocabulary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "decks")
public class Deck {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(length = 8)
    private String level;

    @Column(name = "topic_key", length = 64)
    private String topicKey;

    @Column(length = 120)
    private String topic;

    @Column(name = "topic_source", length = 12)
    private String topicSource;

    @Column(name = "topic_source_label", length = 120)
    private String topicSourceLabel;

    @Column(name = "is_published", nullable = false)
    private boolean published;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected Deck() {
    }

    public static Deck create(String title, String description, String level, boolean published) {
        Deck deck = new Deck();
        deck.title = title;
        deck.description = description;
        deck.level = level;
        deck.published = published;
        deck.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        return deck;
    }

    public void update(String title, String description, String level, Boolean published) {
        if (title != null) {
            this.title = title;
        }
        if (description != null) {
            this.description = description;
        }
        if (level != null) {
            this.level = level;
        }
        if (published != null) {
            this.published = published;
        }
    }

    public void unpublish() {
        this.published = false;
    }

    public UUID getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getLevel() {
        return level;
    }

    public String getTopicKey() {
        return topicKey;
    }

    public String getTopic() {
        return topic;
    }

    public String getTopicSource() {
        return topicSource;
    }

    public String getTopicSourceLabel() {
        return topicSourceLabel;
    }

    public boolean isPublished() {
        return published;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
