package com.englishlearning.quiz;

import org.springframework.http.HttpStatus;

public class QuizException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    QuizException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
}
