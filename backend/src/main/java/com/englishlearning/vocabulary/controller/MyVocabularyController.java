package com.englishlearning.vocabulary.controller;

import com.englishlearning.auth.AuthService;
import com.englishlearning.vocabulary.service.MyVocabularyService;
import com.englishlearning.vocabulary.repository.SavedWordRepository.SavedGroup;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/my-vocabulary")
public class MyVocabularyController {
    private final AuthService auth;
    private final MyVocabularyService vocabulary;

    public MyVocabularyController(AuthService auth, MyVocabularyService vocabulary) {
        this.auth = auth;
        this.vocabulary = vocabulary;
    }

    @GetMapping
    public MyVocabularyService.SavedPage list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "") String query, @RequestParam(defaultValue = "") String level,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID groupId) {
        return vocabulary.list(auth.requireActiveUser(jwt).id(), query, level, page, size, groupId);
    }

    @GetMapping("/groups")
    public java.util.List<SavedGroup> groups(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "") String query) {
        return vocabulary.groups(auth.requireActiveUser(jwt).id(), query);
    }

    @GetMapping("/groups/{groupId}")
    public SavedGroup group(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID groupId) {
        return vocabulary.group(auth.requireActiveUser(jwt).id(), groupId);
    }

    @GetMapping("/count")
    public SavedCount count(@AuthenticationPrincipal Jwt jwt) {
        return new SavedCount(vocabulary.totalSaved(auth.requireActiveUser(jwt).id()));
    }

    @GetMapping("/{wordId}")
    public BookmarkStatus status(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wordId) {
        return new BookmarkStatus(vocabulary.isSaved(auth.requireActiveUser(jwt).id(), wordId));
    }

    @PostMapping("/{wordId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wordId) {
        vocabulary.save(auth.requireActiveUser(jwt).id(), wordId);
    }

    @DeleteMapping("/{wordId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wordId) {
        vocabulary.remove(auth.requireActiveUser(jwt).id(), wordId);
    }

    public record BookmarkStatus(boolean saved) {}
    public record SavedCount(long total) {}
}
