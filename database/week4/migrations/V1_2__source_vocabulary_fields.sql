-- Week 4 vocabulary import extension.
-- Forward-only migration: preserves existing Week 3 data and tables.
-- Run after database/week3/schema.sql; never edits the Week 3 baseline.
-- Preserve the existing definition and constraints of words.meaning_vi.
BEGIN;

ALTER TABLE public.words
  ADD COLUMN part_of_speech VARCHAR(32),
  ADD COLUMN cefr_level VARCHAR(8),
  ADD COLUMN definition_en TEXT,
  ADD COLUMN category_main TEXT,
  ADD COLUMN category_sub TEXT,
  ADD COLUMN threshold_category TEXT,
  ADD COLUMN import_key VARCHAR(64),
  ADD COLUMN source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT words_cefr_level_check
    CHECK (cefr_level IS NULL OR cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  ADD CONSTRAINT uq_words_import_key UNIQUE (import_key);

CREATE INDEX idx_words_cefr_headword ON public.words(cefr_level, lower(headword));

COMMENT ON COLUMN public.words.definition_en IS
  'English dictionary definition; display it explicitly as an English definition.';
COMMENT ON COLUMN public.words.source_metadata IS
  'Field-level dataset/API citations, retrieval timestamps, license notes, and review status.';
COMMENT ON COLUMN public.words.import_key IS
  'Stable idempotency key for an external vocabulary source record; null for legacy/manual rows.';

COMMIT;
