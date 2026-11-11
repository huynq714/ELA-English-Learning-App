package com.englishlearning.vocabulary.repository;

import com.englishlearning.vocabulary.entity.Deck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.util.List;
import java.util.Optional;

public interface DeckRepository extends JpaRepository<Deck, UUID> {

    List<Deck> findAllByPublishedTrueOrderByCreatedAtDesc();

    Optional<Deck> findByIdAndPublishedTrue(UUID id);
}
