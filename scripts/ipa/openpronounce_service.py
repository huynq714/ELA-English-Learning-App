"""Loopback-only reference feedback adapter for OpenPronounce 1.1.0 (AGPL-3.0-or-later)."""
import base64
import json
import math
import os
import subprocess
import tempfile
from importlib.metadata import version
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import soundfile as sf

MAX_BYTES = 8 * 1024 * 1024
MAX_SECONDS = 15
DEFAULT_HF_HOME = Path(__file__).resolve().parents[2] / ".artifacts" / "openpronounce-models"


class EngineUnavailableError(Exception):
    """OpenPronounce failed after the uploaded media passed input validation."""


def model_cache_ready():
    try:
        if version("openpronounce") != "1.1.0": return False
        cache = Path(os.environ.get("HF_HOME") or DEFAULT_HF_HOME).expanduser() / "hub"
        models = ["models--facebook--wav2vec2-large-960h", "models--facebook--wav2vec2-lv-60-espeak-cv-ft"]
        return all(any((cache / name / "snapshots").glob("*/config.json")) for name in models)
    except Exception:
        return False


def clean(value):
    if isinstance(value, dict): return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [clean(v) for v in value]
    if hasattr(value, "tolist"): return clean(value.tolist())
    if isinstance(value, (np.integer,)): return int(value)
    if isinstance(value, (np.floating,)): return float(value)
    return value


def assess(payload):
    raw = base64.b64decode(payload["audioBase64"], validate=True)
    if not raw or len(raw) > MAX_BYTES: return {"status": "UNASSESSABLE", "reason": "Audio size invalid"}
    target = payload.get("targetText", "")
    if not isinstance(target, str) or not target.isalpha() or len(target) > 40:
        return {"status": "UNASSESSABLE", "reason": "Target word invalid"}
    suffix = ".m4a" if "mp4" in payload.get("contentType", "") or "m4a" in payload.get("contentType", "") else ".audio"
    with tempfile.TemporaryDirectory(prefix="ela-ipa-") as td:
        source, wav = Path(td) / ("upload" + suffix), Path(td) / "normalized.wav"
        source.write_bytes(raw)
        try:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(source), "-ac", "1", "-ar", "16000", str(wav)],
                           check=True, capture_output=True, timeout=10)
            samples, rate = sf.read(wav, dtype="float32")
        except Exception:
            return {"status": "UNASSESSABLE", "reason": "Audio decode failed"}
        duration = len(samples) / rate if rate else 0
        rms = float(np.sqrt(np.mean(np.square(samples)))) if len(samples) else 0
        if (rate != 16000 or samples.ndim != 1 or not np.isfinite(samples).all()
                or duration < 0.35 or duration > MAX_SECONDS or rms < 0.004):
            return {"status": "UNASSESSABLE", "reason": "Audio is silent, too short, or too long"}
        try:
            from openpronounce import assess as op_assess
            result = op_assess(samples, target, lang="en")
        except Exception as exc:
            raise EngineUnavailableError() from exc
        quality = result.get("audio_quality") or {}
        score = result.get("score")
        valid_score = (isinstance(score, (int, float)) and not isinstance(score, bool)
                       and math.isfinite(score) and 0 <= score <= 100)
        reliable = result.get("reliable") is True and not quality.get("issues") and valid_score
        response = {"status": "REFERENCE" if reliable else "UNASSESSABLE",
                    "score": score if reliable else None,
                    "reliable": result.get("reliable"), "reasons": result.get("reasons"),
                    "audioQuality": quality, "heardText": result.get("transcribe"),
                    "differences": result.get("differences"), "scores": result.get("scores"),
                    "label": "Điểm tham khảo, chưa dùng để xét hoàn thành" if reliable else None}
        return clean(response)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health": self.send_error(404); return
        if model_cache_ready():
            self.reply(200, {"status": "UP", "engine": "OpenPronounce 1.1.0", "models": "Full cached"})
        else:
            self.reply(503, {"status": "DOWN", "engine": "OpenPronounce readiness check failed"})

    def do_POST(self):
        if self.path != "/assess": self.send_error(404); return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.reply(400, {"status": "UNASSESSABLE", "reason": "Invalid content length"}); return
        if length <= 0 or length > MAX_BYTES * 2: self.reply(413, {"status": "UNASSESSABLE", "reason": "Request too large"}); return
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.reply(400, {"status": "UNASSESSABLE", "reason": "Invalid request or assessment failure"})
            return
        try:
            self.reply(200, assess(body))
        except EngineUnavailableError:
            self.reply(503, {"status": "UNASSESSABLE", "reason": "Assessment engine unavailable"})
        except Exception:
            self.reply(400, {"status": "UNASSESSABLE", "reason": "Invalid request"})

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def log_message(self, *_): pass


if __name__ == "__main__":
    host = os.environ.get("OPENPRONOUNCE_BIND", "127.0.0.1")
    if host not in {"127.0.0.1", "::1"}: raise SystemExit("Bind only to loopback; expose through authenticated Spring Boot")
    os.environ.setdefault("HF_HOME", str(DEFAULT_HF_HOME))
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    ThreadingHTTPServer((host, int(os.environ.get("OPENPRONOUNCE_PORT", "8090"))), Handler).serve_forever()
