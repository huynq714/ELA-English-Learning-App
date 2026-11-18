package com.englishlearning.common.exception;

import com.englishlearning.auth.AuthException;
import com.englishlearning.quiz.QuizException;
import com.englishlearning.vocabulary.service.DeckNotFoundException;
import com.englishlearning.vocabulary.service.ProfileLevelRequiredException;
import com.englishlearning.profile.service.ProfileNotFoundException;
import com.englishlearning.profile.service.UserNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<ApiError> handleAuth(AuthException exception) {
        return ResponseEntity.status(exception.status()).body(new ApiError(exception.code(), exception.getMessage()));
    }

    @ExceptionHandler(QuizException.class)
    public ResponseEntity<ApiError> handleQuiz(QuizException exception) {
        return ResponseEntity.status(exception.status()).body(new ApiError(exception.code(), exception.getMessage()));
    }

    @ExceptionHandler(DeckNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(DeckNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("NOT_FOUND", "Deck not found"));
    }

    @ExceptionHandler(ProfileLevelRequiredException.class)
    public ResponseEntity<ApiError> handleProfileLevelRequired(ProfileLevelRequiredException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("PROFILE_LEVEL_REQUIRED", exception.getMessage()));
    }

    @ExceptionHandler({UserNotFoundException.class, ProfileNotFoundException.class})
    public ResponseEntity<ApiError> handleProfileNotFound(RuntimeException exception) {
        String message = exception instanceof UserNotFoundException ? "User not found" : "Profile not found";
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("NOT_FOUND", message));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, IllegalArgumentException.class,
            HttpMessageNotReadableException.class})
    public ResponseEntity<ApiError> handleBadRequest(Exception exception) {
        String message = "Request is invalid";
        if (exception instanceof MethodArgumentNotValidException validationException) {
            message = validationException.getBindingResult().getFieldErrors().stream()
                    .findFirst().map(error -> error.getDefaultMessage()).orElse(message);
        } else if (exception instanceof IllegalArgumentException && exception.getMessage() != null) {
            message = exception.getMessage();
        }
        return ResponseEntity.badRequest().body(new ApiError("BAD_REQUEST", message));
    }
}
