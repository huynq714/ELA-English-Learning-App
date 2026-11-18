package com.englishlearning.vocabulary;

import com.englishlearning.vocabulary.entity.Deck;
import com.englishlearning.vocabulary.entity.Word;
import com.englishlearning.vocabulary.repository.DeckRepository;
import com.englishlearning.vocabulary.repository.WordRepository;
import com.englishlearning.vocabulary.service.DeckNotFoundException;
import com.englishlearning.vocabulary.service.DeckWordsService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DeckWordsServiceTest {
    private final DeckRepository deckRepository = mock(DeckRepository.class);
    private final WordRepository wordRepository = mock(WordRepository.class);
    private final DeckWordsService service = new DeckWordsService(deckRepository, wordRepository);
    private final UUID deckId = UUID.fromString("11111111-1111-4111-8111-111111111111");

    @Test
    void mapsPublishedDeckWordsToDtosWithoutRequiringVietnameseTranslation() {
        when(deckRepository.findByIdAndPublishedTrue(deckId))
                .thenReturn(Optional.of(Deck.create("A1 words", null, "A1", true)));
        Word word = mock(Word.class);
        when(word.getId()).thenReturn(UUID.fromString("22222222-2222-4222-8222-222222222222"));
        when(word.getHeadword()).thenReturn("journey");
        when(word.getPartOfSpeech()).thenReturn("noun");
        when(word.getCefrLevel()).thenReturn("A1");
        when(word.getDefinitionEn()).thenReturn("A trip from one place to another.");
        when(word.getSourceMetadata()).thenReturn(Map.of("cefrj", Map.of("version", "1.6")));
        when(wordRepository.findAllForDeck(deckId)).thenReturn(List.of(word));

        var result = service.listPublishedDeckWords(deckId);

        assertEquals(1, result.size());
        assertEquals("journey", result.getFirst().headword());
        assertEquals("A1", result.getFirst().cefrLevel());
        assertEquals(null, result.getFirst().meaningVi());
    }

    @Test
    void missingOrUnpublishedDeckIsNotQueriedForWords() {
        when(deckRepository.findByIdAndPublishedTrue(deckId)).thenReturn(Optional.empty());
        assertThrows(DeckNotFoundException.class, () -> service.listPublishedDeckWords(deckId));
    }

    @Test
    void publishedDeckWithNoWordsReturnsEmptyList() {
        when(deckRepository.findByIdAndPublishedTrue(deckId))
                .thenReturn(Optional.of(Deck.create("Empty", null, "A1", true)));
        when(wordRepository.findAllForDeck(deckId)).thenReturn(List.of());
        assertEquals(List.of(), service.listPublishedDeckWords(deckId));
    }
}
