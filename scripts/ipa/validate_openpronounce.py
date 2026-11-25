"""Diagnostic for official OpenPronounce 1.1.0 using human Commons recordings.

Run only after explicitly allowing the large model download in an isolated
local or Colab environment. This script never authorizes production scoring.
"""

import json
import math
import os
import ssl
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path


CLIPS = {
    "day": "File:En-day.ogg",
    "they": "File:En-they.ogg",
    "ship": "File:En-us-ship.ogg",
    "sheep": "File:En-us-sheep.ogg",
}
USER_AGENT = "ELA-IPA-validation/1.0 (academic research; https://github.com/huynq714/ELA-English-Learning-App)"


def commons_clip(title: str, destination: Path) -> dict:
    import certifi
    tls = ssl.create_default_context(cafile=certifi.where())
    query = urllib.parse.urlencode({
        "action": "query", "format": "json", "titles": title,
        "prop": "imageinfo", "iiprop": "url|mime|extmetadata",
    })
    request = urllib.request.Request(
        "https://commons.wikimedia.org/w/api.php?" + query,
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=30, context=tls) as response:
        pages = json.load(response)["query"]["pages"]
    page = next(iter(pages.values()))
    if "missing" in page or page.get("title", "").casefold() != title.casefold():
        raise RuntimeError(f"Commons clip not found: {title}")
    info = page["imageinfo"][0]
    meta = info["extmetadata"]
    license_name = meta.get("LicenseShortName", {}).get("value", "")
    if not license_name.startswith(("CC BY", "CC0")):
        raise RuntimeError(f"Clip license needs review: {title}: {license_name}")
    url = info["url"]
    if not url.startswith("https://upload.wikimedia.org/") or info.get("mime") not in {"audio/ogg", "application/ogg"}:
        raise RuntimeError(f"Unexpected media: {title}")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=30, context=tls) as response:
        payload = response.read(2_000_001)
    if len(payload) > 2_000_000 or not payload.startswith(b"OggS"):
        raise RuntimeError(f"Media too large or invalid: {title}")
    destination.write_bytes(payload)
    return {"title": title, "source": info.get("descriptionurl", "https://commons.wikimedia.org/wiki/" + title), "license": license_name}


def wav_samples(source: Path, destination: Path):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(source), "-ac", "1", "-ar", "16000", str(destination)],
        check=True, capture_output=True, timeout=30,
    )
    import soundfile as sf
    samples, rate = sf.read(destination)
    if rate != 16000 or samples.ndim != 1 or not len(samples):
        raise ValueError("Invalid decoded audio")
    return samples


def assess(samples, expected: str) -> dict:
    from openpronounce import assess as openpronounce_assess
    result = openpronounce_assess(samples, expected, lang="en")
    score = result.get("score")
    if not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 100:
        raise ValueError("Provider returned an invalid score")
    return {
        "score": round(float(score), 2),
        "reliable": result.get("reliable"),
        "reasons": result.get("reasons"),
        "audio_quality": result.get("audio_quality"),
        "transcript": result.get("transcribe"),
        "scores": result.get("scores"),
        "differences": result.get("differences"),
        "phoneme_error_rate": result.get("differences", {}).get("phoneme_error_rate"),
        "alignment": result.get("differences", {}).get("alignment"),
    }


def diagnostic(spoken: str, expected: str, samples) -> dict:
    started = time.perf_counter()
    try:
        return {"spoken": spoken, "expected": expected, **assess(samples, expected),
                "elapsed_seconds": round(time.perf_counter() - started, 2)}
    except Exception as exc:
        return {"spoken": spoken, "expected": expected, "provider_error": type(exc).__name__,
                "elapsed_seconds": round(time.perf_counter() - started, 2)}


def main():
    if os.environ.get("ELA_ALLOW_LOCAL_OPENPRONOUNCE") != "1":
        raise SystemExit("Set ELA_ALLOW_LOCAL_OPENPRONOUNCE=1 to allow model downloads for this diagnostic.")
    import numpy as np
    import soundfile as sf

    with tempfile.TemporaryDirectory(prefix="ela-openpronounce-") as temp:
        root = Path(temp)
        clips = {}
        sources = {}
        for word, title in CLIPS.items():
            source = root / f"{word}.ogg"
            sources[word] = commons_clip(title, source)
            clips[word] = wav_samples(source, root / f"{word}.wav")
        cases = []
        for spoken, expected in (
            ("day", "day"), ("they", "they"), ("day", "they"), ("they", "day"),
            ("ship", "ship"), ("sheep", "sheep"), ("ship", "sheep"), ("sheep", "ship"),
        ):
            cases.append(diagnostic(spoken, expected, clips[spoken]))

        # Negative controls diagnose raw model behavior; they do not demonstrate
        # scoring accuracy or authorize production. No synthetic sample is a positive case.
        silence = np.zeros(16000, dtype=np.float32)
        noise = np.random.default_rng(20261125).normal(0, 0.08, 16000).astype(np.float32)
        cases.append(diagnostic("digital silence", "day", silence))
        cases.append(diagnostic("synthetic broadband noise", "day", noise))
        corrupt = root / "corrupt.wav"
        corrupt.write_bytes(b"not an audio file")
        try:
            sf.read(corrupt)
            cases.append({"spoken": "corrupt", "result": "UNSAFE: decoder accepted invalid bytes"})
        except Exception:
            cases.append({"spoken": "corrupt", "result": "UNASSESSABLE: decode rejected"})

        report = {
            "provider": "OpenPronounce", "source_clips": sources, "cases": cases,
            "decision": "DIAGNOSTIC ONLY: no speech/noise gate or multi-speaker calibration; do not enable scoring",
        }
        output = os.environ.get("ELA_IPA_RESULT_PATH")
        if output:
            Path(output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"provider": report["provider"], "result_path": output,
                          "case_count": len(cases), "decision": report["decision"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
