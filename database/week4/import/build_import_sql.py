#!/usr/bin/env python3
"""Create a deterministic, idempotent, transaction-wrapped PostgreSQL import."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import subprocess
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

IMPORT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = IMPORT_DIR / "data" / "cefrj_a1_enriched.csv"
DEFAULT_SQL = IMPORT_DIR / "data" / "apply_a1_import.sql"
DEFAULT_MANIFEST = IMPORT_DIR / "data" / "import_manifest.json"
DEFAULT_REVIEW = IMPORT_DIR / "data" / "vietnamese_meaning_review.csv"
DEFAULT_EXAMPLES = IMPORT_DIR / "data" / "a1_example_pairs.json"
DEFAULT_EXAMPLES_SQL = IMPORT_DIR / "data" / "apply_a1_examples.sql"
BASELINE_DECK_COUNTS = [20, 20, 12]


def sql_text(value: str | None) -> str:
    if value is None or value == "":
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def validate_translation(record: dict[str, str]) -> None:
    fields = ("meaning_vi", "vietnamese_source_url", "source_origin", "source_license",
              "sense_locator", "source_evidence", "quiz_answer_key", "reason")
    if record.get("status") != "VERIFIED" or record.get("match_confidence") != "HIGH":
        raise ValueError("Only verified Vietnamese senses can be imported")
    if any(not record.get(field, "").strip() for field in fields):
        raise ValueError(f"Missing translation evidence for {record['headword']}")
    url = urlsplit(record["vietnamese_source_url"])
    if (url.scheme != "https" or url.netloc not in {"en.wiktionary.org", "vi.wiktionary.org"}
            or record["source_license"] != "CC BY-SA 4.0"):
        raise ValueError(f"Unexpected Vietnamese source or license for {record['headword']}")
    evidence = record["source_evidence"].casefold().replace("(", "").replace(")", "")
    if record["meaning_vi"].strip().casefold() not in evidence:
        raise ValueError(f"Selected meaning is not supported by the cited gloss for {record['headword']}")


def load_valid(input_path: Path, review_path: Path = DEFAULT_REVIEW
               ) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    with input_path.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    english_matched = [r for r in rows if r.get("cefr_level") == "A1"
             and r.get("dictionary_http") in {"200", "CACHE"}
             and r.get("definition_en", "").strip()
             and r.get("import_key", "").strip()
             and r.get("review_status") == "SOURCE_MATCHED_NEEDS_HUMAN_REVIEW"]
    if len({r["import_key"] for r in english_matched}) != len(english_matched):
        raise ValueError("Duplicate stable import_key in source CSV")
    with review_path.open(encoding="utf-8-sig", newline="") as stream:
        reviews = {}
        for review in csv.DictReader(stream):
            key = review["import_key"]
            if key in reviews:
                raise ValueError(f"Duplicate review key {key}")
            reviews[key] = review
    if set(reviews) != {row["import_key"] for row in english_matched}:
        raise ValueError("Review file must cover exactly the matched English source rows")

    ready = []
    rejected = [dict(row, status="ENGLISH_EXCLUDED") for row in rows if row not in english_matched]
    for row in english_matched:
        review = reviews[row["import_key"]]
        identity_fields = ("cefrj_row", "headword", "part_of_speech", "cefr_level", "definition_en")
        if any(review[field] != row[field] for field in identity_fields):
            raise ValueError(f"Reviewed sense no longer matches cached source row {row['cefrj_row']}")
        record = {**row, **review, "meaning_vi": review["proposed_meaning_vi"].strip()}
        if review["status"] == "VERIFIED":
            validate_translation(record)
            ready.append(record)
        elif review["status"] in {"REVIEW_REQUIRED", "MISSING"}:
            rejected.append(record)
        else:
            raise ValueError(f"Unknown review status for source row {row['cefrj_row']}")
    return ready, rejected


def partition_records(records: list[dict[str, str]]) -> list[list[dict[str, str]]]:
    if not records:
        return []
    count = len(records)
    # Reserve at least five questions for each deck whenever the batch permits it.
    group_count = min(3, max(1, count // 5))
    deck_groups: list[list[dict[str, str]]] = [[] for _ in range(group_count)]
    capacities = []
    for remaining_groups in range(group_count - 1, -1, -1):
        capacity = min(20, count - 5 * remaining_groups)
        capacities.append(capacity)
        count -= capacity
    headword_counts = Counter(row["headword"].casefold() for row in records)
    answer_counts = Counter(row["quiz_answer_key"] for row in records)
    # Place records with shared headwords or answers before unrestricted records.
    by_conflict = sorted(records, key=lambda row: (
        -headword_counts[row["headword"].casefold()] - answer_counts[row["quiz_answer_key"]]
    ))
    for record in by_conflict:
        group = next((g for g, capacity in zip(deck_groups, capacities)
                      if len(g) < capacity and all(
                          item["headword"].casefold() != record["headword"].casefold()
                          and item["quiz_answer_key"] != record["quiz_answer_key"] for item in g
                      )), None)
        if group is None:
            raise ValueError(f"Deck plan cannot place {record['headword']} without an answer conflict")
        group.append(record)
    source_order = {record["import_key"]: index for index, record in enumerate(records)}
    for group in deck_groups:
        group.sort(key=lambda record: source_order[record["import_key"]])
    return deck_groups


def deck_metadata(deck_no: int, group: list[dict[str, str]]) -> tuple[str, str]:
    title = f"A1 – Core Vocabulary {deck_no:02d}"
    identity = [(row["import_key"], row["definition_en"], row["meaning_vi"]) for row in group]
    fingerprint = hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()
    return title, f"English Learning App Week 4, CEFR-J v1.6 A1, verified Vietnamese senses. Batch {fingerprint}."


def load_example_pairs(records: list[dict[str, str]], path: Path) -> dict[str, dict[str, str | None]]:
    pairs = json.loads(path.read_text(encoding="utf-8"))
    by_sense = {(str(pair["row"]), pair["headword"], pair["pos"]): pair for pair in pairs}
    if len(by_sense) != len(pairs):
        raise ValueError("Duplicate example sense in example dataset")
    examples = {}
    for record in records:
        sense = (record["cefrj_row"], record["headword"], record["part_of_speech"])
        pair = by_sense.get(sense)
        if not pair or any(not isinstance(pair.get(lang), str) or not pair[lang].strip() for lang in ("en", "vi")):
            raise ValueError(f"Missing bilingual example for CEFR-J sense {sense}")
        previous_en = (record.get("example_en") or None) if record["headword"] != "airport" else None
        english = pair["en"].strip()
        from_dictionary = english == previous_en
        examples[record["import_key"]] = {
            "previous_en": previous_en,
            "en": english,
            "vi": pair["vi"].strip(),
            "metadata": json.dumps({
                "english": "Free Dictionary API" if from_dictionary else "English Learning App (original example)",
                "englishUrl": record.get("dictionary_url") if from_dictionary else None,
                "vietnamese": "English Learning App (example translation)",
            }, ensure_ascii=False),
        }
    return examples


def build_sql(records: list[dict[str, str]], examples_path: Path = DEFAULT_EXAMPLES) -> str:
    if not records:
        raise ValueError("No A1 records have a verified Vietnamese sense")
    for record in records:
        validate_translation(record)
    examples = load_example_pairs(records, examples_path)
    deck_groups = partition_records(records)

    lines = [
        "-- Generated from CEFR-J Wordlist v1.6 and Free Dictionary API responses.",
        "-- Review source citations in source_metadata before distribution.",
        "-- Idempotent by import_key and deck_words composite primary key.",
        "-- Reviewed Vietnamese glosses from Wiktionary are attributed per word.",
        "BEGIN;",
        "SET LOCAL search_path = public, pg_catalog;",
        "SET LOCAL standard_conforming_strings = on;",
        "DO $$ BEGIN",
        "  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='words' AND column_name='source_metadata') THEN",
        "    RAISE EXCEPTION 'Week 4 vocabulary migration V1_2 is not applied';",
        "  END IF;",
        "END $$;",
        # Deck titles have no UNIQUE constraint. Serialize the existence check and insert.
        "LOCK TABLE public.decks IN SHARE ROW EXCLUSIVE MODE;",
    ]
    for deck_no, group in enumerate(deck_groups, start=1):
        title, marker = deck_metadata(deck_no, group)
        lines += [
            "DO $$ BEGIN",
            f"  IF EXISTS (SELECT 1 FROM decks WHERE title = {sql_text(title)} AND description IS DISTINCT FROM {sql_text(marker)}) THEN",
            f"    RAISE EXCEPTION 'A deck titled % already exists with different content', {sql_text(title)};",
            "  END IF;",
            f"  IF (SELECT count(*) FROM decks WHERE title = {sql_text(title)}) > 1 THEN",
            f"    RAISE EXCEPTION 'More than one deck already has title %', {sql_text(title)};",
            "  END IF;",
            "END $$;",
            "INSERT INTO decks(title, description, level, is_published)",
            f"SELECT {sql_text(title)}, {sql_text(marker)}, 'A1', TRUE",
            f"WHERE NOT EXISTS (SELECT 1 FROM decks WHERE title={sql_text(title)} AND description={sql_text(marker)});",
        ]

    fields = ["headword", "ipa", "meaning_vi", "example_en", "example_vi", "audio_url", "part_of_speech",
              "cefr_level", "definition_en", "category_main", "category_sub", "threshold_category",
              "import_key", "source_metadata"]
    for record in records:
        pair = examples[record["import_key"]]
        source_meta = {
            "cefrj": {
                "source": "CEFR-J Wordlist Version 1.6",
                "compiler": "Yukio Tono, Tokyo University of Foreign Studies",
                "url": record.get("cefrj_source_url") or "https://cefr-j.org/download_eng",
                "version": "1.6",
                "worksheet": record.get("cefrj_worksheet"),
                "row": int(record["cefrj_row"]),
                "citation": record.get("cefrj_citation"),
                "licenseNote": "Official page allows research and commercial use with proper acknowledgement; cite the wordlist.",
            },
            "dictionary": {
                "api": "Free Dictionary API",
                "url": record.get("dictionary_url"),
                "underlyingSource": "English Wiktionary",
                "underlyingPage": "https://en.wiktionary.org/wiki/" + record["headword"].replace(" ", "_"),
                "license": "CC BY-SA 3.0 (or later) and GFDL as stated by the API maintainer",
                "licenseUrl": "https://en.wiktionary.org/wiki/Wiktionary:Copyrights",
                "posMatch": True,
                "selectionMethod": "First non-empty definition in an API sense whose partOfSpeech exactly matches CEFR-J POS.",
                "retrievedAtUtc": record.get("retrieved_at_utc"),
                "reviewStatus": "Source/POS matched; not independently human reviewed.",
                "audioOmitted": "Audio URL not stored because its separate reuse license was not verified.",
            },
            "vietnamese": {
                "url": record["vietnamese_source_url"],
                "source": record["source_origin"],
                "attribution": "Wiktionary contributors",
                "license": record["source_license"],
                "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
                "senseLocator": record["sense_locator"],
                "sourceGloss": record["source_evidence"],
                "reviewStatus": record["status"],
                "reviewReason": record["reason"],
                "adaptation": "Selected and normalized the relevant part of the source gloss.",
            },
            "examples": json.loads(pair["metadata"]),
        }
        row = {
            "headword": record["headword"],
            "ipa": record.get("ipa") or None,
            "meaning_vi": record["meaning_vi"].strip(),
            "example_en": pair["en"],
            "example_vi": pair["vi"],
            "audio_url": None,
            "part_of_speech": record["part_of_speech"],
            "cefr_level": "A1",
            "definition_en": record["definition_en"],
            "category_main": record.get("category_main") or None,
            "category_sub": record.get("category_sub") or None,
            "threshold_category": record.get("threshold_category") or None,
            "import_key": record["import_key"],
            "source_metadata": json.dumps(source_meta, ensure_ascii=False, separators=(",", ":")),
        }
        columns = ", ".join(fields)
        values = ", ".join(sql_text(row[field]) for field in fields)
        lines += [f"INSERT INTO words({columns}) VALUES ({values}) ON CONFLICT (import_key) DO NOTHING;"]

    for deck_no, group in enumerate(deck_groups, start=1):
        title, marker = deck_metadata(deck_no, group)
        for index, record in enumerate(group):
            sort_order = index + 1
            lines += [
                "INSERT INTO deck_words(deck_id, word_id, sort_order)",
                "SELECT d.id, w.id, " + str(sort_order),
                "FROM decks d CROSS JOIN words w",
                f"WHERE d.title={sql_text(title)} AND d.description={sql_text(marker)} AND w.import_key={sql_text(record['import_key'])}",
                "ON CONFLICT (deck_id, word_id) DO NOTHING;",
            ]
        expected = ", ".join(f"({sql_text(row['import_key'])}, {index}, {sql_text(row['meaning_vi'])})"
                             for index, row in enumerate(group, start=1))
        lines += [
            "DO $$ BEGIN",
            "  IF EXISTS (",
            f"    SELECT 1 FROM (VALUES {expected}) AS expected(import_key, sort_order, meaning_vi)",
            "    FULL JOIN (SELECT w.import_key, dw.sort_order, w.meaning_vi FROM decks d",
            "               JOIN deck_words dw ON dw.deck_id=d.id JOIN words w ON w.id=dw.word_id",
            f"               WHERE d.title={sql_text(title)} AND d.description={sql_text(marker)}) actual",
            "    ON actual.import_key=expected.import_key AND actual.sort_order=expected.sort_order",
            "    AND actual.meaning_vi=expected.meaning_vi",
            "    WHERE actual.import_key IS NULL OR expected.import_key IS NULL",
            "  ) THEN",
            f"    RAISE EXCEPTION 'Existing deck links or word meanings differ for %', {sql_text(title)};",
            "  END IF;",
            "END $$;",
        ]
    lines += [
        "-- Summary emitted by the runner after COMMIT; verify with the queries in VOCABULARY_IMPORT_GUIDE.md.",
        "COMMIT;",
    ]
    return "\n".join(lines) + "\n"


def build_examples_sql(records: list[dict[str, str]], examples_path: Path) -> str:
    examples = load_example_pairs(records, examples_path)
    values = []
    for record in records:
        pair = examples[record["import_key"]]
        fields = (record["import_key"], record["headword"], record["part_of_speech"],
                  pair["previous_en"], pair["en"], pair["vi"])
        values.append("    (" + ", ".join(map(sql_text, fields)) + f", {sql_text(pair['metadata'])}::jsonb)")
    rows_sql = ",\n".join(values)
    return f"""-- Add bilingual examples to the verified Week 4 words already imported.
