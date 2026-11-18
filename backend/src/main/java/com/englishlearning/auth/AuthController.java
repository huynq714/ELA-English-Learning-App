package com.englishlearning.auth;

import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) { this.auth = auth; }

    @PostMapping("/register")
    public ResponseEntity<AuthPayloads.LoginResponse> register(@Valid @RequestBody AuthPayloads.RegisterRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(auth.register(body));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthPayloads.LoginResponse> login(@Valid @RequestBody AuthPayloads.LoginRequest body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(auth.login(body));
    }
}
