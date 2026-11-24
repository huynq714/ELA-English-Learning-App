package com.englishlearning.fsrs;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import javax.sql.DataSource;
import java.time.Instant;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Opt-in PostgreSQL tests. They connect only to an explicitly named disposable test database. */
@EnabledIfEnvironmentVariable(named = "FSRS_TEST_JDBC_URL",
        matches = "jdbc:postgresql://[^/]+/english_learning_fsrs_test(?:\\?.*)?")
class FsrsRepositoryPostgresTest {
    private static FsrsRepository repository;
    private static JdbcTemplate jdbc;
    private static TransactionTemplate transactions;
    private static FsrsService service;
    private final List<UUID> fixtureUsers = new ArrayList<>();
    private final List<UUID> fixtureWords = new ArrayList<>();

    @BeforeAll
    static void connectOnlyToDedicatedTestDatabase() {
        String url = System.getenv("FSRS_TEST_JDBC_URL");
        String username = System.getenv("FSRS_TEST_JDBC_USER");
        String password = System.getenv("FSRS_TEST_JDBC_PASSWORD");
        if (username == null || password == null) throw new IllegalStateException("FSRS test DB credentials are required");
        DriverManagerDataSource dataSource = new DriverManagerDataSource(url, username, password);
        jdbc = new JdbcTemplate(dataSource);
        String database = jdbc.queryForObject("SELECT current_database()", String.class);
        if (!"english_learning_fsrs_test".equals(database)) {
            throw new IllegalStateException("Refusing FSRS integration tests outside english_learning_fsrs_test");
        }
        Boolean migrated = jdbc.queryForObject("""
                SELECT to_regclass('public.review_sessions') IS NOT NULL
                   AND to_regclass('public.review_session_items') IS NOT NULL
                   AND to_regclass('public.review_idempotency') IS NOT NULL
                   AND to_regclass('public.user_streaks') IS NOT NULL
                   AND EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_schema = 'public' AND table_name = 'review_cards'
                                 AND column_name = 'learning_step')
                """, Boolean.class);
        if (!Boolean.TRUE.equals(migrated)) throw new IllegalStateException("Apply baseline schema and V1_7 to the disposable test DB first");

        repository = new FsrsRepository(JdbcClient.create(dataSource));
        PlatformTransactionManager manager = new DataSourceTransactionManager(dataSource);
        transactions = new TransactionTemplate(manager);
        service = new FsrsService(repository, new FsrsEngine(), new ObjectMapper(), Clock.systemUTC(),
                ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    @AfterEach
    void cleanFixturesByUserCascade() {
        fixtureUsers.forEach(user -> jdbc.update("DELETE FROM users WHERE id = ?", user));
        fixtureWords.forEach(word -> jdbc.update("DELETE FROM words WHERE id = ?", word));
        fixtureUsers.clear();
        fixtureWords.clear();
    }

    @Test
    void sessionItemsAreUniqueAndOwnershipScoped() {
        Fixture fixture = fixture();
        FsrsRepository.ReviewSession session = session(fixture, 2);
        repository.addSessionItem(fixture.userId(), session.id(), fixture.wordId(), 1);
        assertThrows(DataAccessException.class, () -> repository.addSessionItem(
                fixture.userId(), session.id(), fixture.wordId(), 2));

        UUID otherUser = createUser();
        assertTrue(repository.findSession(otherUser, session.id()).isEmpty());
        assertTrue(repository.lockReviewCard(otherUser, fixture.wordId()).isEmpty());
        assertTrue(repository.lockSessionItem(otherUser, session.id(), fixture.wordId()).isEmpty());
    }

    @Test
    void cardLearningStepRoundTripsAndDueCardsAreScopedToOwner() {
        Fixture fixture = fixture();
        FsrsCard stepOne = new FsrsEngine().schedule(fixture.card().card(), FsrsRating.GOOD, Instant.now()).card();
        assertEquals(FsrsCardState.LEARNING, stepOne.state());
        assertEquals(1, stepOne.step());
        repository.saveReviewCard(fixture.userId(), fixture.wordId(), stepOne, FsrsEngine.SCHEDULER_VERSION);

        FsrsRepository.ReviewCard reloaded = repository.findReviewCard(fixture.userId(), fixture.wordId()).orElseThrow();
        assertEquals(stepOne.due().truncatedTo(ChronoUnit.MICROS), reloaded.card().due());
        assertEquals(stepOne.lastReviewed().truncatedTo(ChronoUnit.MICROS), reloaded.card().lastReviewed());
        assertEquals(stepOne.stability(), reloaded.card().stability());
        assertEquals(stepOne.difficulty(), reloaded.card().difficulty());
        assertEquals(stepOne.repetitions(), reloaded.card().repetitions());
        assertEquals(stepOne.lapses(), reloaded.card().lapses());
        assertEquals(stepOne.state(), reloaded.card().state());
        assertEquals(stepOne.step(), reloaded.card().step());
        assertTrue(repository.findDueCards(fixture.userId(), Instant.now().plusSeconds(3600), 10)
                .stream().anyMatch(card -> card.wordId().equals(fixture.wordId())));
        assertTrue(repository.findDueCards(createUser(), Instant.now().plusSeconds(3600), 10).isEmpty());
    }

    @Test
    void sessionCanResumeAndAgainMovesTheItemToQueueTail() {
        Fixture fixture = fixture();
        FsrsRepository.ReviewSession session = session(fixture, 2);
        repository.addSessionItem(fixture.userId(), session.id(), fixture.wordId(), 1);
        UUID secondWord = createWord();
        repository.findOrCreateReviewCard(fixture.userId(), secondWord);
        repository.addSessionItem(fixture.userId(), session.id(), secondWord, 2);

        transactions.executeWithoutResult(status -> {
            assertTrue(repository.lockSession(fixture.userId(), session.id()).isPresent());
            assertTrue(repository.recordSessionItemRating(fixture.userId(), session.id(), fixture.wordId(),
                    FsrsRating.AGAIN, false, Instant.now()).isPresent());
        });

        List<FsrsRepository.ReviewSessionItem> pending = repository.findPendingSessionItems(fixture.userId(), session.id());
        assertEquals(List.of(secondWord, fixture.wordId()), pending.stream().map(FsrsRepository.ReviewSessionItem::wordId).toList());
        assertEquals(1, pending.get(1).againCount());
        assertEquals(FsrsRepository.SessionStatus.IN_PROGRESS, repository.findActiveSession(fixture.userId()).orElseThrow().status());
    }

    @Test
    void idempotencyReservationAndPersistedResponseAreBoundToRequest() {
        Fixture fixture = fixture();
        FsrsRepository.ReviewSession session = session(fixture, 1);
        repository.addSessionItem(fixture.userId(), session.id(), fixture.wordId(), 1);
        UUID token = UUID.randomUUID();
        byte[] requestHash = new byte[32];
        requestHash[0] = 7;

        transactions.executeWithoutResult(status -> {
            assertTrue(repository.reserveIdempotency(fixture.userId(), token, session.id(), fixture.wordId(),
                    FsrsRating.GOOD, requestHash));
            repository.completeIdempotency(fixture.userId(), token, requestHash, 200, "{\"status\":\"saved\"}");
        });

        FsrsRepository.IdempotencyRecord saved = repository.findIdempotency(fixture.userId(), token).orElseThrow();
        assertEquals("{\"status\": \"saved\"}", saved.responseJson());
        assertTrue(saved.matches(session.id(), fixture.wordId(), FsrsRating.GOOD, requestHash));
        assertFalse(saved.matches(session.id(), fixture.wordId(), FsrsRating.AGAIN, requestHash));
        assertTrue(Boolean.FALSE.equals(transactions.execute(status -> repository.reserveIdempotency(
                fixture.userId(), token, session.id(), fixture.wordId(), FsrsRating.GOOD, requestHash))));
    }

    @Test
    void transactionRollbackRestoresCardLogItemAndIdempotencyTogether() {
        Fixture fixture = fixture();
        FsrsRepository.ReviewSession session = session(fixture, 1);
        repository.addSessionItem(fixture.userId(), session.id(), fixture.wordId(), 1);
        FsrsRepository.ReviewCard before = repository.findReviewCard(fixture.userId(), fixture.wordId()).orElseThrow();
        UUID token = UUID.randomUUID();
        byte[] requestHash = new byte[32];

        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(status -> {
            repository.lockSession(fixture.userId(), session.id()).orElseThrow();
            assertTrue(repository.reserveIdempotency(fixture.userId(), token, session.id(), fixture.wordId(),
                    FsrsRating.GOOD, requestHash));
            repository.lockSessionItem(fixture.userId(), session.id(), fixture.wordId()).orElseThrow();
            FsrsRepository.ReviewCard locked = repository.lockReviewCard(fixture.userId(), fixture.wordId()).orElseThrow();
            var result = new FsrsEngine().schedule(locked.card(), FsrsRating.GOOD, Instant.now());
            repository.saveReviewCard(fixture.userId(), fixture.wordId(), result.card(), FsrsEngine.SCHEDULER_VERSION);
            repository.insertReviewLog(fixture.userId(), fixture.wordId(), result.reviewLog());
            repository.recordSessionItemRating(fixture.userId(), session.id(), fixture.wordId(), FsrsRating.GOOD, true,
                    result.reviewLog().reviewedAt()).orElseThrow();
            repository.completeIdempotency(fixture.userId(), token, requestHash, 200, "{}");
            throw new IllegalStateException("force rollback");
        }));

        assertEquals(before.card(), repository.findReviewCard(fixture.userId(), fixture.wordId()).orElseThrow().card());
        assertTrue(repository.findReviewLogs(fixture.userId(), fixture.wordId(), 10).isEmpty());
        assertTrue(repository.findIdempotency(fixture.userId(), token).isEmpty());
        assertEquals(FsrsRepository.ItemStatus.PENDING,
                repository.findSessionItems(fixture.userId(), session.id()).getFirst().status());
    }

    @Test
    void concurrentSameTokenCreatesOnlyOnePersistedResult() throws Exception {
        Fixture fixture = fixture();
        FsrsRepository.ReviewSession session = session(fixture, 1);
        repository.addSessionItem(fixture.userId(), session.id(), fixture.wordId(), 1);
        UUID token = UUID.randomUUID();
        byte[] requestHash = new byte[32];
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var one = pool.submit(() -> reserveConcurrently(fixture, session, token, requestHash, ready, start));
            var two = pool.submit(() -> reserveConcurrently(fixture, session, token, requestHash, ready, start));
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            assertTrue(one.get(10, TimeUnit.SECONDS) ^ two.get(10, TimeUnit.SECONDS),
                    "exactly one concurrent request should reserve the token");
            assertEquals(FsrsRepository.IdempotencyState.COMPLETED,
                    repository.findIdempotency(fixture.userId(), token).orElseThrow().state());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void reviewHistoryTriggersRejectDirectDeletion() {
        Fixture fixture = fixture();
        var now = Instant.now();
        repository.insertReviewLog(fixture.userId(), fixture.wordId(),
                new FsrsReviewLog(FsrsRating.GOOD, FsrsCardState.NEW, now, 0.0, null,
                        now.plusSeconds(60), 0));

        assertThrows(DataAccessException.class, () -> jdbc.update(
                "DELETE FROM review_logs WHERE user_id = ? AND word_id = ?", fixture.userId(), fixture.wordId()));
        assertThrows(DataAccessException.class, () -> jdbc.update(
                "DELETE FROM review_cards WHERE user_id = ? AND word_id = ?", fixture.userId(), fixture.wordId()));
    }

    @Test
    void serviceCreatesDueSessionFromStudiedWordsAndResumesPersistedQueue() {
        Fixture fixture = fixture();

        FsrsService.SessionView first = inTransaction(() -> service.startOrResume(fixture.userId(), FsrsRepository.SessionType.DUE));
        FsrsService.SessionView resumed = inTransaction(() -> service.startOrResume(fixture.userId(), FsrsRepository.SessionType.CRAM));

        assertFalse(first.empty());
        assertEquals(1, first.targetCount());
        assertEquals(first.sessionId(), resumed.sessionId());
        assertEquals(FsrsRepository.SessionType.DUE, resumed.type());
        assertEquals(fixture.wordId(), resumed.nextWordId());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM review_sessions WHERE user_id = ?", Integer.class, fixture.userId()));
    }

    @Test
    void serviceRatingPersistsLearningStepReplaysTokenAndCompletesOnlyAfterGraduation() {
        Fixture fixture = fixture();
        FsrsService.SessionView session = inTransaction(() -> service.startOrResume(fixture.userId(), FsrsRepository.SessionType.DUE));
        UUID firstToken = UUID.randomUUID();

        FsrsService.RatingResult first = inTransaction(() -> service.rate(fixture.userId(), session.sessionId(),
                fixture.wordId(), firstToken, FsrsRating.GOOD));
        FsrsService.RatingResult replay = inTransaction(() -> service.rate(fixture.userId(), session.sessionId(),
                fixture.wordId(), firstToken, FsrsRating.GOOD));

        assertEquals(first, replay);
        assertEquals(FsrsCardState.LEARNING, first.cardState());
        assertTrue(first.waiting());
        assertEquals(FsrsRepository.ItemStatus.PENDING, first.itemStatus());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM review_logs WHERE user_id = ? AND word_id = ?",
                Integer.class, fixture.userId(), fixture.wordId()));

        FsrsServiceException conflict = assertThrows(FsrsServiceException.class, () -> inTransaction(() ->
                service.rate(fixture.userId(), session.sessionId(), fixture.wordId(), firstToken, FsrsRating.HARD)));
        assertEquals(FsrsServiceException.Code.IDEMPOTENCY_CONFLICT, conflict.code());
        UUID earlyToken = UUID.randomUUID();
        FsrsServiceException early = assertThrows(FsrsServiceException.class, () -> inTransaction(() ->
                service.rate(fixture.userId(), session.sessionId(), fixture.wordId(), earlyToken, FsrsRating.EASY)));
        assertEquals(FsrsServiceException.Code.CARD_NOT_DUE, early.code());
        assertTrue(repository.findIdempotency(fixture.userId(), earlyToken).isEmpty());
        assertTrue(repository.findStreak(fixture.userId()).isEmpty());

        jdbc.update("UPDATE review_cards SET due_at = now() - interval '1 second', "
                        + "last_reviewed_at = now() - interval '2 seconds' WHERE user_id = ? AND word_id = ?",
                fixture.userId(), fixture.wordId());
        FsrsService.RatingResult graduated = inTransaction(() -> service.rate(fixture.userId(), session.sessionId(),
                fixture.wordId(), UUID.randomUUID(), FsrsRating.GOOD));
        assertEquals(FsrsCardState.REVIEW, graduated.cardState());
        assertEquals(FsrsRepository.ItemStatus.COMPLETED, graduated.itemStatus());
        assertEquals(FsrsRepository.SessionStatus.COMPLETED, graduated.sessionStatus());
        assertEquals(1, graduated.currentStreak());
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM review_logs WHERE user_id = ? AND word_id = ?",
                Integer.class, fixture.userId(), fixture.wordId()));
    }

    @Test
    void serviceRejectsAnotherUsersSessionAndWordOutsideSession() {
        Fixture fixture = fixture();
        FsrsService.SessionView session = inTransaction(() -> service.startOrResume(fixture.userId(), FsrsRepository.SessionType.DUE));
        UUID otherUser = createUser();

        FsrsServiceException notOwned = assertThrows(FsrsServiceException.class, () -> inTransaction(() ->
                service.rate(otherUser, session.sessionId(), fixture.wordId(), UUID.randomUUID(), FsrsRating.GOOD)));
        assertEquals(FsrsServiceException.Code.SESSION_NOT_FOUND, notOwned.code());
        UUID otherWord = createWord();
        FsrsServiceException notMember = assertThrows(FsrsServiceException.class, () -> inTransaction(() ->
                service.rate(fixture.userId(), session.sessionId(), otherWord, UUID.randomUUID(), FsrsRating.GOOD)));
        assertEquals(FsrsServiceException.Code.ITEM_NOT_IN_SESSION, notMember.code());
    }

    @Test
    void cramAllowsEarlyFirstRatingButWaitsForRelearningAfterResume() {
        Fixture fixture = fixture();
        UUID user = fixture.userId();
        UUID word = fixture.wordId();
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant future = now.plus(1, ChronoUnit.DAYS);
        repository.saveReviewCard(user, word, new FsrsCard(future, 7, 5, 3, 0,
                FsrsCardState.REVIEW, now.minus(1, ChronoUnit.DAYS), 0), "test");
        FsrsService fixedService = new FsrsService(repository, new FsrsEngine(), new ObjectMapper(),
                Clock.fixed(now, ZoneId.of("UTC")), ZoneId.of("Asia/Ho_Chi_Minh"));

        FsrsService.SessionView due = inTransaction(() -> fixedService.startOrResume(user, FsrsRepository.SessionType.DUE));
        assertTrue(due.empty());
        FsrsService.SessionView cram = inTransaction(() -> fixedService.startOrResume(user, FsrsRepository.SessionType.CRAM));
        assertFalse(cram.waiting());
        assertEquals(word, cram.nextWordId());
        assertEquals(now, cram.nextDueAt());
        assertEquals(future, cram.items().getFirst().dueAt());

        FsrsService.RatingResult again = inTransaction(() ->
                fixedService.rate(user, cram.sessionId(), word, UUID.randomUUID(), FsrsRating.AGAIN));
        assertEquals(FsrsCardState.RELEARNING, again.cardState());
        assertTrue(again.waiting());
        FsrsService.SessionView resumed = inTransaction(() -> fixedService.startOrResume(user, FsrsRepository.SessionType.CRAM));
        assertEquals(cram.sessionId(), resumed.sessionId());
        assertTrue(resumed.waiting());
        assertEquals(again.nextDueAt(), resumed.nextDueAt());
        assertEquals(1, resumed.items().getFirst().againCount());
        FsrsServiceException early = assertThrows(FsrsServiceException.class, () -> inTransaction(() ->
                fixedService.rate(user, cram.sessionId(), word, UUID.randomUUID(), FsrsRating.HARD)));
        assertEquals(FsrsServiceException.Code.CARD_NOT_DUE, early.code());

        FsrsService laterService = new FsrsService(repository, new FsrsEngine(), new ObjectMapper(),
                Clock.fixed(again.nextDueAt(), ZoneId.of("UTC")), ZoneId.of("Asia/Ho_Chi_Minh"));
        FsrsService.RatingResult hard = inTransaction(() ->
                laterService.rate(user, cram.sessionId(), word, UUID.randomUUID(), FsrsRating.HARD));
        assertEquals(FsrsCardState.RELEARNING, hard.cardState());
        assertTrue(hard.waiting());

        FsrsService finalService = new FsrsService(repository, new FsrsEngine(), new ObjectMapper(),
                Clock.fixed(hard.nextDueAt(), ZoneId.of("UTC")), ZoneId.of("Asia/Ho_Chi_Minh"));
        FsrsService.RatingResult easy = inTransaction(() ->
                finalService.rate(user, cram.sessionId(), word, UUID.randomUUID(), FsrsRating.EASY));
        assertEquals(FsrsRepository.SessionStatus.COMPLETED, easy.sessionStatus());
        assertEquals(3, repository.findReviewLogs(user, word, 10).size());
        assertTrue(repository.findStreak(user).isEmpty());
    }

    @Test
    void summaryCountsUninitializedStudyProgressOnceAndExcludesBookmarks() {
        Fixture existing = fixture();
        UUID user = existing.userId();
        UUID uninitialized = createWord();
        UUID bookmarked = createWord();
        jdbc.update("INSERT INTO user_word_progress (user_id, word_id) VALUES (?, ?)", user, uninitialized);
        jdbc.update("INSERT INTO user_saved_words (user_id, word_id) VALUES (?, ?)", user, bookmarked);

        FsrsService.ReviewSummary before = service.summary(user);
        assertEquals(2, before.learnedCount());
        assertEquals(2, before.cramCount());
        assertEquals(2, before.totalCards());
        assertEquals(2, before.newCount());
        assertEquals(2, before.dueCount());
        assertTrue(repository.findReviewCard(user, uninitialized).isEmpty());

        FsrsService.SessionView started = inTransaction(() -> service.startOrResume(user, FsrsRepository.SessionType.DUE));
        assertEquals(2, started.targetCount());
        FsrsService.ReviewSummary after = service.summary(user);
        assertEquals(before.learnedCount(), after.learnedCount());
        assertEquals(before.cramCount(), after.cramCount());
        assertEquals(before.totalCards(), after.totalCards());
        assertEquals(before.newCount(), after.newCount());
        assertEquals(before.dueCount(), after.dueCount());
        assertEquals(started.sessionId(), after.activeSessionId());
        assertTrue(repository.findReviewCard(user, bookmarked).isEmpty());
        assertTrue(repository.findReviewLogs(user, uninitialized, 10).isEmpty());
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM user_word_progress WHERE user_id = ?",
                Integer.class, user));
    }

    @Test
    void streakIsIdempotentPerDateAndRestartsAfterMissedDay() {
        UUID userId = createUser();
        LocalDate dayOne = LocalDate.of(2026, 11, 20);
        assertEquals(1, repository.recordDueCompletion(userId, dayOne, Instant.now()).currentStreak());
        assertEquals(1, repository.recordDueCompletion(userId, dayOne, Instant.now()).currentStreak());
        assertEquals(2, repository.recordDueCompletion(userId, dayOne.plusDays(1), Instant.now()).currentStreak());
        FsrsRepository.UserStreak restarted = repository.recordDueCompletion(userId, dayOne.plusDays(3), Instant.now());
        assertEquals(1, restarted.currentStreak());
        assertEquals(2, restarted.longestStreak());
    }

    @Test
    void serviceRollbackLeavesCardLogItemAndTokenUnchanged() {
        Fixture fixture = fixture();
        FsrsService.SessionView session = inTransaction(() -> service.startOrResume(fixture.userId(), FsrsRepository.SessionType.DUE));
        FsrsRepository.ReviewCard before = repository.findReviewCard(fixture.userId(), fixture.wordId()).orElseThrow();
        UUID token = UUID.randomUUID();
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(status -> {
            service.rate(fixture.userId(), session.sessionId(), fixture.wordId(), token, FsrsRating.EASY);
            throw new IllegalStateException("force transaction rollback");
        }));
        assertEquals(before.card(), repository.findReviewCard(fixture.userId(), fixture.wordId()).orElseThrow().card());
        assertTrue(repository.findReviewLogs(fixture.userId(), fixture.wordId(), 10).isEmpty());
        assertTrue(repository.findIdempotency(fixture.userId(), token).isEmpty());
        assertEquals(FsrsRepository.ItemStatus.PENDING,
                repository.findSessionItems(fixture.userId(), session.sessionId()).getFirst().status());
    }

    @Test
    void concurrentStartsForSameUserResumeOneActiveSession() throws Exception {
        Fixture fixture = fixture();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var one = pool.submit(() -> startServiceConcurrently(fixture.userId(), FsrsRepository.SessionType.DUE, ready, start));
            var two = pool.submit(() -> startServiceConcurrently(fixture.userId(), FsrsRepository.SessionType.CRAM, ready, start));
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(one.get(10, TimeUnit.SECONDS).sessionId(), two.get(10, TimeUnit.SECONDS).sessionId());
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM review_sessions WHERE user_id = ? AND status = 'IN_PROGRESS'",
                    Integer.class, fixture.userId()));
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentServiceRatingWithSameTokenWritesOneLogAndOneStateChange() throws Exception {
        Fixture fixture = fixture();
        FsrsService.SessionView session = inTransaction(() -> service.startOrResume(fixture.userId(), FsrsRepository.SessionType.DUE));
        UUID token = UUID.randomUUID();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var one = pool.submit(() -> rateServiceConcurrently(fixture, session, token, ready, start));
            var two = pool.submit(() -> rateServiceConcurrently(fixture, session, token, ready, start));
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(one.get(10, TimeUnit.SECONDS), two.get(10, TimeUnit.SECONDS));
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM review_logs WHERE user_id = ? AND word_id = ?",
                    Integer.class, fixture.userId(), fixture.wordId()));
        } finally {
            pool.shutdownNow();
        }
    }

    private boolean reserveConcurrently(Fixture fixture, FsrsRepository.ReviewSession session, UUID token,
                                        byte[] hash, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        assertTrue(start.await(5, TimeUnit.SECONDS));
        return transactions.execute(status -> {
            repository.lockSession(fixture.userId(), session.id()).orElseThrow();
            boolean reserved = repository.reserveIdempotency(fixture.userId(), token, session.id(), fixture.wordId(),
                    FsrsRating.GOOD, hash);
            if (reserved) {
                repository.lockSessionItem(fixture.userId(), session.id(), fixture.wordId()).orElseThrow();
                repository.completeIdempotency(fixture.userId(), token, hash, 200, "{\"ok\":true}");
            }
            return reserved;
        });
    }

    private Fixture fixture() {
        UUID user = createUser();
        UUID word = createWord();
        jdbc.update("INSERT INTO user_word_progress (user_id, word_id) VALUES (?, ?)", user, word);
        FsrsRepository.ReviewCard card = repository.findOrCreateReviewCard(user, word);
        return new Fixture(user, word, card);
    }

    private FsrsRepository.ReviewSession session(Fixture fixture, int targetCount) {
        return repository.createSession(fixture.userId(), FsrsRepository.SessionType.DUE,
                FsrsRepository.SessionStatus.IN_PROGRESS, targetCount, "{}");
    }

    private UUID createUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)",
                id, "fsrs-test-" + id + "@example.test", "not-a-real-credential", "FSRS integration test");
        fixtureUsers.add(id);
        return id;
    }

    private UUID createWord() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO words (id, headword, meaning_vi) VALUES (?, ?, ?)",
                id, "test-" + id, "từ kiểm thử");
        fixtureWords.add(id);
        return id;
    }

    private <T> T inTransaction(java.util.function.Supplier<T> operation) {
        return transactions.execute(status -> operation.get());
    }

    private FsrsService.SessionView startServiceConcurrently(UUID userId, FsrsRepository.SessionType type,
                                                              CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        assertTrue(start.await(5, TimeUnit.SECONDS));
        return inTransaction(() -> service.startOrResume(userId, type));
    }

    private FsrsService.RatingResult rateServiceConcurrently(Fixture fixture, FsrsService.SessionView session,
                                                              UUID token, CountDownLatch ready,
                                                              CountDownLatch start) throws Exception {
        ready.countDown();
        assertTrue(start.await(5, TimeUnit.SECONDS));
        return inTransaction(() -> service.rate(fixture.userId(), session.sessionId(), fixture.wordId(),
                token, FsrsRating.GOOD));
    }

    private record Fixture(UUID userId, UUID wordId, FsrsRepository.ReviewCard card) {}
}
