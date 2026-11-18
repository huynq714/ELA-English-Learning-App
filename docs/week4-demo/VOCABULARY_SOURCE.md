# Week 4 Vocabulary Sources and Attribution

## Source selection

- **CEFR-J Wordlist Version 1.6** supplies the English headword, part of speech, CEFR-J level, category fields, and source row. To regenerate the candidate list, download the workbook from CEFR-J and place it at `database/week4/import/source/CEFR-J Wordlist Ver1.6.xlsx`. The project selects a deterministic subset of A1 records in workbook order. [CEFR-J downloads](https://cefr-j.org/download_eng)
- **Free Dictionary API** supplies English definitions and example sentences when an API sense has a part of speech that matches the CEFR-J record. The API describes its source as English Wiktionary. The source response and retrieval time are recorded per word.
- IPA is retained only when returned by that source response. Audio URLs are not imported because a separate right to redistribute audio was not verified.
- **Vietnamese Wiktionary** provides Vietnamese glosses for English entries. The review used the [2026-10-02 Vietnamese Wiktionary dump](https://kaikki.org/viwiktionary/rawdata.html), extracted on 2026-11-03 by Kaikki/Wiktextract, and direct Wiktionary entries for exceptions. For `at`, the English Wiktionary translation table resolves the mismatch in the Vietnamese page's part-of-speech heading.
- The [review CSV](../../database/week4/import/data/vietnamese_meaning_review.csv) retains the English definition, source gloss, chosen Vietnamese wording, cited entry, sense locator, confidence and decision. Short Vietnamese answers are selected from the cited gloss, with capitalization and punctuation normalized as needed.
- The [bilingual example pairs](../../database/week4/import/data/a1_example_pairs.json) provide a sentence and its Vietnamese translation for each of the 43 approved senses. The project supplies the Vietnamese translations and English sentences where a suitable dictionary example was missing. `words.source_metadata.examples` distinguishes original project examples from retained dictionary sentences. This document carries the Vocabulary credits for the demo.

## Review status

The 52 candidates with cached English definitions received individual sense reviews. **43 are VERIFIED, 6 are REVIEW_REQUIRED, and 3 are MISSING.** VERIFIED means the cited gloss supports the selected meaning in context. The set has yet to receive an independent teacher review. Eight entries excluded during English enrichment remain outside this review.

The eligible Deck sizes changed from **20/20/12** in the English-only preview to **20/18/5**. Each deck has at least five entries with distinct answers based on the reviewed equivalence groups. For example, `any`, `anybody`, and `anyone` are placed separately when their chosen answer refers to an unspecified person.

To regenerate just the extraction, download the raw JSONL gzip from the linked Kaikki page and run `python database/week4/import/extract_vi_wiktionary.py <dump.jsonl.gz>`. The snapshot used had SHA-256 `1f0abd21982660b5fc2eff5eb3fbacbed2d9fe8f476af794dbed0d927ffb8187`. Generating the import uses the review CSV and the existing English cache.

## Attribution and license notes

CEFR-J requests citation. Suggested citation:

> The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://cefr-j.org/download_eng.

The Free Dictionary API maintainer identifies its dictionary content as English Wiktionary-derived, under CC BY-SA 3.0 (or later) and GFDL. The applicable Wiktionary attribution and share-alike terms must be followed when redistributing derivative definitions. Each imported row includes source URLs, source row, retrieval timestamp, and license notes in `words.source_metadata`.

For the selected Vietnamese glosses, follow **CC BY-SA 4.0**. Credit Wiktionary contributors through the cited entry link, include the license link, identify wording that was adapted, and distribute adaptations under the applicable share-alike terms. Credit Tatu Ylonen, *Wiktextract: Wiktionary as Machine-Readable Structured Data* (LREC 2022), for the extraction. Check entry-specific exceptions before reusing cited material. The import omits the newspaper quotation attached to `airport` in the English cache.

References:

- [CEFR-J download and use notes](https://cefr-j.org/download_eng)
- [Free Dictionary API](https://dictionaryapi.dev/)
- [API maintainer license/source note](https://github.com/meetDeveloper/freeDictionaryAPI/issues/102)
- [Wiktionary copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)
- [Vietnamese Wiktionary copyright policy](https://vi.wiktionary.org/wiki/Wiktionary:Quy%E1%BB%81n_t%C3%A1c_gi%E1%BA%A3)
- [Kaikki Vietnamese Wiktionary extraction and citation](https://kaikki.org/viwiktionary/rawdata.html)
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

This is a coursework demonstration dataset, not a claim of official CEFR-J curation or legal review. Verify the current license terms before public or commercial redistribution.
