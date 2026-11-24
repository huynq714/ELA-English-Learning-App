package com.englishlearning.fsrs;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verified unit tests for FSRS-4.5 Core Engine.
 * Mathematical specification reference:
 * https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */
class FsrsEngineTest {

    private static final double EPSILON = 1e-4;
    private FsrsEngine engine;
    private Instant baseTime;

    @BeforeEach
    void setUp() {
        engine = new FsrsEngine();
        baseTime = Instant.parse("2026-11-23T10:00:00Z");
    }

    @Nested
    @DisplayName("1. New Card & Initial Memory States (S0 & D0)")
    class InitialStatesTest {

        @Test
        @DisplayName("Initial stability matches exact FSRS-4.5 default weights S0(G) = w[G-1]")
        void initialStabilityMatchesWeights() {
            assertEquals(0.4872, engine.initStability(FsrsRating.AGAIN), EPSILON);
            assertEquals(1.4003, engine.initStability(FsrsRating.HARD), EPSILON);
            assertEquals(3.7145, engine.initStability(FsrsRating.GOOD), EPSILON);
            assertEquals(13.8206, engine.initStability(FsrsRating.EASY), EPSILON);
        }

        @Test
        @DisplayName("Initial difficulty matches exact FSRS-4.5 formula D0(G) = w4 - (G - 3) * w5")
        void initialDifficultyMatchesFormula() {
            // w4 = 5.1618, w5 = 1.2298
            // Again (G=1): 5.1618 - (1 - 3) * 1.2298 = 7.6214
            assertEquals(7.6214, engine.initDifficulty(FsrsRating.AGAIN), EPSILON);
            // Hard (G=2): 5.1618 - (2 - 3) * 1.2298 = 6.3916
            assertEquals(6.3916, engine.initDifficulty(FsrsRating.HARD), EPSILON);
            // Good (G=3): 5.1618 - 0 = 5.1618
            assertEquals(5.1618, engine.initDifficulty(FsrsRating.GOOD), EPSILON);
            // Easy (G=4): 5.1618 - 1.2298 = 3.9320
            assertEquals(3.9320, engine.initDifficulty(FsrsRating.EASY), EPSILON);
        }

        @Test
        @DisplayName("Scheduling NEW card with AGAIN transitions to LEARNING at step 0")
        void scheduleNewCardAgain() {
            FsrsCard card = FsrsCard.newCard(baseTime);
            FsrsSchedulingResult result = engine.schedule(card, FsrsRating.AGAIN, baseTime);

            assertEquals(FsrsCardState.LEARNING, result.card().state());
            assertEquals(0, result.card().step());
            assertEquals(1, result.card().repetitions());
            assertEquals(0, result.card().lapses());
            assertEquals(0.4872, result.card().stability(), EPSILON);
            assertEquals(7.6214, result.card().difficulty(), EPSILON);
            assertEquals(baseTime.plus(Duration.ofMinutes(1)), result.card().due());
            assertEquals(0, result.reviewLog().scheduledDays());
        }

        @Test
        @DisplayName("Scheduling NEW card with GOOD advances step or graduates based on steps")
        void scheduleNewCardGood() {
            FsrsCard card = FsrsCard.newCard(baseTime);
            FsrsSchedulingResult result = engine.schedule(card, FsrsRating.GOOD, baseTime);

            // Default learning steps: 1m, 10m -> step advances to 1
            assertEquals(FsrsCardState.LEARNING, result.card().state());
            assertEquals(1, result.card().step());
            assertEquals(1, result.card().repetitions());
            assertEquals(baseTime.plus(Duration.ofMinutes(10)), result.card().due());
            assertEquals(3.7145, result.card().stability(), EPSILON);
            assertEquals(5.1618, result.card().difficulty(), EPSILON);
        }

