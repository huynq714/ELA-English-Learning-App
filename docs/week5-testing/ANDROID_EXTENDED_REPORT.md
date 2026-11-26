# Android extended tests — 26/11/2026

This extends the 11-case Android smoke suite. Android 14 emulator, Expo Go,
real Spring Boot API on port 8080. Dedicated generated A1 fixture; no existing
user's Quiz or study state was modified. Generated users/history remain for evidence.

## Final results by tested assertion

| ID | Assertion | Final status |
| --- | --- | --- |
| EXT-QUIZ-01 | Starting before studying is refused in native UI | PASS |
| EXT-QUIZ-02 | Five native answer selections, immediate correct/wrong feedback, one intentional mistake; UI 4/5 = 80% agrees with real API result | PASS |
| EXT-NET-01 | Disable emulator Wi-Fi/data; reload Decks shows error and Retry | PASS |
| EXT-NET-02 | Restore network; Retry loads catalogue while session remains signed in | PASS |
| EXT-AUDIO-01 | Word/example speaker controls exercised with no UI playback error; Android telemetry saved | PARTIAL |
| EXT-SIZE-320x568 | Navigation in bounds; Vocabulary reachable, Profile save accessible by scrolling | PASS after runner correction |
| EXT-SIZE-390x844 | Same scoped layout assertions | PASS |
| EXT-SIZE-430x932 | Same scoped layout assertions | PASS |
| BUG-ANDROID-HOME-320 | Visual inspection: Home metric values/labels remain readable at 320x568 | FIXED; three-size retest PASS (see below) |

**7 PASS, 1 PARTIAL** for the eight scripted assertions. An additional visual
inspection found one application layout defect. This is not an all-screens or
all-features responsive certification.

Quiz study progress was prepared via the real study API on the fixture account;
the automated Quiz run does not certify native learning of the whole Deck.
The API generates the questions. Answers are selected via native UI; an independent
GET of the persisted Quiz result verifies 4/5 and 80%.

Audio limitations: dumpsys telemetry in this run contains audio-route events, not
captured PCM or proof of audible/correct content. The environment had no available
loopback capture input. Hearing the correct word/example, overlapping sound and
speaker quality remain NOT TESTED automatically. Manual iPhone listening results
must be cited separately. Do not call this audio PASS.

## Defect: BUG-ANDROID-HOME-320 — FIXED

- Severity: Medium; owner: Frontend; status: FIXED / regression PASS on emulator.
- Reproduce: signed-in user with learned/due/cram counts 15; emulator logical
  size 320x568 dp, density 480 at physical override 960x1704; open Home.
- Expected: metric numbers and captions readable without splitting digits.
- Actual: `15` wraps into `1` then `5`; captions wrap into fragmented syllables.
- Evidence: [Home at 320 dp](evidence/android-extended-20261126/BUG-ANDROID-HOME-320.png).
- Fix: Home metric cards use icon-above-text layout when viewport width divided
  by accessibility font scale is below 400; numbers remain a single line with
  font fitting, captions have the full card width. Wider screens retain the row
  layout. Summary values and navigation actions are unchanged.
- Retest: `python .\docs\week5-testing\scripts\android-smoke.py --home-only`
  ran on the existing fixture account with real counts 15/15/15. All three
  sizes (320x568, 390x844, 430x932 dp) PASS numeric/caption height, full caption
  text, horizontal bounds and no number/caption overlap checks. Screenshots were
  visually reviewed. TypeScript, ESLint and Python syntax checks PASS.
- [Retest results](evidence/home-metrics-fix-20261126/results.json) and
  [320x568 after fix](evidence/home-metrics-fix-20261126/HOME-320x568-metrics.png).
  Original before-fix screenshot remains preserved above. This does not certify
  arbitrary digit counts/font scales or an iPhone retest after the layout change.

## Runner issues and evidence

The first extended attempt hit Expo Go's developer-menu overlay. The runner now
handles Continue/Close. A later 320 dp assertion failed because a deep-link launch
left Home active; explicit selection of the Vocabulary tab fixed that test driver.
The original failing result remains in
[initial-results.json](evidence/android-extended-20261126/initial-results.json);
[320-retest-results.json](evidence/android-extended-20261126/320-retest-results.json)
records the passing recheck. Do not count those driver issues as application bugs.

All extended screenshots and audio telemetry are in
`evidence/android-extended-20261126/`. Full original runs remain under ignored
`.artifacts/week5-android-*`. Screenshots contain only generated test identity.

## Repeat

From the project root, with emulator/Expo/backend running:

```powershell
python .\docs\week5-testing\scripts\android-smoke.py --extended
```

This controls the emulator, creates a fixture account, studies its Deck via API,
submits a real Quiz, temporarily toggles emulator Wi-Fi/mobile data and overrides
display size/density. Normal completion restores original network/display settings
in finally. Avoid interacting with the emulator or force-killing the runner.

To recheck the small layout only in the signed-in test session:

```powershell
python .\docs\week5-testing\scripts\android-smoke.py --display-only
```

The display overrides emulate three logical sizes on one Android image, not three
physical phones. Only Vocabulary and Profile were systematically exercised at all
sizes. No benchmark, model download, database migration or Git commit/push occurred.
