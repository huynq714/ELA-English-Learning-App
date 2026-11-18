package com.englishlearning.quiz;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public final class QuizPayloads {
    public static final int QUESTION_COUNT = 5;
    public static final int OPTION_COUNT = 4;
    public static final int PASS_SCORE = 3;

    private QuizPayloads() {}

    public enum Direction {
        EN_TO_VI, VI_TO_EN;

        Direction opposite() { return this == EN_TO_VI ? VI_TO_EN : EN_TO_VI; }
    }

    public record Start(@NotNull UUID deckId) {}
    public record Study(@NotNull UUID wordId) {}
    public record Selection(
            @Min(1) @Max(QUESTION_COUNT) int questionNo,
            @NotNull @Min(0) @Max(OPTION_COUNT - 1) Integer optionIndex) {}
    public record Submit(
            @NotNull @Size(min = QUESTION_COUNT, max = QUESTION_COUNT) List<@NotNull @Valid Selection> answers) {}
    public record Question(int questionNo, String prompt, List<String> options) {}
    public record AnswerFeedback(int questionNo, int selectedOption, int correctOption, boolean correct) {}
    public record Quiz(UUID attemptId, Direction direction, List<Question> questions, List<AnswerFeedback> answered) {}
    public record Result(UUID attemptId, UUID deckId, int correctCount, int totalQuestions, int percentage, boolean passed) {}
    public record StudyProgress(UUID lastStudiedWordId, List<UUID> unstudiedWordIds, List<UUID> remainingReviewWordIds) {}

    record StoredQuestion(UUID wordId, String prompt, List<String> options, int correctOption) {}
    record Snapshot(Direction direction, List<StoredQuestion> questions) {}
}