        @Test
        @DisplayName("HARD on NEW uses the midpoint of the first two learning steps")
        void scheduleNewCardHardUsesStepMidpoint() {
            FsrsCard card = FsrsCard.newCard(baseTime);
            FsrsSchedulingResult result = engine.schedule(card, FsrsRating.HARD, baseTime);

            assertEquals(FsrsCardState.LEARNING, result.card().state());
            assertEquals(0, result.card().step());
            assertEquals(1, result.card().repetitions());
            assertEquals(baseTime.plus(Duration.ofMinutes(5)).plusSeconds(30), result.card().due());
        }

        @Test
        @DisplayName("Scheduling NEW card with EASY immediately graduates to REVIEW")
        void scheduleNewCardEasy() {
            FsrsCard card = FsrsCard.newCard(baseTime);
            FsrsSchedulingResult result = engine.schedule(card, FsrsRating.EASY, baseTime);

            assertEquals(FsrsCardState.REVIEW, result.card().state());
            assertEquals(1, result.card().repetitions());
            assertEquals(0, result.card().lapses());
            assertEquals(13.8206, result.card().stability(), EPSILON);
            assertEquals(3.9320, result.card().difficulty(), EPSILON);
            // Interval for S = 13.8206 with retention 0.9 is round(13.8206) = 14 days
            assertEquals(14, result.reviewLog().scheduledDays());
            assertEquals(baseTime.plus(14, ChronoUnit.DAYS), result.card().due());
        }
    }

    @Nested
    @DisplayName("2. Learning & Relearning Step Progression")
    class StepsProgressionTest {

        @Test
        @DisplayName("Completing all learning steps graduates card to REVIEW state")
        void graduateThroughLearningSteps() {
            FsrsCard card = FsrsCard.newCard(baseTime);

            // Turn 1: Good -> advances to step 1 (10m)
            FsrsSchedulingResult r1 = engine.schedule(card, FsrsRating.GOOD, baseTime);
            assertEquals(FsrsCardState.LEARNING, r1.card().state());
            assertEquals(1, r1.card().step());

            // Turn 2: 10 minutes later, user rates Good -> completes step 1 -> graduates to REVIEW!
            Instant t2 = baseTime.plus(Duration.ofMinutes(10));
            FsrsSchedulingResult r2 = engine.schedule(r1.card(), FsrsRating.GOOD, t2);

            assertEquals(FsrsCardState.REVIEW, r2.card().state());
            assertEquals(2, r2.card().repetitions());
            assertEquals(4, r2.reviewLog().scheduledDays()); // round(3.7145) = 4 days
            assertEquals(t2.plus(4, ChronoUnit.DAYS), r2.card().due());
        }

        @Test
        @DisplayName("Rating AGAIN in LEARNING step resets to step 0 without incrementing lapses")
        void againInLearningResetsStep() {
            FsrsCard card = FsrsCard.newCard(baseTime);
            FsrsSchedulingResult r1 = engine.schedule(card, FsrsRating.GOOD, baseTime); // step 1
            assertEquals(1, r1.card().step());

            Instant t2 = baseTime.plus(Duration.ofMinutes(10));
            FsrsSchedulingResult r2 = engine.schedule(r1.card(), FsrsRating.AGAIN, t2); // failed step 1

            assertEquals(FsrsCardState.LEARNING, r2.card().state());
            assertEquals(0, r2.card().step());
            assertEquals(0, r2.card().lapses()); // lapses only increment for graduated REVIEW cards
            assertEquals(2, r2.card().repetitions());
            assertEquals(t2.plus(Duration.ofMinutes(1)), r2.card().due());
        }

        @Test
        @DisplayName("HARD in LEARNING repeats the current step using the correct interval")
        void hardInLearningRepeatsCurrentStep() {
            FsrsCard card = FsrsCard.newCard(baseTime);
            FsrsCard stepOne = engine.schedule(card, FsrsRating.GOOD, baseTime).card();
            Instant reviewTime = baseTime.plus(Duration.ofMinutes(10));

            FsrsSchedulingResult result = engine.schedule(stepOne, FsrsRating.HARD, reviewTime);

            assertEquals(FsrsCardState.LEARNING, result.card().state());
            assertEquals(1, result.card().step());
            assertEquals(reviewTime.plus(Duration.ofMinutes(10)), result.card().due());
            assertEquals(2, result.card().repetitions());
        }
    }

