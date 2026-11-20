package com.englishlearning.vocabulary.service;

import com.englishlearning.vocabulary.dto.DeckWordResponse;
import com.englishlearning.vocabulary.repository.SavedWordRepository;
import com.englishlearning.vocabulary.repository.WordRepository;
import com.englishlearning.vocabulary.repository.SavedWordRepository.SavedGroup;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.List;
import java.util.UUID;

@Service
public class MyVocabularyService {
    private final SavedWordRepository saved;
    private final WordRepository words;

    public MyVocabularyService(SavedWordRepository saved, WordRepository words) {
        this.saved = saved;
        this.words = words;
    }

    @Transactional(readOnly = true)
    public SavedPage list(UUID userId, String keyword, String level, int page, int size, UUID groupId) {
        String query = Normalizer.normalize(keyword.strip(), Normalizer.Form.NFC);
        if (query.length() > 200 || !List.of("", "A1", "A2").contains(level) || page < 0 || size < 1
                || size > 100 || (long) page * size > Integer.MAX_VALUE) {
            throw new IllegalArgumentException("Invalid saved vocabulary filters or pagination");
        }
        var result = words.findSavedWords(userId, level, query, groupId, PageRequest.of(page, size));
        return new SavedPage(result.map(word -> new SavedWord(true, DeckWordResponse.from(word))).getContent(),
                page, size, result.getTotalElements(), result.hasNext());
    }

    @Transactional(readOnly = true)
    public List<SavedGroup> groups(UUID userId, String query) {
        String normalized = Normalizer.normalize(query.strip(), Normalizer.Form.NFC);
        if (normalized.length() > 200) throw new IllegalArgumentException("Search text is too long");
        return saved.groups(userId, normalized);
    }

    @Transactional(readOnly = true)
    public SavedGroup group(UUID userId, UUID groupId) {
        return saved.group(userId, groupId);
    }

    @Transactional(readOnly = true)
    public long totalSaved(UUID userId) {
        return saved.count(userId);
    }

    @Transactional(readOnly = true)
    public boolean isSaved(UUID userId, UUID wordId) {
        return saved.exists(userId, wordId);
    }

    @Transactional
    public void save(UUID userId, UUID wordId) {
        if (!saved.saveIfAccessible(userId, wordId) && !saved.exists(userId, wordId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Word not accessible");
        }
    }

    @Transactional
    public void remove(UUID userId, UUID wordId) {
        saved.delete(userId, wordId);
    }

    public record SavedWord(boolean saved, DeckWordResponse word) {}
    public record SavedPage(List<SavedWord> items, int page, int size, long total, boolean hasNext) {}
}
