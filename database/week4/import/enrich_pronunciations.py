#!/usr/bin/env python3
"""Create an offline SQL patch from the pinned vocabulary and Free Dictionary API recordings."""

import argparse
import csv
import json
import re
import subprocess
import unicodedata
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from pathlib import Path
from urllib.parse import parse_qs, quote, urlencode, urlsplit

from build_import_sql import DEFAULT_INPUT, load_valid, sql_text

DATA = Path(__file__).resolve().parent / "data"
API = "https://api.dictionaryapi.dev/api/v2/entries/en/"
AUDIO_HOSTS = {"api.dictionaryapi.dev", "upload.wikimedia.org"}
CC_LICENSE = re.compile(r"/(?:licenses/(?:by|by-sa)/[1-4]\.0|publicdomain/zero/1\.0)(?:/us)?/?")
ACCENTS = {"us": "en-US", "uk": "en-GB", "gb": "en-GB", "au": "en-AU", "ca": "en-CA"}


def https(url, hosts):
    if not isinstance(url, str):
        return None
    parts = urlsplit(url)
    return parts if parts.scheme == "https" and parts.netloc in hosts else None


def normalized(text):
    return unicodedata.normalize("NFC", text or "").casefold().strip()


def ipa_key(text):
    return re.sub(r"[/\[\].\s]", "", unicodedata.normalize("NFC", text or ""))