    @Nested
    @DisplayName("3. Review State Scheduling: On-time, Early, Overdue")
    class ReviewTimingTest {

        private FsrsCard graduatedCard;

        @BeforeEach
        void createGraduatedCard() {
            // A graduated card with Stability = 4.0, Difficulty = 5.0, in REVIEW state
            graduatedCard = new FsrsCard(
                    baseTime.plus(4, ChronoUnit.DAYS),
                    4.0,
                    5.0,
                    1,
                    0,
                    FsrsCardState.REVIEW,
                    baseTime,
                    0
            );
        }

        @Test
        @DisplayName("On-time review (t = 4 days, R ~= 0.90) increases stability normally")
        void onTimeReview() {
            Instant onTime = baseTime.plus(4, ChronoUnit.DAYS);
            double r = engine.retrievability(4.0, 4.0);
            assertEquals(0.90, r, 0.01); // Retrievability at t = S should be ~0.90

            FsrsSchedulingResult result = engine.schedule(graduatedCard, FsrsRating.GOOD, onTime);

            assertEquals(FsrsCardState.REVIEW, result.card().state());
            assertEquals(2, result.card().repetitions());
            assertTrue(result.card().stability() > graduatedCard.stability(),
                    "Stability must increase after successful on-time recall");
            assertTrue(result.reviewLog().scheduledDays() > 4,
                    "Next interval must be longer than previous 4 days");
        }

        @Test
        @DisplayName("Early review (t = 1 day, R > 0.90) results in smaller stability increase")
        void earlyReview() {
            Instant earlyTime = baseTime.plus(1, ChronoUnit.DAYS);
            double rEarly = engine.retrievability(1.0, 4.0);
            assertTrue(rEarly > 0.95, "Early retrievability should be high");

            FsrsSchedulingResult earlyResult = engine.schedule(graduatedCard, FsrsRating.GOOD, earlyTime);

            Instant onTime = baseTime.plus(4, ChronoUnit.DAYS);
            FsrsSchedulingResult onTimeResult = engine.schedule(graduatedCard, FsrsRating.GOOD, onTime);

            assertTrue(earlyResult.card().stability() < onTimeResult.card().stability(),
                    "Early review stability gain should be less than on-time review gain");
        }

        @Test
        @DisplayName("Overdue review (t = 12 days, R < 0.90) results in larger stability increase on recall")
        void overdueReview() {
            Instant overdueTime = baseTime.plus(12, ChronoUnit.DAYS);
            double rOverdue = engine.retrievability(12.0, 4.0);
            assertTrue(rOverdue < 0.80, "Overdue retrievability should be significantly lower");

            FsrsSchedulingResult overdueResult = engine.schedule(graduatedCard, FsrsRating.GOOD, overdueTime);
            FsrsSchedulingResult onTimeResult = engine.schedule(graduatedCard, FsrsRating.GOOD, baseTime.plus(4, ChronoUnit.DAYS));

            assertTrue(overdueResult.card().stability() > onTimeResult.card().stability(),
                    "Recalling a heavily overdue card proves stronger memory and yields higher stability");
        }
    }

    @Nested
    @DisplayName("4. Lapses & Forgetting in REVIEW State")
    class LapseTest {

        @Test
        @DisplayName("Rating AGAIN on a REVIEW card triggers lapse, transitions to RELEARNING")
        void reviewCardLapse() {
            FsrsCard reviewCard = new FsrsCard(
                    baseTime.plus(10, ChronoUnit.DAYS),
                    10.0,
                    5.0,
                    3,
                    0,
                    FsrsCardState.REVIEW,
                    baseTime,
                    0
            );

            Instant reviewTime = baseTime.plus(10, ChronoUnit.DAYS);
            FsrsSchedulingResult result = engine.schedule(reviewCard, FsrsRating.AGAIN, reviewTime);

            assertEquals(FsrsCardState.RELEARNING, result.card().state());
            assertEquals(1, result.card().lapses());
            assertEquals(4, result.card().repetitions());
            assertTrue(result.card().stability() < reviewCard.stability(),
                    "Stability must drop significantly after a lapse");
            assertTrue(result.card().stability() >= 0.1, "Stability must never drop below 0.1");
            assertTrue(result.card().difficulty() > reviewCard.difficulty(),
                    "Difficulty must increase after lapse");
            assertEquals(reviewTime.plus(Duration.ofMinutes(10)), result.card().due());
            assertEquals(0, result.reviewLog().scheduledDays());
        }

