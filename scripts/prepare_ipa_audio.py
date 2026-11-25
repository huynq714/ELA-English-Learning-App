"""Create a checked example-word audio manifest without synthetic IPA speech."""

import json
import re
import subprocess
import sys
import time
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "database" / "week4" / "import"))
from enrich_pronunciations import audio_source, commons_files, curl, dictionary_entry, ipa_key  # noqa: E402

CATALOGUE = ROOT / "src" / "features" / "ipa" / "catalogue.ts"
OUTPUT = ROOT / "src" / "features" / "ipa" / "word-audio.ts"
CACHE = ROOT / ".artifacts" / "ipa-dictionary-cache"


def words():
    rows = re.findall(r"^\s*\['[^']+', '[^']+', '[^']+', '([^']+)', '([^']+)', '([^']+)', '([^']+)'\]",
                      CATALOGUE.read_text(encoding="utf-8"), re.MULTILINE)
    if len(rows) != 44:
        raise RuntimeError(f"Expected 44 catalogue rows, found {len(rows)}")
    result = {}
    for first, first_ipa, second, second_ipa in rows:
        result.setdefault(first, set()).add(ipa_key(first_ipa))
        result.setdefault(second, set()).add(ipa_key(second_ipa))
    return result


def candidates(word, expected):
    found = []
    try:
        entries = dictionary_entry(word, CACHE)
        for entry in entries:
            if entry.get("word", "").casefold() != word.casefold():
                continue
            phonetics = entry.get("phonetics", [])
            known = {ipa_key(item.get("text")) for item in phonetics if item.get("text")}
            for phonetic in phonetics:
                item = audio_source(entry, phonetic)
                if not item:
                    continue
                recorded = ipa_key(item.get("ipa"))
                if recorded and recorded not in expected:
                    continue
                if not recorded and len(known) != 1:
                    continue
                found.append(item)
    except Exception as exc:
        print(f"{word}: dictionary unavailable ({type(exc).__name__})")
    return word, sorted(found, key=lambda item: (item.get("accent") != "en-GB", item.get("accent") != "en-US"))


def commons_example_audio(expected):
    """Exact named word clips, with accent left unknown unless the filename says UK."""
    titles = [(word, prefix, f"File:{prefix}{word}.ogg")
              for word in expected for prefix in ("En-uk-", "En-gb-", "En-us-", "En-")]
    found = {}
    for begin in range(0, len(titles), 40):
        group = titles[begin:begin + 40]
        query = urlencode({"action": "query", "titles": "|".join(row[2] for row in group),
                           "prop": "videoinfo", "viprop": "url|mime|derivatives|extmetadata", "format": "json"})
        response = json.loads(curl("--fail", "--location", "--user-agent", "ELA-IPA/1.0 (academic project)",
                                   "https://commons.wikimedia.org/w/api.php?" + query))
        for page in response["query"]["pages"].values():
            if "missing" in page:
                continue
            title = page["title"].removeprefix("File:")
            key = next(((word, prefix) for word, prefix, name in group if name.removeprefix("File:").casefold() == title.casefold()), None)
            if not key:
                continue
            word, prefix = key
            info = next(iter(page.get("videoinfo", [])), {})
            meta = info.get("extmetadata", {})
            license_name = meta.get("LicenseShortName", {}).get("value", "")
            if license_name not in {"CC0", "CC BY-SA 3.0", "CC BY-SA 4.0", "CC BY 3.0", "CC BY 4.0"}:
                continue
            author = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
            url = next((item["src"] for item in info.get("derivatives", []) if item.get("type") == "audio/mpeg"), None)
            if not author or not url or not url.startswith("https://upload.wikimedia.org/"):
                continue
            item = {"url": url.split("?")[0], "accent": "en-GB" if prefix in {"En-uk-", "En-gb-"} else "en-US" if prefix == "En-us-" else "unknown",
                    "ipa": "", "credit": "https://commons.wikimedia.org/wiki/" + page["title"].replace(" ", "_"),
                    "author": author, "license": license_name,
                    "licenseUrl": meta.get("LicenseUrl", {}).get("value", "").replace("http://", "https://", 1)}
            found.setdefault(word, []).append(item)
    return found


def media_reachable(url):
    # Commons supplies the transcode URL; accept it only when the final HEAD
    # response serves MP3. Playback still handles a later network failure.
    for attempt in range(2):
        result = subprocess.run(["curl.exe", "--head", "--location", "--silent", "--show-error",
                                 "--proto", "=https", "--max-time", "8", url], capture_output=True)
        headers = result.stdout.decode("latin-1", errors="replace").lower()
        final = headers.split("http/")[-1]
        if result.returncode == 0 and (final.startswith("1.1 200") or final.startswith("2 200")):
            if "content-type: audio/mpeg" in final:
                return True
        time.sleep(0.3 * (attempt + 1))
    return False


