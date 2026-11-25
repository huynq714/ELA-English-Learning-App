# OpenPronounce pronunciation scoring diagnostic

Use the official [OpenPronounce repository](https://github.com/OpenPronounce/OpenPronounce), version 1.1.0. This diagnostic does **not** enable scoring in ELA. It uses human Wikimedia Commons recordings for correct and swapped `day/they` and `ship/sheep`; digital silence, synthetic broadband noise, and invalid bytes are negative controls. Synthetic controls do not prove pronunciation accuracy.

## Local result, 2026-11-25

The official PyPI release 1.1.0 ran on this Windows CPU in an isolated virtual environment. The four human clips are [day](https://commons.wikimedia.org/wiki/File:En-day.ogg) and [they](https://commons.wikimedia.org/wiki/File:En-they.ogg) (CC BY-SA 4.0), [ship](https://commons.wikimedia.org/wiki/File:En-us-ship.ogg) and [sheep](https://commons.wikimedia.org/wiki/File:En-us-sheep.ogg) (CC BY-SA 3.0). Scores below are raw diagnostic values; `reliable=false` means the score must not be shown to a learner.

| Spoken clip | Expected | Raw score | Reliable | Elapsed |
| --- | --- | ---: | --- | ---: |
| day | day | 80.7 | no | 39.11 s |
| they | they | 80.4 | yes | 11.63 s |
| day | they | 74.7 | no | 5.54 s |
| they | day | 79.4 | yes | 5.04 s |
| ship | ship | 84.2 | yes | 3.74 s |
| sheep | sheep | 86.9 | yes | 3.39 s |
| ship | sheep | 77.1 | yes | 4.60 s |
| sheep | ship | **80.4** | **yes** | 5.61 s |

Digital silence returned 25.5 with `reliable=false` and a `silent` issue; synthetic broadband noise returned 38.6 with `reliable=false`, although `audio_quality.issues` was empty. Invalid audio bytes were rejected by the decoder. The `sheep → ship` mismatch would falsely PASS at ELA's 80-point threshold, while the correctly spoken `day` was marked unreliable. **Validation failed; scoring remains unavailable.** These four clips do not establish population-level accuracy, en-GB coverage, or phoneme feedback quality. Local JSON output is in ignored `.artifacts/openpronounce-results.json`.

## SpeechOcean762 benchmark, 2026-11-25

Downloaded the official OpenSLR SLR101 archive (520,810,923 bytes). No published checksum was available on the listing; Python gzip/tar read and full member listing succeeded. Extracted only the official `test` audio and metadata (2,500 utterances, ~295.8 MiB), plus expert score files; no train audio was extracted. The benchmark runner uses a deterministic 100 item sample from the official test split, stratified by expert sentence accuracy, and preserves speaker IDs and five-rater accuracy annotations. OpenPronounce's built-in reference TTS requires network access; models ran locally from cache.

Results: 100 scored utterances / 71 speakers; MAE 8.94 on 0–100 machine score against expert mean sentence accuracy scaled 0–10 to 0–100; Pearson r=0.762. At the declared comparison rule (expert accuracy >=8/10; model PASS only if reliable and score>=80): 1 false PASS, 36 false rejects, 6 unreliable. Mean runtime 8.94 s/utterance on CPU. Raw result with phonemes, differences/alignment, reliability and quality is in ignored `.artifacts/speechocean762-openpronounce.json`.

This evaluates sentence accuracy on a corpus used in OpenPronounce development/training; it is not independent external validation. Sentence accuracy is not evidence for isolated target-word or specific IPA-phoneme coaching. **Scoring remains unavailable for ELA IPA practice.** Do not change the >=80 threshold based on this test split.

## Reference-only local service

The app can request a non-persisted reference analysis from the local OpenPronounce adapter. It never marks a lesson complete, applies the official >=80 rule, updates streak/FSRS, or inserts `pronunciation_attempts`. Scores appear only when the engine reports `reliable=true` and audio quality has no issues; all other results are UNASSESSABLE with no displayed score. The label shown is “Điểm tham khảo, chưa dùng để xét hoàn thành”. This is a usability aid, **not an accepted IPA score**; benchmark false rejects and false pass mean it must not control learning outcomes.

### Start services (Windows PowerShell)

From the project root, Terminal A starts the private local adapter using the already downloaded cache (no model download). The adapter defaults `HF_HOME` to `.artifacts/openpronounce-models`, binds only to loopback, and forces Hugging Face/Transformers offline mode. Set `HF_HOME` only when the existing cache is stored elsewhere:

```powershell
$env:HF_HOME = "$PWD\.artifacts\openpronounce-models"
$env:HF_HUB_OFFLINE = '1'
$env:OPENPRONOUNCE_DEVICE = 'cpu'
$env:OPENPRONOUNCE_BIND = '127.0.0.1'
& .\.artifacts\openpronounce-venv\Scripts\python.exe .\scripts\ipa\openpronounce_service.py
```

Terminal B starts Spring Boot as usual with DB/Auth environment configured. It calls the adapter at `http://127.0.0.1:8090/assess`; only authenticated `POST /api/v1/ipa/reference` is available to the mobile app. Terminal C starts Expo with `EXPO_PUBLIC_API_BASE_URL` set to the PC LAN address when using iPhone on the same Wi-Fi. The engine itself remains loopback-only. `GET http://127.0.0.1:8090/health` is the adapter health probe.

Uploads are capped at 8 MiB, normalized through ffmpeg, and limited to 15 seconds. No reference recording is stored by ELA; assessment response is in memory only. Spring requires JWT and does not persist result rows. Service crashes, invalid audio, silence, unreliable engine output and quality issues do not return a score.

### Licence

The current official OpenPronounce code and shipped scorer models are AGPL-3.0-or-later. Its licensing page says a product built on it and offered over a network must publish corresponding source under AGPL, unless a commercial licence is obtained. The adapter is an optional separate local process, but this does not automatically settle whether the combined app has AGPL obligations. Resolve project distribution/licensing before shipping. See [official licensing terms](https://github.com/OpenPronounce/OpenPronounce/blob/main/LICENSING.md).

### Current integration verification

The adapter `/health` returned `UP` using the project-local cached models; a live noise request returned UNASSESSABLE with `reliable=false` and no score. Corrupt, silence, >8 MiB and engine-error handling passed six adapter tests. Four focused Spring controller tests passed for missing principal, >8 MiB, engine HTTP failure, and engine network failure. Full Maven tests passed (94 passed, 18 skipped); TypeScript, ESLint, IPA tests (4/4), Python syntax and Expo web export passed. Authenticated Spring upload with a real learner recording/JWT, actual JWT rejection through the security filter, Expo Go/iPhone LAN and PostgreSQL integration were not tested because local DB/JWT/API URL environment variables were absent. PostgreSQL was not touched; the IPA controller has no persistence path and does not write `pronunciation_attempts`.

## Licence and requirements

The current official engine and shipped models use [AGPL-3.0-or-later](https://github.com/OpenPronounce/OpenPronounce/blob/main/LICENSING.md), not the older fork's MIT licence. Releases 0.1–0.4 remain MIT. Evaluate the AGPL obligations before offering a network product built on this engine. English needs Python 3.10+, ffmpeg, CPU PyTorch, and two Wav2Vec2 downloads of about 1.2 GB each on first run; it does not require espeak-ng. The built-in gTTS reference is not evidence of scoring quality. The engine's `reliable` flag and `audio_quality` must be checked before showing any score.

## Reproduce on Windows (PowerShell)

From the project root, create an ignored virtual environment on a drive with enough space. Use Python 3.10 or later. `ffmpeg` must be on PATH. These commands download models locally; `ELA_ALLOW_LOCAL_OPENPRONOUNCE` is an explicit opt-in for the diagnostic.

```powershell
py -3.10 -m venv .artifacts/openpronounce-venv
$env:TEMP = "$PWD\.artifacts\openpronounce-tmp"
$env:TMP = $env:TEMP
$env:HF_HOME = "$PWD\.artifacts\openpronounce-models"
New-Item -ItemType Directory -Force $env:TEMP, $env:HF_HOME | Out-Null
.\.artifacts\openpronounce-venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.artifacts\openpronounce-venv\Scripts\python.exe -m pip install openpronounce==1.1.0 transformers==4.57.3 hf_xet
$env:ELA_ALLOW_LOCAL_OPENPRONOUNCE = '1'
.\.artifacts\openpronounce-venv\Scripts\python.exe scripts\ipa\validate_openpronounce.py
```

The script verifies source licences before downloading clips, decodes them with ffmpeg, and prints diagnostic JSON. A valid candidate must reject silence, noise, corrupt audio and wrong words as unassessable, while correctly distinguishing genuinely spoken words at the application's 80-point threshold. Repeat with consented, human-labelled recordings from multiple speakers and accents, especially en-GB and the target phonemes. Do not expose the OpenPronounce server directly to Expo or the internet. Integration requires a private scoring adapter, JWT protection, upload and timeout limits, and isolated PostgreSQL tests.

Sources: [OpenPronounce README](https://github.com/OpenPronounce/OpenPronounce), [API reference](https://github.com/OpenPronounce/OpenPronounce/blob/main/docs/reference.md), [licensing](https://github.com/OpenPronounce/OpenPronounce/blob/main/LICENSING.md), [Wikimedia Commons](https://commons.wikimedia.org/).