        @Test
        @DisplayName("Relearning card with GOOD graduates back to REVIEW state")
        void relearningCardReGraduation() {
            FsrsCard relearningCard = new FsrsCard(
                    baseTime.plus(Duration.ofMinutes(10)),
                    2.0,
                    6.5,
                    3,
                    1,
                    FsrsCardState.RELEARNING,
                    baseTime,
                    0
            );

            Instant t2 = baseTime.plus(Duration.ofMinutes(10));
            FsrsSchedulingResult result = engine.schedule(relearningCard, FsrsRating.GOOD, t2);

            assertEquals(FsrsCardState.REVIEW, result.card().state());
            assertEquals(4, result.card().repetitions());
            assertEquals(1, result.card().lapses());
            assertEquals(2, result.reviewLog().scheduledDays()); // round(2.0) = 2 days
            assertEquals(t2.plus(2, ChronoUnit.DAYS), result.card().due());
        }

        @Test
        @DisplayName("Repeated AGAIN in RELEARNING increments repetitions but not lapses")
        void repeatedAgainInRelearningDoesNotAddLapses() {
            FsrsCard card = new FsrsCard(baseTime.plus(Duration.ofMinutes(10)), 2.0, 6.5,
                    3, 1, FsrsCardState.RELEARNING, baseTime, 0);
            Instant reviewTime = baseTime.plus(Duration.ofMinutes(10));

            FsrsSchedulingResult result = engine.schedule(card, FsrsRating.AGAIN, reviewTime);

            assertEquals(FsrsCardState.RELEARNING, result.card().state());
            assertEquals(0, result.card().step());
            assertEquals(4, result.card().repetitions());
            assertEquals(1, result.card().lapses());
            assertEquals(reviewTime.plus(Duration.ofMinutes(10)), result.card().due());
        }

        @Test
        @DisplayName("HARD in RELEARNING repeats the current step; GOOD advances through configured steps")
        void hardRepeatsAndGoodAdvancesRelearningSteps() {
            FsrsParameters twoStepRelearning = new FsrsParameters(FsrsParameters.defaultWeights(),
                    0.9, -0.5, 19.0 / 81.0, 36500,
                    FsrsParameters.DEFAULT_LEARNING_STEPS,
                    java.util.List.of(Duration.ofMinutes(10), Duration.ofHours(1)));
            FsrsEngine twoStepEngine = new FsrsEngine(twoStepRelearning);
            FsrsCard card = new FsrsCard(baseTime.plus(Duration.ofMinutes(10)), 2.0, 6.5,
                    3, 1, FsrsCardState.RELEARNING, baseTime, 0);
            Instant reviewTime = baseTime.plus(Duration.ofMinutes(10));

            FsrsSchedulingResult hard = twoStepEngine.schedule(card, FsrsRating.HARD, reviewTime);
            assertEquals(FsrsCardState.RELEARNING, hard.card().state());
            assertEquals(0, hard.card().step());
            assertEquals(reviewTime.plus(Duration.ofMinutes(35)), hard.card().due());

            FsrsSchedulingResult goodAtStepZero = twoStepEngine.schedule(card, FsrsRating.GOOD, reviewTime);
            assertEquals(FsrsCardState.RELEARNING, goodAtStepZero.card().state());
            assertEquals(1, goodAtStepZero.card().step());
            assertEquals(reviewTime.plus(Duration.ofHours(1)), goodAtStepZero.card().due());

            FsrsSchedulingResult goodAtLastStep = twoStepEngine.schedule(goodAtStepZero.card(), FsrsRating.GOOD,
                    reviewTime.plus(Duration.ofHours(1)));
            assertEquals(FsrsCardState.REVIEW, goodAtLastStep.card().state());
            assertEquals(0, goodAtLastStep.card().step());
        }
    }

