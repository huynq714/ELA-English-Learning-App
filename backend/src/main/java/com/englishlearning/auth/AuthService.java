package com.englishlearning.auth;

import com.englishlearning.profile.entity.User;
import com.englishlearning.profile.entity.UserProfile;
import com.englishlearning.profile.repository.UserProfileRepository;
import com.englishlearning.profile.repository.UserRepository;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final PasswordEncoder passwords;
    private final JwtService tokens;
    private final String absentUserHash;

    public AuthService(UserRepository users, UserProfileRepository profiles, PasswordEncoder passwords, JwtService tokens) {
        this.users = users;
        this.profiles = profiles;
        this.passwords = passwords;
        this.tokens = tokens;
        this.absentUserHash = passwords.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AuthPayloads.LoginResponse register(AuthPayloads.RegisterRequest request) {
        var email = normalizeEmail(request.email());
        var password = request.password();
        validateNewPassword(password, request.confirmPassword());
        if (users.findByNormalizedEmail(email).isPresent()) {
            throw duplicateEmail();
        }
        User user;
        try {
            user = users.saveAndFlush(User.register(email, passwords.encode(password), request.displayName().strip()));
        } catch (DataIntegrityViolationException error) {
            // The index also protects against a concurrent registration of the same email.
            if (error.getCause() instanceof ConstraintViolationException violation
                    && "uq_users_email_lower".equals(violation.getConstraintName())) {
                throw duplicateEmail();
            }
            throw error;
        }
        profiles.save(UserProfile.createWithDefaults(user, request.englishLevel()));
        return tokens.issue(user);
    }

    @Transactional(readOnly = true)
    public AuthPayloads.LoginResponse login(AuthPayloads.LoginRequest request) {
        if (utf8Length(request.password()) > 72) {
            throw invalidLogin();
        }
        var user = users.findByNormalizedEmail(normalizeEmail(request.email())).orElse(null);
        boolean valid = passwords.matches(request.password(), user == null ? absentUserHash : user.getPasswordHash());
        if (user == null || !valid || !user.isActive()) {
            throw invalidLogin();
        }
        return tokens.issue(user);
    }

    @Transactional(readOnly = true)
    public AuthPayloads.CurrentUser requireActiveUser(Jwt jwt) {
        var user = users.findById(UUID.fromString(jwt.getSubject())).orElseThrow(AuthService::unavailableAccount);
        validateSession(jwt, user);
        return AuthPayloads.CurrentUser.from(user);
    }

    @Transactional
    public AuthPayloads.LoginResponse changePassword(Jwt jwt, AuthPayloads.ChangePasswordRequest request) {
        validateNewPassword(request.newPassword(), request.confirmPassword());
        var user = users.findForPasswordChange(UUID.fromString(jwt.getSubject())).orElseThrow(AuthService::unavailableAccount);
        validateSession(jwt, user);
        if (utf8Length(request.currentPassword()) > 72 || !passwords.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INCORRECT_PASSWORD", "Current password is incorrect");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "SAME_PASSWORD", "New password must differ from the current password");
        }
        user.changePasswordHash(passwords.encode(request.newPassword()));
        return tokens.issue(user);
    }

    private void validateSession(Jwt jwt, User user) {
        if (!user.isActive()) throw unavailableAccount();
        if (!tokens.matchesCredentials(jwt, user)) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "SESSION_EXPIRED", "Session has expired");
        }
    }

    private static void validateNewPassword(String password, String confirmation) {
        if (!password.equals(confirmation)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "PASSWORD_MISMATCH", "Passwords do not match");
        }
        if (password.length() < 8 || utf8Length(password) > 72 || !password.codePoints().anyMatch(Character::isLetter)
                || !password.codePoints().anyMatch(Character::isDigit)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD",
                    "Password must contain a letter and a digit, have at least 8 characters and fit in 72 UTF-8 bytes");
        }
    }

    private static AuthException unavailableAccount() {
        return new AuthException(HttpStatus.FORBIDDEN, "ACCOUNT_UNAVAILABLE", "Account not available");
    }

    private static String normalizeEmail(String email) { return email.strip().toLowerCase(Locale.ROOT); }
    private static int utf8Length(String text) { return text.getBytes(StandardCharsets.UTF_8).length; }
    private static AuthException duplicateEmail() {
        return new AuthException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "Email is already registered");
    }
    private static AuthException invalidLogin() {
        return new AuthException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password");
    }
}
