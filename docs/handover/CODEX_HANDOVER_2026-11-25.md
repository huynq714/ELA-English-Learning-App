# ELA Codex Handover — 2026-11-25

## 1. Project overview

English Learning App (ELA) is a Vietnamese-first English vocabulary learning app. The current repository is a Windows workspace with a React Native/Expo mobile client, a Spring Boot REST backend, and PostgreSQL persistence.

### Architecture and stack

- Mobile: React Native 0.88.1, Expo SDK 58, Expo Router, TypeScript 6, feature-oriented repositories and hooks/view models.
- Backend: Java 21, Spring Boot 4.1.2, Spring MVC/Security, JWT HMAC-SHA256, Spring Data JPA and Spring JDBC `JdbcClient`.
- Database: PostgreSQL 18. Backend schema validation uses `spring.jpa.hibernate.ddl-auto=validate`; it does not create or migrate the schema automatically.
- Client requests use `src/services/api-client.ts` (Bearer token, timeout and normalized network/HTTP errors). Authentication tokens are stored with Expo SecureStore on native platforms.

### Main directories

- `src/app/`: Expo Router route declarations.
- `src/screens/`: screen UI.
- `src/features/`: feature models, repositories, hooks and components (auth, vocabulary, review, etc.).
- `backend/src/main/java/com/englishlearning/`: backend domains (`auth`, `profile`, `vocabulary`, `quiz`, `fsrs`, and shared code).
- `backend/src/test/java/`: unit and opt-in PostgreSQL integration tests.
- `database/week*/`: SQL schema, migrations and import/backfill scripts.
- `docs/`: project handover and demo/testing notes.

## 2. Work completed in the evening session

FSRS review was wired into the existing ELA app, followed by replacement of the Home screen's static `320` learned-word mock with database-backed review summary statistics.

### Existing FSRS work included in this commit

- Added FSRS-4.5 card state, rating, scheduler, service/repository and REST adapter.
- Added PostgreSQL persistence migration `V1_7__fsrs_persistence.sql` and an optional idempotent backfill script from `user_word_progress`.
- Added authenticated review API and mobile review session screen/route, session persistence/resume, retry/idempotency behavior and rating UI.
- Connected study flashcard reveal/progress interaction to the review flow and added Expo Crypto dependency for client-generated request tokens.
- Added unit tests, opt-in PostgreSQL integration tests, a web smoke script and FSRS demo notes.
- Home and Review UI were connected to real review summary/streak information while retaining the existing design system.

### Latest statistics change

- Expanded `GET /api/v1/review/summary` with `learnedCount` and `cramCount`; existing `dueCount` remains.
- Removed the Home screen dependency on the Figma mock value `learningSummary.learned` (`320`). Home now renders `Đã học qua`, `Đến hạn ôn`, and `Ôn thêm` using the summary response.
- Summary hook clears prior account data when signed out/account changes or a new load begins. Loading/error values do not fall back to mock numbers.
- Added regression assertions for the new counters in service and PostgreSQL repository tests.

### Files changed/added for this work

Modified tracked files:

- `backend/src/main/java/com/englishlearning/auth/SecurityConfig.java`
- `package.json`, `package-lock.json`
- `src/app/_layout.tsx`
- `src/features/vocabulary/components/study-flashcard.tsx`
- `src/screens/home-screen.tsx`, `src/screens/review-screen.tsx`
- `src/services/api-client.ts`

Added FSRS/backend/test/docs/frontend files:

- `backend/scripts/test-review-web.cjs`
- `backend/src/main/java/com/englishlearning/fsrs/*.java`
- `backend/src/test/java/com/englishlearning/fsrs/*.java`
- `database/week5/migrations/V1_7__fsrs_persistence.sql`
- `database/week5/import/backfill_fsrs_cards_from_user_word_progress.sql`
- `docs/handover/PROJECT_HANDOVER.md`, `docs/week5-demo/FSRS_REVIEW.md`
- `src/app/review-session.tsx`
- `src/features/review/*`
- `src/screens/review-session-screen.tsx`
- This handover file.

## 3. FSRS behavior and API

### Business rules

- FSRS state is scoped to the unique `(user_id, word_id)` pair. `user_word_progress` is evidence that the user studied a word; bookmarks alone do not qualify.
- Summary and session creation do not create fake review logs. Session start lazily initializes missing review cards only for words with study progress; the optional backfill script is separate.
- DUE selects studied words whose review card is due (`due_at <= now`); session start caps the selected queue at 10, while the summary due count is the full eligible population.
- CRAM uses the repository's existing studied-word predicate and can include not-yet-due studied cards; session selection is capped at 10. CRAM does not increase the streak.
- DUE completion may update the user's streak. Again/Hard/Good/Easy are persisted as per-card reviews, with FSRS state and next due time. Learning/Relearning steps may wait; active sessions can be resumed.
- Ratings are transactional and protected by per-user session ownership, row locks, and client idempotency tokens. A retry with the same token replays the saved response; reusing a token with different request data conflicts.
- Quiz progress and My Vocabulary bookmark state are separate from FSRS review state.

### Summary counter definitions