    @Nested
    @DisplayName("5. Same-Day Reviews & Edge Cases")
    class SameDayAndEdgeCasesTest {

        @Test
        @DisplayName("Multiple reviews in same day (elapsed = 0) do not cause division by zero or NaN")
        void sameDayReviewStability() {
            FsrsCard card = new FsrsCard(
                    baseTime.plus(1, ChronoUnit.DAYS),
                    5.0,
                    5.0,
                    2,
                    0,
                    FsrsCardState.REVIEW,
                    baseTime,
                    0
            );

            // Reviewing within seconds of last review (elapsed days = 0.0)
            Instant sameMoment = baseTime.plusSeconds(30);
            FsrsSchedulingResult result = engine.schedule(card, FsrsRating.GOOD, sameMoment);

            assertFalse(Double.isNaN(result.card().stability()));
            assertFalse(Double.isInfinite(result.card().stability()));
            assertFalse(Double.isNaN(result.card().difficulty()));
            assertTrue(result.card().stability() >= 5.0);
        }

        @Test
        @DisplayName("Review timestamp before lastReviewed (negative elapsed) safely falls back to elapsed 0")
        void negativeElapsedDaysSafety() {
            FsrsCard card = new FsrsCard(
                    baseTime.plus(1, ChronoUnit.DAYS),
                    5.0,
                    5.0,
                    2,
                    0,
                    FsrsCardState.REVIEW,
                    baseTime,
                    0
            );

            Instant clockSkewTime = baseTime.minusSeconds(60);
            FsrsSchedulingResult result = engine.schedule(card, FsrsRating.GOOD, clockSkewTime);

            assertEquals(0.0, result.reviewLog().elapsedDays());
            assertFalse(Double.isNaN(result.card().stability()));
        }

        @Test
        @DisplayName("Clamping prevents Difficulty from exceeding [1.0, 10.0]")
        void difficultyClamping() {
            // Extreme ratings should never push D outside 1..10
            FsrsCard veryHardCard = new FsrsCard(baseTime, 1.0, 9.8, 1, 3, FsrsCardState.REVIEW, baseTime.minus(1, ChronoUnit.DAYS), 0);
            FsrsSchedulingResult hardRes = engine.schedule(veryHardCard, FsrsRating.AGAIN, baseTime);
            assertEquals(10.0, hardRes.card().difficulty(), EPSILON);

            FsrsCard veryEasyCard = new FsrsCard(baseTime, 10.0, 1.2, 5, 0, FsrsCardState.REVIEW, baseTime.minus(5, ChronoUnit.DAYS), 0);
            FsrsSchedulingResult easyRes = engine.schedule(veryEasyCard, FsrsRating.EASY, baseTime);
            assertEquals(1.0, easyRes.card().difficulty(), EPSILON);
        }

        @Test
        @DisplayName("Maximum interval cap is respected")
        void maximumIntervalCapped() {
            // Card at the maximum supported stability.
            FsrsCard godCard = new FsrsCard(baseTime, FsrsCard.MAX_STABILITY, 1.0, 20, 0, FsrsCardState.REVIEW, baseTime.minus(100, ChronoUnit.DAYS), 0);
            FsrsSchedulingResult res = engine.schedule(godCard, FsrsRating.EASY, baseTime);

            assertEquals(FsrsParameters.DEFAULT_MAXIMUM_INTERVAL, res.reviewLog().scheduledDays());
        }
    }

    @Nested
    @DisplayName("6. Preview & Determinism")
    class PreviewAndDeterminismTest {

