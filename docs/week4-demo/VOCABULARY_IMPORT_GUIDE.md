# Week 4 Vocabulary Import Guide

The Week 3 baseline schema and DBML remain unchanged. Week 4 vocabulary fields are a separate forward migration at `database/week4/migrations/V1_2__source_vocabulary_fields.sql`.

## Generate and inspect the source sample

From the repository root, with Python 3 installed:

```powershell
python database/week4/import/build_import_sql.py --dry-run
```

The command combines the cached English records in `cefrj_a1_enriched.csv` with the individual sense decisions in [vietnamese_meaning_review.csv](../../database/week4/import/data/vietnamese_meaning_review.csv). It writes `apply_a1_import.sql` and `import_manifest.json` under `database/week4/import/data/` without connecting to PostgreSQL.

The 43 verified senses fill three decks of 20, 18, and 5, compared with the prior English-only preview of 20, 20, and 12. The planner separates repeated headwords and equivalent Vietnamese answer choices identified during review. The manifest lists the source row numbers in each deck's display order.

## Existing native PostgreSQL database

1. Back up the database using pgAdmin before schema changes.
2. Open pgAdmin Query Tool connected to `english_learning_db`.
3. First check whether the migration has already been applied:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'words'
  AND column_name IN ('definition_en', 'source_metadata', 'import_key');
```

4. Check and record the type, nullability, and constraints of `words.meaning_vi` using the queries in [the acceptance record](WEEK4_VOCABULARY_TEST.md). If all Week 4 columns and objects are absent, open and execute `database/week4/migrations/V1_2__source_vocabulary_fields.sql` once. If some already exist, compare them with the migration before doing anything else.
5. Confirm `meaning_vi` is `text NOT NULL`, then open the current `apply_a1_import.sql` in Query Tool and execute the entire script. This batch provides a non-blank meaning for every word. The script runs one transaction and checks the batch fingerprint, the expected word-to-deck links, and their order. A title collision with a different batch needs investigation before import.

Alternatively, set `PGHOST`, `PGPORT`, `PGDATABASE`, and `PGUSER` in a PowerShell session, then run:

```powershell
python database/week4/import/build_import_sql.py --apply
```

`psql` asks for the password interactively. Do not put it in the command or commit it to `.env` or source control.

## Docker

On a **brand new empty Docker volume**, `compose.yaml` initializes Week 3 schema then applies the Week 4 migration in order. It does not import the vocabulary automatically. Review the generated import SQL and apply it to the container database as above (set the `PG*` variables to the published local port and configured username/database).

For an already initialized Docker volume, PostgreSQL ignores `/docker-entrypoint-initdb.d` scripts on restart. Do not delete the volume to force reinitialization. Apply the migration once through pgAdmin/psql after checking the columns, then apply the generated import SQL.

## Verify import

```sql
SELECT d.title, count(dw.word_id) AS words
FROM decks d
LEFT JOIN deck_words dw ON dw.deck_id = d.id
WHERE d.description LIKE 'English Learning App Week 4, CEFR-J v1.6 A1, verified Vietnamese senses. Batch %'
GROUP BY d.id, d.title
ORDER BY d.title;

SELECT w.headword, w.part_of_speech, w.cefr_level, w.definition_en,
       w.meaning_vi, w.import_key, w.source_metadata
FROM words w
WHERE w.import_key IS NOT NULL
ORDER BY w.headword, w.part_of_speech;
```

Expect three decks with 20, 18, and 5 links. Re-running the same generated SQL leaves the existing rows and links intact.

## Add bilingual examples to an existing import

If the 43 words were imported before examples were added, open [apply_a1_examples.sql](../../database/week4/import/data/apply_a1_examples.sql) in the pgAdmin Query Tool for `english_learning_db` and run the entire file. It updates `example_en`, `example_vi`, and example provenance on the original batch. It stops if an expected word is missing or an example was edited after import. The same script can run again safely.

Restart the backend so it returns `exampleVi`, then reload the Expo app. Fresh imports from `apply_a1_import.sql` already include both examples.
