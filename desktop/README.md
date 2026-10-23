# Tutorly Desktop — Developer Guide

Tutorly Desktop is a local application for independent tutors built with Tauri 2, React, TypeScript, Rust, and SQLite. It has no hosted backend, online authentication, or cloud database.

For a product overview, installer instructions for macOS and Windows, first-run setup, and backup procedures, read the **[main README](../README.md)**.

## Interface languages (0.2.0)

Settings and first-run setup include **Русский**, **Українська**, and **English**. Existing profiles without a language field continue in Russian. New workspaces detect a supported system language, falling back to English. Changing the language on an existing profile saves it immediately through the normal SQLite transaction. The preference is also included in exported backups; older backups without it remain supported.

Translations cover navigation, screens, forms, notifications, validation errors, and app-provided file dialog titles. Dates, times, currency formatting, and month names use the selected locale. Operating-system dialog controls follow the OS language. Technical errors from SQLite or the operating system may retain their original wording.

Version 0.2.0 must be built and installed to use translations; the published 0.1.0 installers are unchanged.

## Selection controls (0.2.0)

Language, currency, time zone, student, and lesson status use shared keyboard-accessible selectors. Long lists support search, including student subjects and prices. Use arrows and Enter to choose, Escape to dismiss, and Tab to continue the form. The time zone list includes the zones supported by the local runtime and preserves an existing profile's zone.

Lesson dates use a localized Monday-first calendar with today/tomorrow shortcuts, month/year navigation, arrow-key day navigation, and Page Up / Page Down for months (Shift for years). Time can be typed to the minute or set from quick presets; duration offers 30, 45, 60, and 90 minutes while allowing any value in the supported 15–480 range. New lessons default to the next quarter hour in the computer's local time zone.

## Recurring lessons (0.2.0)

Use **Recurring lessons** on Today/Calendar, switch modes in the new lesson dialog, or open it from a student card. Pick weekdays and assign each its own time (for example Monday 16:00, Friday 18:00, Saturday 12:30), duration, price, and an inclusive start/end date. Repeat every week or every two weeks, anchored to the Monday of the start week. Defaults cover eight weeks; quick ranges cover 4, 8, or 12 weeks. The maximum range is 366 days between endpoints.

Preview lists dates and conflicts before saving. UTC instants are generated from the profile's IANA time zone, independently of the computer's local zone. Daylight saving changes preserve the chosen wall-clock time; nonexistent or ambiguous local times are rejected with the affected date and time. A conflict with another lesson or within the series blocks the entire batch. No partial series is written.

The series is materialized into ordinary scheduled lessons through the selected end date. There is no background extension beyond that date. An optional `seriesId` groups occurrences and is included in backups; old backups without this field remain valid. Individual edits affect one occurrence. The lesson editor also lets users confirm cancellation of all upcoming scheduled occurrences in its series, preserving completed/past lessons and payments.

Domain tests cover weekday-specific times, inclusive boundaries, biweekly anchoring, DST changes/gaps/ambiguities, intra-series overlaps, atomic conflict rejection, and backup round-trips.

## Development setup

Use Node.js 22.18+, npm, Rust stable, and the native build tools described in the official [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). macOS needs Xcode Command Line Tools; Windows needs the Microsoft C++ toolchain, Windows SDK, and WebView2 Runtime.

From the repository root:

```sh
npm ci --prefix desktop
npm run desktop:dev
```

The `desktop` package is independent of the older root/client npm workspace. Installing only the root dependencies is not enough. No `.env` file, PostgreSQL installation, or database migration command is required for the desktop app.

| Command from repository root | Purpose |
| --- | --- |
| `npm run desktop:dev` | Start Vite and the native Tauri window. |
| `npm run dev --prefix desktop` | Browser-only interface preview on port 1420. Data is kept only in memory. |
| `npm run build --prefix desktop` | Check TypeScript and build frontend assets; does not create an installer. |
| `npm test --prefix desktop` | Run domain tests using Node's built-in test runner. |
| `cargo test --release --manifest-path desktop/src-tauri/Cargo.toml` | Run Rust tests for persistence, snapshots, and backup envelope validation. |