        @Test
        @DisplayName("Preview returns results for all 4 ratings without side effects")
        void previewAllRatings() {
            FsrsCard card = FsrsCard.newCard(baseTime);
            Map<FsrsRating, FsrsSchedulingResult> preview = engine.preview(card, baseTime);

            assertEquals(4, preview.size());
            assertTrue(preview.containsKey(FsrsRating.AGAIN));
            assertTrue(preview.containsKey(FsrsRating.HARD));
            assertTrue(preview.containsKey(FsrsRating.GOOD));
            assertTrue(preview.containsKey(FsrsRating.EASY));
        }

        @Test
        @DisplayName("Deterministic execution: identical inputs produce identical bit-for-bit outputs")
        void deterministicExecution() {
            FsrsCard card = new FsrsCard(baseTime.plus(3, ChronoUnit.DAYS), 3.5, 5.2, 2, 0, FsrsCardState.REVIEW, baseTime, 0);
            Instant reviewTime = baseTime.plus(3, ChronoUnit.DAYS);

            FsrsSchedulingResult r1 = engine.schedule(card, FsrsRating.GOOD, reviewTime);
            FsrsSchedulingResult r2 = engine.schedule(card, FsrsRating.GOOD, reviewTime);

            assertEquals(r1.card().stability(), r2.card().stability());
            assertEquals(r1.card().difficulty(), r2.card().difficulty());
            assertEquals(r1.card().due(), r2.card().due());
            assertEquals(r1.reviewLog().scheduledDays(), r2.reviewLog().scheduledDays());
        }
    }

    @Nested
    @DisplayName("7. Input Validation & Error Handling")
    class InputValidationTest {

        @Test
        @DisplayName("Null card or rating throws NullPointerException")
        void nullInputsRejected() {
            assertThrows(NullPointerException.class, () -> engine.schedule(null, FsrsRating.GOOD, baseTime));
            assertThrows(NullPointerException.class, () -> engine.schedule(FsrsCard.newCard(baseTime), null, baseTime));
            assertThrows(NullPointerException.class, () -> engine.schedule(FsrsCard.newCard(baseTime), FsrsRating.GOOD, null));
        }

        @Test
        @DisplayName("Invalid weights count throws IllegalArgumentException")
        void invalidWeightsRejected() {
            double[] tooFew = new double[]{0.5, 1.0, 2.0};
            assertThrows(IllegalArgumentException.class, () ->
                    new FsrsParameters(tooFew, 0.9, -0.5, 19.0 / 81.0, 36500, null, null));
        }

        @Test
        @DisplayName("Invalid desired retention throws IllegalArgumentException")
        void invalidRetentionRejected() {
            assertThrows(IllegalArgumentException.class, () ->
                    new FsrsParameters(FsrsParameters.defaultWeights(), 1.5, -0.5, 19.0 / 81.0, 36500, null, null));
            assertThrows(IllegalArgumentException.class, () ->
                    new FsrsParameters(FsrsParameters.defaultWeights(), -0.1, -0.5, 19.0 / 81.0, 36500, null, null));
        }

        @Test
        @DisplayName("Weights are defensively copied and non-finite parameters are rejected")
        void parametersAreFiniteAndImmutable() {
            double[] weights = FsrsParameters.defaultWeights();
            weights[0] = Double.NaN;
            assertEquals(0.4872, FsrsParameters.defaultParameters().w(0), EPSILON);

            double[] supplied = FsrsParameters.defaultWeights();
            FsrsParameters parameters = new FsrsParameters(supplied, 0.9, -0.5, 19.0 / 81.0, 36500, null, null);
            supplied[0] = Double.POSITIVE_INFINITY;
            assertEquals(0.4872, parameters.w(0), EPSILON);
            double[] returned = parameters.weights();
            returned[0] = Double.NEGATIVE_INFINITY;
            assertEquals(0.4872, parameters.w(0), EPSILON);

            double[] invalid = FsrsParameters.defaultWeights();
            invalid[8] = Double.NaN;
            assertThrows(IllegalArgumentException.class, () ->
                    new FsrsParameters(invalid, 0.9, -0.5, 19.0 / 81.0, 36500, null, null));
            assertThrows(IllegalArgumentException.class, () ->
                    new FsrsParameters(FsrsParameters.defaultWeights(), 0.9, -0.5, Double.POSITIVE_INFINITY,
                            36500, null, null));
            assertThrows(IllegalArgumentException.class, () ->
                    new FsrsParameters(FsrsParameters.defaultWeights(), 0.9, Double.NaN, 19.0 / 81.0,
                            36500, null, null));
        }

