package com.englishlearning.vocabulary;

import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.vocabulary.controller.DeckController;
import com.englishlearning.vocabulary.controller.DeckDevController;
import com.englishlearning.vocabulary.dto.DeckResponse;
import com.englishlearning.vocabulary.service.DeckNotFoundException;
import com.englishlearning.vocabulary.service.DeckService;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class DeckControllerTest {

    private final DeckService deckService = mock(DeckService.class);
    private MockMvc mockMvc;
    private UUID deckId;

    @BeforeEach
    void setUp() {
        deckId = UUID.fromString("11111111-1111-4111-8111-111111111111");
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = standaloneSetup(new DeckController(deckService), new DeckDevController(deckService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }

    @Test
    void listsPublishedDecksAsDtos() throws Exception {
        when(deckService.listPublished()).thenReturn(List.of(deck("Travel A1", true)));

        mockMvc.perform(get("/api/v1/decks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Travel A1"))
                .andExpect(jsonPath("$[0].isPublished").value(true));
    }

    @Test
    void hiddenOrMissingPublicDeckReturns404() throws Exception {
        when(deckService.getPublished(deckId)).thenThrow(new DeckNotFoundException(deckId));

        mockMvc.perform(get("/api/v1/decks/{id}", deckId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void validCreateReturns201AndLocation() throws Exception {
        when(deckService.create(any())).thenReturn(deck("Travel A1", true));

        mockMvc.perform(post("/api/v1/dev/decks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Travel A1","description":"Travel words","level":"A1"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/v1/dev/decks/" + deckId))
                .andExpect(jsonPath("$.id").value(deckId.toString()));
    }

    @Test
    void invalidCreateReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/dev/decks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":" ","level":"C9"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void validPatchReturns200AndDeleteReturns204() throws Exception {
        when(deckService.update(eq(deckId), any())).thenReturn(deck("Updated title", true));

        mockMvc.perform(patch("/api/v1/dev/decks/{id}", deckId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Updated title\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated title"));

        mockMvc.perform(delete("/api/v1/dev/decks/{id}", deckId))
                .andExpect(status().isNoContent());
        verify(deckService).softDelete(deckId);
    }

    @Test
    void invalidPatchReturns400() throws Exception {
        mockMvc.perform(patch("/api/v1/dev/decks/{id}", deckId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"level\":\"C9\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void devWriteControllerIsAbsentUnlessLocalProfileIsActive() {
        try (AnnotationConfigApplicationContext defaultContext = new AnnotationConfigApplicationContext()) {
            defaultContext.register(TestBeans.class, DeckDevController.class);
            defaultContext.refresh();
            assertFalse(defaultContext.containsBean("deckDevController"));
        }

        try (AnnotationConfigApplicationContext localContext = new AnnotationConfigApplicationContext()) {
            localContext.getEnvironment().setActiveProfiles("local");
            localContext.register(TestBeans.class, DeckDevController.class);
            localContext.refresh();
            assertTrue(localContext.containsBean("deckDevController"));
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class TestBeans {
        @Bean
        DeckService deckService() {
            return mock(DeckService.class);
        }
    }

    private DeckResponse deck(String title, boolean published) {
        return new DeckResponse(deckId, title, null, "A1", published, OffsetDateTime.parse("2026-11-11T12:00:00Z"));
    }
}
