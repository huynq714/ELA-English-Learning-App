package com.englishlearning.auth;

import com.englishlearning.profile.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

@Service
class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private final UserRepository users;
    private final PasswordResetStore store;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final SecretKey key;
    private final TransactionTemplate transaction;
    private final Executor mailExecutor;
    private final JavaMailSender mail;
    private final String sender;
    private final boolean enabled;
    private final SecureRandom random = new SecureRandom();

    PasswordResetService(UserRepository users, PasswordResetStore store, PasswordEncoder passwords, JwtService jwt,
                         SecretKey key, PlatformTransactionManager transactionManager,
                         @Qualifier("passwordResetMailExecutor") Executor mailExecutor, JavaMailSender mail,
                         @Value("${spring.mail.username}") String sender, @Value("${spring.mail.password}") String password) {
        this.users = users;
        this.store = store;
        this.passwords = passwords;
        this.jwt = jwt;
        this.key = key;
        this.transaction = new TransactionTemplate(transactionManager);
        this.mailExecutor = mailExecutor;
        this.mail = mail;
        this.sender = sender.strip();
        this.enabled = !this.sender.isBlank() && !password.isBlank();
    }

    void requestCode(String address, String ip) {
        requireEnabled();
        String email = AuthService.normalizeEmail(address);
        var subject = hash("email-limit", email);
        if (!store.allow("send-ip", hash("ip-limit", ip), 20, 3600)
                || !store.allow("send-email-cooldown", subject, 1, 60)
                || !store.allow("send-email", subject, 5, 3600)) return;

        try {
            // The response does not wait for an account lookup or an SMTP connection.
            mailExecutor.execute(() -> deliver(email));
        } catch (RejectedExecutionException error) {
            log.warn("Password recovery mail queue is full");
        }
    }

    private void deliver(String email) {
        try {
            String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
            String destination = transaction.execute(ignored -> users.findForPasswordReset(email)
                    .filter(user -> user.isActive() && store.start(user.getId(), jwt.credentialVersion(user),
                            hash("otp:" + user.getId(), code)))
                    .map(user -> user.getEmail()).orElse(null));
            if (destination == null) return;

            var message = new SimpleMailMessage();
            message.setFrom(sender);
            message.setTo(destination);
            message.setSubject("English Learning App - Mã khôi phục mật khẩu");
            message.setText("Mã OTP khôi phục mật khẩu của bạn: " + code
                    + "\nMã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.");
            mail.send(message);
        } catch (RuntimeException error) {
            // SMTP exceptions can contain addresses or message data.
            log.warn("Password recovery email could not be sent ({})", error.getClass().getSimpleName());
        }
    }

    String verify(String address, String otp, String ip) {
        requireEnabled();
        String email = AuthService.normalizeEmail(address);
        limit("verify", email, ip);
        String result = transaction.execute(ignored -> users.findForPasswordReset(email).filter(user -> user.isActive())
                .flatMap(user -> store.find(user.getId(), jwt.credentialVersion(user)).map(challenge -> {
                    if (!challenge.otpLive() || challenge.otpHash() == null || challenge.failures() >= 5) return null;
                    if (!MessageDigest.isEqual(challenge.otpHash(), hash("otp:" + user.getId(), otp))) {
                        store.recordFailure(user.getId());
                        return null;
                    }
                    byte[] bytes = new byte[32];
                    random.nextBytes(bytes);
                    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
                    store.issueToken(user.getId(), hash("token:" + user.getId(), token));
                    return token;
                })).orElse(null));
        // Throw after the transaction commits so failed attempts are persisted.
        if (result == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_RESET_OTP", "OTP is invalid or expired");
        }
        return result;
    }

    void finish(String address, String token, String password, String confirmation, String ip) {
        requireEnabled();
        String email = AuthService.normalizeEmail(address);
        limit("reset", email, ip);
        AuthService.validateNewPassword(password, confirmation);
        Boolean completed = transaction.execute(ignored -> users.findForPasswordReset(email).filter(user -> user.isActive())
                .flatMap(user -> store.find(user.getId(), jwt.credentialVersion(user)).map(challenge -> {
                    if (!challenge.tokenLive() || challenge.tokenHash() == null
                            || !MessageDigest.isEqual(challenge.tokenHash(), hash("token:" + user.getId(), token))) {
                        return false;
                    }
                    if (passwords.matches(password, user.getPasswordHash())) {
                        throw new AuthException(HttpStatus.BAD_REQUEST, "SAME_PASSWORD", "Use a different password");
                    }
                    user.changePasswordHash(passwords.encode(password));
                    store.consume(user.getId());
                    return true;
                })).orElse(false));
        if (!Boolean.TRUE.equals(completed)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_RESET_TOKEN", "Reset request is invalid or expired");
        }
    }

    private void requireEnabled() {
        if (!enabled) throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "RESET_UNAVAILABLE",
                "Password recovery is unavailable");
    }

    private void limit(String action, String email, String ip) {
        if (!store.allow(action + "-ip", hash("ip-limit", ip), 80, 900)
                || !store.allow(action + "-email", hash("email-limit", email), 30, 900)) {
            throw new AuthException(HttpStatus.TOO_MANY_REQUESTS, "RESET_RATE_LIMIT", "Try again later");
        }
    }

    private byte[] hash(String purpose, String value) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            return mac.doFinal(("ela:password-reset:" + purpose + ":" + value).getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("Unable to protect recovery data", error);
        }
    }

    @Scheduled(initialDelay = 900_000, fixedDelay = 900_000)
    void purgeExpired() {
        if (enabled) store.purgeExpired();
    }
}
