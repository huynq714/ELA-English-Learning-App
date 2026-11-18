package com.englishlearning.vocabulary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "words")
public class Word {

    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String headword;

    @Column(length = 120)
    private String ipa;

    @Column(name = "meaning_vi", columnDefinition = "text")
    private String meaningVi;

    @Column(name = "example_en", columnDefinition = "text")
    private String exampleEn;

    @Column(name = "example_vi", columnDefinition = "text")
    private String exampleVi;

    @Column(name = "audio_url", columnDefinition = "text")
    private String audioUrl;

    @Column(name = "part_of_speech", length = 32)
    private String partOfSpeech;

    @Column(name = "cefr_level", length = 8)
    private String cefrLevel;

    @Column(name = "definition_en", columnDefinition = "text")
    private String definitionEn;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_metadata", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> sourceMetadata;

    protected Word() {
    }

    public UUID getId() { return id; }
    public String getHeadword() { return headword; }
    public String getIpa() { return ipa; }
    public String getMeaningVi() { return meaningVi; }
    public String getExampleEn() { return exampleEn; }
    public String getExampleVi() { return exampleVi; }
    public String getAudioUrl() { return audioUrl; }
    public String getPartOfSpeech() { return partOfSpeech; }
    public String getCefrLevel() { return cefrLevel; }
    public String getDefinitionEn() { return definitionEn; }
    public Map<String, Object> getSourceMetadata() { return sourceMetadata; }
}
