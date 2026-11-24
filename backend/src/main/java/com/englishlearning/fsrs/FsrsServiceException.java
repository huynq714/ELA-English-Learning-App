package com.englishlearning.fsrs;

import java.time.Instant;

/** Domain error for the FSRS service layer; a future controller can map code/status without exposing internals. */
public final class FsrsServiceException extends RuntimeException {
    public enum Code { USER_NOT_FOUND, SESSION_NOT_FOUND, SESSION_CLOSED, ITEM_NOT_IN_SESSION, ITEM_NOT_CURRENT,
        ITEM_ALREADY_COMPLETED, CARD_NOT_DUE, IDEMPOTENCY_CONFLICT, REQUEST_IN_PROGRESS }

    private final Code code;
    private final Instant nextDueAt;

    public FsrsServiceException(Code code, String message) {
        this(code, message, null);
    }

    public FsrsServiceException(Code code, String message, Instant nextDueAt) {
        super(message);
        this.code = code;
        this.nextDueAt = nextDueAt;
    }

    public Code code() { return code; }
    public Instant nextDueAt() { return nextDueAt; }
}