def catalogue():
    legacy, _ = load_valid(DEFAULT_INPUT)
    rows = {row["import_key"]: {
        "key": row["import_key"], "word": row["headword"], "pos": row["part_of_speech"],
        "ipa": row["ipa"], "definition_url": row["dictionary_url"],
    } for row in legacy}
    with (DATA / "topic_word_review.csv").open(encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            if row["review_status"] != "VERIFIED":
                raise ValueError(f"Unexpected unverified catalogue row for {row['headword']}")
            rows[row["import_key"]] = {
                "key": row["import_key"], "word": row["headword"], "pos": row["pos"],
                "ipa": row["ipa"], "definition_url": row["en_url"],
            }
    return list(rows.values())


def curl(*args):
    return subprocess.run(["curl", "--silent", "--show-error", "--proto", "=https", "--max-time", "12",
                           "--retry", "1", "--retry-max-time", "18", *args], capture_output=True, check=True).stdout


def dictionary_entry(word, cache):
    cache_file = cache / (quote(word, safe="") + ".json")
    if cache_file.exists():
        value = json.loads(cache_file.read_text(encoding="utf-8"))
        return value if isinstance(value, list) else []
    response = curl("--compressed", "--location", "--max-redirs", "2", "--write-out", "\n%{http_code}",
                    API + quote(word, safe=""))
    body, _, status = response.rpartition(b"\n")
    if status == b"404":
        value = []
    elif status == b"200":
        value = json.loads(body)
        if not isinstance(value, list):
            raise ValueError(f"Unexpected dictionary response for {word}")
    else:
        raise ValueError(f"Dictionary request failed for {word} (HTTP {status.decode(errors='replace')})")
    cache_file.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return value if isinstance(value, list) else []


def audio_source(entry, phonetic):
    url = phonetic.get("audio")
    if isinstance(url, str) and url.startswith("//"):
        url = "https:" + url
    audio = https(url, AUDIO_HOSTS)
    source = phonetic.get("sourceUrl")
    if isinstance(source, str) and source.startswith("//"):
        source = "https:" + source
    credit = https(source, {"commons.wikimedia.org", "en.wiktionary.org"})
    license_data = phonetic.get("license") or {}
    license_url = https(license_data.get("url"), {"creativecommons.org", "www.creativecommons.org"})
    if (not audio or not credit or not license_url or not CC_LICENSE.fullmatch(license_url.path)
            or not audio.path.lower().endswith((".mp3", ".ogg", ".wav"))
            or not license_data.get("name")):
        return None
    api_url = API + quote(entry["word"], safe="")
    suffix = re.search(r"[-_]([a-z]{2})\.[a-z0-9]+$", audio.path.lower())
    return {"source": "Free Dictionary API", "url": source, "apiUrl": api_url, "dictionaryAudioUrl": url,
            "audioUrl": url,
            "license": license_data["name"], "licenseUrl": license_data["url"],
            "accent": ACCENTS.get(suffix[1]) if suffix else None, "ipa": phonetic.get("text") or None}


def candidates(record, entries):
    same_word = [item for item in entries if normalized(item.get("word")) == normalized(record["word"])]
    expected = ipa_key(record["ipa"])
    pronunciations = {ipa_key(phonetic.get("text"))
                      for entry in same_word for phonetic in entry.get("phonetics", []) if phonetic.get("text")}
    # When an entry mixes pronunciations, require the recording's phonetic to match the card.
    unambiguous = len(pronunciations) == 1 and (not expected or expected in pronunciations)
    matches = []
    for entry in same_word:
        parts = {normalized(meaning.get("partOfSpeech")) for meaning in entry.get("meanings", [])}
        if normalized(record["pos"]) not in parts:
            continue
        for phonetic in entry.get("phonetics", []):
            candidate = audio_source(entry, phonetic)
            if not candidate:
                continue
            recorded = ipa_key(candidate["ipa"])
            exact = bool(expected and recorded == expected)
            if exact or (unambiguous and (recorded or len(same_word) == 1)):
                accent = {"en-US": 0, "en-GB": 1}.get(candidate["accent"], 2)
                matches.append(((not exact, accent, not candidate["accent"], candidate["audioUrl"]), candidate))
    return [candidate for _, candidate in sorted(matches, key=lambda match: match[0])]


def reachable(url):
    # Check the response and file signature. Only URLs are included in the SQL patch.
    try:
        raw = curl("--retry", "0", "--max-filesize", "1048576", "--write-out", "\n%{http_code} %{content_type}",
                   "--user-agent", "ELAVocabulary/1.0 (English Learning App study project)", url)
    except subprocess.CalledProcessError:
        return False
    body, _, result = raw.rpartition(b"\n")
    status, _, media = result.partition(b" ")
    if status != b"200":
        return False
    if media == b"audio/mpeg":
        return body.startswith(b"ID3") or (len(body) > 4 and body[0] == 255 and body[1] & 224 == 224)
    if media in {b"audio/wav", b"audio/x-wav"}:
        return body.startswith(b"RIFF") and body[8:12] == b"WAVE"
    return media == b"audio/mp4" and body[4:8] == b"ftyp"


def commons_id(credit_url):
    parsed = urlsplit(credit_url)
    if parsed.hostname == "commons.wikimedia.org":
        return next(iter(parse_qs(parsed.query).get("curid", [])), None)


def commons_files(candidates_by_word):
    ids = sorted({key for group in candidates_by_word for item in group if (key := commons_id(item["url"]))
                  and key.isdigit()})
    recordings = {}
    for begin in range(0, len(ids), 5):
        query = urlencode({
            "action": "query", "prop": "videoinfo", "viprop": "url|mime|derivatives|extmetadata",
            "viextmetadatafilter": "Artist|LicenseShortName|LicenseUrl", "format": "json",
            "pageids": "|".join(ids[begin:begin + 5]),
        })
        response = json.loads(curl("--fail", "--location", "--max-redirs", "2", "--user-agent",
                                   "ELAVocabulary/1.0 (English Learning App study project)",
                                   "https://commons.wikimedia.org/w/api.php?" + query))
        for page_id, page in response["query"]["pages"].items():
            info = next(iter(page.get("videoinfo", [])), {})
            meta = info.get("extmetadata", {})
            author = " ".join(unescape(re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).split())
            license_name = meta.get("LicenseShortName", {}).get("value")
            license_url = meta.get("LicenseUrl", {}).get("value", "").replace("http://", "https://", 1)
            license_parsed = https(license_url, {"creativecommons.org", "www.creativecommons.org"})
            url = next((item["src"] for item in info.get("derivatives", []) if item.get("type") == "audio/mpeg"), None)
            if not url and info.get("mime") in {"audio/mpeg", "audio/wav", "audio/mp4", "audio/x-wav"}:
                url = info.get("url")
            if (url and https(url, {"upload.wikimedia.org"}) and license_name and license_parsed
                    and CC_LICENSE.fullmatch(license_parsed.path) and author):
                recordings[page_id] = {"audioUrl": url.split("?")[0], "author": author,
                                       "license": license_name, "licenseUrl": license_url}
    return recordings


def json_sql(value):
    return sql_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"))) + "::jsonb" if value else "NULL::jsonb"


def build_sql(rows):
    values = ",\n".join(
        "(" + ", ".join([sql_text(row["key"]), sql_text(row["word"]), sql_text(row["ipa"]),
                         sql_text(row["definition_url"]), json_sql(row["ipa_source"]),
                         sql_text(row["audio"]["audioUrl"] if row["audio"] else None), json_sql(row["audio"])]) + ")"
        for row in rows
    )
    return f"""-- Generated by enrich_pronunciations.py. Apply after the vocabulary data imports.
-- Updates only pronunciation fields for matching imported rows. Re-running is safe.
BEGIN;
SET LOCAL standard_conforming_strings = on;
WITH verified(import_key, headword, ipa, definition_url, ipa_source, audio_url, audio_source) AS (
    VALUES
{values}
), changes AS (
    SELECT w.id,
           CASE WHEN v.ipa_source IS NOT NULL AND w.ipa = v.ipa
                     AND w.source_metadata #>> '{{dictionary,url}}' = v.definition_url
                     AND w.source_metadata #> '{{pronunciation,ipa}}' IS NULL
                THEN v.ipa_source END AS ipa_source,
           CASE WHEN w.audio_url IS NULL AND w.source_metadata #> '{{pronunciation,audio}}' IS NULL
                THEN v.audio_source END AS audio_source,
           v.audio_url
    FROM public.words w JOIN verified v USING (import_key)
    WHERE w.headword = v.headword
    FOR UPDATE OF w
)
UPDATE public.words w
SET audio_url = CASE WHEN c.audio_source IS NOT NULL THEN c.audio_url ELSE w.audio_url END,
    source_metadata = jsonb_set(w.source_metadata, '{{pronunciation}}',
        COALESCE(w.source_metadata -> 'pronunciation', '{{}}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object('ipa', c.ipa_source, 'audio', c.audio_source)))
FROM changes c
WHERE w.id = c.id AND (c.ipa_source IS NOT NULL OR c.audio_source IS NOT NULL);
COMMIT;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=DATA / "apply_pronunciations.sql")
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    rows = sorted(catalogue(), key=lambda row: (row["word"], row["pos"], row["key"]))
    words = sorted({row["word"] for row in rows})
    with ThreadPoolExecutor(max_workers=4) as pool:
        entries = dict(zip(words, pool.map(lambda word: dictionary_entry(word, args.cache_dir), words)))
        candidates_by_word = [candidates(row, entries[row["word"]]) for row in rows]
        files = commons_files(candidates_by_word)
        # Use the publisher's iOS-compatible file for the same Commons recording.
        # The API's own URL remains in the evidence even when its mirror is unavailable.
        possible = [[item | files[key] for item in group if (key := commons_id(item["url"])) in files]
                    for group in candidates_by_word]
        urls = sorted({item["audioUrl"] for group in possible for item in group})
        valid = dict(zip(urls, pool.map(reachable, urls)))
    tally = Counter()
    for row, possible_audio in zip(rows, possible):
        row["audio"] = next((item for item in possible_audio if valid[item["audioUrl"]]), None)
        # Both import builders take IPA (when present) from their selected English dictionary entry.
        source = https(row["definition_url"], {"api.dictionaryapi.dev", "en.wiktionary.org"})
        row["ipa_source"] = ({"source": "Free Dictionary API" if source.hostname == "api.dictionaryapi.dev"
                              else "English Wiktionary", "url": row["definition_url"], "text": row["ipa"]}
                             if row["ipa"] and source else None)
        tally[row["audio"]["accent"] or "accent unknown" if row["audio"] else "without audio"] += 1
    args.output.write_text(build_sql(rows), encoding="utf-8")
    print(f"{len(rows)} imported records, {len(urls)} candidate URLs checked: {dict(tally)}", flush=True)


if __name__ == "__main__":
    main()
