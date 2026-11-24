package com.englishlearning.fsrs;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/**
 * Configuration parameters for the FSRS-4.5 algorithm.
 * Uses exact 17 weights according to Open Spaced Repetition official specification:
 * https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */
public record FsrsParameters(
        double[] weights,
        double desiredRetention,
        double decay,
        double factor,
        int maximumInterval,
        List<Duration> learningSteps,
        List<Duration> relearningSteps
) {
    public static final int EXPECTED_WEIGHTS_COUNT = 17;

    /**
     * Exact 17 default weights for FSRS-4.5.
     */
    private static final double[] FSRS_45_DEFAULT_WEIGHTS = {
            0.4872, 1.4003, 3.7145, 13.8206,
            5.1618, 1.2298, 0.8975, 0.031,
            1.6474, 0.1367, 1.0461, 2.1072,
            0.0793, 0.3246, 1.587, 0.2272,
            2.8755
    };
    public static final double DEFAULT_DESIRED_RETENTION = 0.9;
    public static final double DEFAULT_DECAY = -0.5;
    public static final double DEFAULT_FACTOR = 19.0 / 81.0;
    public static final int DEFAULT_MAXIMUM_INTERVAL = 36500;

    public static final List<Duration> DEFAULT_LEARNING_STEPS = List.of(
            Duration.ofMinutes(1),
            Duration.ofMinutes(10)
    );

    public static final List<Duration> DEFAULT_RELEARNING_STEPS = List.of(
            Duration.ofMinutes(10)
    );

    public FsrsParameters {
        Objects.requireNonNull(weights, "Weights cannot be null");
        if (weights.length != EXPECTED_WEIGHTS_COUNT) {
            throw new IllegalArgumentException(
                    "FSRS-4.5 requires exactly 17 weights, provided: " + weights.length);
        }
        if (Arrays.stream(weights).anyMatch(value -> !Double.isFinite(value))) {
            throw new IllegalArgumentException("FSRS weights must be finite");
        }
        if (!Double.isFinite(desiredRetention) || desiredRetention <= 0.0 || desiredRetention >= 1.0) {
            throw new IllegalArgumentException(
                    "Desired retention must be strictly between 0.0 and 1.0, provided: " + desiredRetention);
        }
        if (!Double.isFinite(decay) || decay >= 0.0) {
            throw new IllegalArgumentException("Decay must be a finite negative number");
        }
        if (!Double.isFinite(factor) || factor <= 0.0) {
            throw new IllegalArgumentException("Factor must be finite and positive");
        }
        if (maximumInterval < 1) {
            throw new IllegalArgumentException("Maximum interval must be at least 1 day");
        }
        weights = Arrays.copyOf(weights, weights.length);
        learningSteps = learningSteps == null ? List.of() : List.copyOf(learningSteps);
        relearningSteps = relearningSteps == null ? List.of() : List.copyOf(relearningSteps);
        if (learningSteps.stream().anyMatch(step -> step.isZero() || step.isNegative())
                || relearningSteps.stream().anyMatch(step -> step.isZero() || step.isNegative())) {
            throw new IllegalArgumentException("Learning steps must be positive durations");
        }
    }

    public static FsrsParameters defaultParameters() {
        return new FsrsParameters(
                FSRS_45_DEFAULT_WEIGHTS,
                DEFAULT_DESIRED_RETENTION,
                DEFAULT_DECAY,
                DEFAULT_FACTOR,
                DEFAULT_MAXIMUM_INTERVAL,
                DEFAULT_LEARNING_STEPS,
                DEFAULT_RELEARNING_STEPS
        );
    }

    /** Returns a defensive copy of the canonical FSRS-4.5 weights. */
    public static double[] defaultWeights() {
        return FSRS_45_DEFAULT_WEIGHTS.clone();
    }

    public double w(int index) {
        if (index < 0 || index >= EXPECTED_WEIGHTS_COUNT) {
            throw new IndexOutOfBoundsException("Weight index must be between 0 and 16, requested: " + index);
        }
        return weights[index];
    }

    @Override
    public double[] weights() {
        return weights.clone();
    }
}
