package com.englishlearning.fsrs;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FsrsRepositoryTest {
    @Test
    void mapsLearningStepAndCompleteCardState() throws SQLException {
        ResultSet row = mock(ResultSet.class);
        UUID userId = UUID.randomUUID();
        UUID wordId = UUID.randomUUID();
        OffsetDateTime due = OffsetDateTime.ofInstant(Instant.parse("2026-11-23T10:00:00Z"), ZoneOffset.UTC);
        OffsetDateTime reviewed = due.minusDays(2);
        when(row.getObject("user_id", UUID.class)).thenReturn(userId);
        when(row.getObject("word_id", UUID.class)).thenReturn(wordId);
        when(row.getObject("due_at", OffsetDateTime.class)).thenReturn(due);
        when(row.getObject("last_reviewed_at", OffsetDateTime.class)).thenReturn(reviewed);
        when(row.getDouble("stability")).thenReturn(4.75);
        when(row.getDouble("difficulty")).thenReturn(6.0);
        when(row.getInt("repetitions")).thenReturn(8);
        when(row.getInt("lapses")).thenReturn(2);
        when(row.getString("fsrs_state")).thenReturn("LEARNING");
        when(row.getInt("learning_step")).thenReturn(1);
        when(row.getString("scheduler_version")).thenReturn("fsrs-4.5");

        FsrsRepository.ReviewCard mapped = FsrsRepository.mapReviewCard(row, 0);

        assertEquals(userId, mapped.userId());
        assertEquals(wordId, mapped.wordId());
        assertEquals(FsrsCardState.LEARNING, mapped.card().state());
        assertEquals(1, mapped.card().step());
        assertEquals(8, mapped.card().repetitions());
        assertEquals(2, mapped.card().lapses());
        assertEquals("fsrs-4.5", mapped.schedulerVersion());
        assertEquals(due.toInstant(), mapped.card().due());
        assertEquals(reviewed.toInstant(), mapped.card().lastReviewed());
    }

    @Test
    void legacyReviewLogDoesNotInventFieldsAbsentBeforeV17() throws SQLException {
        ResultSet row = mock(ResultSet.class);
        UUID id = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID wordId = UUID.randomUUID();
        OffsetDateTime reviewed = OffsetDateTime.parse("2026-11-23T10:00:00Z");
        when(row.getObject("id", UUID.class)).thenReturn(id);
        when(row.getObject("user_id", UUID.class)).thenReturn(userId);
        when(row.getObject("word_id", UUID.class)).thenReturn(wordId);
        when(row.getString("rating")).thenReturn("GOOD");
        when(row.getObject("reviewed_at", OffsetDateTime.class)).thenReturn(reviewed);
        when(row.getObject("previous_due_at", OffsetDateTime.class)).thenReturn(null);
        when(row.getObject("next_due_at", OffsetDateTime.class)).thenReturn(reviewed.plusDays(4));
        when(row.getString("state_before")).thenReturn(null);
        when(row.getObject("elapsed_days", Double.class)).thenReturn(null);
        when(row.getObject("scheduled_days", Integer.class)).thenReturn(null);

        FsrsRepository.PersistedReviewLog mapped = FsrsRepository.mapReviewLog(row, 0);

        assertEquals(id, mapped.id());
        assertEquals(FsrsRating.GOOD, mapped.rating());
        assertNull(mapped.stateBefore());
        assertNull(mapped.elapsedDays());
        assertNull(mapped.scheduledDays());
    }

    @Test
    void idempotencyRecordDefensivelyCopiesRequestHashAndBindsTheWholeRequest() {
        byte[] hash = new byte[32];
        hash[0] = 42;
        UUID session = UUID.randomUUID();
        UUID word = UUID.randomUUID();
        FsrsRepository.IdempotencyRecord record = new FsrsRepository.IdempotencyRecord(
                UUID.randomUUID(), UUID.randomUUID(), session, word, FsrsRating.AGAIN, hash,
                FsrsRepository.IdempotencyState.COMPLETED, 200, "{}", Instant.now(), Instant.now(), Instant.now());
        hash[0] = 0;
        byte[] returned = record.requestHash();
        returned[0] = 0;

        byte[] originalHash = new byte[32];
        originalHash[0] = 42;
        assertTrue(record.matches(session, word, FsrsRating.AGAIN, originalHash));
        assertFalse(record.matches(session, word, FsrsRating.GOOD, originalHash));
        assertFalse(record.matches(UUID.randomUUID(), word, FsrsRating.AGAIN, originalHash));
    }

    @Test
    void invalidRepositoryInputFailsBeforeDatabaseAccess() {
        FsrsRepository repository = new FsrsRepository(mock(JdbcClient.class));
        assertThrows(IllegalArgumentException.class, () -> repository.findDueCards(UUID.randomUUID(), Instant.now(), 0));
        assertThrows(IllegalArgumentException.class, () -> repository.createSession(UUID.randomUUID(),
                FsrsRepository.SessionType.DUE, FsrsRepository.SessionStatus.COMPLETED, 10, "{}"));
        assertThrows(IllegalArgumentException.class, () -> repository.reserveIdempotency(UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), FsrsRating.GOOD, new byte[5]));
        assertThrows(IllegalArgumentException.class, () -> repository.saveStreak(UUID.randomUUID(), 4, 3,
                null, Instant.now()));
    }
}
