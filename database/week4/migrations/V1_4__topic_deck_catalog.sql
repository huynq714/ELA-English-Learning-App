BEGIN;

ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS topic_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS topic VARCHAR(120),
  ADD COLUMN IF NOT EXISTS topic_source VARCHAR(12),
  ADD COLUMN IF NOT EXISTS topic_source_label VARCHAR(120);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.decks'::regclass AND conname = 'decks_topic_catalog_check') THEN
    ALTER TABLE public.decks ADD CONSTRAINT decks_topic_catalog_check CHECK (
      (topic_key IS NULL AND topic IS NULL AND topic_source IS NULL AND topic_source_label IS NULL)
      OR (
        topic_key IS NOT NULL AND topic_key ~ '^a[12]-[a-z0-9-]+$'
        AND topic IS NOT NULL AND btrim(topic) <> ''
        AND level IS NOT NULL AND split_part(topic_key, '-', 1) = lower(level)
        AND topic_source IS NOT NULL AND (
          (topic_source = 'APP' AND topic_source_label IS NULL)
          OR (topic_source = 'CEFR_J' AND topic_source_label IS NOT NULL AND btrim(topic_source_label) <> '')
        )
      )
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_decks_topic_key ON public.decks (topic_key);

COMMIT;
