#!/usr/bin/env python3
"""Extract Vietnamese Wiktionary candidates for the cached A1 English senses."""

import argparse
import csv
import gzip
import json
from collections import defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dump", type=Path, help="Kaikki Vietnamese Wiktionary raw JSONL .gz")
    parser.add_argument("--output", type=Path, default=DATA_DIR / "vi_wiktionary_candidates.json")
    args = parser.parse_args()

    with (DATA_DIR / "cefrj_a1_enriched.csv").open(encoding="utf-8-sig", newline="") as stream:
        headwords = {row["headword"] for row in csv.DictReader(stream) if row["definition_en"]}

    entries = defaultdict(list)
    with gzip.open(args.dump, mode="rt", encoding="utf-8") as stream:
        for line in stream:
            entry = json.loads(line)
            word = entry.get("word")
            if entry.get("lang_code") != "en" or word not in headwords:
                continue
            senses = [
                {key: sense[key] for key in ("glosses", "tags", "raw_tags", "topics") if key in sense}
                for sense in entry.get("senses", [])
                if sense.get("glosses")
            ]
            if senses:
                entries[word].append({"pos": entry["pos"], "senses": senses})

    args.output.write_text(json.dumps(dict(sorted(entries.items())), ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    print(f"{len(entries)}/{len(headwords)} distinct headwords have extracted English entries")


if __name__ == "__main__":
    main()
