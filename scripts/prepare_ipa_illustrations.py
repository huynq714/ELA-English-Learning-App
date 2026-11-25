"""Fetch licensed Commons articulation diagrams; never substitute an unverified image."""

import json
import hashlib
import re
import subprocess
from html import unescape
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "ipa"
MODULE = ROOT / "src" / "features" / "ipa" / "illustrations.ts"
AGENT = "ELA-academic-IPA/1.0 (learning project; Commons API)"

# Exact sagittal sections where available. A general vowel chart is explicitly
# labelled as a reference, not an illustration of a particular mouth shape.
SOUNDS = {
    "fleece": ("IPA i Sagittal Section.svg", "Khẩu hình /i/ (tham khảo cho /iː/)", "approx"),
    "kit": ("IPA Ɪ Sagittal Section.svg", "Khẩu hình /ɪ/", "exact"),
    "foot": ("IPA Ʊ Sagittal Section.svg", "Khẩu hình /ʊ/", "exact"),
    "goose": ("IPA u Sagittal Section.svg", "Khẩu hình /u/ (tham khảo cho /uː/)", "approx"),
    "dress": ("IPA Ɛ Sagittal Section.svg", "Khẩu hình /ɛ/ (gần /e/ trong bảng học)", "approx"),
    "schwa": ("Neutral Sagittal Section.svg", "Vị trí miệng trung tính; không mô tả chính xác /ə/", "reference"),
    "nurse": ("IPA vowel trapezium.svg", "Sơ đồ nguyên âm tham khảo; chưa có khẩu hình /ɜː/", "reference"),
    "thought": ("IPA vowel trapezium.svg", "Sơ đồ nguyên âm tham khảo; chưa có khẩu hình /ɔː/", "reference"),
    "trap": ("IPA æ Sagittal Section.svg", "Khẩu hình /æ/", "exact"),
    "strut": ("IPA vowel trapezium.svg", "Sơ đồ nguyên âm tham khảo; chưa có khẩu hình /ʌ/", "reference"),
    "palm": ("IPA a Sagittal Section.svg", "Khẩu hình /a/ (tham khảo cho /ɑː/)", "approx"),
    "lot": ("IPA vowel trapezium.svg", "Sơ đồ nguyên âm tham khảo; chưa có khẩu hình /ɒ/", "reference"),
    "face": ("IPA vowel trapezium.svg", "Sơ đồ vị trí nguyên âm; /eɪ/ chuyển từ /e/ đến /ɪ/", "reference"),
    "price": ("IPA vowel trapezium.svg", "Sơ đồ vị trí nguyên âm; /aɪ/ chuyển về /ɪ/", "reference"),
    "choice": ("IPA vowel trapezium.svg", "Sơ đồ vị trí nguyên âm; /ɔɪ/ chuyển về /ɪ/", "reference"),
    "goat": ("IPA vowel trapezium.svg", "Sơ đồ vị trí nguyên âm; /əʊ/ chuyển về /ʊ/", "reference"),
    "mouth": ("IPA vowel trapezium.svg", "Sơ đồ vị trí nguyên âm; /aʊ/ chuyển về /ʊ/", "reference"),
    "near": ("IPA vowel trapezium.svg", "Sơ đồ vị trí nguyên âm; /ɪə/ chuyển về /ə/", "reference"),
    "square": ("IPA vowel trapezium.svg", "Sơ đồ vị trí nguyên âm; /eə/ chuyển về /ə/", "reference"),
    "cure": ("IPA vowel trapezium.svg", "Sơ đồ vị trí nguyên âm; /ʊə/ chuyển về /ə/", "reference"),
    "p": ("IPA p Sagittal Section.svg", "Vị trí cấu âm /p/", "exact"),
    "b": ("IPA b Sagittal Section.svg", "Vị trí cấu âm /b/", "exact"),
    "t": ("IPA t Sagittal Section.svg", "Vị trí cấu âm /t/", "exact"),
    "d": ("IPA d Sagittal Section.svg", "Vị trí cấu âm /d/", "exact"),
    "k": ("IPA k Sagittal Section.svg", "Vị trí cấu âm /k/", "exact"),
    "g": ("IPA g Sagittal Section.svg", "Vị trí cấu âm /ɡ/", "exact"),
    "ch": ("Voiceless palato-alveolar fricative articulation.svg", "Vị trí lưỡi khi nhả /tʃ/; chưa minh họa giai đoạn tắc", "approx"),
    "j-affricate": ("Voiced palato-alveolar fricative articulation.svg", "Vị trí lưỡi khi nhả /dʒ/; chưa minh họa giai đoạn tắc", "approx"),
    "f": ("IPA F Sagittal Section.svg", "Vị trí cấu âm /f/", "exact"),
    "v": ("IPA v Sagittal Section.svg", "Vị trí cấu âm /v/", "exact"),
    "th": ("IPA θ Sagittal Section.svg", "Vị trí cấu âm /θ/", "exact"),
    "dh": ("IPA ð Sagittal Section.svg", "Vị trí cấu âm /ð/", "exact"),
    "s": ("IPA s laminal Sagittal Section.svg", "Một cách đặt lưỡi cho /s/", "approx"),
    "z": ("IPA z laminal Sagittal Section.svg", "Một cách đặt lưỡi cho /z/", "approx"),
    "sh": ("IPA ʃ laminal Sagittal Section.svg", "Một cách đặt lưỡi cho /ʃ/", "approx"),
    "zh": ("IPA apical Ʒ Sagittal Section.svg", "Một cách đặt lưỡi cho /ʒ/", "approx"),
    "m": ("IPA m Sagittal Section.svg", "Vị trí cấu âm /m/", "exact"),
    "n": ("IPA n Sagittal Section.svg", "Vị trí cấu âm /n/", "exact"),
    "ng": ("IPA ŋ Sagittal Section.svg", "Vị trí cấu âm /ŋ/", "exact"),
    "h": ("Neutral Sagittal Section.svg", "Sơ đồ trung tính; chưa có hình luồng hơi thanh môn /h/", "reference"),
    "l": ("PlaceOfArticulation.svg", "Sơ đồ vị trí cấu âm; chưa có khẩu hình riêng /l/", "reference"),
    "r": ("Voiced postalveolar approximant.svg", "Một cách đặt lưỡi cho /r/ tiếng Anh", "approx"),
    "w": ("Voiced labial-velar approximant.svg", "Vị trí cấu âm /w/", "exact"),
    "y": ("Voiced palatal approximant.svg", "Vị trí cấu âm /j/", "exact"),
}


