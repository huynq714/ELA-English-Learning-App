package com.englishlearning.fsrs;

import com.englishlearning.fsrs.FsrsRepository.CardSummary;
import com.englishlearning.fsrs.FsrsRepository.IdempotencyRecord;
import com.englishlearning.fsrs.FsrsRepository.QueueEntry;
import com.englishlearning.fsrs.FsrsRepository.ReviewCard;
import com.englishlearning.fsrs.FsrsRepository.ReviewSession;
import com.englishlearning.fsrs.FsrsRepository.ReviewSessionItem;
import com.englishlearning.fsrs.FsrsRepository.SessionStatus;
import com.englishlearning.fsrs.FsrsRepository.SessionType;
import com.englishlearning.fsrs.FsrsRepository.UserStreak;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Transactional FSRS session and streak use cases. The userId argument is trusted service context and must
 * come from the authenticated principal in a later adapter; it must never be copied from an untrusted body.
 */
@Service
public class FsrsService {
    private static final int SESSION_LIMIT = 10;
    private static final String SESSION_METADATA = "{}";

    private final FsrsRepository repository;
    private final FsrsEngine engine;
    private final ObjectMapper json;
    private final Clock clock;
    private final ZoneId streakZone;

    @Autowired
    public FsrsService(FsrsRepository repository, FsrsEngine engine, ObjectMapper json,
                       @Value("${ela.streak.time-zone:Asia/Ho_Chi_Minh}") String streakTimeZone) {
        this(repository, engine, json, Clock.systemUTC(), ZoneId.of(streakTimeZone));
    }

