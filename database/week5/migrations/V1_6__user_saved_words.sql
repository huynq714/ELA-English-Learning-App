BEGIN;

CREATE TABLE IF NOT EXISTS public.user_saved_words (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    word_id uuid NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_saved_words_user_word_unique UNIQUE (user_id, word_id)
);

CREATE INDEX IF NOT EXISTS user_saved_words_user_order_idx
    ON public.user_saved_words (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS user_saved_words_word_idx ON public.user_saved_words (word_id);

COMMIT;
