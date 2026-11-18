package com.englishlearning.auth;

import com.englishlearning.profile.entity.User;
import com.englishlearning.profile.repository.UserProfileRepository;
import com.englishlearning.profile.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AuthServiceTest {
    @Test
    void disabledAccountCannotLoginOrUseAnExistingIdentity() {
        var users = mock(UserRepository.class);
        var profiles = mock(UserProfileRepository.class);
        var passwordEncoder = mock(PasswordEncoder.class);
        var jwtService = mock(JwtService.class);
        var auth = new AuthService(users, profiles, passwordEncoder, jwtService);
        var user = mock(User.class);
        var userId = UUID.randomUUID();
        when(user.isActive()).thenReturn(false);
        when(user.getPasswordHash()).thenReturn("bcrypt-placeholder-for-mock");
        when(users.findByNormalizedEmail("user@example.test")).thenReturn(Optional.of(user));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("test-only", user.getPasswordHash())).thenReturn(true);

        var loginFailure = assertThrows(AuthException.class, () ->
                auth.login(new AuthPayloads.LoginRequest("User@example.test", "test-only")));
        assertEquals(HttpStatus.UNAUTHORIZED, loginFailure.status());
        var jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn(userId.toString());
        var accessFailure = assertThrows(AuthException.class, () -> auth.requireActiveUser(jwt));
        assertEquals(HttpStatus.FORBIDDEN, accessFailure.status());
        verifyNoInteractions(jwtService);
    }
}