## Architecture

```text
React interface
    → Tauri IPC commands
        → Rust persistence layer
            → local SQLite database
```

The desktop app never starts the legacy Express server. SQLite is bundled with the Rust application, so end users do not install a database service. The single-instance plugin focuses the existing window when another instance is launched.

### Source layout

```text
desktop/
  src/
    App.tsx             Screens, forms, and workspace actions
    domain.ts           Types, validation, money, conflicts, and balances
    domain.test.ts      Domain tests
    storage.ts          Tauri command adapter and browser preview behavior
    styles.css          Local styles, without remote fonts
  src-tauri/
    src/main.rs         SQLite persistence, dialogs, snapshots, and startup
    Cargo.toml          Rust dependencies
    tauri.conf.json     Window, build, CSP, and packaging configuration
    capabilities/       Tauri window capabilities
    icons/              Application icons
  package.json          Frontend and Tauri CLI commands
```

### Persistence and data format

Rust opens `tutorly.sqlite` in Tauri's `app_data_dir` for `com.tutorly.desktop`. On macOS this is `~/Library/Application Support/com.tutorly.desktop/`; on Windows it is normally `%APPDATA%\com.tutorly.desktop\`.

Version 0.1.0 stores the workspace as a single versioned JSON document in a SQLite `workspace` table, rather than separate relational tables for each entity. This keeps related changes in one transaction for a personal workspace. Any future schema change must account for the existing document format and database `user_version`.

- SQLite uses WAL mode and `synchronous=FULL`.
- The UI validates a workspace and waits for persistence to succeed before adopting the new state.
- The browser preview uses memory only and does not simulate durable desktop storage.
- Frontend code does not receive general-purpose filesystem or SQL access.
- A startup read failure shows an error instead of creating a blank profile over existing data.

### IPC commands

| Command | Purpose |
| --- | --- |
| `load_workspace` | Read the saved workspace document, or return no document on a fresh installation. |
| `save_workspace` | Save a workspace transactionally and maintain daily snapshots. |
| `export_backup` | Read the saved document and export it using a native Save dialog. |
| `read_backup` | Select a backup using a native Open dialog and read its content. |

Restore flow: read the backup, validate its domain structure in TypeScript, show a replacement confirmation, and persist it with `save_workspace`. The Rust layer also checks the document envelope and a 20 MB size limit.

### Snapshots and external backups

Before the first write of each UTC day, the previous workspace is inserted into the `backups` table. Up to 14 daily entries are retained. There is no snapshot recovery UI yet; these entries are intended for future recovery support and do not protect against loss of the disk.

External JSON export reads a consistent workspace document instead of copying a live SQLite file with an active WAL. Exports contain personal data and are not encrypted. Restore replaces the workspace rather than merging it.

### Domain rules

- Money is stored in integer minor units.
- Student balance is total payments minus completed lesson charges.
- Scheduled and cancelled lessons do not incur charges.
- Payments contribute to a student's overall balance, without allocation to individual lessons.
- Non-cancelled lessons cannot overlap, even for different students. Adjacent lessons are allowed.
- Archiving a student keeps their historical records.
- Lesson moments are stored in UTC and displayed in the profile time zone. Date/time input uses the computer time zone, explicitly shown in the form.
- Changing the currency changes its label without converting stored amounts.

## Build installers locally

Run the following commands from `desktop/` after installing its npm dependencies.

### macOS — current architecture

```sh
npm run bundle -- --bundles app,dmg
```

Outputs:

```text
src-tauri/target/release/bundle/macos/Tutorly.app
src-tauri/target/release/bundle/dmg/*.dmg
```

