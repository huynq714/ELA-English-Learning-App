# IPA audio and scoring acceptance (2026-11-25)

## Scoring gate

Scoring remains unavailable. The real-audio Pronunciada 1.1.0 results in
[PRONUNCIADA_GATE.md](./PRONUNCIADA_GATE.md) fail the `they`/`day` contrast and
score digital silence. Do not return its raw score or store an attempt as PASS.

| Candidate | Resource / license | Current decision |
| --- | --- | --- |
| Pronunciada | 71 MB int8 model; Apache-2.0 code, ZIPA CC BY 4.0 | Small enough for CPU, but failed the local real-audio gate. |
| OpenPronounce | Two approximately 1.2 GB checkpoints; AGPL-3.0-or-later | Cached and benchmarked for sentence-level feedback, but not validated for isolated ELA IPA targets; remains reference-only. |
| Azure Pronunciation Assessment | Cloud Speech resource and key; usage-based pricing | Supports phoneme results, but no configured credential or real-audio gate. en-GB IPA feedback needs verification. |

Before integration: use consented, labelled English recordings from multiple
speakers for each target sound, with explicit `day`/`they`, correct/wrong word,
silence, noise, clipped and damaged-file cases. Measure false PASS at the fixed
80/100 threshold and reject uncertain input as UNASSESSABLE. Only then consider
an authenticated backend API, key held server-side, and isolated PostgreSQL tests.

## iPhone Expo Go checklist (not yet executed)

- [ ] Open IPA grid; confirm 20 vowels, 24 consonants and both examples per sound.
- [ ] On a recorded example, hear the exact shown word in-app; tap twice quickly,
      switch words and leave the screen: no overlapping or continuing audio.
- [ ] On a TTS example, see the TTS label; verify speech with the silent switch
      **off**, then check behavior with the switch **on**.
- [ ] Disconnect network: recorded audio shows an error and retry works after
      reconnecting. TTS availability may depend on installed device voices.
- [ ] Record a word, play it back, re-record it, and deny microphone permission.
- [ ] Confirm the result screen never shows a numeric PASS/FAIL score while
      scoring is unavailable.

Provider references: https://github.com/moglearn/pronunciada ;
https://github.com/xuanhoatrieu/openpronounce ;
https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment ;
https://docs.expo.dev/versions/v58.0.0/sdk/speech/ .
