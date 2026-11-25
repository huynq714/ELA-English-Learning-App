# Pronunciada integration gate (2026-11-25)

Provider: `pronunciada` 1.1.0, English int8 model, Windows CPU. This is a small diagnostic set, not an accuracy study. The two Commons clips are human recordings by Aren Elliott, [day](https://commons.wikimedia.org/wiki/File:En-day.ogg) and [they](https://commons.wikimedia.org/wiki/File:En-they.ogg); their accent is not documented as en-GB.

| Real recording | Expected word | Score | Other word | Other score | Warning |
| --- | --- | ---: | --- | ---: | --- |
| day | day | 93.95 | they | 80.98 | none |
| they | they | 60.90 | day | 63.78 | none |
| digital silence (1 s) | day | 66.05 | they | 78.97 | `audio is silent` |

The actual `they` recording would fail a PASS ≥80 rule, while its incorrect `day` hypothesis scores higher. Raw model scores must never be returned for silence. Previous single learner clip also produced a false high score for a short `day` segment scored as `they` (86.43 vs 83.26). The English pronunciation dictionary uses American GOAT `/oʊ/`, so British `/əʊ/` coverage needs explicit validation.

**Decision:** Do not expose provider scoring or save `pronunciation_attempts`. The app shows no numeric score. Before integration, collect consented labelled en-GB and learner recordings across target sounds and speakers; test contrasts, silence/noise, recording quality, calibration and phone-level feedback. Reject uncertain audio as `UNASSESSABLE`.
