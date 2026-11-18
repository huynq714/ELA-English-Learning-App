package com.englishlearning.quiz;

import com.englishlearning.vocabulary.dto.DeckWordResponse;
import org.springframework.http.HttpStatus;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static com.englishlearning.quiz.QuizPayloads.*;

final class QuizQuestionGenerator {
    private QuizQuestionGenerator() {}

    static Snapshot generate(List<DeckWordResponse> words, Direction direction, Snapshot previous) {
        var verified = words.stream().filter(QuizQuestionGenerator::verified).toList();
        var candidates = new ArrayList<>(verified);
        Collections.shuffle(candidates);
        var questions = new ArrayList<StoredQuestion>();
        var usedHeadwords = new HashSet<String>();
        var usedMeanings = new HashSet<String>();
        for (var word : candidates) {
            if (usedHeadwords.contains(normalize(word.headword())) || usedMeanings.contains(normalize(word.meaningVi()))) {
                continue;
            }
            var previousQuestion = previous == null ? null : previous.questions().stream()
                    .filter(item -> item.wordId().equals(word.id())).findFirst().orElse(null);
            var choices = choices(word, verified, direction, previousQuestion);
            if (choices.size() != OPTION_COUNT) continue;
            var correct = direction == Direction.EN_TO_VI ? word.meaningVi() : word.headword();
            var prompt = direction == Direction.EN_TO_VI ? word.headword() : word.meaningVi();
            questions.add(new StoredQuestion(word.id(), prompt, choices, choices.indexOf(correct)));
            usedHeadwords.add(normalize(word.headword()));
            usedMeanings.add(normalize(word.meaningVi()));
            if (questions.size() == QUESTION_COUNT) {
                if (previous != null && questions.stream().map(StoredQuestion::wordId).toList()
                        .equals(previous.questions().stream().map(StoredQuestion::wordId).toList())) {
                    Collections.rotate(questions, 1);
                }
                return new Snapshot(direction, questions);
            }
        }
        throw new QuizException(HttpStatus.UNPROCESSABLE_ENTITY, "QUIZ_UNAVAILABLE",
                "Deck requires five verified words with four distinct options each");
    }

    private static List<String> choices(DeckWordResponse word, List<DeckWordResponse> verified,
                                       Direction direction, StoredQuestion previous) {
        var alternatives = new ArrayList<>(verified);
        Collections.shuffle(alternatives);
        var chosen = new ArrayList<DeckWordResponse>();
        chosen.add(word);
        for (var other : alternatives) {
            if (chosen.stream().anyMatch(selected -> overlaps(selected, other))) continue;
            chosen.add(other);
            if (chosen.size() == OPTION_COUNT) break;
        }
        var options = new ArrayList<>(chosen.stream()
                .map(item -> direction == Direction.EN_TO_VI ? item.meaningVi() : item.headword()).toList());
        Collections.shuffle(options);
        if (previous != null && options.indexOf(direction == Direction.EN_TO_VI ? word.meaningVi() : word.headword())
                == previous.correctOption()) {
            Collections.rotate(options, 1);
        }
        return options;
    }

    private static boolean overlaps(DeckWordResponse left, DeckWordResponse right) {
        if (normalize(left.headword()).equals(normalize(right.headword()))) return true;
        var leftSenses = senses(left.meaningVi());
        return senses(right.meaningVi()).stream().anyMatch(leftSenses::contains);
    }

    private static Set<String> senses(String meaning) {
        var keys = new HashSet<String>();
        for (var part : meaning.split("[,;/|]")) {
            var key = normalize(part);
            if (!key.isEmpty()) keys.add(key);
        }
        return keys;
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFKC).strip()
                .toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static boolean verified(DeckWordResponse word) {
        return word.meaningVi() != null && !word.meaningVi().isBlank() && !word.headword().isBlank()
                && word.sourceMetadata() != null && word.sourceMetadata().get("vietnamese") instanceof Map<?, ?> source
                && "VERIFIED".equals(source.get("reviewStatus"));
    }
}
