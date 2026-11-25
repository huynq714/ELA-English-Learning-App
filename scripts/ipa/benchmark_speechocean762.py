"""Run a deterministic, human-labelled sample from SpeechOcean762's official test split."""
import json
import os
import random
import time
from pathlib import Path

import numpy as np
from openpronounce import assess, load_audio


ROOT = Path(os.environ.get("SPEECHOCEAN762_TEST_DIR", ".artifacts/speechocean762-test"))
OUTPUT = Path(os.environ.get("ELA_SPEECHOCEAN_RESULT", ".artifacts/speechocean762-openpronounce.json"))
SAMPLE_SIZE = int(os.environ.get("ELA_SPEECHOCEAN_SAMPLE", "100"))


def read_map(path):
    return {parts[0]: " ".join(parts[1:]) for line in path.read_text(encoding="utf-8").splitlines()
            if (parts := line.split())}


def main():
    text = read_map(ROOT / "test/text")
    speakers = read_map(ROOT / "test/utt2spk")
    scores = json.loads((ROOT / "resource/scores.json").read_text(encoding="utf-8"))
    detail = json.loads((ROOT / "resource/scores-detail.json").read_text(encoding="utf-8"))
    ids = sorted(set(text) & set(speakers) & set(scores) & set(detail))
    ordered = sorted(ids, key=lambda uid: (float(scores[uid]["accuracy"]), uid))
    buckets = [ordered[int(len(ordered) * i / 4):int(len(ordered) * (i + 1) / 4)] for i in range(4)]
    rng = random.Random(7621101)
    chosen = []
    for bucket in buckets:
        rng.shuffle(bucket)
        chosen.extend(bucket[:SAMPLE_SIZE // 4])
    chosen = sorted(chosen)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    prior = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    rows_by_id = {r["utterance_id"]: r for r in prior.get("records", []) if not r.get("provider_error")}
    for i, uid in enumerate(chosen, 1):
        if uid in rows_by_id and "score_0_100" in rows_by_id[uid]:
            continue
        started = time.perf_counter()
        audio_path = ROOT / "WAVE" / f"SPEAKER{speakers[uid]}" / (uid + ".WAV")
        try:
            result = assess(load_audio(str(audio_path)), text[uid], lang="en")
            row = {"utterance_id": uid, "speaker_id": speakers[uid], "reference_text": text[uid],
                     "expert_accuracy_0_10": scores[uid]["accuracy"],
                     "expert_accuracy_raters": detail[uid]["accuracy"],
                     "expert_total_0_10": scores[uid]["total"], "score_0_100": result.get("score"),
                     "scores": result.get("scores"), "reliable": result.get("reliable"),
                     "reasons": result.get("reasons"), "heard_text": result.get("transcribe"),
                     "phonemes": {"expected": result.get("differences", {}).get("expected_phones"),
                                  "heard": result.get("differences", {}).get("heard_phones")},
                     "differences": result.get("differences"), "alignment": result.get("differences", {}).get("alignment"),
                     "audio_quality": result.get("audio_quality"),
                     "elapsed_seconds": round(time.perf_counter() - started, 3)}
        except Exception as exc:
            row = {"utterance_id": uid, "speaker_id": speakers[uid], "reference_text": text[uid],
                   "provider_error": type(exc).__name__, "elapsed_seconds": round(time.perf_counter() - started, 3)}
        rows_by_id[uid] = row
        OUTPUT.write_text(json.dumps({"dataset": "SpeechOcean762 test split", "records": list(rows_by_id.values())}, ensure_ascii=False), encoding="utf-8")
        if i % 10 == 0:
            print(f"processed {i}/{len(chosen)}", flush=True)
    rows = [rows_by_id[uid] for uid in chosen if uid in rows_by_id and "score_0_100" in rows_by_id[uid]]
    machine = np.array([float(r["score_0_100"]) if r["score_0_100"] is not None else np.nan for r in rows])
    human = np.array([float(r["expert_accuracy_0_10"]) * 10 for r in rows])
    eligible = np.isfinite(machine)
    human_pass = human >= 80
    machine_pass = np.array([r["reliable"] is True and r["score_0_100"] is not None and r["score_0_100"] >= 80 for r in rows])
    metrics = {"n": len(rows), "speakers": len({r["speaker_id"] for r in rows}),
               "mae_vs_expert_accuracy_scaled_0_100": float(np.mean(np.abs(machine[eligible] - human[eligible]))) if eligible.any() else None,
               "pearson_vs_expert_accuracy": float(np.corrcoef(machine[eligible], human[eligible])[0, 1]) if eligible.sum() > 1 else None,
               "pass_rule": "expert mean accuracy >= 8/10; machine PASS requires reliable=true and score>=80",
               "false_pass": int(np.sum(machine_pass & ~human_pass)), "false_reject": int(np.sum(~machine_pass & human_pass)),
               "unreliable": int(sum(r["reliable"] is not True for r in rows)),
               "mean_elapsed_seconds": float(np.mean([r["elapsed_seconds"] for r in rows]))}
    payload = {"engine": "OpenPronounce 1.1.0 Full", "dataset": "SpeechOcean762 official test split (SLR101, CC BY 4.0)",
               "sampling": "deterministic, stratified by official expert accuracy; seed 7621101",
               "metrics": metrics, "records": rows}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload["records"] = rows
    payload["metrics"]["failed_or_unassessable_records"] = SAMPLE_SIZE - len(rows)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False))


if __name__ == "__main__":
    main()