-- Stops and rolls back if a target sense is missing or its examples were edited.
BEGIN;
SET LOCAL standard_conforming_strings = on;

DO $week4_examples$
DECLARE
  pair record;
  updated_count integer := 0;
BEGIN
  FOR pair IN SELECT * FROM (VALUES
{rows_sql}
  ) AS expected(import_key, headword, part_of_speech, previous_en, en, vi, metadata)
  LOOP
    UPDATE public.words w
    SET example_en = pair.en,
        example_vi = pair.vi,
        source_metadata = w.source_metadata || jsonb_build_object('examples', pair.metadata)
    WHERE w.import_key = pair.import_key
      AND w.headword = pair.headword AND w.part_of_speech = pair.part_of_speech
      AND w.example_en IS NOT DISTINCT FROM pair.previous_en
      AND w.example_vi IS NULL
      AND NOT (w.source_metadata ? 'examples');

    IF FOUND THEN
      updated_count := updated_count + 1;
    ELSIF NOT EXISTS (SELECT 1 FROM public.words w
      WHERE w.import_key = pair.import_key
        AND w.headword = pair.headword AND w.part_of_speech = pair.part_of_speech
        AND w.example_en = pair.en AND w.example_vi = pair.vi
        AND w.source_metadata -> 'examples' = pair.metadata) THEN
      RAISE EXCEPTION 'Word example is missing or was edited: % (%)', pair.headword, pair.part_of_speech;
    END IF;
  END LOOP;
  RAISE NOTICE 'Week 4 example pairs updated: % of {len(records)}', updated_count;
