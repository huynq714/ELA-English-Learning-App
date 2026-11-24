package com.englishlearning.fsrs;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Deterministic implementation of the FSRS-4.5 (Free Spaced Repetition Scheduler) algorithm.
 * Specification Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 *
 * Algorithm properties:
 * - 17 default parameters.
 * - DECAY = -0.5, FACTOR = 19.0 / 81.0.
 * - Default desired retention = 0.9.
 * - Clamping: Difficulty in [1.0, 10.0], Stability >= 0.1.
 * - Pure functions, no static system clock dependency, 100% deterministic.
 */
public class FsrsEngine {
    public static final String SCHEDULER_VERSION = "fsrs-4.5";

    private final FsrsParameters parameters;

    public FsrsEngine(FsrsParameters parameters) {
        this.parameters = Objects.requireNonNull(parameters, "Parameters cannot be null");
    }

    public FsrsEngine() {
        this(FsrsParameters.defaultParameters());
    }

    public FsrsParameters getParameters() {
        return parameters;
    }

    public String getVersion() {
        return SCHEDULER_VERSION;
    }

    /**
     * Evaluate and schedule a card with the given rating at a specific review timestamp.
     *
     * @param card the existing card state (cannot be null)
     * @param rating user rating: AGAIN, HARD, GOOD, or EASY (cannot be null)
     * @param reviewTime evaluation timestamp (cannot be null)
     * @return FsrsSchedulingResult containing updated card and review log
     */
    public FsrsSchedulingResult schedule(FsrsCard card, FsrsRating rating, Instant reviewTime) {
        Objects.requireNonNull(card, "Card cannot be null");
        Objects.requireNonNull(rating, "Rating cannot be null");
        Objects.requireNonNull(reviewTime, "Review time cannot be null");

        double elapsedDays = calculateElapsedDays(card, reviewTime);

        return switch (card.state()) {
            case NEW -> scheduleNewCard(card, rating, reviewTime);
            case LEARNING -> scheduleLearningCard(card, rating, reviewTime, elapsedDays);
            case REVIEW -> scheduleReviewCard(card, rating, reviewTime, elapsedDays);
            case RELEARNING -> scheduleRelearningCard(card, rating, reviewTime, elapsedDays);
        };
    }

    /**
     * Preview all 4 ratings for the given card at reviewTime without mutating any state.
     */
    public Map<FsrsRating, FsrsSchedulingResult> preview(FsrsCard card, Instant reviewTime) {
        Map<FsrsRating, FsrsSchedulingResult> results = new EnumMap<>(FsrsRating.class);
        for (FsrsRating rating : FsrsRating.values()) {
            results.put(rating, schedule(card, rating, reviewTime));
        }
        return results;
    }

    // -------------------------------------------------------------------------
    // State-specific scheduling
    // -------------------------------------------------------------------------