def fetch(url):
    return subprocess.run(["curl.exe", "--fail", "--location", "--silent", "--show-error",
                           "--proto", "=https", "--max-time", "30", "--user-agent", AGENT, url],
                          capture_output=True, check=True).stdout


def main():
    DEST.mkdir(exist_ok=True)
    unique = sorted({entry[0] for entry in SOUNDS.values()})
    query = urlencode({"action": "query", "titles": "|".join("File:" + name for name in unique),
                       "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 360,
                       "format": "json"})
    pages = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + query))["query"]["pages"]
    files = {}
    for page in pages.values():
        name = page["title"].removeprefix("File:")
        info = page.get("imageinfo", [{}])[0]
        meta = info.get("extmetadata", {})
        license_name = meta.get("LicenseShortName", {}).get("value", "")
        if license_name not in {"CC0", "CC BY-SA 3.0", "CC BY-SA 4.0", "CC BY 3.0", "CC BY 4.0"}:
            raise RuntimeError(f"License not approved for {name}: {license_name}")
        thumb = info.get("thumburl")
        if not thumb or not thumb.startswith("https://"):
            raise RuntimeError(f"Missing HTTPS thumbnail for {name}")
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        slug += "-" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
        path = DEST / (slug + ".png")
        if not path.exists():
            content = fetch(thumb)
            if not content.startswith(b"\x89PNG\r\n\x1a\n"):
                raise RuntimeError(f"Invalid PNG for {name}")
            path.write_bytes(content)
        author = unescape(re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).strip()
        license_url = meta.get("LicenseUrl", {}).get("value", "").replace("http://", "https://", 1)
        files[name] = (path, license_name, "https://commons.wikimedia.org/wiki/File:" + name.replace(" ", "_"), author, license_url)
    lines = ["// Verified Wikimedia Commons diagrams. See media attribution below.",
             "export const ipaIllustrations = {"]
    for key, (name, caption, fidelity) in SOUNDS.items():
        path, license_name, page, author, license_url = files[name]
        lines.append(f"  {json.dumps(key)}: {{ source: require('../../../assets/ipa/{path.name}'), caption: {json.dumps(caption, ensure_ascii=False)}, fidelity: {json.dumps(fidelity)}, credit: {json.dumps(page)}, license: {json.dumps(license_name)}, author: {json.dumps(author, ensure_ascii=False)}, licenseUrl: {json.dumps(license_url)} }},")
    lines.append("} as const;\n")
    MODULE.write_text("\n".join(lines), encoding="utf-8")
    print(f"Prepared {len(files)} licensed images for {len(SOUNDS)} sounds")


if __name__ == "__main__":
    main()
