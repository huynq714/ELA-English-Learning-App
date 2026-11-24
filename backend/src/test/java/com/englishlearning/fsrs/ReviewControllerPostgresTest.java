package com.englishlearning.fsrs;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest(properties = "ela.auth.token-ttl=PT1H")
@EnabledIfEnvironmentVariable(named = "FSRS_TEST_JDBC_URL",
        matches = "jdbc:postgresql://[^/]+/english_learning_fsrs_test(?:\\?.*)?")
class ReviewControllerPostgresTest {
    private static final String REVIEW = "/api/v1/review";
    private static final String PASSWORD = "Review-fixture-only-123";
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    private MockMvc mvc;
    private final List<UUID> users = new ArrayList<>();
    private final List<UUID> words = new ArrayList<>();
    private final List<UUID> decks = new ArrayList<>();

    @DynamicPropertySource
    static void testProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("FSRS_TEST_JDBC_URL"));
        registry.add("spring.datasource.username", () -> System.getenv("FSRS_TEST_JDBC_USER"));
        registry.add("spring.datasource.password", () -> System.getenv("FSRS_TEST_JDBC_PASSWORD"));
        registry.add("ela.auth.jwt-secret", () -> Base64.getEncoder().encodeToString(new byte[32]));
    }

    @BeforeEach
    void setUp() {
        assertEquals("english_learning_fsrs_test", jdbc.queryForObject("SELECT current_database()", String.class));
        mvc = webAppContextSetup(context)
                .addFilters(context.getBean("springSecurityFilterChain", jakarta.servlet.Filter.class)).build();
    }

    @AfterEach
    void cleanUp() {
        users.forEach(id -> jdbc.update("DELETE FROM users WHERE id = ?", id));
        decks.forEach(id -> jdbc.update("DELETE FROM decks WHERE id = ?", id));
        words.forEach(id -> jdbc.update("DELETE FROM words WHERE id = ?", id));
    }

    @Test
    void jwtValidationOwnershipAndRatingValidation() throws Exception {
        mvc.perform(get(REVIEW + "/summary")).andExpect(status().isUnauthorized());
        mvc.perform(get(REVIEW + "/summary").header("Authorization", "Bearer invalid")).andExpect(status().isUnauthorized());
        Account owner = account();
        Account other = account();
        UUID word = studiedWord(owner);
        String id = start(owner, "DUE").path("sessionId").asText();
        mvc.perform(get(REVIEW + "/session/" + id).header("Authorization", other.bearer()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
        mvc.perform(get(REVIEW + "/session/a-b-c-d-e").header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest());
        mvc.perform(post(REVIEW + "/session/" + id + "/rate").header("Authorization", owner.bearer())
                .contentType("application/json").content(rating(word, "UNKNOWN", UUID.randomUUID())))
                .andExpect(status().isBadRequest());
        mvc.perform(post(REVIEW + "/session/" + id + "/rate").header("Authorization", owner.bearer())
                .contentType("application/json").content(rating(word, "EASY", null)))
                .andExpect(status().isBadRequest());
        mvc.perform(post(REVIEW + "/session/" + id + "/rate").header("Authorization", other.bearer())
                .contentType("application/json").content(rating(word, "EASY", UUID.randomUUID())))
                .andExpect(status().isNotFound());
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE id = ?", other.id());
        mvc.perform(get(REVIEW + "/summary").header("Authorization", other.bearer())).andExpect(status().isForbidden());
    }

    @Test
    void dueWaitResumeReplayCompleteAndCramWithoutExtraStreak() throws Exception {
        Account user = account();
        UUID word = studiedWord(user);
        mvc.perform(get(REVIEW + "/summary").header("Authorization", user.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.dueCount").value(1));
        String id = start(user, "DUE").path("sessionId").asText();
        UUID token = UUID.randomUUID();
        JsonNode again = rate(user, id, word, "AGAIN", token);
        assertEquals("LEARNING", again.path("cardState").asText());
        assertTrue(again.path("waiting").asBoolean());
        assertEquals(again, rate(user, id, word, "AGAIN", token));
        mvc.perform(post(REVIEW + "/session/" + id + "/rate").header("Authorization", user.bearer())
                .contentType("application/json").content(rating(word, "EASY", token)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
        mvc.perform(get(REVIEW + "/session/" + id).header("Authorization", user.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.session.waiting").value(true))
                .andExpect(jsonPath("$.session.nextDueAt").isString())
                .andExpect(jsonPath("$.session.items[0].againCount").value(1))
                .andExpect(jsonPath("$.words[0].id").value(word.toString()));
        jdbc.update("UPDATE review_cards SET due_at = now() WHERE user_id = ? AND word_id = ?", user.id(), word);
        assertEquals("COMPLETED", rate(user, id, word, "EASY", UUID.randomUUID()).path("sessionStatus").asText());
        assertTrue(start(user, "DUE").path("empty").asBoolean());
        JsonNode cram = start(user, "CRAM");
        assertFalse(cram.path("waiting").asBoolean());
        assertEquals("COMPLETED", rate(user, cram.path("sessionId").asText(), word, "EASY", UUID.randomUUID())
                .path("sessionStatus").asText());
        mvc.perform(get(REVIEW + "/summary").header("Authorization", user.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.currentStreak").value(1));
        UUID deck = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO decks (id, title, level, is_published, topic_key, topic, topic_source)
                VALUES (?, ?, 'A1', true, ?, 'Review fixture', 'APP')
                """, deck, "Review fixture", "a1-review-" + deck);
        decks.add(deck);
        jdbc.update("INSERT INTO deck_words (deck_id, word_id, sort_order) VALUES (?, ?, 1)", deck, word);
        mvc.perform(post("/api/v1/my-vocabulary/" + word).header("Authorization", user.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(patch("/api/v1/users/me/profile").header("Authorization", user.bearer())
                .contentType("application/json").content("{\"englishLevel\":\"A2\"}"))
                .andExpect(status().isOk());
        mvc.perform(get(REVIEW + "/session/" + id).header("Authorization", user.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.session.status").value("COMPLETED"));
        assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM review_logs WHERE user_id = ?", Integer.class, user.id()));
    }

    private Account account() throws Exception {
        String email = "review-" + UUID.randomUUID() + "@example.test";
        JsonNode registered = json.readTree(mvc.perform(post("/api/v1/auth/register").contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("email", email, "displayName", "Review test",
                        "password", PASSWORD, "confirmPassword", PASSWORD, "englishLevel", "A1"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        UUID id = UUID.fromString(registered.path("user").path("id").asText());
        users.add(id);
        String token = json.readTree(mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("accessToken").asText();
        return new Account(id, "Bearer " + token);
    }

    private UUID studiedWord(Account account) {
        UUID word = UUID.randomUUID();
        jdbc.update("INSERT INTO words (id, headword, meaning_vi, cefr_level) VALUES (?, ?, ?, 'A1')",
                word, "review-" + word, "tu");
        words.add(word);
        jdbc.update("INSERT INTO user_word_progress (user_id, word_id) VALUES (?, ?)", account.id(), word);
        return word;
    }

    private JsonNode start(Account account, String type) throws Exception {
        return json.readTree(mvc.perform(post(REVIEW + "/session/start").header("Authorization", account.bearer())
                .contentType("application/json").content("{\"type\":\"" + type + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("session");
    }

    private JsonNode rate(Account account, String id, UUID word, String rating, UUID token) throws Exception {
        return json.readTree(mvc.perform(post(REVIEW + "/session/" + id + "/rate")
                .header("Authorization", account.bearer()).contentType("application/json").content(rating(word, rating, token)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private String rating(UUID word, String rating, UUID token) {
        var body = json.createObjectNode().put("wordId", word.toString()).put("rating", rating);
        if (token != null) body.put("clientRequestToken", token.toString());
        return body.toString();
    }

    private record Account(UUID id, String bearer) {}
}