    FsrsService(FsrsRepository repository, FsrsEngine engine, ObjectMapper json, Clock clock, ZoneId streakZone) {
        this.repository = Objects.requireNonNull(repository);
        this.engine = Objects.requireNonNull(engine);
        this.json = Objects.requireNonNull(json);
        this.clock = Objects.requireNonNull(clock);
        this.streakZone = Objects.requireNonNull(streakZone);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ReviewSummary summary(UUID trustedUserId) {
        requireUserId(trustedUserId);
        if (!repository.userExists(trustedUserId)) throw error(FsrsServiceException.Code.USER_NOT_FOUND, "User not found");
        Instant now = clock.instant();
        CardSummary cards = repository.summarizeCards(trustedUserId, now);
        UserStreak streak = repository.findStreak(trustedUserId).orElse(null);
        int currentStreak = streak == null ? 0 : displayedCurrentStreak(streak, now.atZone(streakZone).toLocalDate());
        return new ReviewSummary(repository.learnedCount(trustedUserId), cards.dueCount(), repository.cramEligibleCount(trustedUserId),
                cards.newCount(), cards.learningCount(), cards.reviewCount(),
                cards.relearningCount(), currentStreak,
                streak == null ? 0 : streak.longestStreak(), cards.totalCards(),
                repository.findActiveSession(trustedUserId).map(ReviewSession::id).orElse(null));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public SessionView getSession(UUID trustedUserId, UUID sessionId) {
        ReviewSession session = repository.findSession(trustedUserId, sessionId)
                .orElseThrow(() -> error(FsrsServiceException.Code.SESSION_NOT_FOUND, "Review session not found"));
        return sessionView(trustedUserId, session);
    }

    /**
     * Resumes an existing active session first. A per-user users-row lock serializes competing start calls,
     * including the no-active-session case, without changing V1_7 or editing the already-applied migration.
     */
    @Transactional
    public SessionView startOrResume(UUID trustedUserId, SessionType requestedType) {
        requireUserId(trustedUserId);
        Objects.requireNonNull(requestedType, "Session type is required");
        if (!repository.lockUser(trustedUserId)) throw error(FsrsServiceException.Code.USER_NOT_FOUND, "User not found");

        Optional<ReviewSession> active = repository.findActiveSession(trustedUserId);
        if (active.isPresent()) return sessionView(trustedUserId, active.get());

        Instant now = clock.instant();
        // Study progress is the evidence that a word has actually been learned; bookmark-only words are excluded.
        repository.initializeCardsForStudiedWords(trustedUserId, now);
        List<ReviewCard> selected = requestedType == SessionType.DUE
                ? repository.findDueEligibleCards(trustedUserId, now, SESSION_LIMIT)
                : repository.findCramEligibleCards(trustedUserId, SESSION_LIMIT);
        if (selected.isEmpty()) return emptySession(requestedType);

        ReviewSession session = repository.createSession(trustedUserId, requestedType,
                SessionStatus.IN_PROGRESS, selected.size(), SESSION_METADATA);
        long position = 1;
        for (ReviewCard card : selected) repository.addSessionItem(trustedUserId, session.id(), card.wordId(), position++);
        return sessionView(trustedUserId, session);
    }

    /**
     * One atomic rating. The caller supplies userId from trusted authentication context and a client-generated
     * UUID idempotency token. Session lock precedes token, item and card locks as documented by the repository.
     */
    @Transactional
    public RatingResult rate(UUID trustedUserId, UUID sessionId, UUID wordId, UUID requestToken, FsrsRating rating) {
        requireUserId(trustedUserId);
        Objects.requireNonNull(sessionId, "Session ID is required");
        Objects.requireNonNull(wordId, "Word ID is required");
        Objects.requireNonNull(requestToken, "Idempotency token is required");
        Objects.requireNonNull(rating, "Rating is required");

        ReviewSession session = repository.lockSession(trustedUserId, sessionId)
                .orElseThrow(() -> error(FsrsServiceException.Code.SESSION_NOT_FOUND, "Review session not found"));
        byte[] requestHash = requestHash(sessionId, wordId, rating);

        Optional<IdempotencyRecord> previous = repository.findIdempotency(trustedUserId, requestToken);
        if (previous.isPresent()) return replayOrConflict(previous.get(), sessionId, wordId, rating, requestHash);
        if (session.status() != SessionStatus.IN_PROGRESS) {
            throw error(FsrsServiceException.Code.SESSION_CLOSED, "Review session is no longer active");
        }
        // The idempotency table has an FK to the session item; check membership before INSERT to avoid a raw FK error.
        if (!repository.hasSessionItem(trustedUserId, sessionId, wordId)) {
            throw error(FsrsServiceException.Code.ITEM_NOT_IN_SESSION, "Word does not belong to this review session");
        }

        boolean reserved = repository.reserveIdempotency(trustedUserId, requestToken, sessionId, wordId, rating, requestHash);
        if (!reserved) {
            IdempotencyRecord raced = repository.findIdempotency(trustedUserId, requestToken)
                    .orElseThrow(() -> error(FsrsServiceException.Code.REQUEST_IN_PROGRESS, "Rating request is already being processed"));
            return replayOrConflict(raced, sessionId, wordId, rating, requestHash);
        }

        ReviewSessionItem item = repository.lockSessionItem(trustedUserId, sessionId, wordId)
                .orElseThrow(() -> error(FsrsServiceException.Code.ITEM_NOT_IN_SESSION, "Word does not belong to this review session"));
        if (item.status() != FsrsRepository.ItemStatus.PENDING) {
            throw error(FsrsServiceException.Code.ITEM_ALREADY_COMPLETED, "Word has already completed its learning steps");
        }

        ReviewCard lockedCard = repository.lockReviewCard(trustedUserId, wordId)
                .orElseThrow(() -> error(FsrsServiceException.Code.ITEM_NOT_IN_SESSION, "Review card not found"));
        Instant reviewedAt = clock.instant();
        if (!isReady(session.type(), item, lockedCard.card().due(), reviewedAt)) {
            throw new FsrsServiceException(FsrsServiceException.Code.CARD_NOT_DUE,
                    "This learning step is not due yet", lockedCard.card().due());
        }
        QueueEntry nextReady = firstReadyItem(session.type(), repository.findSessionQueue(trustedUserId, sessionId), reviewedAt);
        if (nextReady == null || !nextReady.item().wordId().equals(wordId)) {
            throw error(FsrsServiceException.Code.ITEM_NOT_CURRENT, "Another available word is earlier in the review queue");
        }

        FsrsSchedulingResult scheduled = engine.schedule(lockedCard.card(), rating, reviewedAt);
        repository.saveReviewCard(trustedUserId, wordId, scheduled.card(), engine.getVersion());
        repository.insertReviewLog(trustedUserId, wordId, scheduled.reviewLog());

        boolean itemCompleted = scheduled.card().state() == FsrsCardState.REVIEW;
        ReviewSessionItem updatedItem = repository.recordSessionItemRating(trustedUserId, sessionId, wordId,
                        rating, itemCompleted, reviewedAt)
                .orElseThrow(() -> error(FsrsServiceException.Code.ITEM_ALREADY_COMPLETED, "Word is no longer pending"));

        int completedCount = (int) repository.findSessionItems(trustedUserId, sessionId).stream()
                .filter(saved -> saved.status() == FsrsRepository.ItemStatus.COMPLETED).count();
        int pendingCount = session.targetCount() - completedCount;
        SessionStatus resultStatus = SessionStatus.IN_PROGRESS;
        UserStreak streak = repository.findStreak(trustedUserId).orElse(null);
        if (pendingCount == 0) {
            ReviewSession finished = repository.finishSession(trustedUserId, sessionId, SessionStatus.COMPLETED, reviewedAt)
                    .orElseThrow(() -> error(FsrsServiceException.Code.SESSION_CLOSED, "Review session is no longer active"));
            resultStatus = finished.status();
            if (finished.type() == SessionType.DUE) {
                LocalDate today = reviewedAt.atZone(streakZone).toLocalDate();
                streak = repository.recordDueCompletion(trustedUserId, today, reviewedAt);
            }
        }

        boolean waiting = !itemCompleted && scheduled.card().due().isAfter(reviewedAt);
        RatingResult result = new RatingResult(sessionId, wordId, rating, scheduled.card().state(),
                scheduled.card().step(), scheduled.card().due(), updatedItem.status(), updatedItem.againCount(),
                completedCount, session.targetCount(), pendingCount, resultStatus, waiting,
                streak == null ? 0 : streak.currentStreak());
        repository.completeIdempotency(trustedUserId, requestToken, requestHash, 200, json.writeValueAsString(result));
        return result;
    }

    private SessionView sessionView(UUID userId, ReviewSession session) {
        List<QueueEntry> queue = repository.findSessionQueue(userId, session.id());
        List<SessionItemView> items = new ArrayList<>(queue.size());
        Instant now = clock.instant();
        int completed = 0;
        for (QueueEntry entry : queue) {
            ReviewSessionItem item = entry.item();
            if (item.status() == FsrsRepository.ItemStatus.COMPLETED) completed++;
            items.add(new SessionItemView(item.wordId(), item.queuePosition(), item.status(), item.againCount(),
                    item.lastRating(), entry.dueAt(), entry.cardState(), entry.learningStep()));
        }
        QueueEntry nextReady = firstReadyItem(session.type(), queue, now);
        QueueEntry next = nextReady == null
                ? queue.stream().filter(entry -> entry.item().status() == FsrsRepository.ItemStatus.PENDING)
                    .min(java.util.Comparator.comparing(QueueEntry::dueAt).thenComparingLong(entry -> entry.item().queuePosition()))
                    .orElse(null)
                : nextReady;
        boolean waiting = next != null && nextReady == null;
        Instant nextDueAt = next == null ? null : next.dueAt();
        if (nextReady != null && nextDueAt.isAfter(now)) nextDueAt = now;
        return new SessionView(session.id(), session.type(), session.status(), session.targetCount(), completed,
                session.targetCount() - completed, next == null ? null : next.item().wordId(),
                nextDueAt, waiting, false, items);
    }

    private static QueueEntry firstReadyItem(SessionType type, List<QueueEntry> queue, Instant now) {
        return queue.stream()
                .filter(entry -> entry.item().status() == FsrsRepository.ItemStatus.PENDING)
                .filter(entry -> isReady(type, entry.item(), entry.dueAt(), now))
                .findFirst().orElse(null);
    }

    private static boolean isReady(SessionType type, ReviewSessionItem item, Instant dueAt, Instant now) {
        // CRAM can advance the first review of a queued word. A subsequent learning step keeps its new due time.
        return !dueAt.isAfter(now) || (type == SessionType.CRAM && item.lastRating() == null);
    }

    private static SessionView emptySession(SessionType type) {
        return new SessionView(null, type, null, 0, 0, 0, null, null, false, true, List.of());
    }

    private RatingResult replayOrConflict(IdempotencyRecord saved, UUID sessionId, UUID wordId,
                                          FsrsRating rating, byte[] requestHash) {
        if (!saved.matches(sessionId, wordId, rating, requestHash)) {
            throw error(FsrsServiceException.Code.IDEMPOTENCY_CONFLICT,
                    "Idempotency token was already used for another rating request");
        }
        if (saved.state() != FsrsRepository.IdempotencyState.COMPLETED || saved.responseJson() == null) {
            throw error(FsrsServiceException.Code.REQUEST_IN_PROGRESS, "Rating request is already being processed");
        }
        return json.readValue(saved.responseJson(), RatingResult.class);
    }

    private static byte[] requestHash(UUID sessionId, UUID wordId, FsrsRating rating) {
        try {
            String canonical = "fsrs-rating:v1:" + sessionId + ":" + wordId + ":" + rating.name();
            return MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static void requireUserId(UUID userId) {
        Objects.requireNonNull(userId, "Trusted user ID is required");
    }

    private static int displayedCurrentStreak(UserStreak streak, LocalDate today) {
        LocalDate last = streak.lastEligibleStudyDate();
        if (last == null || last.isBefore(today.minusDays(1))) return 0;
        return streak.currentStreak();
    }

    private static FsrsServiceException error(FsrsServiceException.Code code, String message) {
        return new FsrsServiceException(code, message);
    }

    public record ReviewSummary(int learnedCount, int dueCount, int cramCount, int newCount, int learningCount, int reviewCount,
                                int relearningCount, int currentStreak, int longestStreak, int totalCards,
                                UUID activeSessionId) {}

    public record SessionView(UUID sessionId, SessionType type, SessionStatus status, int targetCount,
                              int completedCount, int pendingCount, UUID nextWordId, Instant nextDueAt,
                              boolean waiting, boolean empty, List<SessionItemView> items) {}

    public record SessionItemView(UUID wordId, long queuePosition, FsrsRepository.ItemStatus status,
                                  int againCount, FsrsRating lastRating, Instant dueAt,
                                  FsrsCardState cardState, int learningStep) {}

    public record RatingResult(UUID sessionId, UUID wordId, FsrsRating rating, FsrsCardState cardState,
                               int learningStep, Instant nextDueAt, FsrsRepository.ItemStatus itemStatus,
                               int againCount, int completedCount, int targetCount, int pendingCount,
                               SessionStatus sessionStatus, boolean waiting, int currentStreak) {}
}
