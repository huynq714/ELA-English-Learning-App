#!/usr/bin/env python3
"""Build the Task 01D SQL from CEFR-J v1.6 and the reviewed dictionary senses."""

import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import quote, urlsplit

from build_import_sql import DEFAULT_EXAMPLES, DEFAULT_INPUT, load_example_pairs, load_valid, sql_text
from prepare_vocabulary import CEFRJ_URL, DEFAULT_XLSX, natural_key, read_xlsx_sheet

DATA = Path(__file__).resolve().parent / "data"
OUTPUT = DATA / "apply_topic_decks.sql"
GLOSS_SEPARATORS = re.compile(r"[,;/|]")


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def read_review():
    decks = json.loads((DATA / "topic_decks.json").read_text(encoding="utf-8"))
    by_key = {deck["key"]: deck for deck in decks}
    if len(decks) != len(by_key) or Counter(d["level"] for d in decks) != {"A1": 3, "A2": 3}:
        raise ValueError("Expected three distinct approved decks per level")

    with (DATA / "topic_word_review.csv").open(encoding="utf-8", newline="") as stream:
        records = list(csv.DictReader(stream))
    sheets = {level: read_xlsx_sheet(DEFAULT_XLSX, level) for level in ("A1", "A2")}
    if len({r["import_key"] for r in records}) != len(records):
        raise ValueError("Repeated source word keys")

    for row in records:
        deck = by_key[row["topic_key"]]
        sheet = sheets[deck["level"]]
        source = dict(zip(sheet[0], sheet[int(row["cefrj_row"]) - 1]))
        for column, field in (("headword", "headword"), ("pos", "pos"), ("CEFR", "level"),
                              ("CoreInventory 1", "category_main"), ("CoreInventory 2", "category_sub"),
                              ("Threshold", "threshold")):
            if source.get(column, "").strip() != row[field]:
                raise ValueError(f"Workbook mismatch for {row['headword']}: {column}")
        if deck["source"] == "CEFR_J" and deck["source_label"] != row["category_main"]:
            raise ValueError(f"Word outside the CEFR-J topic: {row['headword']}")
        if row["import_key"] != natural_key(row["headword"], row["pos"], row["level"]):
            raise ValueError(f"Incorrect source key: {row['headword']}")
        vietnamese_gloss = normalized(row["vi_evidence"].translate(str.maketrans("", "", "()")))
        meaning = normalized(row["meaning_vi"].translate(str.maketrans("", "", "()")))
        if (row["review_status"] != "VERIFIED"
                or not all(row[field].strip() for field in (
                    "definition_en", "en_url", "en_license", "en_license_url", "en_sense",
                    "meaning_vi", "vi_url", "vi_source", "vi_license", "vi_sense", "answer_key"))
                or meaning not in vietnamese_gloss):
            raise ValueError(f"Missing verification evidence: {row['headword']}")
        if (urlsplit(row["vi_url"]).netloc not in {"vi.wiktionary.org", "en.wiktionary.org"}
                or urlsplit(row["en_url"]).netloc not in {"api.dictionaryapi.dev", "en.wiktionary.org"}):
            raise ValueError(f"Unexpected dictionary source: {row['headword']}")

    for key in by_key:
        group = sorted((r for r in records if r["topic_key"] == key), key=lambda r: int(r["sort_order"]))
        headwords = {normalized(r["headword"]) for r in group}
        answers = {r["answer_key"] for r in group}
        senses = [normalized(part) for r in group for part in GLOSS_SEPARATORS.split(r["meaning_vi"])]
        # Distinct prompts and meanings in both directions, including individual Vietnamese glosses.
        if not 15 <= len(group) <= 20 or len(headwords) != len(group) or len(answers) != len(group):
            raise ValueError(f"Invalid word or question count: {key}")
        if len(senses) != len(set(senses)) or [int(r["sort_order"]) for r in group] != list(range(1, len(group) + 1)):
            raise ValueError(f"Overlapping meanings or nonconsecutive order: {key}")
    return decks, records


def word_values(row, example_metadata):
    metadata = {
        "cefrj": {
            "source": "CEFR-J Wordlist Version 1.6",
            "compiler": "Yukio Tono, Tokyo University of Foreign Studies",
            "version": "1.6", "worksheet": row["level"], "row": int(row["cefrj_row"]), "url": CEFRJ_URL,
        },
        "dictionary": {
            "api": row["en_source"], "url": row["en_url"], "senseLocator": row["en_sense"],
            "underlyingPage": "https://en.wiktionary.org/wiki/" + quote(row["headword"].replace(" ", "_")),
            "license": row["en_license"], "licenseUrl": row["en_license_url"],
            "posMatch": True, "selectionMethod": "English sense matched to the cited Vietnamese gloss.",
        },
        "vietnamese": {
            "url": row["vi_url"], "source": row["vi_source"], "attribution": "Wiktionary contributors",
            "license": row["vi_license"], "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
            "sourceGloss": row["vi_evidence"], "senseLocator": row["vi_sense"],
            "reviewStatus": row["review_status"], "adaptation": "Selected and normalized part of the source gloss.",
        },
    }
    if row["import_key"] in example_metadata:
        metadata["examples"] = example_metadata[row["import_key"]]
    fields = (
        "topic_key", "import_key", "headword", "pos", "level", "definition_en", "meaning_vi",
        "ipa", "example_en", "example_vi", "category_main", "category_sub", "threshold",
    )
    return "(" + ", ".join([str(int(row["sort_order"])), *(sql_text(row[field]) for field in fields),
                           sql_text(json.dumps(metadata, ensure_ascii=False, separators=(",", ":")))]) + ")"