END $week4_examples$;

COMMIT;
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--review", type=Path, default=DEFAULT_REVIEW)
    parser.add_argument("--examples", type=Path, default=DEFAULT_EXAMPLES)
    parser.add_argument("--examples-sql", type=Path, default=DEFAULT_EXAMPLES_SQL)
    parser.add_argument("--sql", type=Path, default=DEFAULT_SQL)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--psql", default="psql")
    args = parser.parse_args()
    if not args.input.is_file():
        raise SystemExit(f"Enriched CSV not found: {args.input}")
    records, rejected = load_valid(args.input, args.review)
    deck_groups = partition_records(records)
    deck_counts = [len(group) for group in deck_groups]
    status_counts = Counter(row["status"] for row in records + rejected)
    sql = build_sql(records, args.examples)
    examples_sql = build_examples_sql(records, args.examples)
    print(json.dumps({
        "verified_records": len(records),
        "excluded_records": len(rejected),
        "translation_status_counts": dict(status_counts),
        "previous_preview_deck_counts": BASELINE_DECK_COUNTS,
        "deck_word_counts": deck_counts,
        "quiz_eligible_decks": sum(count >= 5 for count in deck_counts),
        "missing_vietnamese_meanings_in_import": 0,
        "operation": "DRY RUN ONLY" if args.dry_run else "APPLY TO DATABASE",
    }, ensure_ascii=False, indent=2))
    manifest = {
        "source": "CEFR-J Wordlist Version 1.6",
        "source_url": "https://cefr-j.org/download_eng",
        "source_file": "CEFR-J Wordlist Ver1.6.xlsx",
        "access_date": "2026-11-18",
        "filter": "Worksheet A1, POS-matched English definition, Vietnamese sense verified against Wiktionary and the specific cached sense.",
        "candidate_records": len(records) + len(rejected),
        "dictionary_successful_records": sum(r.get("dictionary_http") in {"200", "CACHE"}
                                             for r in records + rejected),
        "eligible_records": len(records),
        "translation_status_counts": dict(status_counts),
        "previous_preview_deck_counts": BASELINE_DECK_COUNTS,
        "excluded_records": [{
            "headword": r.get("headword"),
            "part_of_speech": r.get("part_of_speech"),
            "cefrj_row": r.get("cefrj_row"),
            "dictionary_http": r.get("dictionary_http"),
            "status": r["status"],
            "reason": r.get("reason") or ("HTTP 404" if r.get("dictionary_http") == "404"
                                         else "No non-empty definition matched the CEFR-J part of speech"),
        } for r in rejected],
        "eligible_words": [{"headword": r["headword"], "part_of_speech": r["part_of_speech"], "cefrj_row": int(r["cefrj_row"])} for r in records],
        "deck_plan": [
            {"name": deck_metadata(i, group)[0], "word_count": len(group),
             "distinct_answer_count": len({row["quiz_answer_key"] for row in group}),
             "quiz_eligible": len(group) >= 5,
             "cefrj_rows_in_order": [int(row["cefrj_row"]) for row in group]}
            for i, group in enumerate(deck_groups, start=1)
        ],
        "dictionary_source": "Free Dictionary API; English Wiktionary-derived, with license/provenance retained per word.",
        "fields_unverified_or_missing": {
            "meaning_vi": 0,
            "audio_url": sum(not r.get("audio_url", "").strip() for r in records),
            "independent_human_review": len(records),
        },
        "dictionary_fields_present": {
            "ipa": sum(bool(r.get("ipa", "").strip()) for r in records),
            "example_en_before_project_examples": sum(bool(r.get("example_en", "").strip()) and r["headword"] != "airport" for r in records),
        },
        "bilingual_example_pairs": len(records),
        "vietnamese_source": "Wiktionary, CC BY-SA 4.0; Kaikki raw dump from 2026-10-02 and direct entries.",
        "database_apply": "Dry-run does not write to PostgreSQL. Apply after backup and catalog verification.",
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Import manifest generated: {args.manifest}")
    args.sql.parent.mkdir(parents=True, exist_ok=True)
    args.sql.write_text(sql, encoding="utf-8")
    print(f"SQL preview generated: {args.sql}")
    args.examples_sql.parent.mkdir(parents=True, exist_ok=True)
    args.examples_sql.write_text(examples_sql, encoding="utf-8")
    print(f"Existing database example update generated: {args.examples_sql}")
    if args.apply:
        psql = shutil.which(args.psql) or (args.psql if Path(args.psql).is_file() else None)
        if not psql:
            raise SystemExit("psql not found. Install PostgreSQL CLI or pass --psql with its full path.")
        for variable in ("PGHOST", "PGPORT", "PGDATABASE", "PGUSER"):
            if not os.environ.get(variable):
                raise SystemExit(f"Set {variable} in this shell before --apply; password will be prompted by psql.")
        command = [psql, "-X", "-W", "-v", "ON_ERROR_STOP=1", "-f", str(args.sql)]
        result = subprocess.run(command, check=False)
        if result.returncode:
            raise SystemExit(result.returncode)
        print("APPLY completed. Verify row counts and deck links using the guide SQL.")


if __name__ == "__main__":
    main()
