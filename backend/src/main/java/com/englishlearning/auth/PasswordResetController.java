package com.englishlearning.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class PasswordResetController {
    private final PasswordResetService reset;

    PasswordResetController(PasswordResetService reset) { this.reset = reset; }

    @PostMapping("/forgot-password")
    public ResponseEntity<ForgotResponse> forgot(@Valid @RequestBody ForgotRequest body, HttpServletRequest request) {
        reset.requestCode(body.email(), request.getRemoteAddr());
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore())
                .body(new ForgotResponse("If the address is registered, a code will be sent"));
    }

    @PostMapping("/verify-reset-otp")
    public ResponseEntity<VerifiedReset> verify(@Valid @RequestBody VerifyRequest body, HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new VerifiedReset(reset.verify(body.email(), body.otp(), request.getRemoteAddr())));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> complete(@Valid @RequestBody ResetRequest body, HttpServletRequest request) {
        reset.finish(body.email(), body.resetToken(), body.newPassword(), body.confirmPassword(), request.getRemoteAddr());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    public record ForgotRequest(@NotBlank @Email @Size(max = 255) String email) {}
    public record ForgotResponse(String message) {}

    public record VerifyRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Pattern(regexp = "[0-9]{6}", message = "OTP must have six digits") String otp
    ) {
        @Override public String toString() { return "VerifyRequest[redacted]"; }
    }

    public record ResetRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}", message = "Reset token is invalid") String resetToken,
            @NotBlank @Size(min = 8, max = 72) String newPassword,
            @NotBlank @Size(max = 72) String confirmPassword
    ) {
        @Override public String toString() { return "ResetRequest[redacted]"; }
    }

    public record VerifiedReset(String resetToken) {
        @Override public String toString() { return "VerifiedReset[redacted]"; }
    }
}
