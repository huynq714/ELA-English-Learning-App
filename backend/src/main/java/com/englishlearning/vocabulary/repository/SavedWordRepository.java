package com.englishlearning.vocabulary.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import com.englishlearning.vocabulary.service.SavedVocabularyGroupNotFoundException;

import java.util.UUID;
import java.util.List;

@Repository
public class SavedWordRepository {
    private final JdbcClient jdbc;

    public SavedWordRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean exists(UUID userId, UUID wordId) {
        return jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM user_saved_words WHERE user_id = :userId AND word_id = :wordId)
                """).param("userId", userId).param("wordId", wordId).query(Boolean.class).single();
    }

    public boolean saveIfAccessible(UUID userId, UUID wordId) {
        // Keep eligibility equivalent to the published topic catalogue in DeckService.
        return jdbc.sql("""
                INSERT INTO user_saved_words (user_id, word_id)
                SELECT :userId, :wordId
                WHERE EXISTS (
                    SELECT 1 FROM deck_words link
                    JOIN decks deck ON deck.id = link.deck_id
                    JOIN user_profiles profile ON profile.user_id = :userId AND profile.english_level = deck.level
                    WHERE link.word_id = :wordId AND deck.is_published AND deck.topic_key IS NOT NULL
                )
                ON CONFLICT (user_id, word_id) DO NOTHING
                """).param("userId", userId).param("wordId", wordId).update() == 1;
    }

    public void delete(UUID userId, UUID wordId) {
        jdbc.sql("DELETE FROM user_saved_words WHERE user_id = :userId AND word_id = :wordId")
                .param("userId", userId).param("wordId", wordId).update();
    }

    public List<SavedGroup> groups(UUID userId, String query) {
        return jdbc.sql("""
                SELECT d.id AS group_id, d.title AS title, d.topic AS topic, d.level AS level,
                       d.description AS description,
                       count(DISTINCT s.word_id) AS word_count,
                       COALESCE((
                           SELECT string_agg(preview.headword, ', ' ORDER BY preview.headword)
                           FROM (
                               SELECT DISTINCT w2.headword
                               FROM user_saved_words s2
                               JOIN deck_words dw2 ON dw2.word_id = s2.word_id AND dw2.deck_id = d.id
                               JOIN words w2 ON w2.id = s2.word_id
                               WHERE s2.user_id = :userId
                                 AND (
                                   strpos(lower(d.title COLLATE pg_catalog.pg_unicode_fast),
                                          lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0
                                   OR strpos(lower(d.topic COLLATE pg_catalog.pg_unicode_fast),
                                             lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0
                                   OR strpos(lower(w2.headword COLLATE pg_catalog.pg_unicode_fast),
                                             lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0
                                   OR strpos(lower(w2.meaning_vi COLLATE pg_catalog.pg_unicode_fast),
                                             lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0)
                               ORDER BY w2.headword LIMIT 3
                           ) preview
                       ), '') AS preview_words
                FROM decks d
                JOIN deck_words dw ON dw.deck_id = d.id
                JOIN user_saved_words s ON s.word_id = dw.word_id AND s.user_id = :userId
                JOIN words w ON w.id = s.word_id
                WHERE d.topic_key IS NOT NULL
                  AND (strpos(lower(d.title COLLATE pg_catalog.pg_unicode_fast),
                              lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0
                    OR strpos(lower(d.topic COLLATE pg_catalog.pg_unicode_fast),
                              lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0
                    OR strpos(lower(w.headword COLLATE pg_catalog.pg_unicode_fast),
                              lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0
                    OR strpos(lower(w.meaning_vi COLLATE pg_catalog.pg_unicode_fast),
                              lower(:query COLLATE pg_catalog.pg_unicode_fast)) > 0)
                GROUP BY d.id, d.title, d.topic, d.level, d.description
                ORDER BY d.level, d.title
                """).param("userId", userId).param("query", query).query(SavedGroup.class).list();
    }

    public SavedGroup group(UUID userId, UUID groupId) {
        return jdbc.sql("""
                SELECT d.id AS group_id, d.title AS title, d.topic AS topic, d.level AS level,
                       d.description AS description, count(DISTINCT s.word_id) AS word_count,
                       ''::text AS preview_words
                FROM decks d
                LEFT JOIN deck_words dw ON dw.deck_id = d.id
                LEFT JOIN user_saved_words s ON s.word_id = dw.word_id AND s.user_id = :userId
                WHERE d.id = :groupId AND d.topic_key IS NOT NULL
                GROUP BY d.id, d.title, d.topic, d.level, d.description
                """).param("userId", userId).param("groupId", groupId)
                .query(SavedGroup.class).optional()
                .orElseThrow(SavedVocabularyGroupNotFoundException::new);
    }

    public long count(UUID userId) {
        return jdbc.sql("SELECT count(*) FROM user_saved_words WHERE user_id = :userId")
                .param("userId", userId).query(Long.class).single();
    }

    public record SavedGroup(UUID groupId, String title, String topic, String level, String description,
                             long wordCount, String previewWords) {}
}
