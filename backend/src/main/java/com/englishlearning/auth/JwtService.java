package com.englishlearning.auth;

import com.englishlearning.profile.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

@Service
public class JwtService {
    static final String ISSUER = "english-learning-api";
    static final String AUDIENCE = "english-learning-app";
    private static final String CREDENTIAL_VERSION = "pwdv";

    private final JwtEncoder encoder;
    private final SecretKey key;
    private final Duration ttl;

    public JwtService(JwtEncoder encoder, SecretKey key, @Value("${ela.auth.token-ttl}") Duration ttl) {
        if (ttl.isNegative() || ttl.isZero() || ttl.compareTo(Duration.ofDays(1)) > 0) {
            throw new IllegalStateException("AUTH_TOKEN_TTL must be positive and at most 24 hours");
        }
        this.encoder = encoder;
        this.key = key;
        this.ttl = ttl;
    }

    public AuthPayloads.LoginResponse issue(User user) {
        Instant now = Instant.now();
        Instant expiration = now.plus(ttl);
        var claims = JwtClaimsSet.builder()
                .issuer(ISSUER).audience(List.of(AUDIENCE)).subject(user.getId().toString())
                .claim(CREDENTIAL_VERSION, credentialVersion(user))
                .issuedAt(now).expiresAt(expiration).build();
        var parameters = JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims);
        return new AuthPayloads.LoginResponse(encoder.encode(parameters).getTokenValue(), "Bearer", expiration,
                AuthPayloads.CurrentUser.from(user));
    }

    public boolean matchesCredentials(Jwt jwt, User user) {
        var version = jwt.getClaimAsString(CREDENTIAL_VERSION);
        return version != null && MessageDigest.isEqual(
                version.getBytes(StandardCharsets.UTF_8), credentialVersion(user).getBytes(StandardCharsets.UTF_8));
    }

    String credentialVersion(User user) {
        // Invalidate old sessions on password change without putting the stored hash in the token.
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            var input = "ela:credentials:" + user.getId() + ":" + user.getPasswordHash();
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("Unable to calculate credential version", error);
        }
    }
}
