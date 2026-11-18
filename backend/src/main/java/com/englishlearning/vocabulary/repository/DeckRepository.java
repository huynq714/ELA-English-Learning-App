package com.englishlearning.vocabulary.repository;

import com.englishlearning.vocabulary.entity.Deck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.util.List;
import java.util.Optional;

public interface DeckRepository extends JpaRepository<Deck, UUID> {

    List<Deck> findAllByPublishedTrueAndLevelAndTopicKeyIsNotNullOrderByTopicKey(String level);

    Optional<Deck> findByIdAndPublishedTrueAndLevelAndTopicKeyIsNotNull(UUID id, String level);
}