        @Test
        @DisplayName("Cards reject invalid memory ranges and state-step combinations")
        void invalidCardMemoryStateRejected() {
            assertThrows(IllegalArgumentException.class, () -> new FsrsCard(baseTime, Double.NaN, 5.0,
                    0, 0, FsrsCardState.REVIEW, baseTime, 0));
            assertThrows(IllegalArgumentException.class, () -> new FsrsCard(baseTime, 1.0, Double.POSITIVE_INFINITY,
                    0, 0, FsrsCardState.LEARNING, baseTime, 0));
            assertThrows(IllegalArgumentException.class, () -> new FsrsCard(baseTime, 0.0, 5.0,
                    0, 0, FsrsCardState.REVIEW, baseTime, 0));
            assertThrows(IllegalArgumentException.class, () -> new FsrsCard(baseTime, 1.0, 11.0,
                    0, 0, FsrsCardState.RELEARNING, baseTime, 0));
            assertThrows(IllegalArgumentException.class, () -> new FsrsCard(baseTime, 0.0, 0.0,
                    0, 0, FsrsCardState.NEW, null, 1));
            assertThrows(IllegalArgumentException.class, () -> new FsrsCard(baseTime, 1.0, 5.0,
                    0, 0, FsrsCardState.REVIEW, baseTime, 1));
            assertThrows(IllegalArgumentException.class, () -> new FsrsReviewLog(FsrsRating.GOOD,
                    FsrsCardState.REVIEW, baseTime, Double.NaN, baseTime, baseTime.plusSeconds(1), 0));
        }

        @Test
        @DisplayName("Stability and intervals remain within configured bounds")
        void stabilityAndIntervalBounds() {
            assertEquals(FsrsCard.MIN_STABILITY,
                    engine.nextRecallStability(10.0, FsrsCard.MIN_STABILITY, 1.0, FsrsRating.HARD));
            assertEquals(FsrsCard.MAX_STABILITY,
                    engine.nextRecallStability(1.0, FsrsCard.MAX_STABILITY, 0.0, FsrsRating.EASY));
            assertEquals(FsrsParameters.DEFAULT_MAXIMUM_INTERVAL,
                    engine.nextInterval(Double.MAX_VALUE, 0.9));
            assertThrows(IllegalArgumentException.class, () -> engine.nextInterval(Double.NaN, 0.9));
            assertThrows(IllegalArgumentException.class, () -> engine.nextInterval(0.05, 0.9));
            assertThrows(IllegalArgumentException.class, () -> engine.retrievability(1.0, 0.05));
            assertThrows(IllegalArgumentException.class, () -> engine.retrievability(1.0, 36501.0));
        }
    }

    @Nested
    @DisplayName("8. Mathematical Reference Verification (FSRS-4.5 Specification)")
    class ReferenceFormulaTest {

        @Test
        @DisplayName("Verified recall stability formula matches reference calculation")
        void referenceRecallCalculation() {
            // Reference case:
            // S = 3.7145, D = 5.1618, t = 3 days, Rating = GOOD (G=3)
            // R = (1 + (19/81) * (3 / 3.7145))^(-0.5) = 0.916911
            // S' expected = 12.2624 (derived from FSRS-4.5 formula specification)
            double sInit = 3.7145;
            double dInit = 5.1618;
            double r = engine.retrievability(3.0, sInit);

            assertEquals(0.916911, r, 1e-4);

            double sNext = engine.nextRecallStability(dInit, sInit, r, FsrsRating.GOOD);
            assertEquals(12.2624, sNext, 1e-2);

            double dNext = engine.nextDifficulty(dInit, FsrsRating.GOOD);
            assertEquals(5.1618, dNext, 1e-4); // On Good rating, Difficulty stays at mean
        }

