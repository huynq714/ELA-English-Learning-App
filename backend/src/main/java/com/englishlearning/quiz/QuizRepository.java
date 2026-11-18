package com.englishlearning.quiz;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class QuizRepository {
    private final JdbcClient jdbc;

    public QuizRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    record Attempt(UUID id, UUID deckId, String status, Integer correctCount, String snapshot, OffsetDateTime completedAt) {
        boolean completed() { return "COMPLETED".equals(status); }
    }

    record SavedAnswer(int questionNo, String selectedAnswer) {}

    void lockUser(UUID userId) {
        jdbc.sql("SELECT id FROM users WHERE id = :id FOR UPDATE").param("id", userId).query(UUID.class).single();
    }

    Optional<Attempt> latest(UUID userId, UUID deckId) {
        return jdbc.sql("""
                SELECT id, deck_id, status, correct_count, question_snapshot, completed_at
                FROM quiz_attempts WHERE user_id = :user AND deck_id = :deck AND question_snapshot IS NOT NULL
                ORDER BY started_at DESC, id DESC LIMIT 1
                """).param("user", userId).param("deck", deckId).query(QuizRepository::mapAttempt).optional();
    }

    Optional<Attempt> owned(UUID userId, UUID id) {
        return jdbc.sql("""
                SELECT id, deck_id, status, correct_count, question_snapshot, completed_at
                FROM quiz_attempts WHERE id = :id AND user_id = :user
                """).param("id", id).param("user", userId).query(QuizRepository::mapAttempt).optional();
    }

    UUID insertAttempt(UUID userId, UUID deckId, String snapshot) {
        return jdbc.sql("""
                INSERT INTO quiz_attempts (user_id, deck_id, started_at, question_snapshot)
                VALUES (:user, :deck, clock_timestamp(), CAST(:snapshot AS jsonb)) RETURNING id
                """).param("user", userId).param("deck", deckId).param("snapshot", snapshot).query(UUID.class).single();
    }

    void insertAnswer(UUID attemptId, UUID wordId, int number, String selectedAnswer, boolean correct) {
        jdbc.sql("""
                INSERT INTO quiz_answers (attempt_id, word_id, question_no, selected_answer, is_correct)
                VALUES (:attempt, :word, :number, :answer, :correct)
                """).param("attempt", attemptId).param("word", wordId).param("number", number)
                .param("answer", selectedAnswer).param("correct", correct).update();
    }

    List<SavedAnswer> answers(UUID attemptId) {
        return jdbc.sql("""
                SELECT question_no, selected_answer FROM quiz_answers
                WHERE attempt_id = :attempt ORDER BY question_no
                """).param("attempt", attemptId)
                .query((rs, row) -> new SavedAnswer(rs.getInt("question_no"), rs.getString("selected_answer"))).list();
    }

    void complete(UUID id, int score) {
        jdbc.sql("""
                UPDATE quiz_attempts SET status = 'COMPLETED', correct_count = :score, completed_at = clock_timestamp()
                WHERE id = :id
                """).param("id", id).param("score", score).update();
    }

    boolean study(UUID userId, UUID deckId, UUID wordId) {
        return jdbc.sql("""
                INSERT INTO user_word_progress (user_id, word_id, last_studied_at)
                SELECT :user, dw.word_id, clock_timestamp()
                FROM deck_words dw JOIN decks d ON d.id = dw.deck_id
                WHERE dw.deck_id = :deck AND dw.word_id = :word AND d.is_published
                ON CONFLICT (user_id, word_id) DO UPDATE
                    SET last_studied_at = GREATEST(user_word_progress.last_studied_at, EXCLUDED.last_studied_at)
                """).param("user", userId).param("deck", deckId).param("word", wordId).update() == 1;
    }

    UUID lastStudiedWord(UUID userId, UUID deckId) {
        return jdbc.sql("""
                SELECT p.word_id FROM user_word_progress p JOIN deck_words dw ON dw.word_id = p.word_id
                WHERE p.user_id = :user AND dw.deck_id = :deck
                ORDER BY p.last_studied_at DESC, dw.sort_order, p.word_id LIMIT 1
                """).param("user", userId).param("deck", deckId).query(UUID.class).optional().orElse(null);
    }

    List<UUID> unstudiedWords(UUID userId, UUID deckId) {
        return jdbc.sql("""
                SELECT dw.word_id FROM deck_words dw
                WHERE dw.deck_id = :deck AND NOT EXISTS (
                    SELECT 1 FROM user_word_progress p WHERE p.user_id = :user AND p.word_id = dw.word_id
                )
                ORDER BY dw.sort_order, dw.word_id
                """).param("user", userId).param("deck", deckId).query(UUID.class).list();
    }

    List<UUID> wordsNotReviewedSince(UUID userId, UUID deckId, List<UUID> words, OffsetDateTime cutoff) {
        return jdbc.sql("""
                SELECT dw.word_id FROM deck_words dw LEFT JOIN user_word_progress p
                  ON p.word_id = dw.word_id AND p.user_id = :user
                WHERE dw.deck_id = :deck AND dw.word_id IN (:words)
                  AND (p.last_studied_at IS NULL OR p.last_studied_at <= :cutoff)
                ORDER BY dw.sort_order, dw.word_id
                """).param("user", userId).param("deck", deckId).param("words", words)
                .param("cutoff", cutoff).query(UUID.class).list();
    }

    private static Attempt mapAttempt(ResultSet rs, int row) throws SQLException {
        return new Attempt(rs.getObject("id", UUID.class), rs.getObject("deck_id", UUID.class),
                rs.getString("status"), rs.getObject("correct_count", Integer.class),
                rs.getString("question_snapshot"), rs.getObject("completed_at", OffsetDateTime.class));
    }
}
