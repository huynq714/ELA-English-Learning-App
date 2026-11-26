# Android automated smoke test — 26/11/2026

## Environment and scope

- Source baseline: merge `e19001a`, with the uncommitted Home greeting fix.
- Android Emulator `ELA_Pixel2_API34`, Android 14, 1080×1920, serial `emulator-5554`.
- Stable startup used `-gpu software -feature -Vulkan -no-snapshot`; earlier System UI failures were environment issues. This run does not prove the GPU driver cause or long-term emulator stability.
- Expo Go and Metro were already running. Emulator API URL: `http://10.0.2.2:8080`; Windows test runner: `http://127.0.0.1:8080/api/v1`.
- Driver: existing ADB + Android UI Automator XML, Python standard library. No Maestro/Appium installation or application-source changes were needed.
- Fixture: a generated A1 test account registered through the real API. Password and JWT were not saved. The fixture user remains in the existing database; no migration, schema reset or deletion of existing users was performed.

## Executed results

The completed run recorded **11 PASS, 0 FAIL, 0 SKIPPED**. The initial preflight attempt was aborted before any case because it expected Home while the emulator was on Login; the runner now accepts Home/Login/Welcome. A preflight abort is not counted as an application failure or passing test.

| ID | Native UI assertion | Result |
| --- | --- | --- |
| AND-01 | Reach Login from the current entry screen | PASS |
| AND-02 | Empty Login shows invalid-email validation | PASS |
| AND-03 | Incorrect password is rejected | PASS |
| AND-04 | Correct fixture credentials open Home with the fixture name | PASS |
| AND-05 | A1 catalogue contains the three approved Deck titles | PASS |
| AND-06 | Non-matching search shows empty state | PASS |
| AND-07 | Clearing search restores the Deck list | PASS |
| AND-08 | Meaning absent before flip and visible after flip | PASS |
| AND-09 | Bookmark changes to the saved state | PASS |
| AND-10 | My Vocabulary shows the saved folder and one word | PASS |
| AND-11 | Open saved folder review; unbookmark returns to unsaved state | PASS |

These are native UI smoke cases, not the complete 57-case Week 5 suite. AND-05 checks expected titles, not direct-ID access control. AND-11 checks the action state, not a subsequent database query or persisted empty-list reload. Audio listening, OTP mail, Quiz completion, network recovery, hardware Back, multiple viewports and iPhone are **NOT TESTED by this script**. Existing manual evidence remains separate.

## Evidence and repeat

Sanitized [results JSON](evidence/android-smoke-20261126/results.json) and four screenshots are in `evidence/android-smoke-20261126/`. Full screenshots for the successful run remain in ignored `.artifacts/week5-android-20261126-005922/`. UI XML is read in memory and the script removes its temporary device XML after each read.

Run from the project root while the emulator, backend and Expo are ready:

```powershell
python .\docs\week5-testing\scripts\android-smoke.py
```

The runner takes control of the emulator, may log out the current session, creates a new fixture user on each run, and stops at the first failure. Do not interact with the emulator while it runs. Logs omit credentials; screenshots are captured only after checks, with password fields masked. Results are written to a new timestamped `.artifacts/week5-android-*` directory; they do not overwrite historical evidence.

## Remaining environment issue

Repeated `System UI isn't responding` prevented the first manual Android checks. With software rendering and Vulkan disabled, the emulator remained usable throughout this automated run. Preserve that launch configuration for the demo. This is separate from the application Home greeting bug, which was fixed and manually retested on iPhone.
