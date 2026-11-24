package com.englishlearning.fsrs;

/**
 * Standard ratings for the FSRS algorithm.
 * Rating grade values map directly to:
 * 1 = AGAIN (complete blackout / forgotten)
 * 2 = HARD (recalled with significant difficulty)
 * 3 = GOOD (recalled after hesitation / expected recall)
 * 4 = EASY (recalled easily without hesitation)
 */
public enum FsrsRating {
    AGAIN(1),
    HARD(2),
    GOOD(3),
    EASY(4);

    private final int grade;

    FsrsRating(int grade) {
        this.grade = grade;
    }

    public int grade() {
        return grade;
    }

    public static FsrsRating fromGrade(int grade) {
        return switch (grade) {
            case 1 -> AGAIN;
            case 2 -> HARD;
            case 3 -> GOOD;
            case 4 -> EASY;
            default -> throw new IllegalArgumentException("Invalid FSRS grade: " + grade + ". Must be 1, 2, 3, or 4.");
        };
    }

    public static FsrsRating fromName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Rating name cannot be null or blank");
        }
        return valueOf(name.trim().toUpperCase());
    }
}
