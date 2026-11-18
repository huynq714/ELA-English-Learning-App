import json
import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_import_sql  # noqa: E402


class ImportBuilderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records, cls.rejected = build_import_sql.load_valid(build_import_sql.DEFAULT_INPUT)

    def test_source_matched_subset_and_deck_sizes(self):
        groups = build_import_sql.partition_records(self.records)
        self.assertEqual(43, len(self.records))
        self.assertEqual(Counter(REVIEW_REQUIRED=6, MISSING=3, ENGLISH_EXCLUDED=8),
                         Counter(row["status"] for row in self.rejected))
        self.assertEqual([20, 18, 5], [len(group) for group in groups])

    def test_no_repeated_headword_within_each_deck(self):
        for group in build_import_sql.partition_records(self.records):
            counts = Counter(record["headword"].casefold() for record in group)
            self.assertTrue(all(count == 1 for count in counts.values()))
            self.assertEqual(len(group), len({record["quiz_answer_key"] for record in group}))
            self.assertGreaterEqual(len(group), 5)

    def test_only_verified_entries_with_sourced_nonblank_meaning_are_emitted(self):
        for record in self.records:
            build_import_sql.validate_translation(record)
            self.assertTrue(record["meaning_vi"].strip())
        for invalid in ({"meaning_vi": " "}, {"meaning_vi": "this is not in the source"},
                        {"status": "REVIEW_REQUIRED"}, {"vietnamese_source_url": "https://example.com"}):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                build_import_sql.build_sql([{**self.records[0], **invalid}])

    def test_dump_based_reviews_point_to_the_cited_pos_and_gloss(self):
        sources = json.loads((build_import_sql.DEFAULT_INPUT.parent / "vi_wiktionary_candidates.json")
                             .read_text(encoding="utf-8"))
        pos_aliases = {"adjective": "adj", "adverb": "adv", "conjunction": "conj",
                       "preposition": "prep", "pronoun": "pron"}
        for record in self.records:
            pos, sense = record["sense_locator"].split(":")
            if not sense.isdigit():
                continue  # Direct Wiktionary entries are cited separately in the review CSV.
            with self.subTest(row=record["cefrj_row"]):
                self.assertEqual(pos, pos_aliases.get(record["part_of_speech"], record["part_of_speech"]))
                glosses = [item["glosses"] for entry in sources[record["headword"]]
                           if entry["pos"] == pos for item in entry["senses"]]
                self.assertEqual(record["source_evidence"], " / ".join(glosses[int(sense) - 1]))

    def test_generated_sql_is_transactional_and_non_destructive(self):
        sql = build_import_sql.build_sql(self.records)
        self.assertTrue(sql.startswith("-- Generated from CEFR-J"))
        self.assertIn("BEGIN;", sql)
        self.assertTrue(sql.rstrip().endswith("COMMIT;"))
        self.assertIn("ON CONFLICT (import_key) DO NOTHING", sql)
        self.assertIn("ON CONFLICT (deck_id, word_id) DO NOTHING", sql)
        self.assertNotRegex(sql, r"(?im)^\s*(DROP|TRUNCATE|DELETE)\b")


if __name__ == "__main__":
    unittest.main()
