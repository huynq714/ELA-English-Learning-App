package com.englishlearning.profile.controller;

import com.englishlearning.auth.AuthPayloads;
import com.englishlearning.auth.AuthService;
import com.englishlearning.profile.dto.CurrentProfilePatchRequest;
import com.englishlearning.profile.dto.CurrentProfileResponse;
import com.englishlearning.profile.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/me")
public class CurrentUserController {
    private final AuthService auth;
    private final ProfileService profiles;

    public CurrentUserController(AuthService auth, ProfileService profiles) {
        this.auth = auth;
        this.profiles = profiles;
    }

    @GetMapping
    public AuthPayloads.CurrentUser me(@AuthenticationPrincipal Jwt jwt) {
        return auth.requireActiveUser(jwt);
    }

    @GetMapping("/profile")
    public CurrentProfileResponse profile(@AuthenticationPrincipal Jwt jwt) {
        var user = me(jwt);
        return CurrentProfileResponse.from(profiles.get(user.id()), user.displayName());
    }

    @PatchMapping("/profile")
    public CurrentProfileResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CurrentProfilePatchRequest body) {
        return profiles.patchCurrent(me(jwt).id(), body);
    }

    @PatchMapping("/password")
    public ResponseEntity<AuthPayloads.LoginResponse> changePassword(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AuthPayloads.ChangePasswordRequest body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.changePassword(jwt, body));
    }
}
