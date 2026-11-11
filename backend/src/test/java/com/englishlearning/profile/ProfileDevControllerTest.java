package com.englishlearning.profile;

import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.profile.controller.ProfileDevController;
import com.englishlearning.profile.dto.ProfileResponse;
import com.englishlearning.profile.service.ProfileService;
import com.englishlearning.profile.service.ProfileNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class ProfileDevControllerTest {

    private final ProfileService profileService = mock(ProfileService.class);
    private MockMvc mockMvc;
    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.fromString("22222222-2222-4222-8222-222222222222");
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = standaloneSetup(new ProfileDevController(profileService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }

    @Test
    void validPutReturnsProfileDtoAndDoesNotExposeSensitiveFields() throws Exception {
        when(profileService.put(org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new ProfileResponse(userId, "B1", 30, null,
                        OffsetDateTime.parse("2026-11-11T12:00:00Z")));

        mockMvc.perform(put("/api/v1/dev/users/{userId}/profile", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"englishLevel":"B1","dailyGoalMinutes":30,"avatarUrl":null,
                                 "email":"attacker@example.test","passwordHash":"nope","status":"DISABLED"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.englishLevel").value("B1"))
                .andExpect(jsonPath("$.dailyGoalMinutes").value(30))
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.status").doesNotExist());
    }

    @Test
    void invalidLevelAndGoalReturn400() throws Exception {
        mockMvc.perform(put("/api/v1/dev/users/{userId}/profile", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"englishLevel\":\"C9\",\"dailyGoalMinutes\":4}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void getAndPatchReturnProfileAndMissingProfileReturns404() throws Exception {
        ProfileResponse profile = new ProfileResponse(userId, "A2", 45, null,
                OffsetDateTime.parse("2026-11-11T12:00:00Z"));
        when(profileService.get(userId)).thenReturn(profile);
        when(profileService.patch(org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(profile);

        mockMvc.perform(get("/api/v1/dev/users/{userId}/profile", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyGoalMinutes").value(45));

        mockMvc.perform(patch("/api/v1/dev/users/{userId}/profile", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dailyGoalMinutes\":45}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.englishLevel").value("A2"));

        when(profileService.get(userId)).thenThrow(new ProfileNotFoundException(userId));
        mockMvc.perform(get("/api/v1/dev/users/{userId}/profile", userId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void controllerIsNotRegisteredWithoutLocalProfile() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.register(TestBeans.class, ProfileDevController.class);
            context.refresh();
            assertFalse(context.containsBean("profileDevController"));
        }
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("local");
            context.register(TestBeans.class, ProfileDevController.class);
            context.refresh();
            assertTrue(context.containsBean("profileDevController"));
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class TestBeans {
        @Bean
        ProfileService profileService() {
            return mock(ProfileService.class);
        }
    }
}
