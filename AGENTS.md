# Lessavio: project context

Last reviewed: 2026-10-23 (Europe/Kyiv). Update this file when architecture or release status changes.

## Product and user preferences

- Lessavio is a desktop application for independent tutors on macOS and Windows. Tutorly is the former name and still the repository name.
- Teaching data stays on the user's device. Firebase authentication and optional analytics use the network; there is no cloud teaching database or synchronization yet.
- Supported UI languages: English, Russian, Ukrainian. New installations default to English. Preserve existing language preferences.
- README installation buttons should be prominent. Release text must be English. macOS releases currently have no Developer ID signature/notarization; preserve the installation guide and annotated screenshot.
- Do not upload teaching data or automatically enable analytics.

## Source layout

- Active app: `desktop/`, React 19 + TypeScript + Vite + Tauri 2 + Rust/rusqlite.
- Root web client/server sources are legacy, not the current desktop implementation.
- `desktop/src/App.tsx`: teaching workspace; `AccountApp.tsx`: authentication and workspace lifecycle.
- `domain.ts`, `planning.ts`, `recurrence.ts`, `recurrenceRule.ts`, `finance.ts`: validation and business rules.
- `desktop/src-tauri/src/repository.rs`: scoped SQLite persistence and migrations. `main.rs`: IPC, active workspace and reminder worker.

## Data and account boundaries

- Keep the Tauri identifier `com.tutorly.desktop` and database filename `tutorly.sqlite` stable across branding changes.
- SQLite schema version 2 scopes workspaces to `guest` or `firebase:<projectId>:<uid>`. JSON backup format version remains 1.
- Legacy data and notification deduplication migrate to the guest workspace. Old tables remain a migration snapshot; downgrading to 0.4 can expose stale data.
- Backups are retained per workspace for 14 days. Record revisions, change journal and deletion tombstones prepare for future synchronization; they do not implement it.
- Switching accounts must deactivate the native workspace before accepting any auth outcome, including observer failures. `sessionTransitions.ts` guards against stale callbacks.
- Copying guest data into an account is explicit and requires an empty target. Account workspaces must never silently share teaching data.
- Local database/backup files are not encrypted. Authentication does not provide encryption at rest.

## Firebase

- Public app configuration: `desktop/src/firebase.config.json`, project `lessavio-1fa05`; environment overrides documented in `.env.example`.
- Share one Firebase app through `firebase.ts`.
- Email/password registration, sign-in, verification, reset and sign-out are implemented. Google/Phone/Anonymous providers enabled in the console do not imply implemented UI flows.
- Guest mode is local and does not create a Firebase anonymous account.
- Auth emulator is allowed only in development with a demo project and loopback endpoint. Production must ignore emulator configuration.
- Analytics is opt-in per workspace/device and defaults off. Consent is outside teaching-data backups. Never send names, email, phone, lesson notes, amounts or Firebase UID.
- `analyticsPolicy.ts` restricts events and parameters; `analytics.ts` lazily loads the SDK after consent. Development uses a no-network adapter.
- A custom Firebase project without a measurement ID must not fall back to the Lessavio measurement stream.
- Production browser SDK initialization was checked; actual GA4 report ingestion and native-platform delivery remain unverified.

## Business rules to preserve

- Recurrence rules require real calendar dates, unique weekdays, valid times, a valid time zone and a bounded date range.
- Preserve the original range and every-other-week phase when editing a series. Completed/cancelled history must remain protected.
- Moving a lesson to another student detaches it from the original series.
- Reject nonexistent/ambiguous DST wall times for new scheduling. Preserve an existing known instant when editing an unchanged wall time.
- Sort timestamps by their numeric instant, not by their ISO string (offsets can differ).
- Financial summaries distinguish payments received from earned amounts for completed lessons. Month navigation is bounded to years 0001–9999.
- Native reminders run while the app is open. Immediately before delivery, recheck active account, current lesson, due time and deduplication under native locks.

## Translation and verification

- Catalogs: `desktop/src/locales/{en,ru,uk}.json`; currently 324 keys each.
- `desktop/scripts/check-translations.mjs` checks source strings, all catalogs and interpolation placeholders. Native language names and search aliases have explicit exceptions.
- Run `npm ci --prefix desktop`, `npm test --prefix desktop`, `npm run build --prefix desktop`.
- Run `cargo test --manifest-path desktop/src-tauri/Cargo.toml` with a working Rust toolchain.
- Last review: 34 TypeScript tests, 9 Rust tests and translation audit passed; production dependency audit found zero vulnerabilities.
- Temporary Rust tooling used in this session: `/private/tmp/tutorly-cargo/bin`, with `RUSTUP_HOME=/private/tmp/tutorly-rustup` and `CARGO_HOME=/private/tmp/tutorly-cargo`. These paths may disappear.
- Browser checks covered English/Ukrainian/Russian settings and finance month boundaries. Installed native notification delivery, Windows installation and week-view drag completion still need device checks.

## Release state

- Repository: `Valentin-Holovin/Tutorly`. Last verified published release: 0.5.0 (desktop-v0.5.0), built from fd820fb.
- Current source version: 0.5.0; authentication, analytics and review fixes are included in the local 0.5.0 commit. Inspect Git status before editing; preserve existing work.
- Workflow: `.github/workflows/desktop-release.yml`, macOS universal and Windows NSIS. Verify both uploaded installers and stable download aliases before calling a release complete.
- GitHub Actions run 39988826871 successfully built macOS universal and Windows x64 installers. Release 0.5.0 is published with both stable download aliases. Local Apple Silicon DMG was also rebuilt after review; its image checksum passed verification.
- More details: `docs/accounts-and-sync.md`, `docs/analytics.md`, `docs/quality-review-2026-10-23.md`.
