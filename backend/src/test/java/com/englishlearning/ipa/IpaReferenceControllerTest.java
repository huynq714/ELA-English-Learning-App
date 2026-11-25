package com.englishlearning.ipa;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.net.URI;

import static org.junit.jupiter.api.Assertions.*;

class IpaReferenceControllerTest {
    private static final Jwt TEST_JWT = Jwt.withTokenValue("test-only")
            .header("alg", "none").claim("sub", "ipa-fixture-user").build();

    @Test
    void rejectsMissingJwtBeforeCallingEngine() {
        var controller = controller("http://127.0.0.1:1/assess");
        var audio = new MockMultipartFile("audio", "clip.m4a", "audio/mp4", new byte[]{1});

        var error = assertThrows(ResponseStatusException.class,
                () -> controller.assess(null, audio, "day"));

        assertEquals(401, error.getStatusCode().value());
    }

    @Test
    void rejectsAudioOverEightMib() {
        var controller = controller("http://127.0.0.1:1/assess");
        var audio = new MockMultipartFile("audio", "large.m4a", "audio/mp4",
                new byte[(int) (8L * 1024 * 1024 + 1)]);

        var error = assertThrows(ResponseStatusException.class,
                () -> controller.assess(TEST_JWT, audio, "day"));

        assertEquals(400, error.getStatusCode().value());
    }

    @Test
    void mapsEngineHttpFailureToServiceUnavailable() throws Exception {
        var engine = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        engine.createContext("/assess", exchange -> {
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
        });
        engine.start();
        try {
            var controller = controller("http://127.0.0.1:" + engine.getAddress().getPort() + "/assess");
            var audio = new MockMultipartFile("audio", "clip.m4a", "audio/mp4", new byte[]{1, 2, 3});

            var error = assertThrows(ResponseStatusException.class,
                    () -> controller.assess(TEST_JWT, audio, "day"));

            assertEquals(503, error.getStatusCode().value());
        } finally {
            engine.stop(0);
        }
    }

    @Test
    void mapsEngineNetworkFailureToServiceUnavailable() {
        var controller = controller("http://127.0.0.1:1/assess");
        var audio = new MockMultipartFile("audio", "clip.m4a", "audio/mp4", new byte[]{1, 2, 3});

        var error = assertThrows(ResponseStatusException.class,
                () -> controller.assess(TEST_JWT, audio, "day"));

        assertEquals(503, error.getStatusCode().value());
    }

    private static IpaReferenceController controller(String engineUrl) {
        return new IpaReferenceController(new ObjectMapper(), URI.create(engineUrl));
    }
}
