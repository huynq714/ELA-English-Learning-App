package com.englishlearning.vocabulary.dto;

import com.englishlearning.vocabulary.entity.Word;

import java.util.Map;
import java.util.UUID;

public record DeckWordResponse(
        UUID id,
        String headword,
        String partOfSpeech,
        String cefrLevel,
        String definitionEn,
        String meaningVi,
        String ipa,
        String exampleEn,
        String exampleVi,
        String audioUrl,
        Map<String, Object> sourceMetadata
) {
    public static DeckWordResponse from(Word word) {
        return new DeckWordResponse(word.getId(), word.getHeadword(), word.getPartOfSpeech(),
                word.getCefrLevel(), word.getDefinitionEn(), word.getMeaningVi(), word.getIpa(),
                word.getExampleEn(), word.getExampleVi(), word.getAudioUrl(), word.getSourceMetadata());
    }
}
