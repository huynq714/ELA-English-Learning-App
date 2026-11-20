package com.englishlearning.vocabulary;

import com.englishlearning.auth.AuthPayloads.CurrentUser;
import com.englishlearning.auth.AuthService;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.vocabulary.controller.MyVocabularyController;
import com.englishlearning.vocabulary.repository.SavedWordRepository.SavedGroup;
import com.englishlearning.vocabulary.service.MyVocabularyService;
import com.englishlearning.vocabulary.service.SavedVocabularyGroupNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class MyVocabularyControllerTest {
    private final UUID userId = UUID.randomUUID();
    private final UUID groupId = UUID.randomUUID();
    private final AuthService auth = mock(AuthService.class);
    private final MyVocabularyService vocabulary = mock(MyVocabularyService.class);
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        when(auth.requireActiveUser(any())).thenReturn(new CurrentUser(userId, "saved@example.test", "Saved User"));
        mockMvc = standaloneSetup(new MyVocabularyController(auth, vocabulary))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void returnsGroupMetadataAndOnlyTheAuthenticatedUsersSavedCount() throws Exception {
        when(vocabulary.group(userId, groupId)).thenReturn(new SavedGroup(groupId, "Du lịch của tôi", "Travel", "A1",
                null, 3, "journey, passport, vacation"));

        mockMvc.perform(get("/api/v1/my-vocabulary/groups/{groupId}", groupId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupId").value(groupId.toString()))
                .andExpect(jsonPath("$.title").value("Du lịch của tôi"))
                .andExpect(jsonPath("$.wordCount").value(3))
                .andExpect(jsonPath("$.description").value(org.hamcrest.Matchers.nullValue()));

        verify(vocabulary).group(userId, groupId);
    }

    @Test
    void returnsNotFoundForUnknownOrUnsupportedGroup() throws Exception {
        when(vocabulary.group(userId, groupId)).thenThrow(new SavedVocabularyGroupNotFoundException());

        mockMvc.perform(get("/api/v1/my-vocabulary/groups/{groupId}", groupId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void groupListIncludesDatabaseDescriptionAndCount() throws Exception {
        when(vocabulary.groups(userId, "")).thenReturn(List.of(new SavedGroup(groupId, "Du lịch của tôi", "Travel", "A1",
                "Bộ từ chủ đề du lịch.", 2, "journey, passport")));

        mockMvc.perform(get("/api/v1/my-vocabulary/groups"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].description").value("Bộ từ chủ đề du lịch."))
                .andExpect(jsonPath("$[0].wordCount").value(2));
    }
}