    private FsrsSchedulingResult scheduleNewCard(FsrsCard card, FsrsRating rating, Instant reviewTime) {
        double initS = initStability(rating);
        double initD = initDifficulty(rating);

        FsrsCard updatedCard;
        Instant nextDue;
        int scheduledDays;

        if (rating == FsrsRating.AGAIN) {
            // First step in learning: 1 minute
            Duration stepDuration = parameters.learningSteps().isEmpty()
                    ? Duration.ofMinutes(1)
                    : parameters.learningSteps().get(0);
            nextDue = reviewTime.plus(stepDuration);
            scheduledDays = 0;
            updatedCard = card.with(
                    nextDue, initS, initD, card.repetitions() + 1, 0, FsrsCardState.LEARNING, reviewTime, 0
            );
        } else if (rating == FsrsRating.HARD) {
            Duration stepDuration = hardStepDuration(parameters.learningSteps(), 0);
            nextDue = reviewTime.plus(stepDuration);
            scheduledDays = 0;
            updatedCard = card.with(
                    nextDue, initS, initD, card.repetitions() + 1, 0, FsrsCardState.LEARNING, reviewTime, 0
            );
        } else if (rating == FsrsRating.GOOD) {
            // Good: if multiple learning steps exist, advance to step 1;
            // if single step or default 2-step graduation policy, Good graduates or advances.
            if (parameters.learningSteps().size() > 1 && card.step() < parameters.learningSteps().size() - 1) {
                Duration nextStep = parameters.learningSteps().get(1);
                nextDue = reviewTime.plus(nextStep);
                scheduledDays = 0;
                updatedCard = card.with(
                        nextDue, initS, initD, card.repetitions() + 1, 0, FsrsCardState.LEARNING, reviewTime, 1
                );
            } else {
                // Graduate immediately to REVIEW
                scheduledDays = nextInterval(initS, parameters.desiredRetention());
                nextDue = reviewTime.plus(scheduledDays, ChronoUnit.DAYS);
                updatedCard = card.with(
                        nextDue, initS, initD, card.repetitions() + 1, 0, FsrsCardState.REVIEW, reviewTime, 0
                );
            }
        } else {
            // EASY: Immediately graduates to REVIEW with initial Easy stability
            scheduledDays = nextInterval(initS, parameters.desiredRetention());
            nextDue = reviewTime.plus(scheduledDays, ChronoUnit.DAYS);
            updatedCard = card.with(
                    nextDue, initS, initD, card.repetitions() + 1, 0, FsrsCardState.REVIEW, reviewTime, 0
            );
        }

        FsrsReviewLog log = new FsrsReviewLog(
                rating, card.state(), reviewTime, 0.0, card.due(), nextDue, scheduledDays
        );
        return new FsrsSchedulingResult(updatedCard, log);
    }

    private FsrsSchedulingResult scheduleLearningCard(FsrsCard card, FsrsRating rating, Instant reviewTime, double elapsedDays) {
        double currentD = card.difficulty();
        double currentS = card.stability();

        if (rating == FsrsRating.AGAIN) {
            // Failed learning step: reset to step 0
            Duration stepDuration = parameters.learningSteps().isEmpty()
                    ? Duration.ofMinutes(1)
                    : parameters.learningSteps().get(0);
            Instant nextDue = reviewTime.plus(stepDuration);
            FsrsCard updatedCard = card.with(
                    nextDue, currentS, currentD, card.repetitions() + 1, card.lapses(),
                    FsrsCardState.LEARNING, reviewTime, 0
            );
            FsrsReviewLog log = new FsrsReviewLog(
                    rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, 0
            );
            return new FsrsSchedulingResult(updatedCard, log);
        }

        if (rating == FsrsRating.HARD) {
            // Repeat current learning step
            int currentStep = Math.min(card.step(), Math.max(0, parameters.learningSteps().size() - 1));
            Duration stepDuration = hardStepDuration(parameters.learningSteps(), currentStep);
            Instant nextDue = reviewTime.plus(stepDuration);
            FsrsCard updatedCard = card.with(
                    nextDue, currentS, currentD, card.repetitions() + 1, card.lapses(),
                    FsrsCardState.LEARNING, reviewTime, currentStep
            );
            FsrsReviewLog log = new FsrsReviewLog(
                    rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, 0
            );
            return new FsrsSchedulingResult(updatedCard, log);
        }

        if (rating == FsrsRating.GOOD) {
            int nextStep = card.step() + 1;
            if (nextStep < parameters.learningSteps().size()) {
                // Advance to next learning step
                Duration stepDuration = parameters.learningSteps().get(nextStep);
                Instant nextDue = reviewTime.plus(stepDuration);
                FsrsCard updatedCard = card.with(
                        nextDue, currentS, currentD, card.repetitions() + 1, card.lapses(),
                        FsrsCardState.LEARNING, reviewTime, nextStep
                );
                FsrsReviewLog log = new FsrsReviewLog(
                        rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, 0
                );
                return new FsrsSchedulingResult(updatedCard, log);
            } else {
                // Graduated from LEARNING to REVIEW
                int scheduledDays = nextInterval(currentS, parameters.desiredRetention());
                Instant nextDue = reviewTime.plus(scheduledDays, ChronoUnit.DAYS);
                FsrsCard updatedCard = card.with(
                        nextDue, currentS, currentD, card.repetitions() + 1, card.lapses(),
                        FsrsCardState.REVIEW, reviewTime, 0
                );
                FsrsReviewLog log = new FsrsReviewLog(
                        rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, scheduledDays
                );
                return new FsrsSchedulingResult(updatedCard, log);
            }
        }

        // EASY: Immediately graduates to REVIEW with bonus stability
        double easyS = initStability(FsrsRating.EASY);
        int scheduledDays = nextInterval(Math.max(currentS, easyS), parameters.desiredRetention());
        Instant nextDue = reviewTime.plus(scheduledDays, ChronoUnit.DAYS);
        FsrsCard updatedCard = card.with(
                nextDue, Math.max(currentS, easyS), currentD, card.repetitions() + 1, card.lapses(),
                FsrsCardState.REVIEW, reviewTime, 0
        );
        FsrsReviewLog log = new FsrsReviewLog(
                rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, scheduledDays
        );
        return new FsrsSchedulingResult(updatedCard, log);
    }