def build_sql(decks, rows):
    prior, _ = load_valid(DEFAULT_INPUT)
    examples = {key: json.loads(pair["metadata"]) for key, pair in load_example_pairs(prior, DEFAULT_EXAMPLES).items()}
    deck_rows = ",\n".join(
        "(" + ", ".join(sql_text(d[field]) for field in ("key", "title", "level", "source", "source_label")) + ")"
        for d in decks
    )
    word_rows = ",\n".join(word_values(row, examples) for row in rows)
    return f"""-- Generated by build_topic_import_sql.py from topic_decks.json and topic_word_review.csv.
-- Apply V1_2 and V1_4 before running. For a dry run, replace the final COMMIT with ROLLBACK.
BEGIN;
SET LOCAL standard_conforming_strings = on;

CREATE TEMP TABLE topic_catalog_import (
  topic_key TEXT PRIMARY KEY, title TEXT NOT NULL, level TEXT NOT NULL,
  topic_source TEXT NOT NULL, topic_source_label TEXT
) ON COMMIT DROP;

INSERT INTO topic_catalog_import VALUES
{deck_rows};

CREATE TEMP TABLE topic_words_import (
  sort_order INTEGER NOT NULL, topic_key TEXT NOT NULL, import_key TEXT PRIMARY KEY,
  headword TEXT NOT NULL, pos TEXT NOT NULL, level TEXT NOT NULL, definition_en TEXT NOT NULL,
  meaning_vi TEXT NOT NULL CHECK (btrim(meaning_vi) <> ''), ipa TEXT,
  example_en TEXT, example_vi TEXT, category_main TEXT, category_sub TEXT,
  threshold_category TEXT, source_metadata JSONB NOT NULL,
  UNIQUE (topic_key, sort_order)
) ON COMMIT DROP;

INSERT INTO topic_words_import VALUES
{word_rows};

LOCK TABLE public.decks, public.words, public.deck_words IN SHARE ROW EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_temp.topic_catalog_import s JOIN public.decks d
      ON lower(d.title) = lower(s.title) AND d.level IS NOT DISTINCT FROM s.level
    WHERE d.topic_key IS DISTINCT FROM s.topic_key
  ) THEN
    RAISE EXCEPTION 'A legacy deck already uses an approved topic title; review it before importing';
  END IF;
END $$;

INSERT INTO public.decks (topic_key, title, level, topic, topic_source, topic_source_label, is_published)
SELECT topic_key, title, level, title, topic_source, topic_source_label, true FROM pg_temp.topic_catalog_import
ON CONFLICT (topic_key) DO NOTHING;

INSERT INTO public.words (import_key, headword, part_of_speech, cefr_level, definition_en, meaning_vi,
                          ipa, example_en, example_vi, category_main, category_sub, threshold_category, source_metadata)
SELECT import_key, headword, pos, level, definition_en, meaning_vi,
       ipa, example_en, example_vi, category_main, category_sub, threshold_category, source_metadata
FROM pg_temp.topic_words_import
ON CONFLICT (import_key) DO NOTHING;

INSERT INTO public.deck_words (deck_id, word_id, sort_order)
SELECT d.id, w.id, s.sort_order
FROM pg_temp.topic_words_import s JOIN public.decks d USING (topic_key) JOIN public.words w USING (import_key)
ON CONFLICT (deck_id, word_id) DO NOTHING;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_temp.topic_catalog_import s LEFT JOIN public.decks d USING (topic_key)
    WHERE d.title IS DISTINCT FROM s.title OR d.topic IS DISTINCT FROM s.title
      OR d.level IS DISTINCT FROM s.level OR d.topic_source IS DISTINCT FROM s.topic_source
      OR d.topic_source_label IS DISTINCT FROM s.topic_source_label OR d.is_published IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'Existing topic deck metadata differs from the verified catalogue';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp.topic_words_import s
    JOIN public.decks d USING (topic_key)
    LEFT JOIN public.words w USING (import_key)
    LEFT JOIN public.deck_words link ON link.deck_id = d.id AND link.word_id = w.id
    WHERE w.headword IS DISTINCT FROM s.headword OR w.part_of_speech IS DISTINCT FROM s.pos
      OR w.cefr_level IS DISTINCT FROM s.level OR w.meaning_vi IS DISTINCT FROM s.meaning_vi
      OR w.source_metadata #>> '{{vietnamese,reviewStatus}}' IS DISTINCT FROM 'VERIFIED'
      OR link.sort_order IS DISTINCT FROM s.sort_order
  ) OR EXISTS (
    SELECT 1 FROM pg_temp.topic_catalog_import s JOIN public.decks d USING (topic_key)
    JOIN public.deck_words link ON link.deck_id = d.id JOIN public.words w ON w.id = link.word_id
    LEFT JOIN pg_temp.topic_words_import r ON r.topic_key = d.topic_key AND r.import_key = w.import_key
    WHERE r.import_key IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing word review data or topic deck links differ; no records were applied';
  END IF;
  IF (SELECT count(*) FROM public.decks WHERE topic_key IS NOT NULL AND is_published) <> 6 THEN
    RAISE EXCEPTION 'The published topic catalogue must contain exactly six decks';
  END IF;
END $$;

SELECT d.level, d.topic, count(*) AS verified_words
FROM pg_temp.topic_catalog_import s JOIN public.decks d USING (topic_key)
JOIN public.deck_words dw ON dw.deck_id = d.id
GROUP BY d.id ORDER BY d.level, d.topic_key;

COMMIT;
"""


if __name__ == "__main__":
    decks, records = read_review()
    OUTPUT.write_text(build_sql(decks, records), encoding="utf-8", newline="\n")
    print(f"Generated {OUTPUT.name} for {len(decks)} decks and {len(records)} verified words")
