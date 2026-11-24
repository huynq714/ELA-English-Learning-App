package com.englishlearning.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.time.Duration;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;

@Configuration
public class SecurityConfig {
    private static final Set<String> LOOPBACK = Set.of("127.0.0.1", "::1", "0:0:0:0:0:0:0:1");

    @Bean
    SecurityFilterChain appSecurity(HttpSecurity http, Environment environment) {
        boolean localProfile = environment.acceptsProfiles(Profiles.of("local"));
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(rules -> rules
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login",
                                "/api/v1/auth/forgot-password", "/api/v1/auth/verify-reset-otp",
                                "/api/v1/auth/reset-password").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/decks", "/api/v1/decks/{id}",
                                "/api/v1/decks/{id}/words").authenticated()
                        .requestMatchers("/api/v1/users/me", "/api/v1/users/me/profile", "/api/v1/users/me/password").authenticated()
                        .requestMatchers("/api/v1/my-vocabulary", "/api/v1/my-vocabulary/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/review/summary", "/api/v1/review/session/{id}").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/review/session/start", "/api/v1/review/session/{id}/rate").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/quiz/attempts", "/api/v1/quiz/attempts/{id}/answers",
                                "/api/v1/quiz/attempts/{id}/submit").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/quiz/attempts/{id}/result", "/api/v1/decks/{id}/study-progress").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/decks/{id}/study-progress").authenticated()
                        .requestMatchers("/api/v1/dev/**").access((authentication, context) ->
                                new AuthorizationDecision(localProfile && LOOPBACK.contains(context.getRequest().getRemoteAddr())))
                        .anyRequest().denyAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> unauthorized(response))
                        .accessDeniedHandler((request, response, exception) ->
                                respond(response, 403, "FORBIDDEN", "Access denied")))
                .oauth2ResourceServer(oauth -> oauth
                        .authenticationEntryPoint((request, response, exception) -> unauthorized(response))
                        .jwt(Customizer.withDefaults()))
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    SecretKey jwtSigningKey(@Value("${ela.auth.jwt-secret}") String encoded) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException error) {
            throw new IllegalStateException("AUTH_JWT_SECRET must be base64 encoded");
        }
        if (bytes.length < 32) {
            throw new IllegalStateException("Set AUTH_JWT_SECRET to at least 32 cryptographically random bytes encoded as base64");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }

    @Bean
    JwtDecoder jwtDecoder(SecretKey key) {
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ZERO),
                new JwtIssuerValidator(JwtService.ISSUER),
                token -> token.getAudience() != null && token.getAudience().contains(JwtService.AUDIENCE)
                        && token.getExpiresAt() != null && isUuid(token.getSubject())
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"))));
        return decoder;
    }

    private static boolean isUuid(String subject) {
        if (subject == null) return false;
        try {
            return UUID.fromString(subject).toString().equals(subject);
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    private static void unauthorized(HttpServletResponse response) throws IOException {
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        respond(response, 401, "UNAUTHORIZED", "Valid access token required");
    }

    private static void respond(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
