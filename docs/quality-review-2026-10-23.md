# Quality review — 2026-10-23

Scope: active Lessavio desktop source, including the pending Firebase account and analytics integration. This review does not certify that all possible defects are absent.

## Fixed

| Area | Defect and correction |
| --- | --- |
| Backup validation | Malformed recurrence metadata could reach scheduling. Shared validation now checks real dates, range, weekday uniqueness, time, interval and time zone. |
| Timestamps | Invalid calendar dates and timestamps without an explicit time zone could be accepted. Validation now rejects them. |
| Series editing | Inferred series dates could lose the original end boundary and shift every-other-week phase after moving lessons. Preserve the original range and phase. |
| Student reassignment | A lesson moved to another student could retain the original student's series. Reassignment now detaches it. |
| DST scheduling | Single lessons could silently normalize nonexistent or ambiguous local times. Reject these inputs while preserving existing known instants on unchanged-time edits. |
| Sorting | ISO strings with different offsets could sort out of chronological order. Sort by numeric timestamp. |
| Finance | Month navigation could exceed the supported year range. Validate month input and bound navigation to 0001–9999. |
| Auth lifecycle | Observer failures and stale callbacks could retain/adopt the wrong active workspace. Deactivate before all transitions and guard asynchronous callbacks. |
| Verification email | A registration callback could target a later current user. Pass the user created by that registration explicitly. |
| Reminders | Stale snapshots could notify after cancellation, rescheduling or account switching. Recheck current state immediately before delivery under native locks. |
| Reminder migration | Legacy notification history could be lost during migration. Import guest deduplication records once. |
| Translation | Language descriptions and new validation/session messages lacked complete localization. Added English, Ukrainian and Russian coverage plus an automated source/catalog/placeholder check. |

## Verification

- 34 TypeScript tests passed, including regression cases for recurrence, backup validation, DST, reassignment, finance bounds and account transition races.
- 9 Rust tests passed, including scoped persistence/migration and reminder-history migration.
- Translation audit passed: 324 keys per language, including interpolation checks.
- TypeScript check and Vite production build passed. Vite reports a non-blocking bundle-size warning.
- Production dependency audit found zero vulnerabilities.
- Browser checks: settings in English, Ukrainian and Russian; language descriptions; finance navigation at December 9999; no browser errors in that boundary check.
- Screenshot: `lessavio-translations-review.png`, saved in the Codex visualization directory for this task.

## Remaining verification and limits

- Native macOS/Windows installation, OS notification delivery and week-view drag completion still require installed-app/device checks.
- Real email delivery and GA4 report ingestion were not verified. Production browser analytics SDK initialization was checked earlier; development analytics sends no network events.
- Teaching data remains local, without cloud synchronization or database encryption.
- No release was published by this review. Existing local installers may predate these fixes.

Project context for future sessions: `../AGENTS.md`.