- `learnedCount`: distinct `word_id` values in `user_word_progress` for the authenticated user. Does not count bookmarks.
- `dueCount`: existing summary due predicate over studied progress with absent cards treated as due, matching eligible DUE initialization/selection.
- `cramCount`: count of studied words eligible under the existing CRAM predicate. It is the full count, not the 10-card session cap.
- The authenticated user ID is resolved from JWT server-side; no client-supplied user ID is trusted for summary or review operations.

### API surface

- `GET /api/v1/review/summary`
- `POST /api/v1/review/session/start` with `DUE` or `CRAM`
- `GET /api/v1/review/session/{id}`
- `POST /api/v1/review/session/{id}/rate`

The summary response retains streak/state fields and now includes `learnedCount`, `dueCount`, and `cramCount`.

## 4. Database and migration safety

- Development database configured in `backend/src/main/resources/application.properties`: `english_learning_db` on `localhost:5432`; DB credentials are environment variables `DB_USERNAME`/`DB_PASSWORD`.
- Do not run V1_7 or the backfill against the development database without a separate explicit approval, confirmed identity, verified backup, and restore plan. `ddl-auto=validate` does not apply the SQL migration.
- V1_7 adds FSRS session/idempotency/streak persistence and the learning-step field. The backfill is optional and only derives review cards from existing `user_word_progress`; it is not required merely to see historical studied-word counts because summary can account for progress before card initialization.
- The user previously reported making a dump and a successful restore check in `ela_restore_check`. The exact final migration status of `english_learning_db` was not independently verified from a query during this handover. Prior console output showed 19 public tables and `review_cards`, but not `review_sessions` at that point. Recheck migration state before assuming development DB is ready.
- No migration or backfill was run by this session.

## 5. Verification status

Verification performed for the latest implementation:

- `mvn -q test` in `backend`: PASS (exit code 0).
- `npx tsc --noEmit`: PASS.
- `npm run lint -- --no-cache`: PASS.
- `git diff --check`: PASS (line-ending conversion warnings only).
- PostgreSQL integration tests are opt-in via `FSRS_TEST_JDBC_URL`, `FSRS_TEST_JDBC_USER`, and `FSRS_TEST_JDBC_PASSWORD`. They were SKIPPED in the latest run because the isolated test DB variables were unavailable; do not count skips as passes.
- Earlier project history reported PostgreSQL FSRS integration tests passing on a separate test database (14 tests in the Task 3 acceptance report), Maven 94/94, and Expo iOS/Android export passing. These are historical reports, not reproduced in this latest run.
- A physical iPhone/Expo Go demo has not been verified by Codex.

## 6. Run instructions

### PostgreSQL

The Windows service observed during the session was `postgresql-x64-18`. Check it with:

```powershell
Get-Service postgresql-x64-18
```

Start it only if stopped (may require an elevated PowerShell):

```powershell
Start-Service postgresql-x64-18
```

### Backend

From `D:\My Project\Project 6 - Mobile\English Learning App\backend`, set the correct local DB credentials and the same Base64 JWT secret used by the app. Do not commit or disclose these values.

```powershell
$env:DB_USERNAME = "postgres"
$securePassword = Read-Host "PostgreSQL password" -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
$env:AUTH_JWT_SECRET = Read-Host "Base64 JWT secret"
mvn spring-boot:run
```

`application.properties` currently binds to `127.0.0.1`, which is suitable only for local access. For Expo Go on another device, backend must bind to the LAN interface (for example a verified `SERVER_ADDRESS` property/override); do not assume the current default is phone-accessible. Check current configuration before demo; firewall must allow TCP 8080 on the private Wi-Fi network.

### Expo

From repository root, set `EXPO_PUBLIC_API_BASE_URL` to the computer's Wi-Fi IPv4 address, not `localhost`, then start Expo:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://<computer-wifi-ip>:8080"
npx expo start --lan
```

Phone and computer must be on the same Wi-Fi. Scan the QR with Expo Go. Never put secrets in `EXPO_PUBLIC_*` variables.

### Tests

```powershell
# Backend unit/default suite
cd "D:\My Project\Project 6 - Mobile\English Learning App\backend"
mvn test

# Mobile static checks, from repository root
cd "D:\My Project\Project 6 - Mobile\English Learning App"
npx tsc --noEmit
npm run lint -- --no-cache
```

To run PostgreSQL integration tests, configure `FSRS_TEST_JDBC_URL` to an explicitly isolated disposable database (not development), plus its username/password. Inspect the test configuration before running because the suite applies its schema setup to the named test DB.

## 7. Remaining work and risks

1. Independently verify development DB identity and whether V1_7 was applied. Do not apply migration or backfill in this handover task.
2. If another FSRS integration run is needed, provision/use an isolated database and set the three `FSRS_TEST_JDBC_*` variables; confirm the report has zero skips.
3. Test the full mobile experience on a physical iPhone with Expo Go; this has not yet been done.
4. For LAN demo, explicitly configure Spring Boot bind address and Windows Firewall. Current checked-in properties bind to loopback (`127.0.0.1`), so a LAN-specific runtime override is required.
5. No IPA training or AI Conversation implementation is part of the FSRS scope. Do not start Task 4–7 or new modules without direction.
6. Preserve existing uncommitted work and untracked user files; do not reset, clean, or push.

## 8. Commit handoff note

This file is intended to be committed with the reviewed ELA code changes on the current branch. Record the resulting commit hash in the Codex transfer message after verifying `git status --short` is clean (or explicitly list any intentionally uncommitted files).
