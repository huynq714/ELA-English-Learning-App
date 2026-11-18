#!/usr/bin/env python3
"""Prepare an auditable A1 vocabulary import from the official CEFR-J xlsx.

Uses only Python's standard library. Network enrichment is sequential, cached,
and opt-in; database writes are deliberately handled by a separate SQL apply
file after review.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
IMPORT_DIR = Path(__file__).resolve().parent
DEFAULT_XLSX = IMPORT_DIR / "source" / "CEFR-J Wordlist Ver1.6.xlsx"
DEFAULT_CACHE = IMPORT_DIR / "cache"
DEFAULT_CANDIDATES = IMPORT_DIR / "data" / "cefrj_a1_candidates.csv"
DEFAULT_ENRICHED = IMPORT_DIR / "data" / "cefrj_a1_enriched.csv"
CEFRJ_URL = "https://cefr-j.org/download_eng"
CEFRJ_CITATION = "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://cefr-j.org/download_eng on {date}."
DICT_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/"
USER_AGENT = "EnglishLearningAppWeek4/1.0 (academic vocabulary import; source citations in repository)"

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"


def cell_column(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref).group(0)  # type: ignore[union-attr]
    n = 0
    for char in letters:
        n = n * 26 + ord(char) - ord("A") + 1
    return n - 1


def read_xlsx_sheet(path: Path, sheet_name: str) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        sheet = next(s for s in workbook.find(f"{{{NS_MAIN}}}sheets")
                     if s.attrib["name"] == sheet_name)
        target = targets[sheet.attrib[f"{{{NS_REL}}}id"]].lstrip("/")
        sheet_path = target if target.startswith("xl/") else f"xl/{target}"
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in item.findall(f".//{{{NS_MAIN}}}t"))
                      for item in root.findall(f"{{{NS_MAIN}}}si")]

        xml = ET.fromstring(archive.read(sheet_path))
        rows: list[list[str]] = []
        for row in xml.findall(f".//{{{NS_MAIN}}}sheetData/{{{NS_MAIN}}}row"):
            values: list[str] = []
            for cell in row.findall(f"{{{NS_MAIN}}}c"):
                index = cell_column(cell.attrib["r"])
                while len(values) <= index:
                    values.append("")
                value = cell.find(f"{{{NS_MAIN}}}v")
                text = value.text or "" if value is not None else ""
                if cell.attrib.get("t") == "s" and text:
                    text = shared[int(text)]
                inline = cell.find(f"{{{NS_MAIN}}}is/{{{NS_MAIN}}}t")
                if inline is not None:
                    text = inline.text or ""
                values[index] = text
            rows.append(values)
        return rows


def natural_key(headword: str, pos: str, cefr: str) -> str:
    normalized = "|".join((headword.casefold().strip(), pos.casefold().strip(), cefr.upper()))
    return hashlib.sha256(("cefr-j-v1.6|" + normalized).encode("utf-8")).hexdigest()


def extract_candidates(source: Path, limit: int) -> tuple[list[dict[str, str]], dict[str, int]]:
    rows = read_xlsx_sheet(source, "A1")
    headers = [h.strip() for h in rows[0]]
    index = {name: headers.index(name) for name in headers if name}
    required = {"headword", "pos", "CEFR"}
    if not required.issubset(index):
        raise ValueError(f"A1 sheet missing required columns: {sorted(required - index.keys())}")

    stats = {"source_rows": 0, "invalid_headword": 0, "not_a1": 0, "duplicates": 0}
    chosen: list[dict[str, str]] = []
    seen: set[str] = set()
    for source_row, values in enumerate(rows[1:], start=2):
        if not any(values):
            continue
        stats["source_rows"] += 1
        get = lambda name: values[index[name]].strip() if index[name] < len(values) else ""
        headword = re.sub(r"\s+", " ", get("headword")).strip()
        pos = re.sub(r"\s+", " ", get("pos")).strip().lower()
        cefr = get("CEFR").strip().upper()
        if cefr != "A1":
            stats["not_a1"] += 1
            continue
        if not headword or not re.fullmatch(r"[A-Za-z][A-Za-z '\-]*", headword) or not pos:
            stats["invalid_headword"] += 1
            continue
        key = natural_key(headword, pos, cefr)
        if key in seen:
            stats["duplicates"] += 1
            continue
        seen.add(key)
        chosen.append({
            "import_key": key,
            "headword": headword,
            "part_of_speech": pos,
            "cefr_level": cefr,
            "category_main": get("CoreInventory 1"),
            "category_sub": get("CoreInventory 2"),
            "threshold_category": get("Threshold"),
            "cefrj_worksheet": "A1",
            "cefrj_row": str(source_row),
            "cefrj_source_url": CEFRJ_URL,
            "cefrj_source_version": "1.6",
            "cefrj_citation": CEFRJ_CITATION.format(date=dt.date.today().isoformat()),
        })
        if len(chosen) >= limit:
            break
    return chosen, stats


def write_csv(path: Path, records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(records[0]) if records else []
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)


def request_json(url: str, cache_dir: Path, timeout: float = 12.0) -> tuple[object | None, str]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / (hashlib.sha256(url.encode()).hexdigest() + ".json")
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8")), "CACHE"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
                cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                return payload, str(response.status)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None, "404"
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                return None, str(error.code)
            retry_after = error.headers.get("Retry-After")
            time.sleep(min(float(retry_after), 8.0) if retry_after and retry_after.isdigit() else 1.5 * (attempt + 1))
        except (TimeoutError, urllib.error.URLError):
            if attempt == 2:
                return None, "NETWORK_ERROR"
            time.sleep(1.0 * (attempt + 1))
    return None, "NETWORK_ERROR"


def pos_matches(expected: str, actual: str) -> bool:
    aliases = {"determiner": {"determiner"}, "number": {"number", "numeral"}}
    return actual.casefold() == expected.casefold() or actual.casefold() in aliases.get(expected.casefold(), set())


def enrich(records: list[dict[str, str]], cache_dir: Path) -> list[dict[str, str]]:
    dictionary_cache: dict[str, tuple[object | None, str]] = {}
    enriched: list[dict[str, str]] = []
    last_request = 0.0
    for number, record in enumerate(records, start=1):
        word = record["headword"]
        normalized = word.casefold()
        if normalized not in dictionary_cache:
            url = DICT_BASE + urllib.parse.quote(word, safe="")
            delay = 0.35 - (time.monotonic() - last_request)
            if delay > 0:
                time.sleep(delay)
            dictionary_cache[normalized] = request_json(url, cache_dir / "dictionary")
            last_request = time.monotonic()
        dict_payload, dict_status = dictionary_cache[normalized]
        definitions = []
        ipa = ""
        example = ""
        if isinstance(dict_payload, list):
            for entry in dict_payload:
                if not isinstance(entry, dict):
                    continue
                if not ipa:
                    ipa = str(entry.get("phonetic") or "").strip()
                    for phonetic in entry.get("phonetics", []):
                        if not ipa and isinstance(phonetic, dict):
                            ipa = str(phonetic.get("text") or "").strip()
                for meaning in entry.get("meanings", []):
                    if not isinstance(meaning, dict) or not pos_matches(record["part_of_speech"], str(meaning.get("partOfSpeech", ""))):
                        continue
                    for definition in meaning.get("definitions", []):
                        if isinstance(definition, dict) and str(definition.get("definition", "")).strip():
                            definitions.append(str(definition["definition"]).strip())
                            if not example:
                                example = str(definition.get("example") or "").strip()
        definition_en = definitions[0] if definitions else ""

        result = dict(record)
        result.update({
            "definition_en": definition_en,
            "meaning_vi": "",  # verified separately in the sense review CSV
            "ipa": ipa,
            "example_en": example,
            "audio_url": "",  # external audio rights not verified; intentionally omitted
            "dictionary_http": dict_status,
            "dictionary_url": DICT_BASE + urllib.parse.quote(word, safe=""),
            "dictionary_license": "Wiktionary-derived text; CC BY-SA 3.0 or later and GFDL according to the Free Dictionary API maintainer; review attribution before redistribution",
            "retrieved_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "review_status": "SOURCE_MATCHED_NEEDS_HUMAN_REVIEW" if definition_en else "BLOCKED_MISSING_MATCHED_SOURCE_FIELD",
        })
        enriched.append(result)
        print(f"[{number}/{len(records)}] {word} ({record['part_of_speech']}): dictionary={dict_status}, en={'yes' if definition_en else 'no'}")
    return enriched


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--limit", type=int, default=60)
    parser.add_argument("--output", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--enrich", action="store_true", help="Fetch English dictionary data using cached responses when available")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--enriched-output", type=Path, default=DEFAULT_ENRICHED)
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Source workbook not found: {args.source}. Download CEFR-J Wordlist v1.6 from {CEFRJ_URL}.")
    candidates, stats = extract_candidates(args.source, args.limit)
    write_csv(args.output, candidates)
    print(json.dumps({**stats, "candidate_records_written": len(candidates), "candidate_csv": str(args.output)}, ensure_ascii=False, indent=2))
    if args.enrich:
        records = enrich(candidates, args.cache)
        write_csv(args.enriched_output, records)
        summary = {
            "records": len(records),
            "dictionary_match": sum(bool(row["definition_en"]) for row in records),
            "ready_for_review": sum(row["review_status"] == "SOURCE_MATCHED_NEEDS_HUMAN_REVIEW" for row in records),
            "audio_urls_saved": 0,
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
