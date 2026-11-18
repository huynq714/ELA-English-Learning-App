package com.englishlearning.quiz;

import com.englishlearning.auth.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

import static com.englishlearning.quiz.QuizPayloads.*;

@RestController
@RequestMapping("/api/v1")
public class QuizController {
    private final AuthService auth;
    private final QuizService quiz;

    public QuizController(AuthService auth, QuizService quiz) {
        this.auth = auth;
        this.quiz = quiz;
    }

    @PostMapping("/quiz/attempts")
    public Quiz start(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Start body) {
        return quiz.start(auth.requireActiveUser(jwt).id(), body.deckId());
    }

    @PostMapping("/quiz/attempts/{id}/answers")
    public AnswerFeedback answer(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody Selection body) {
        return quiz.answer(auth.requireActiveUser(jwt).id(), id, body);
    }

    @PostMapping("/quiz/attempts/{id}/submit")
    public Result submit(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody Submit body) {
        return quiz.submit(auth.requireActiveUser(jwt).id(), id, body);
    }

    @GetMapping("/quiz/attempts/{id}/result")
    public Result result(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return quiz.result(auth.requireActiveUser(jwt).id(), id);
    }

    @GetMapping("/decks/{id}/study-progress")
    public StudyProgress progress(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return quiz.progress(auth.requireActiveUser(jwt).id(), id);
    }

    @PostMapping("/decks/{id}/study-progress")
    public StudyProgress study(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody Study body) {
        return quiz.study(auth.requireActiveUser(jwt).id(), id, body.wordId());
    }
}
