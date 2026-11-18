package com.englishlearning.auth;

import com.englishlearning.profile.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

import static com.englishlearning.profile.entity.UserProfile.ENGLISH_LEVEL_PATTERN;

public final class AuthPayloads {
    private AuthPayloads() {}

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 100) String displayName,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 72) String confirmPassword,
            @NotBlank(message = "englishLevel is required")
            @Pattern(regexp = ENGLISH_LEVEL_PATTERN, message = "englishLevel must be A1, A2, B1, B2, C1, or C2")
            String englishLevel
    ) {}

    public record LoginRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 72) String password
    ) {}

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 72) String currentPassword,
            @NotBlank @Size(min = 8, max = 72) String newPassword,
            @NotBlank @Size(max = 72) String confirmPassword
    ) {}

    public record CurrentUser(UUID id, String email, String displayName) {
        public static CurrentUser from(User user) {
            return new CurrentUser(user.getId(), user.getEmail(), user.getDisplayName());
        }
    }

    public record LoginResponse(String accessToken, String tokenType, Instant expiresAt, CurrentUser user) {}
}
