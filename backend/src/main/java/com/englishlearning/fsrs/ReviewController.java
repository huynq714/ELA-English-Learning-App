package com.englishlearning.fsrs;

import com.englishlearning.auth.AuthService;
import com.englishlearning.vocabulary.dto.DeckWordResponse;
import com.englishlearning.vocabulary.repository.WordRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/review")
public class ReviewController {
    private final AuthService auth;
    private final FsrsService service;
    private final WordRepository words;

    public ReviewController(AuthService auth, FsrsService service, WordRepository words) {
        this.auth = auth;
        this.service = service;
        this.words = words;
    }

    @GetMapping("/summary")
    public FsrsService.ReviewSummary summary(@AuthenticationPrincipal Jwt jwt) {
        return service.summary(auth.requireActiveUser(jwt).id());
    }

    @PostMapping("/session/start")
    public ReviewPayloads.Session start(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ReviewPayloads.Start body) {
        return withWords(service.startOrResume(auth.requireActiveUser(jwt).id(), FsrsRepository.SessionType.valueOf(body.type())));
    }

    @GetMapping("/session/{id}")
    public ReviewPayloads.Session session(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return withWords(service.getSession(auth.requireActiveUser(jwt).id(), sessionId(id)));
    }

    @PostMapping("/session/{id}/rate")
    public FsrsService.RatingResult rate(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                                        @Valid @RequestBody ReviewPayloads.Rate body) {
        return service.rate(auth.requireActiveUser(jwt).id(), sessionId(id), UUID.fromString(body.wordId()),
                UUID.fromString(body.clientRequestToken()), FsrsRating.valueOf(body.rating()));
    }

    private ReviewPayloads.Session withWords(FsrsService.SessionView view) {
        var wordIds = view.items().stream().map(FsrsService.SessionItemView::wordId).toList();
        return new ReviewPayloads.Session(view, words.findAllById(wordIds).stream().map(DeckWordResponse::from).toList());
    }

    @ExceptionHandler(FsrsServiceException.class)
    ResponseEntity<ReviewPayloads.Error> serviceError(FsrsServiceException error) {
        HttpStatus status = switch (error.code()) {
            case USER_NOT_FOUND, SESSION_NOT_FOUND, ITEM_NOT_IN_SESSION -> HttpStatus.NOT_FOUND;
            default -> HttpStatus.CONFLICT;
        };
        return ResponseEntity.status(status)
                .body(new ReviewPayloads.Error(error.code().name(), error.getMessage(), error.nextDueAt()));
    }

    private static UUID sessionId(String id) {
        if (!id.matches(ReviewPayloads.UUID_PATTERN)) throw new IllegalArgumentException("Invalid session ID");
        return UUID.fromString(id);
    }
}
