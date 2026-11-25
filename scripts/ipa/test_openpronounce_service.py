"""Focused tests for OpenPronounce adapter input and service-error handling."""
import base64
import importlib.util
import json
import sys
import threading
import types
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

import numpy as np
import soundfile as sf
from http.server import ThreadingHTTPServer


MODULE_PATH = Path(__file__).with_name("openpronounce_service.py")
SPEC = importlib.util.spec_from_file_location("ela_openpronounce_service", MODULE_PATH)
service = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = service
SPEC.loader.exec_module(service)


def payload(audio):
    return {"audioBase64": base64.b64encode(audio).decode(), "contentType": "audio/wav", "targetText": "day"}


def wav(samples):
    import io
    stream = io.BytesIO()
    sf.write(stream, samples, 16000, format="WAV", subtype="PCM_16")
    return stream.getvalue()


class OpenPronounceAdapterTests(unittest.TestCase):
    def test_readiness_uses_project_local_model_cache(self):
        self.assertTrue(service.model_cache_ready())

    def test_corrupt_audio_is_unassessable_without_score(self):
        with mock.patch.object(service.subprocess, "run", side_effect=RuntimeError("decode")):
            result = service.assess(payload(b"not-audio"))
        self.assertEqual(result["status"], "UNASSESSABLE")
        self.assertIsNone(result.get("score"))

    def test_silence_is_unassessable_without_score(self):
        silent = wav(np.zeros(16000, dtype=np.float32))
        with mock.patch.object(service.subprocess, "run"), mock.patch.object(
            service.sf, "read", return_value=(np.zeros(16000, dtype=np.float32), 16000)
        ):
            result = service.assess(payload(silent))
        self.assertEqual(result["status"], "UNASSESSABLE")
        self.assertIsNone(result.get("score"))

    def test_audio_over_8_mib_is_unassessable(self):
        result = service.assess(payload(b"x" * (service.MAX_BYTES + 1)))
        self.assertEqual(result["status"], "UNASSESSABLE")
        self.assertIsNone(result.get("score"))

    def test_engine_exception_is_classified_as_unavailable(self):
        recorded = wav(np.full(8000, 0.1, dtype=np.float32))
        engine = types.ModuleType("openpronounce")
        engine.assess = mock.Mock(side_effect=RuntimeError("private engine detail"))
        with mock.patch.object(service.subprocess, "run"), mock.patch.object(
            service.sf, "read", return_value=(np.full(8000, 0.1, dtype=np.float32), 16000)
        ), mock.patch.dict(sys.modules, {"openpronounce": engine}):
            with self.assertRaises(service.EngineUnavailableError):
                service.assess(payload(recorded))

    def test_http_engine_error_is_503_without_leaking_exception(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), service.Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            request = urllib.request.Request(
                f"http://127.0.0.1:{server.server_port}/assess",
                data=json.dumps({"audioBase64": "eA==", "targetText": "day"}).encode(),
                headers={"Content-Type": "application/json"},
            )
            with mock.patch.object(service, "assess", side_effect=service.EngineUnavailableError()):
                with self.assertRaises(urllib.error.HTTPError) as caught:
                    urllib.request.urlopen(request, timeout=3)
            self.assertEqual(caught.exception.code, 503)
            body = caught.exception.read().decode()
            self.assertIn("Assessment engine unavailable", body)
            self.assertNotIn("private engine detail", body)
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
