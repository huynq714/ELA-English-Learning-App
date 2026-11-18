# Week 4 Vocabulary Acceptance Record

## Task 01B results (historical)

| Check | Result | Evidence |
| --- | --- | --- |
| PostgreSQL service and target connection | BLOCKED | PostgreSQL 18 service was running. The target rejected non-interactive CLI authentication because no configured credential was available. The Windows UI tool could not open pgAdmin (OS error 3). |
| Migration on `english_learning_db` | BLOCKED | The project owner confirmed `words.meaning_vi` has `is_nullable = NO` in pgAdmin. The remaining target catalog and applied migration objects are still unverified. |
| Migration on isolated PostgreSQL 18 | PASS | Week 3 baseline and revised V1_2 executed. The live catalog confirmed `meaning_vi` remains `text NOT NULL`, `definition_en` is `text`, `import_key` is `varchar`, and `source_metadata` is `jsonb NOT NULL`. |
| Import on `english_learning_db` (01B) | SUPERSEDED | pgAdmin confirmed that the target requires a value in `words.meaning_vi`. Task 01C supplies verified meanings for the new batch below. |
| Import guard on isolated PostgreSQL 18 | PASS | The import raised the expected error before inserting rows. Counts after the failed transaction were 0 decks, 0 words, and 0 links in the empty test database. |
| Actual CEFR-J deck and word counts on target | UNKNOWN | No count query result from the target. The dry run plans 3 decks of 20, 20, and 12 words. |
| Spring Boot and Hibernate on isolated PostgreSQL 18 | PASS | The application started with `ddl-auto=validate`. `GET /api/v1/decks` returned the published test fixture only. Published empty deck words returned `200 []`. Hidden and missing deck words each returned `404`. |
| API with imported CEFR-J words | NOT TESTED | Word DTO, IPA, English definition, source metadata, and order still need a populated database check. The successful re-import path is also pending. |
| React Native / Expo Go | NOT TESTED | ADB listed no attached device. Device URL, navigation, card flips, previous/next, IPA, definition, source attribution, loading, empty, error, and retry still need a runtime check. |
| Maven, TypeScript, and ESLint | PASS | Maven ran 21 tests with 0 failures. TypeScript and ESLint on the Vocabulary feature and screens exited 0. |
| Import builder | PASS | Three tests passed. Dry run regenerated the SQL and manifest with 52 records and sizes 20/20/12. |

The prior migration dropped `NOT NULL` from `meaning_vi`. Task 01B removed that statement and added a guard to the import. The import also checks for ambiguous deck titles and serializes deck creation. The Week 3 schema remains the reference for the existing data and constraints.

## Task 01C results

| Check | Result | Evidence |
| --- | --- | --- |
| Vietnamese sense review | PASS | 52 entries reviewed. 43 VERIFIED, 6 REVIEW_REQUIRED, 3 MISSING. Each included entry has a cited Wiktionary sense. |
| Dry-run and deck plan | PASS | 3 decks of 20/18/5, compared with 20/20/12 in the old preview. 43 non-blank meanings. Tests checked distinct headwords and answer groups within each deck. |
| Migration and import on isolated PostgreSQL 18 | PASS | `is_nullable = NO`. The import added 3 decks, 43 words and 43 links, with verified metadata and consecutive order per deck. The unrelated fixture deck remained. |
| Rollback on invalid data | PASS | Added a test insert with `meaning_vi = NULL` immediately before the transaction commit. PostgreSQL rejected it and counts returned to 1 existing deck, 0 words and 0 links. |
| Repeat import | PASS | The second run kept totals at 4 decks including the fixture, 43 words, and 43 links. The word, link and metadata snapshot digest matched. |
| Local suites | PASS | 5 import builder tests and 21 Maven tests passed. TypeScript and Vocabulary ESLint also exited 0. |
| Migration on `english_learning_db` | PASS | The owner confirmed the backup and that only the baseline `meaning_vi` column matched the preflight. The Week 4 migration returned `COMMIT` in pgAdmin. |
| Import on `english_learning_db` | PASS | pgAdmin reported `COMMIT`. The owner's result grid showed 20, 18, and 5 total words, with matching verified counts for each deck. The verified query counted only non-blank Vietnamese meanings with `reviewStatus = 'VERIFIED'`. |
| New batch through live API | PASS | Health returned HTTP 200. The live deck list contained all 3 published decks. The word endpoints returned 20/18/5 entries with HTTP 200, matching the expected order, part of speech, English definition, Vietnamese meaning, and source URL. A nonexistent deck returned HTTP 404. |
| Bilingual examples through live API | PASS | After the example update and backend restart, all 43 words returned nonempty `exampleEn` and `exampleVi` fields, split 20/18/5 across the three decks. |
| Expo Go flashcards with bilingual examples | PASS | The owner confirmed the updated screen on a phone after opening A1 Core Vocabulary 03 in Expo Go. The acceptance check covered the Vietnamese translation beneath the English example, the Again/Hard/Good/Easy controls, and removal of the attribution block from the card. |