    private FsrsSchedulingResult scheduleReviewCard(FsrsCard card, FsrsRating rating, Instant reviewTime, double elapsedDays) {
        double r = retrievability(elapsedDays, card.stability());
        double nextD = nextDifficulty(card.difficulty(), rating);

        if (rating == FsrsRating.AGAIN) {
            // Lapse: Card forgotten after entering REVIEW
            double nextS = nextForgetStability(card.difficulty(), card.stability(), r);
            Duration relearnStep = parameters.relearningSteps().isEmpty()
                    ? Duration.ofMinutes(10)
                    : parameters.relearningSteps().get(0);
            Instant nextDue = reviewTime.plus(relearnStep);
            FsrsCard updatedCard = card.with(
                    nextDue, nextS, nextD, card.repetitions() + 1, card.lapses() + 1,
                    FsrsCardState.RELEARNING, reviewTime, 0
            );
            FsrsReviewLog log = new FsrsReviewLog(
                    rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, 0
            );
            return new FsrsSchedulingResult(updatedCard, log);
        }

        // Successful recall (HARD, GOOD, EASY)
        double nextS = nextRecallStability(card.difficulty(), card.stability(), r, rating);
        int scheduledDays = nextInterval(nextS, parameters.desiredRetention());
        Instant nextDue = reviewTime.plus(scheduledDays, ChronoUnit.DAYS);

        FsrsCard updatedCard = card.with(
                nextDue, nextS, nextD, card.repetitions() + 1, card.lapses(),
                FsrsCardState.REVIEW, reviewTime, 0
        );
        FsrsReviewLog log = new FsrsReviewLog(
                rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, scheduledDays
        );
        return new FsrsSchedulingResult(updatedCard, log);
    }

    private FsrsSchedulingResult scheduleRelearningCard(FsrsCard card, FsrsRating rating, Instant reviewTime, double elapsedDays) {
        double currentD = card.difficulty();
        double currentS = card.stability();

        if (rating == FsrsRating.AGAIN) {
            // Repeat relearning step
            Duration relearnStep = parameters.relearningSteps().isEmpty()
                    ? Duration.ofMinutes(10)
                    : parameters.relearningSteps().get(0);
            Instant nextDue = reviewTime.plus(relearnStep);
            FsrsCard updatedCard = card.with(
                    nextDue, currentS, currentD, card.repetitions() + 1, card.lapses(),
                    FsrsCardState.RELEARNING, reviewTime, 0
            );
            FsrsReviewLog log = new FsrsReviewLog(
                    rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, 0
            );
            return new FsrsSchedulingResult(updatedCard, log);
        }

        if (rating == FsrsRating.HARD) {
            int currentStep = Math.min(card.step(), Math.max(0, parameters.relearningSteps().size() - 1));
            Duration step = hardStepDuration(parameters.relearningSteps(), currentStep);
            Instant nextDue = reviewTime.plus(step);
            FsrsCard updatedCard = card.with(nextDue, currentS, currentD, card.repetitions() + 1,
                    card.lapses(), FsrsCardState.RELEARNING, reviewTime, currentStep);
            FsrsReviewLog log = new FsrsReviewLog(rating, card.state(), reviewTime, elapsedDays,
                    card.due(), nextDue, 0);
            return new FsrsSchedulingResult(updatedCard, log);
        }

        if (rating == FsrsRating.GOOD && card.step() + 1 < parameters.relearningSteps().size()) {
            int nextStep = card.step() + 1;
            Instant nextDue = reviewTime.plus(parameters.relearningSteps().get(nextStep));
            FsrsCard updatedCard = card.with(nextDue, currentS, currentD, card.repetitions() + 1,
                    card.lapses(), FsrsCardState.RELEARNING, reviewTime, nextStep);
            FsrsReviewLog log = new FsrsReviewLog(rating, card.state(), reviewTime, elapsedDays,
                    card.due(), nextDue, 0);
            return new FsrsSchedulingResult(updatedCard, log);
        }

        // GOOD after the last relearning step, or EASY, graduates back to REVIEW.
        int scheduledDays = nextInterval(currentS, parameters.desiredRetention());
        Instant nextDue = reviewTime.plus(scheduledDays, ChronoUnit.DAYS);
        FsrsCard updatedCard = card.with(
                nextDue, currentS, currentD, card.repetitions() + 1, card.lapses(),
                FsrsCardState.REVIEW, reviewTime, 0
        );
        FsrsReviewLog log = new FsrsReviewLog(
                rating, card.state(), reviewTime, elapsedDays, card.due(), nextDue, scheduledDays
        );
        return new FsrsSchedulingResult(updatedCard, log);
    }

