package com.englishlearning.ipa;

import tools.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ipa/reference")
public class IpaReferenceController {
    private static final long MAX_AUDIO_BYTES = 8L * 1024 * 1024;

    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final URI engineUri;

    public IpaReferenceController(ObjectMapper mapper,
            @Value("${ela.ipa.reference-url:http://127.0.0.1:8090/assess}") URI engineUri) {
        this.mapper = mapper;
        this.engineUri = engineUri;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> assess(@AuthenticationPrincipal Jwt jwt,
            @RequestPart("audio") MultipartFile audio,
            @RequestPart("targetText") @NotBlank @Pattern(regexp = "[A-Za-z][A-Za-z '-]{0,39}") String targetText) {
        if (jwt == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (audio.isEmpty() || audio.getSize() > MAX_AUDIO_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Audio must be between 1 byte and 8 MB");
        }
        try {
            var payload = mapper.writeValueAsBytes(Map.of("targetText", targetText.toLowerCase(),
                    "contentType", audio.getContentType() == null ? "application/octet-stream" : audio.getContentType(),
                    "audioBase64", Base64.getEncoder().encodeToString(audio.getBytes())));
            var request = HttpRequest.newBuilder(engineUri).timeout(Duration.ofSeconds(110))
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofByteArray(payload)).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() != 200) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IPA reference service unavailable");
            @SuppressWarnings("unchecked") Map<String, Object> result = mapper.readValue(response.body(), Map.class);
            return result;
        } catch (ResponseStatusException e) { throw e; }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IPA reference assessment failed"); }
    }
}
