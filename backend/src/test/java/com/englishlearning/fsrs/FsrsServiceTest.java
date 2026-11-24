package com.englishlearning.fsrs;

import com.englishlearning.fsrs.FsrsRepository.*;
import com.englishlearning.fsrs.FsrsService.RatingResult;
import com.englishlearning.fsrs.FsrsService.SessionView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FsrsServiceTest {
    private static final Instant NOW = Instant.parse("2026-11-24T10:00:00Z");
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final UUID USER = UUID.randomUUID();
    private FsrsRepository repository;
    private FsrsEngine engine;
    private ObjectMapper json;
    private FsrsService service;

    @BeforeEach
    void setUp() {
        repository = mock(FsrsRepository.class);
        engine = new FsrsEngine();
        json = new ObjectMapper();
        service = new FsrsService(repository, engine, json, Clock.fixed(NOW, ZoneId.of("UTC")), ZONE);
    }

    @Test
    void dueSessionSelectsAtMostTenOldestEligibleCards() {
        when(repository.lockUser(USER)).thenReturn(true);
        when(repository.findActiveSession(USER)).thenReturn(Optional.empty());
        List<ReviewCard> cards = cards(10);
        when(repository.findDueEligibleCards(USER, NOW, 10)).thenReturn(cards);
        when(repository.createSession(USER, SessionType.DUE, SessionStatus.IN_PROGRESS, 10, "{}"))
                .thenReturn(session(SessionType.DUE, 10));
        when(repository.findSessionQueue(eq(USER), any())).thenReturn(List.of());

        SessionView result = service.startOrResume(USER, SessionType.DUE);

        assertEquals(10, result.targetCount());
        assertFalse(result.empty());
        verify(repository, times(10)).addSessionItem(eq(USER), any(), any(), anyLong());
        verify(repository, never()).findCramEligibleCards(any(), anyInt());
    }

    @Test
    void dueSessionUsesAllAvailableWhenBetweenOneAndNine() {
        when(repository.lockUser(USER)).thenReturn(true);
        when(repository.findActiveSession(USER)).thenReturn(Optional.empty());
        when(repository.findDueEligibleCards(USER, NOW, 10)).thenReturn(cards(4));
        when(repository.createSession(USER, SessionType.DUE, SessionStatus.IN_PROGRESS, 4, "{}"))
                .thenReturn(session(SessionType.DUE, 4));
        when(repository.findSessionQueue(eq(USER), any())).thenReturn(List.of());

        SessionView result = service.startOrResume(USER, SessionType.DUE);

        assertEquals(4, result.targetCount());
        verify(repository, times(4)).addSessionItem(eq(USER), any(), any(), anyLong());
    }

    @Test
    void noDueCardsReturnsEmptyAndDoesNotCreateEmptySession() {
        when(repository.lockUser(USER)).thenReturn(true);
        when(repository.findActiveSession(USER)).thenReturn(Optional.empty());
        when(repository.findDueEligibleCards(USER, NOW, 10)).thenReturn(List.of());

        SessionView result = service.startOrResume(USER, SessionType.DUE);

        assertTrue(result.empty());
        assertNull(result.sessionId());
        verify(repository, never()).createSession(any(), any(), any(), anyInt(), any());
    }

    @Test
    void existingSessionIsResumedBeforeCreatingAnother() {
        ReviewSession active = session(SessionType.CRAM, 1);
        when(repository.lockUser(USER)).thenReturn(true);
        when(repository.findActiveSession(USER)).thenReturn(Optional.of(active));
        when(repository.findSessionQueue(USER, active.id())).thenReturn(List.of());

        SessionView result = service.startOrResume(USER, SessionType.DUE);

        assertEquals(active.id(), result.sessionId());
        assertEquals(SessionType.CRAM, result.type());
        verify(repository, never()).createSession(any(), any(), any(), anyInt(), any());
        verify(repository, never()).initializeCardsForStudiedWords(any(), any());
    }

    @Test
    void cramSelectsOnlyRepositoryEligibleStudiedCardsAndCapsAtTen() {
        when(repository.lockUser(USER)).thenReturn(true);
        when(repository.findActiveSession(USER)).thenReturn(Optional.empty());
        when(repository.findCramEligibleCards(USER, 10)).thenReturn(cards(2));
        when(repository.createSession(USER, SessionType.CRAM, SessionStatus.IN_PROGRESS, 2, "{}"))
                .thenReturn(session(SessionType.CRAM, 2));
        when(repository.findSessionQueue(eq(USER), any())).thenReturn(List.of());

        SessionView result = service.startOrResume(USER, SessionType.CRAM);

        assertEquals(2, result.targetCount());
        verify(repository).findCramEligibleCards(USER, 10);
        verify(repository, never()).findDueEligibleCards(any(), any(), anyInt());
    }

    @Test
    void cramWithNoPreviouslyStudiedWordsReturnsEmptyWithoutCreatingSession() {
        when(repository.lockUser(USER)).thenReturn(true);
        when(repository.findActiveSession(USER)).thenReturn(Optional.empty());
        when(repository.findCramEligibleCards(USER, 10)).thenReturn(List.of());

        SessionView result = service.startOrResume(USER, SessionType.CRAM);

        assertTrue(result.empty());
        verify(repository).initializeCardsForStudiedWords(USER, NOW);
        verify(repository, never()).createSession(any(), any(), any(), anyInt(), any());
    }

    @Test
    void goodOnUnfinishedLearningCardKeepsItemPendingAndReportsWait() {
        UUID sessionId = UUID.randomUUID(), wordId = UUID.randomUUID(), token = UUID.randomUUID();
        stubRating(USER, sessionId, wordId, token, FsrsCard.newCard(NOW.minusSeconds(1)));
        ReviewSessionItem updated = new ReviewSessionItem(USER, sessionId, wordId, 1, ItemStatus.PENDING,
                0, FsrsRating.GOOD, NOW, NOW, NOW);
        when(repository.recordSessionItemRating(USER, sessionId, wordId, FsrsRating.GOOD, false, NOW)).thenReturn(Optional.of(updated));
        when(repository.findSessionItems(USER, sessionId)).thenReturn(List.of(updated));

        RatingResult result = service.rate(USER, sessionId, wordId, token, FsrsRating.GOOD);

        assertEquals(FsrsCardState.LEARNING, result.cardState());
        assertEquals(ItemStatus.PENDING, result.itemStatus());
        assertTrue(result.waiting());
        verify(repository, never()).finishSession(any(), any(), any(), any());
        verify(repository).insertReviewLog(eq(USER), eq(wordId), any());
        verify(repository).completeIdempotency(eq(USER), eq(token), any(), eq(200), anyString());
    }

    @Test
    void tooEarlyRatingIsRejectedBeforeCardOrLogWrite() {
        UUID sessionId = UUID.randomUUID(), wordId = UUID.randomUUID(), token = UUID.randomUUID();
        stubRating(USER, sessionId, wordId, token, FsrsCard.newCard(NOW.plusSeconds(60)));

        FsrsServiceException error = assertThrows(FsrsServiceException.class,
                () -> service.rate(USER, sessionId, wordId, token, FsrsRating.GOOD));

        assertEquals(FsrsServiceException.Code.CARD_NOT_DUE, error.code());
        assertEquals(NOW.plusSeconds(60), error.nextDueAt());
        verify(repository, never()).saveReviewCard(any(), any(), any(), any());
        verify(repository, never()).insertReviewLog(any(), any(), any());
    }

    @Test
    void againRequeuesTheCardAtTailAndIncrementsAgainCountWithoutCompletingIt() {
        UUID sessionId = UUID.randomUUID(), wordId = UUID.randomUUID(), token = UUID.randomUUID();
        FsrsCard review = new FsrsCard(NOW.minusSeconds(60), 10, 5, 4, 0,
                FsrsCardState.REVIEW, NOW.minusSeconds(86400), 0);
        stubRating(USER, sessionId, wordId, token, review);
        ReviewSessionItem updated = new ReviewSessionItem(USER, sessionId, wordId, 2, ItemStatus.PENDING,
                1, FsrsRating.AGAIN, NOW, NOW, NOW);
        when(repository.recordSessionItemRating(USER, sessionId, wordId, FsrsRating.AGAIN, false, NOW))
                .thenReturn(Optional.of(updated));
        when(repository.findSessionItems(USER, sessionId)).thenReturn(List.of(updated));

        RatingResult result = service.rate(USER, sessionId, wordId, token, FsrsRating.AGAIN);

        assertEquals(FsrsCardState.RELEARNING, result.cardState());
        assertEquals(ItemStatus.PENDING, result.itemStatus());
        assertEquals(1, result.againCount());
        assertTrue(result.waiting());
        verify(repository, never()).finishSession(any(), any(), any(), any());
    }

    @Test
    void rejectsRatingWhenAnotherDueItemIsFirstInQueue() {
        UUID sessionId = UUID.randomUUID(), wordId = UUID.randomUUID(), token = UUID.randomUUID();
        stubRating(USER, sessionId, wordId, token, FsrsCard.newCard(NOW.minusSeconds(1)));
        ReviewSessionItem first = new ReviewSessionItem(USER, sessionId, UUID.randomUUID(), 1,
                ItemStatus.PENDING, 0, null, null, null, NOW);
        when(repository.findSessionQueue(USER, sessionId)).thenReturn(List.of(
                new QueueEntry(first, NOW.minusSeconds(1), FsrsCardState.NEW, 0)));

        FsrsServiceException error = assertThrows(FsrsServiceException.class,
                () -> service.rate(USER, sessionId, wordId, token, FsrsRating.GOOD));

        assertEquals(FsrsServiceException.Code.ITEM_NOT_CURRENT, error.code());
        verify(repository, never()).saveReviewCard(any(), any(), any(), any());
        verify(repository, never()).insertReviewLog(any(), any(), any());
    }

    @Test
    void rejectsNonOwnedSessionBeforeTokenReservation() {
        UUID sessionId = UUID.randomUUID(), wordId = UUID.randomUUID(), token = UUID.randomUUID();
        when(repository.lockSession(USER, sessionId)).thenReturn(Optional.empty());

        FsrsServiceException error = assertThrows(FsrsServiceException.class,
                () -> service.rate(USER, sessionId, wordId, token, FsrsRating.GOOD));

        assertEquals(FsrsServiceException.Code.SESSION_NOT_FOUND, error.code());
        verify(repository, never()).reserveIdempotency(any(), any(), any(), any(), any(), any());
    }

    @Test
    void currentStreakDisplaysZeroAfterAFullMissedDayWithoutChangingStoredStreak() {
        when(repository.userExists(USER)).thenReturn(true);
        when(repository.summarizeCards(USER, NOW)).thenReturn(new CardSummary(0, 2, 0, 1, 0, 3));
        when(repository.learnedCount(USER)).thenReturn(3);
        when(repository.cramEligibleCount(USER)).thenReturn(3);
        when(repository.findStreak(USER)).thenReturn(Optional.of(new UserStreak(USER, 4, 7,
                LocalDate.of(2026, 11, 21), NOW.minusSeconds(86400))));

        FsrsService.ReviewSummary summary = service.summary(USER);

        assertEquals(0, summary.currentStreak());
        assertEquals(7, summary.longestStreak());
        assertEquals(3, summary.totalCards());
        assertEquals(3, summary.learnedCount());
        assertEquals(3, summary.cramCount());
        verify(repository, never()).saveStreak(any(), anyInt(), anyInt(), any(), any());
    }

    @Test
    void completedDUEItemUpdatesStreakInVietnameseLocalDateAndCompletesAtomically() {
        UUID sessionId = UUID.randomUUID(), wordId = UUID.randomUUID(), token = UUID.randomUUID();
        stubRating(USER, sessionId, wordId, token, FsrsCard.newCard(NOW.minusSeconds(1)));
        ReviewSessionItem updated = new ReviewSessionItem(USER, sessionId, wordId, 1, ItemStatus.COMPLETED,
                0, FsrsRating.EASY, NOW, NOW, NOW);
        when(repository.recordSessionItemRating(USER, sessionId, wordId, FsrsRating.EASY, true, NOW)).thenReturn(Optional.of(updated));
        when(repository.findSessionItems(USER, sessionId)).thenReturn(List.of(updated));
        when(repository.findStreak(USER)).thenReturn(Optional.empty());
        when(repository.finishSession(USER, sessionId, SessionStatus.COMPLETED, NOW))
                .thenReturn(Optional.of(new ReviewSession(sessionId, USER, SessionType.DUE, SessionStatus.COMPLETED,
                        1, NOW, NOW, "{}")));
        UserStreak streak = new UserStreak(USER, 1, 1, LocalDate.ofInstant(NOW, ZONE), NOW);
        when(repository.recordDueCompletion(USER, LocalDate.ofInstant(NOW, ZONE), NOW)).thenReturn(streak);

        RatingResult result = service.rate(USER, sessionId, wordId, token, FsrsRating.EASY);

        assertEquals(FsrsCardState.REVIEW, result.cardState());
        assertEquals(SessionStatus.COMPLETED, result.sessionStatus());
        assertEquals(1, result.currentStreak());
        verify(repository).recordDueCompletion(USER, LocalDate.ofInstant(NOW, ZONE), NOW);
    }

    @Test
    void retryWithSameTokenReplaysStoredResultWithoutSecondScheduling() throws Exception {
        UUID sessionId = UUID.randomUUID(), wordId = UUID.randomUUID(), token = UUID.randomUUID();
        RatingResult expected = new RatingResult(sessionId, wordId, FsrsRating.GOOD, FsrsCardState.LEARNING,
                1, NOW.plusSeconds(600), ItemStatus.PENDING, 0, 0, 1, 1, SessionStatus.IN_PROGRESS,
                true, 0);
        byte[] hash = hash(sessionId, wordId, FsrsRating.GOOD);
        when(repository.lockSession(USER, sessionId)).thenReturn(Optional.of(session(SessionType.DUE, 1)));
        when(repository.findIdempotency(USER, token)).thenReturn(Optional.of(new IdempotencyRecord(USER, token,
                sessionId, wordId, FsrsRating.GOOD, hash, IdempotencyState.COMPLETED, 200,
                json.writeValueAsString(expected), NOW, NOW, NOW.plusSeconds(86400))));

        RatingResult actual = service.rate(USER, sessionId, wordId, token, FsrsRating.GOOD);

        assertEquals(expected, actual);
        verify(repository, never()).reserveIdempotency(any(), any(), any(), any(), any(), any());
        verify(repository, never()).saveReviewCard(any(), any(), any(), any());
        verify(repository, never()).insertReviewLog(any(), any(), any());
    }

    @Test
    void tokenReusedWithAnotherRatingConflicts() throws Exception {
        UUID sessionId = UUID.randomUUID(), wordId = UUID.randomUUID(), token = UUID.randomUUID();
        when(repository.lockSession(USER, sessionId)).thenReturn(Optional.of(session(SessionType.DUE, 1)));
        when(repository.findIdempotency(USER, token)).thenReturn(Optional.of(new IdempotencyRecord(USER, token,
                sessionId, wordId, FsrsRating.GOOD, hash(sessionId, wordId, FsrsRating.GOOD),
                IdempotencyState.COMPLETED, 200, "{}", NOW, NOW, NOW.plusSeconds(86400))));

        FsrsServiceException error = assertThrows(FsrsServiceException.class,
                () -> service.rate(USER, sessionId, wordId, token, FsrsRating.AGAIN));

        assertEquals(FsrsServiceException.Code.IDEMPOTENCY_CONFLICT, error.code());
        verify(repository, never()).reserveIdempotency(any(), any(), any(), any(), any(), any());
    }

    private void stubRating(UUID userId, UUID sessionId, UUID wordId, UUID token, FsrsCard card) {
        ReviewSession session = new ReviewSession(sessionId, userId, SessionType.DUE, SessionStatus.IN_PROGRESS,
                1, NOW.minusSeconds(5), null, "{}");
        when(repository.lockSession(userId, sessionId)).thenReturn(Optional.of(session));
        when(repository.findIdempotency(userId, token)).thenReturn(Optional.empty());
        when(repository.hasSessionItem(userId, sessionId, wordId)).thenReturn(true);
        when(repository.reserveIdempotency(eq(userId), eq(token), eq(sessionId), eq(wordId), any(), any())).thenReturn(true);
        ReviewSessionItem item = new ReviewSessionItem(userId, sessionId, wordId, 1, ItemStatus.PENDING,
                0, null, null, null, NOW.minusSeconds(2));
        when(repository.lockSessionItem(userId, sessionId, wordId)).thenReturn(Optional.of(item));
        when(repository.lockReviewCard(userId, wordId)).thenReturn(Optional.of(new ReviewCard(userId, wordId, card, "uninitialized")));
        when(repository.findSessionQueue(userId, sessionId)).thenReturn(List.of(
                new QueueEntry(item, card.due(), card.state(), card.step())));
        when(repository.recordSessionItemRating(eq(userId), eq(sessionId), eq(wordId), any(), anyBoolean(), any()))
                .thenAnswer(invocation -> Optional.of(new ReviewSessionItem(userId, sessionId, wordId, 1,
                        invocation.getArgument(4, Boolean.class) ? ItemStatus.COMPLETED : ItemStatus.PENDING,
                        invocation.getArgument(3, FsrsRating.class) == FsrsRating.AGAIN ? 1 : 0,
                        invocation.getArgument(3, FsrsRating.class), NOW, NOW, NOW)));
        when(repository.findSessionItems(userId, sessionId)).thenAnswer(invocation -> {
            // Rating completion count is derived from the item returned above; tests that finish override this stub.
            return List.of(new ReviewSessionItem(userId, sessionId, wordId, 1, ItemStatus.PENDING,
                    0, FsrsRating.GOOD, NOW, NOW, NOW));
        });
        when(repository.findStreak(userId)).thenReturn(Optional.empty());
    }

    private static List<ReviewCard> cards(int count) {
        return java.util.stream.IntStream.range(0, count).mapToObj(i -> new ReviewCard(USER, UUID.randomUUID(),
                FsrsCard.newCard(NOW.minusSeconds(i + 1)), "uninitialized")).toList();
    }

    private static ReviewSession session(SessionType type, int target) {
        return new ReviewSession(UUID.randomUUID(), USER, type, SessionStatus.IN_PROGRESS, target,
                NOW.minusSeconds(10), null, "{}");
    }

    private static byte[] hash(UUID session, UUID word, FsrsRating rating) throws Exception {
        String value = "fsrs-rating:v1:" + session + ":" + word + ":" + rating.name();
        return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    }
}