    // -------------------------------------------------------------------------
    // Core Mathematical Formulas (FSRS-4.5)
    // -------------------------------------------------------------------------

    /**
     * Initial stability S_0(G) = w[G - 1]
     */
    public double initStability(FsrsRating rating) {
        return clampStability(parameters.w(rating.grade() - 1));
    }

    /**
     * Initial difficulty D_0(G) = clamp(w[4] - (G - 3) * w[5], 1.0, 10.0)
     */
    public double initDifficulty(FsrsRating rating) {
        double d0 = parameters.w(4) - (rating.grade() - 3) * parameters.w(5);
        return clampDifficulty(d0);
    }

    /**
     * Next difficulty D'(D, G) = clamp(w[7] * D_0(3) + (1 - w[7]) * (D - w[6] * (G - 3)), 1.0, 10.0)
     * where D_0(3) = w[4].
     */
    public double nextDifficulty(double currentDifficulty, FsrsRating rating) {
        double d0Good = parameters.w(4);
        double adjustedD = currentDifficulty - parameters.w(6) * (rating.grade() - 3);
        double nextD = parameters.w(7) * d0Good + (1.0 - parameters.w(7)) * adjustedD;
        return clampDifficulty(nextD);
    }

    /**
     * Retrievability R(t, S) = (1 + FACTOR * (t / S))^DECAY
     * where FACTOR = 19/81, DECAY = -0.5.
     */
    public double retrievability(double elapsedDays, double stability) {
        if (!Double.isFinite(elapsedDays) || !Double.isFinite(stability)) {
            throw new IllegalArgumentException("Elapsed days and stability must be finite");
        }
        if (stability < FsrsCard.MIN_STABILITY || stability > FsrsCard.MAX_STABILITY) {
            throw new IllegalArgumentException("Stability must be within the supported FSRS bounds");
        }
        if (elapsedDays <= 0.0) {
            return 1.0;
        }
        double factor = parameters.factor();
        double decay = parameters.decay();
        double r = Math.pow(1.0 + factor * (elapsedDays / stability), decay);
        return Math.min(1.0, Math.max(0.0, r));
    }

    /**
     * Next Stability on Successful Recall (HARD, GOOD, EASY):
     * S'_r = S * (1 + exp(w[8]) * (11 - D) * S^(-w[9]) * (exp(w[10] * (1 - R)) - 1) * modifier)
     * where modifier = w[15] for HARD, w[16] for EASY, 1.0 for GOOD.
     */
    public double nextRecallStability(double difficulty, double stability, double retrievability, FsrsRating rating) {
        requireFiniteMemoryState(difficulty, stability, retrievability);
        double modifier = switch (rating) {
            case HARD -> parameters.w(15);
            case EASY -> parameters.w(16);
            case GOOD -> 1.0;
            case AGAIN -> throw new IllegalArgumentException("Recall stability cannot be computed for rating AGAIN");
        };

        double term = Math.exp(parameters.w(8))
                * (11.0 - difficulty)
                * Math.pow(stability, -parameters.w(9))
                * (Math.exp(parameters.w(10) * (1.0 - retrievability)) - 1.0)
                * modifier;

        double nextS = stability * (1.0 + term);
        return clampStability(nextS);
    }