### macOS — universal Apple Silicon and Intel

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run bundle -- --target universal-apple-darwin --bundles app,dmg
```

Outputs are under `src-tauri/target/universal-apple-darwin/release/bundle/`.

### Windows — NSIS installer

Run on Windows:

```powershell
npm run bundle -- --bundles nsis
```

The installer is written under `src-tauri/target/release/bundle/nsis/`. The checked-in GitHub workflow uses a Windows x64 runner; Windows ARM is not a configured release target.

Use explicit `--bundles` values for the host platform. The shared configuration lists package types for both operating systems.

## Validation

From the repository root:

```sh
npm test --prefix desktop
npm run build --prefix desktop
cargo test --release --manifest-path desktop/src-tauri/Cargo.toml
```

Domain tests cover money parsing, lesson conflicts, balance calculation, and backup integrity. Rust tests cover workspace persistence, retention of the previous daily state, and rejection of invalid backup envelopes.

Before publishing a release, verify on real macOS and Windows installations:

1. Fresh installation and profile creation.
2. Student, lesson, and payment creation; data still present after closing and reopening.
3. Lesson completion, cancellation, conflicts, and balance recalculation.
4. Backup export, cancellation of file dialogs, and restoration with confirmation.
5. Rejection of invalid backups without replacing current data.
6. Installation of a newer build over an existing workspace.
7. Reopening the existing window when launching another instance.

The Apple Silicon macOS installer has been built locally. Native window interaction was not verified through automation because macOS computer-control permissions were unavailable. The universal macOS and Windows x64 builds have also completed successfully in GitHub Actions, and version 0.1.0 is published. Full native installation and interface testing still requires platform verification.

## GitHub Releases

The workflow at [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml) creates:

- A universal macOS application and DMG.
- A Windows NSIS installer.
- A **draft prerelease** containing the build assets.
- Stable download filenames for the main README buttons: `Tutorly-macOS.dmg` and `Tutorly-Windows-Setup.exe`.

It uses the repository's `GITHUB_TOKEN` with `contents: write`. It does not upload user databases or backups.

### Publish version 0.1.0

1. Push the source and lock files to GitHub.
2. Open **Actions → Desktop installers → Run workflow**, or push the matching version tag:

   ```sh
   git tag desktop-v0.1.0
   git push origin desktop-v0.1.0
   ```

3. Wait for both platform jobs to finish successfully.
4. Open **Releases** and review the generated draft and attached installers.
5. Complete platform testing and signing setup as appropriate for the release audience.
6. Publish the draft when it is ready for users.

Creating or pushing a tag is a maintainer action; the instructions above do not imply that a release has already been published.

### Prepare a new version

Keep these version fields aligned:

- `desktop/package.json`
- `desktop/src-tauri/Cargo.toml`
- `desktop/src-tauri/tauri.conf.json`

Update `desktop/package-lock.json` and `desktop/src-tauri/Cargo.lock`, update user-facing version text and the download button URLs in the main README, and use a matching `desktop-vX.Y.Z` tag. The workflow derives its release version from the Tauri application configuration.

### Signing and updates

The current workflow produces preview installers without publisher signing or Apple notarization. Configure signing credentials as GitHub Actions secrets before general public distribution. Never commit signing keys or certificates to the repository.

References: [macOS signing and notarization](https://v2.tauri.app/distribute/sign/macos/), [Windows installer packaging](https://v2.tauri.app/distribute/windows-installer/).

There is no automatic updater in 0.1.0. Users manually install a newer version; the workspace database is stored separately from the application files. Preserve backward compatibility or provide migrations when changing persistence formats.

## Scope of the preview

Not implemented: cloud sync, in-app profile switching, payment editing, a dedicated finance ledger, automatic updates, snapshot recovery UI.

The older web application in the repository's `client/` and `src/` directories is separate. Its dependencies, database migration scripts, and root `dev` / `build` commands belong to that legacy application. Desktop development does not import its data.
