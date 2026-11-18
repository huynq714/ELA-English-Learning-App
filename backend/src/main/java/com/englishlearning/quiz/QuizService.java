package com.englishlearning.quiz;

import com.englishlearning.vocabulary.repository.DeckRepository;
import com.englishlearning.vocabulary.service.DeckNotFoundException;
import com.englishlearning.vocabulary.service.DeckWordsService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

import static com.englishlearning.quiz.QuizPayloads.*;

@Service
public class QuizService {
    private final QuizRepository repository;
    private final DeckRepository decks;
    private final DeckWordsService words;
    private final ObjectMapper json;

    public QuizService(QuizRepository repository, DeckRepository decks, DeckWordsService words, ObjectMapper json) {
        this.repository = repository;
        this.decks = decks;
        this.words = words;
        this.json = json;
    }

    @Transactional
    public Quiz start(UUID userId, UUID deckId) {
        repository.lockUser(userId);
        requirePublishedDeck(deckId);
        var latest = repository.latest(userId, deckId).orElse(null);
        if (latest != null && !latest.completed()) {
            requireStudiedDeck(userId, deckId);
            var snapshot = snapshot(latest);
            var answered = repository.answers(latest.id()).stream()
                    .map(saved -> feedback(snapshot.questions().get(saved.questionNo() - 1), saved.questionNo(), saved.selectedAnswer()))
                    .toList();
            return publicQuiz(latest.id(), snapshot, answered);
        }
        if (!remaining(userId, deckId, latest).isEmpty()) {
            throw new QuizException(HttpStatus.CONFLICT, "REVIEW_REQUIRED", "Review the five quiz words before retrying");
        }
        var previous = latest == null ? null : snapshot(latest);
        var direction = previous == null ? Direction.EN_TO_VI : previous.direction().opposite();
        var next = QuizQuestionGenerator.generate(words.listPublishedDeckWords(deckId), direction, previous);
        requireStudiedDeck(userId, deckId);
        var attemptId = repository.insertAttempt(userId, deckId, json.writeValueAsString(next));
        return publicQuiz(attemptId, next, List.of());
    }

    @Transactional
    public AnswerFeedback answer(UUID userId, UUID attemptId, Selection selection) {
        repository.lockUser(userId);
        var attempt = owned(userId, attemptId);
        if (!attempt.completed()) requireStudiedDeck(userId, attempt.deckId());
        var question = snapshot(attempt).questions().get(selection.questionNo() - 1);
        for (var saved : repository.answers(attemptId)) {
            if (saved.questionNo() == selection.questionNo()) {
                return feedback(question, saved.questionNo(), saved.selectedAnswer());
            }
        }
        if (attempt.completed()) {
            throw new QuizException(HttpStatus.CONFLICT, "QUIZ_COMPLETED", "Quiz has already been submitted");
        }

        // Save the choice before returning the correct option.
        var selected = question.options().get(selection.optionIndex());
        var graded = feedback(question, selection.questionNo(), selected);
        repository.insertAnswer(attemptId, question.wordId(), selection.questionNo(), selected, graded.correct());
        return graded;
    }

    @Transactional
    public Result submit(UUID userId, UUID attemptId, Submit request) {
        repository.lockUser(userId);
        var attempt = owned(userId, attemptId);
        if (attempt.completed()) return scored(attempt, attempt.correctCount());
        requireStudiedDeck(userId, attempt.deckId());
        var questions = snapshot(attempt).questions();
        var selections = new HashMap<Integer, Integer>();
        for (var answer : request.answers()) {
            if (selections.put(answer.questionNo(), answer.optionIndex()) != null) {
                throw new IllegalArgumentException("Provide one valid option for each of the five questions");
            }
        }
        var savedAnswers = new HashMap<Integer, String>();
        repository.answers(attemptId).forEach(answer -> savedAnswers.put(answer.questionNo(), answer.selectedAnswer()));
        int score = 0;
        for (int number = 1; number <= questions.size(); number++) {
            var question = questions.get(number - 1);
            int option = selections.get(number);
            boolean correct = option == question.correctOption();
            var selected = question.options().get(option);
            var saved = savedAnswers.get(number);
            if (saved == null) {
                repository.insertAnswer(attemptId, question.wordId(), number, selected, correct);
            } else if (!saved.equals(selected)) {
                throw new QuizException(HttpStatus.CONFLICT, "ANSWER_LOCKED", "A graded answer cannot be changed");
            }
            if (correct) score++;
        }
        // The immediate trigger allows answers only while the attempt is open.
        // Completion triggers count all five answers at commit.
        repository.complete(attemptId, score);
        return scored(attempt, score);
    }

