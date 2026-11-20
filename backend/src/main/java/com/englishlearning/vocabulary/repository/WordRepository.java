package com.englishlearning.vocabulary.repository;

import com.englishlearning.vocabulary.entity.Word;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    String SAVED_WORD_FILTER = """
            FROM user_saved_words saved JOIN words w ON w.id = saved.word_id
            WHERE saved.user_id = :userId
              AND (:level = '' OR w.cefr_level = :level)
              AND (:groupId IS NULL OR EXISTS (
                  SELECT 1 FROM deck_words group_link WHERE group_link.deck_id = :groupId AND group_link.word_id = w.id
              ))
              AND (strpos(lower(w.headword COLLATE pg_catalog.pg_unicode_fast), lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0
                OR strpos(lower(w.meaning_vi COLLATE pg_catalog.pg_unicode_fast), lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0)
            """;

    @Query(value = "SELECT w.* " + SAVED_WORD_FILTER + " ORDER BY saved.created_at DESC, saved.id DESC",
           countQuery = "SELECT count(*) " + SAVED_WORD_FILTER, nativeQuery = true)
    Page<Word> findSavedWords(UUID userId, String level, String query, UUID groupId, Pageable pageable);
}