## pgAdmin preflight and migration

1. In pgAdmin, right-click `english_learning_db` and select **Backup**. Choose **Custom**, save the backup outside the repository, and confirm the backup job completed.
2. Open **Query Tool** on `english_learning_db`. Run the following to record the target, counts, column types, and constraints. If a relation is missing, stop after identifying it.

```sql
SELECT current_database(), current_setting('server_version') AS postgres_version;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('decks', 'words', 'deck_words')
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS table_name, conname, contype, convalidated,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (to_regclass('public.decks'), to_regclass('public.words'),
                   to_regclass('public.deck_words'))
   OR confrelid = to_regclass('public.words')
ORDER BY table_name, conname;

SELECT (SELECT count(*) FROM public.decks) AS decks_before,
       (SELECT count(*) FROM public.words) AS words_before,
       (SELECT count(*) FROM public.deck_words) AS links_before;

SELECT to_regclass('public.idx_words_cefr_headword') AS week4_index;
```

3. Compare the catalog with [V1_2](../../database/week4/migrations/V1_2__source_vocabulary_fields.sql). If all eight new columns, both constraints, and the index are absent, open the revised file in Query Tool and execute the full script. If all are present and match, skip it. A partial match needs investigation first. Run the catalog queries again and confirm `meaning_vi` and old row counts are unchanged.
4. Confirm `words.meaning_vi` remains `text NOT NULL` and the finished backup belongs to the target database. Open the current [apply_a1_import.sql](../../database/week4/import/data/apply_a1_import.sql), run it in full and inspect Messages. Both files use standard PostgreSQL SQL and can be opened directly in Query Tool.

## Verify after a successful import

```sql
SELECT d.title, d.is_published, count(w.id) AS words,
       count(DISTINCT lower(w.headword)) AS distinct_headwords,
       min(dw.sort_order) AS first_order, max(dw.sort_order) AS last_order,
       count(DISTINCT dw.sort_order) AS distinct_orders,
       count(*) FILTER (
         WHERE w.cefr_level = 'A1'
           AND w.source_metadata->'cefrj'->>'version' = '1.6'
           AND w.source_metadata->'dictionary'->>'url' IS NOT NULL
           AND w.source_metadata->'vietnamese'->>'reviewStatus' = 'VERIFIED'
           AND w.source_metadata->'vietnamese'->>'url' IS NOT NULL
           AND NULLIF(btrim(w.meaning_vi), '') IS NOT NULL
           AND NULLIF(btrim(w.definition_en), '') IS NOT NULL
       ) AS attributed_a1_words
FROM public.decks d
LEFT JOIN public.deck_words dw ON dw.deck_id = d.id
LEFT JOIN public.words w ON w.id = dw.word_id
WHERE d.title IN ('A1 – Core Vocabulary 01', 'A1 – Core Vocabulary 02',
                  'A1 – Core Vocabulary 03')
GROUP BY d.id, d.title, d.is_published
ORDER BY d.title;

SELECT count(*) AS orphan_links
FROM public.deck_words dw
LEFT JOIN public.decks d ON d.id = dw.deck_id
LEFT JOIN public.words w ON w.id = dw.word_id
WHERE d.id IS NULL OR w.id IS NULL;
```

Expect one row per deck, with counts of 20/18/5, distinct consecutive positions starting at 1, an equal number of attributed records, and zero orphan links. Compare the overall counts with the preflight. For a repeat check after a successful import, run a copy of the same SQL in Query Tool with its final `COMMIT` replaced by the verification queries and `ROLLBACK`. Compare the counts and check that inserts report zero added rows.

Start Spring Boot against the target using the development credentials already configured locally. Compare the words returned by `GET /api/v1/decks/{id}/words` with `deck_words.sort_order` in PostgreSQL. For Expo Go, set `EXPO_PUBLIC_API_BASE_URL` to the laptop's reachable LAN address and port and restart Metro. Confirm the API opens in the phone browser first. If the backend is reachable over the LAN, keep the local profile with unauthenticated write endpoints disabled. Run the device checks in the table above and record the results here.