    @Transactional(readOnly = true)
    public Result result(UUID userId, UUID attemptId) {
        var attempt = owned(userId, attemptId);
        if (!attempt.completed()) {
            throw new QuizException(HttpStatus.CONFLICT, "QUIZ_IN_PROGRESS", "Quiz has not been submitted");
        }
        return scored(attempt, attempt.correctCount());
    }

    @Transactional(readOnly = true)
    public StudyProgress progress(UUID userId, UUID deckId) {
        requirePublishedDeck(deckId);
        return studyProgress(userId, deckId);
    }

    @Transactional
    public StudyProgress study(UUID userId, UUID deckId, UUID wordId) {
        if (!repository.study(userId, deckId, wordId)) {
            throw new QuizException(HttpStatus.NOT_FOUND, "WORD_NOT_FOUND", "Word not found in the published deck");
        }
        return studyProgress(userId, deckId);
    }

    private StudyProgress studyProgress(UUID userId, UUID deckId) {
        var latest = repository.latest(userId, deckId).orElse(null);
        return new StudyProgress(repository.lastStudiedWord(userId, deckId),
                repository.unstudiedWords(userId, deckId), remaining(userId, deckId, latest));
    }

    private List<UUID> remaining(UUID userId, UUID deckId, QuizRepository.Attempt latest) {
        if (latest == null || !latest.completed() || latest.correctCount() >= PASS_SCORE) return List.of();
        var wordIds = snapshot(latest).questions().stream().map(StoredQuestion::wordId).toList();
        return repository.wordsNotReviewedSince(userId, deckId, wordIds, latest.completedAt());
    }

    private void requirePublishedDeck(UUID deckId) {
        if (decks.findByIdAndPublishedTrue(deckId).isEmpty()) throw new DeckNotFoundException(deckId);
    }

    private void requireStudiedDeck(UUID userId, UUID deckId) {
        if (!repository.unstudiedWords(userId, deckId).isEmpty()) {
            throw new QuizException(HttpStatus.CONFLICT, "STUDY_REQUIRED", "Study all flashcards in the deck before taking the quiz");
        }
    }

    private QuizRepository.Attempt owned(UUID userId, UUID attemptId) {
        return repository.owned(userId, attemptId).orElseThrow(() ->
                new QuizException(HttpStatus.NOT_FOUND, "QUIZ_NOT_FOUND", "Quiz attempt not found"));
    }

    private Snapshot snapshot(QuizRepository.Attempt attempt) {
        if (attempt.snapshot() == null) {
            throw new QuizException(HttpStatus.CONFLICT, "QUIZ_UNAVAILABLE", "Quiz questions are unavailable");
        }
        return json.readValue(attempt.snapshot(), Snapshot.class);
    }

    private static AnswerFeedback feedback(StoredQuestion question, int questionNo, String selected) {
        int option = question.options().indexOf(selected);
        if (option < 0) throw new IllegalStateException("Saved answer is missing from the quiz options");
        return new AnswerFeedback(questionNo, option, question.correctOption(), option == question.correctOption());
    }

    private static Quiz publicQuiz(UUID id, Snapshot snapshot, List<AnswerFeedback> answered) {
        var questions = new ArrayList<Question>();
        for (var question : snapshot.questions()) {
            questions.add(new Question(questions.size() + 1, question.prompt(), question.options()));
        }
        return new Quiz(id, snapshot.direction(), questions, answered);
    }

    private static Result scored(QuizRepository.Attempt attempt, int score) {
        return new Result(attempt.id(), attempt.deckId(), score, QUESTION_COUNT,
                score * 100 / QUESTION_COUNT, score >= PASS_SCORE);
    }
}