    /**
     * Next Stability on Forget / Lapse (AGAIN):
     * S'_f = w[11] * D^(-w[12]) * ((S + 1)^w[13] - 1) * exp(w[14] * (1 - R))
     * Bounded by min(S, S'_f) so stability does not magically grow on failure.
     */
    public double nextForgetStability(double difficulty, double stability, double retrievability) {
        requireFiniteMemoryState(difficulty, stability, retrievability);
        double nextS = parameters.w(11)
                * Math.pow(difficulty, -parameters.w(12))
                * (Math.pow(stability + 1.0, parameters.w(13)) - 1.0)
                * Math.exp(parameters.w(14) * (1.0 - retrievability));

        // Clamped between 0.1 and previous stability S
        return Math.min(stability, clampStability(nextS));
    }

    /**
     * Next Interval in Days:
     * I = round( (S / FACTOR) * (r^(1 / DECAY) - 1) )
     * For r = 0.9, FACTOR = 19/81, DECAY = -0.5:
     * r^(1 / DECAY) - 1 = 0.9^(-2) - 1 = (100/81) - 1 = 19/81.
     * Thus (S / (19/81)) * (19/81) = S.
     */
    public int nextInterval(double stability, double desiredRetention) {
        if (!Double.isFinite(stability) || !Double.isFinite(desiredRetention)
                || desiredRetention <= 0.0 || desiredRetention >= 1.0) {
            throw new IllegalArgumentException("Stability and desired retention must be finite and valid");
        }
        if (stability < FsrsCard.MIN_STABILITY) {
            throw new IllegalArgumentException("Stability is below the supported FSRS minimum");
        }
        double ratio = (Math.pow(desiredRetention, 1.0 / parameters.decay()) - 1.0) / parameters.factor();
        double rawInterval = Math.min(stability, FsrsCard.MAX_STABILITY) * ratio;
        long rounded = Math.round(rawInterval);
        int interval = (int) Math.min(parameters.maximumInterval(), Math.max(1L, rounded));
        return interval;
    }

    private static double clampDifficulty(double d) {
        if (!Double.isFinite(d)) throw new IllegalArgumentException("Difficulty must be finite");
        return Math.min(10.0, Math.max(1.0, d));
    }

    private static double clampStability(double s) {
        if (!Double.isFinite(s)) throw new IllegalArgumentException("Stability must be finite");
        return Math.min(FsrsCard.MAX_STABILITY, Math.max(FsrsCard.MIN_STABILITY, s));
    }

    private static void requireFiniteMemoryState(double difficulty, double stability, double retrievability) {
        if (!Double.isFinite(difficulty) || difficulty < 1.0 || difficulty > 10.0
                || !Double.isFinite(stability) || stability < FsrsCard.MIN_STABILITY
                || stability > FsrsCard.MAX_STABILITY || !Double.isFinite(retrievability)
                || retrievability < 0.0 || retrievability > 1.0) {
            throw new IllegalArgumentException("Invalid FSRS memory state");
        }
    }

    private static Duration hardStepDuration(java.util.List<Duration> steps, int currentStep) {
        if (steps.isEmpty()) return Duration.ofMinutes(5);
        if (currentStep == 0 && steps.size() >= 2) return steps.get(0).plus(steps.get(1)).dividedBy(2);
        if (currentStep == 0) return steps.get(0).multipliedBy(3).dividedBy(2);
        return steps.get(Math.min(currentStep, steps.size() - 1));
    }

    private static double calculateElapsedDays(FsrsCard card, Instant reviewTime) {
        if (card.lastReviewed() == null) {
            return 0.0;
        }
        long millis = Duration.between(card.lastReviewed(), reviewTime).toMillis();
        if (millis <= 0) {
            return 0.0;
        }
        return (double) millis / (1000.0 * 60.0 * 60.0 * 24.0);
    }
}
