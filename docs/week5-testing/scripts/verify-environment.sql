SELECT current_database(), inet_server_addr(), inet_server_port(), current_user, version();
SELECT EXISTS (SELECT 1 FROM pg_collation WHERE collname='pg_unicode_fast'
               AND collnamespace='pg_catalog'::regnamespace) AS my_vocabulary_collation_available;
SELECT count(*) AS public_tables FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
SELECT (SELECT count(*) FROM decks) AS decks,
       (SELECT count(*) FROM words) AS words,
       (SELECT count(*) FROM deck_words) AS links;
SELECT to_regclass('public.review_sessions'), to_regclass('public.review_session_items'),
       to_regclass('public.review_idempotency'), to_regclass('public.user_streaks');
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND ((table_name='review_cards' AND column_name='learning_step')
OR (table_name='review_logs' AND column_name IN ('state_before','elapsed_days','scheduled_days')));
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'
AND tablename IN ('review_sessions','review_session_items','review_idempotency','user_streaks');
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace='public'::regnamespace
AND conrelid IN ('review_sessions'::regclass,'review_session_items'::regclass,
                'review_idempotency'::regclass,'user_streaks'::regclass)
ORDER BY table_name, conname;
