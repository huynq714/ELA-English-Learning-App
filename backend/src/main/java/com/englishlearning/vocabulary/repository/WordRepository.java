package com.englishlearning.vocabulary.repository;

import com.englishlearning.vocabulary.entity.Word;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface WordRepository extends JpaRepository<Word, UUID> {

    @Query(value = """
            SELECT w.*
            FROM words w
            JOIN deck_words dw ON dw.word_id = w.id
            WHERE dw.deck_id = :deckId
            ORDER BY dw.sort_order, w.headword, w.id
            """, nativeQuery = true)
    List<Word> findAllForDeck(@Param("deckId") UUID deckId);
}
