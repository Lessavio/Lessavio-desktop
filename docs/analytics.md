# Firebase Analytics (source version 0.5.0)

Lessavio uses Google Analytics for Firebase with the public Web stream `G-10939TYT88` in Firebase project `lessavio-1fa05`. The stream ID was verified against Firebase's public Web app configuration. There is no custom analytics server, embedded Measurement Protocol secret, or service-account key.

## User choice

In **Settings → Usage analytics → Help improve Lessavio**, the user can enable collection. It is off by default. The Firebase Analytics module, Google tag script, and installation requests are not initialized before consent. Firebase Authentication is independent and may make its normal requests when analytics is off.

Consent is saved in the local webview's storage per workspace. It is not a field in the teaching database, is not copied from guest data into an account, and is not included in backups. Clearing webview storage resets consent to off. Switching workspaces disables the previous collection context and discards queued app events. Turning collection off blocks new events immediately, including while initialization is pending; requests already in flight cannot be recalled, and existing reports are not deleted.

The settings describe Google as the recipient and disclose browser/installation identifiers and technical network processing, including IP addresses. These statistics should not be described as completely anonymous. Lessavio never calls `setUserId` with an auth UID or an email address.

## Events and properties

Only finite, app-defined event and screen names are accepted. The event API does not accept arbitrary form data or workspace objects.

| Event | Trigger |
| --- | --- |
| `app_opened` | First successful analytics activation in an app session. A user who first opts in during a session is counted at that point. |
| `screen_view` | Today, Calendar, Students, Finances, or Settings. |
| `onboarding_completed` | Local profile saved for the first time, if collection was already enabled. |
| `student_created`, `student_updated` | Student changes saved successfully. |
| `lesson_created`, `lesson_updated`, `lesson_completed`, `lesson_rescheduled` | Lesson changes saved successfully. |
| `series_created`, `series_updated`, `series_cancelled` | Recurring schedule changes saved successfully. |
| `payment_recorded`, `payment_deleted` | Payment changes saved successfully, without amounts or student references. |
| `backup_exported`, `backup_restored` | Backup successfully exported/restored. Cancellation and errors do not count. |

Common custom properties are `platform`, `operating_system`, `app_version`, and `ui_language`. `screen_view` also includes an allowlisted `screen_name`. No names, emails, Firebase auth UIDs, phone numbers, notes, file paths, entity IDs, lesson dates, or financial amounts are passed as event properties. Events generated before consent are not replayed. The in-memory initialization queue is limited to 20 app events and is cleared on opt-out or scope changes.

The Google SDK may additionally generate standard technical/session events and its browser/installation identifiers. No screen recording is installed. Google signals and advertising personalization are disabled; `ad_storage`, `ad_user_data`, and `ad_personalization` remain denied. Automatic initial page views are disabled. A fixed virtual page URL under the Firebase app domain is used instead of a local filesystem URL, navigation query, or user-entered value.

## Firebase / GA4 setup

1. In Firebase Console, confirm that Google Analytics is connected to the project and the Web app has measurement ID `G-10939TYT88`.
2. In the connected Google Analytics property, open **Admin → Data streams → Web stream**. Turn off **Enhanced measurement** if only the explicitly listed events are desired. Keep Google signals, advertising personalization, and user-provided data collection off; this app does not configure advertising or enhanced conversions.
3. Review data retention, access permissions, and your user-facing privacy notice.
4. To use another project, set all public Firebase environment values in `desktop/.env.local`, including `VITE_FIREBASE_MEASUREMENT_ID`. A different project without a measurement ID will not fall back to Lessavio's Analytics stream.
5. Build a production preview or installer. Development builds deliberately use a no-network analytics transport, even if the consent checkbox is selected; this avoids polluting reports during development and Auth emulator testing.
6. Enable collection in a test workspace and open screens or create test records. Inspect **Analytics → Realtime** / the connected GA4 property. Custom event properties can be registered as event-scoped custom dimensions (`platform`, `operating_system`, `app_version`, `ui_language`, `screen_name`) for reports. Standard reports may not update immediately.

## Tauri and future platforms

The current desktop integration runs the Firebase Web SDK in the Tauri webview. Native CSP permits only the required Google tag, Analytics, Firebase installation/configuration, and existing Auth destinations. `isSupported()` checks web storage support. If initialization is unsupported, blocked, offline, or times out, the settings show that status and local teaching features continue to work. Enabled means SDK initialization succeeded, not a guarantee that every event has appeared in reports.

Analytics delivery in a packaged macOS/Windows webview still requires a platform smoke test; cookie/storage behavior can differ from a browser. The desktop integration uses a Web stream and labels its custom `platform` property `desktop`. It is not a native Windows/macOS Firebase Analytics SDK. Future Web apps can share the Web integration; future iOS and Android apps should use their native Firebase Analytics SDKs/app streams in the same Firebase/GA4 project with the same event vocabulary and consent behavior.

## Verification

Pure tests cover default-off consent, per-workspace preferences, event/property allowlists, dropping events after revocation during initialization, stale initialization after account switching, and unsupported/offline adapters. UI checks cover the initial unchecked state, enabling, and disabling the setting in development without Google delivery. A production browser preview served with the native CSP also initialized the real Firebase Analytics SDK successfully: the Google client ID readiness callback completed and no browser console/CSP errors were observed. This does not establish ingestion in the Firebase/GA4 reports, which was not inspected. Packaged native-webview delivery still requires a platform smoke test.

References: [Firebase Analytics setup](https://firebase.google.com/docs/analytics/get-started?platform=web), [JavaScript API and consent controls](https://firebase.google.com/docs/reference/js/analytics).