        @Test
        @DisplayName("Verified forget stability formula matches reference calculation")
        void referenceForgetCalculation() {
            // Reference case:
            // S = 3.7145, D = 5.1618, t = 3 days, Rating = AGAIN (G=1)
            // S'_f expected = 1.3810 (derived from FSRS-4.5 formula specification)
            double sInit = 3.7145;
            double dInit = 5.1618;
            double r = engine.retrievability(3.0, sInit);

            double sForget = engine.nextForgetStability(dInit, sInit, r);
            assertEquals(1.3810, sForget, 1e-2);

            double dNextAgain = engine.nextDifficulty(dInit, FsrsRating.AGAIN);
            assertEquals(6.9012, dNextAgain, 1e-2);
        }
    }

    @Test
    @DisplayName("Every rating is covered for every FSRS state")
    void everyRatingHasExpectedStateTransition() {
        Map<FsrsCardState, FsrsCard> cards = Map.of(
                FsrsCardState.NEW, FsrsCard.newCard(baseTime),
                FsrsCardState.LEARNING, new FsrsCard(baseTime, 1.4, 6.4, 2, 0,
                        FsrsCardState.LEARNING, baseTime.minus(Duration.ofMinutes(1)), 0),
                FsrsCardState.REVIEW, new FsrsCard(baseTime, 4.0, 5.0, 3, 2,
                        FsrsCardState.REVIEW, baseTime.minus(4, ChronoUnit.DAYS), 0),
                FsrsCardState.RELEARNING, new FsrsCard(baseTime, 1.2, 7.0, 4, 2,
                        FsrsCardState.RELEARNING, baseTime.minus(Duration.ofMinutes(10)), 0)
        );
        Map<FsrsCardState, Map<FsrsRating, FsrsCardState>> expected = Map.of(
                FsrsCardState.NEW, Map.of(FsrsRating.AGAIN, FsrsCardState.LEARNING,
                        FsrsRating.HARD, FsrsCardState.LEARNING, FsrsRating.GOOD, FsrsCardState.LEARNING,
                        FsrsRating.EASY, FsrsCardState.REVIEW),
                FsrsCardState.LEARNING, Map.of(FsrsRating.AGAIN, FsrsCardState.LEARNING,
                        FsrsRating.HARD, FsrsCardState.LEARNING, FsrsRating.GOOD, FsrsCardState.LEARNING,
                        FsrsRating.EASY, FsrsCardState.REVIEW),
                FsrsCardState.REVIEW, Map.of(FsrsRating.AGAIN, FsrsCardState.RELEARNING,
                        FsrsRating.HARD, FsrsCardState.REVIEW, FsrsRating.GOOD, FsrsCardState.REVIEW,
                        FsrsRating.EASY, FsrsCardState.REVIEW),
                FsrsCardState.RELEARNING, Map.of(FsrsRating.AGAIN, FsrsCardState.RELEARNING,
                        FsrsRating.HARD, FsrsCardState.RELEARNING, FsrsRating.GOOD, FsrsCardState.REVIEW,
                        FsrsRating.EASY, FsrsCardState.REVIEW)
        );

        for (FsrsCardState state : FsrsCardState.values()) {
            FsrsCard card = cards.get(state);
            for (FsrsRating rating : FsrsRating.values()) {
                FsrsSchedulingResult result = engine.schedule(card, rating, baseTime);
                assertEquals(expected.get(state).get(rating), result.card().state(), state + " + " + rating);
                assertEquals(card.repetitions() + 1, result.card().repetitions(), state + " + " + rating);
                int expectedLapses = card.lapses() + (state == FsrsCardState.REVIEW && rating == FsrsRating.AGAIN ? 1 : 0);
                assertEquals(expectedLapses, result.card().lapses(), state + " + " + rating);
                assertTrue(result.card().due() != null, state + " + " + rating + " due");
            }
        }
    }
}