def british_dictionary_audio(expected):
    """Require Commons title to be the exact UK word, and UK IPA to match catalogue."""
    candidate_ids = {}
    for word, expected_ipas in expected.items():
        path = CACHE / (word + ".json")
        if not path.exists():
            continue
        for entry in json.loads(path.read_text(encoding="utf-8")):
            if entry.get("word", "").casefold() != word.casefold():
                continue
            for phonetic in entry.get("phonetics", []):
                audio_url = phonetic.get("audio") or ""
                source = phonetic.get("sourceUrl") or ""
                if not audio_url.endswith("-uk.mp3") or "curid=" not in source:
                    continue
                recorded = ipa_key(phonetic.get("text")).replace("ɹ", "r").replace("(", "").replace(")", "")
                allowed = {ipa.replace("ɹ", "r") for ipa in expected_ipas}
                if recorded not in allowed:
                    continue
                page_id = source.split("curid=")[-1]
                if page_id.isdigit():
                    candidate_ids.setdefault(page_id, []).append((word, phonetic.get("text") or ""))
    results = {}
    ids = list(candidate_ids)
    for begin in range(0, len(ids), 30):
        query = urlencode({"action": "query", "pageids": "|".join(ids[begin:begin + 30]),
                           "prop": "videoinfo", "viprop": "url|mime|derivatives|extmetadata", "format": "json"})
        response = json.loads(curl("--fail", "--location", "--user-agent", "ELA-IPA/1.0 (academic project)",
                                   "https://commons.wikimedia.org/w/api.php?" + query))
        for page_id, page in response["query"]["pages"].items():
            title = page.get("title", "")
            info = next(iter(page.get("videoinfo", [])), {})
            meta = info.get("extmetadata", {})
            license_name = meta.get("LicenseShortName", {}).get("value", "")
            license_url = meta.get("LicenseUrl", {}).get("value", "").replace("http://", "https://", 1)
            author = unescape(re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).strip()
            url = next((item["src"] for item in info.get("derivatives", []) if item.get("type") == "audio/mpeg"), None)
            if (not url or not url.startswith("https://upload.wikimedia.org/") or not author
                    or "assumed" in author.casefold()
                    or not re.match(r"^CC (?:BY(?:-SA)?|0)", license_name, re.IGNORECASE)
                    or not license_url.startswith("https://creativecommons.org/")):
                continue
            for word, transcription in candidate_ids[page_id]:
                if title.casefold() not in {f"file:en-uk-{word}.ogg", f"file:en-gb-{word}.ogg"}:
                    continue
                if not media_reachable(url):
                    continue
                results[word] = {"url": url.split("?")[0], "accent": "en-GB", "ipa": transcription,
                                 "credit": "https://commons.wikimedia.org/wiki/" + title.replace(" ", "_"),
                                 "author": author, "license": license_name, "licenseUrl": license_url}
    return results


def write_manifest(selected):
    lines = ["// Recordings checked against Free Dictionary API, Wikimedia Commons license and media signature.",
             "export const ipaWordAudio: Record<string, { url: string; accent: string; ipa: string; credit: string; author: string; license: string; licenseUrl: string }> = {"]
    for word, item in sorted(selected.items()):
        lines.append(f"  {json.dumps(word)}: {json.dumps(item, ensure_ascii=False)},")
    lines.append("};\n")
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")


def existing_manifest():
    return {word: json.loads(value) for word, value in re.findall(
        r'^  "([^"]+)": (\{.*\}),$', OUTPUT.read_text(encoding="utf-8"), re.MULTILINE)}


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    expected = words()
    if "--uk-only" in sys.argv:
        selected = existing_manifest()
        selected.update(british_dictionary_audio(expected))
        write_manifest(selected)
        print(f"Verified audio: {len(selected)}/{len(expected)} unique words; UK: {sum(v['accent'] == 'en-GB' for v in selected.values())}")
        return
    by_word = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for future in as_completed([pool.submit(candidates, word, value) for word, value in expected.items()]):
            word, by_word[word] = future.result()
    verified_files = commons_files(by_word.values())
    selected = {}
    for word, options in by_word.items():
        for item in options:
            page_id = item["url"].split("curid=")[-1] if "curid=" in item["url"] else ""
            verified = verified_files.get(page_id)
            if not verified or "assumed" in verified["author"].casefold() or not media_reachable(verified["audioUrl"]):
                continue
            selected[word] = {
                "url": verified["audioUrl"], "accent": item.get("accent") or "unknown",
                "ipa": item.get("ipa") or "", "credit": item["url"],
                "author": verified["author"], "license": verified["license"],
                "licenseUrl": verified["licenseUrl"],
            }
            break
    legacy_sql = (ROOT / "database" / "week4" / "import" / "data" / "apply_pronunciations.sql").read_text(encoding="utf-8")
    legacy_rows = re.findall(
        r"^\('[a-f0-9]{64}', '([^']+)', '([^']*)', .*?, '(https://upload\.wikimedia\.org/[^']+)', '(\{.*?\})'::jsonb\)",
        legacy_sql, re.MULTILINE)
    print(f"Previously verified SQL recordings found: {len(legacy_rows)}")
    for word, row_ipa, url, metadata in legacy_rows:
        if word in selected or word not in expected or ipa_key(row_ipa) not in expected[word]:
            continue
        item = json.loads(metadata)
        if (not item.get("author") or "assumed" in item["author"].casefold()
                or not item.get("license") or not item.get("url") or not media_reachable(url)):
            continue
        selected[word] = {"url": url, "accent": item.get("accent") or "unknown",
                          "ipa": row_ipa, "credit": item["url"], "author": item["author"],
                          "license": item["license"], "licenseUrl": item["licenseUrl"]}
    commons = commons_example_audio(expected)
    print(f"Exact-name Commons word recordings found: {len(commons)}")
    for word, options in commons.items():
        if word in selected:
            continue
        for item in sorted(options, key=lambda candidate: candidate["accent"] != "en-GB"):
            if media_reachable(item["url"]):
                selected[word] = item
                break
    selected.update(british_dictionary_audio(expected))
    write_manifest(selected)
    print(f"Verified audio: {len(selected)}/{len(expected)} unique words")


if __name__ == "__main__":
    main()
