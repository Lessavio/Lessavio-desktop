# Accounts and future synchronization (source version 0.5.0)

## Available now

Lessavio uses Firebase Authentication for optional email/password registration, sign-in, verification email, password reset, session restoration, and sign-out. Email and password go directly to Firebase; no Lessavio authentication server is required. Passwords are not written to SQLite or JSON backups. Firebase persists its own session in the webview's IndexedDB, with localStorage as the SDK fallback. This is standard Firebase browser persistence, not OS keychain encryption.

Users can continue without an account. Account actions require internet access; a previously restored session can continue using local data offline. Offline access does not verify that an account is still valid on the server, and cannot enforce remote revocation until the SDK reconnects.

The included public Web app configuration targets `lessavio-1fa05`. It is intentionally distributable and is not a service account credential. Firestore, Storage, Google login, phone login, and anonymous Firebase sign-in are not initialized. Firebase Analytics is separate and initializes only after the user opts in; see [Analytics](analytics.md). Enabling these providers in the Firebase Console does not add their UI flows. Local guest mode does not create a Firebase user.

## Local data separation

All teaching data remains in the existing `tutorly.sqlite` file under `com.tutorly.desktop`.

- `guest` is the local workspace used before accounts were introduced.
- `firebase:<projectId>:<uid>` identifies a separate account workspace on this device.
- Switching accounts remounts the workspace UI, including forms, selected students, and pending restore dialogs.
- Loading, saving, daily snapshots, backup exports, and notifications are scoped to the selected workspace.
- Sign-out keeps the database and returns to the account chooser. Continuing without an account opens guest data, not the signed-out account's data.
- A first-time account has an empty local workspace. **Data from before registration → Copy local data** copies the guest workspace after explicit confirmation, only when the destination has no profile or records. Original guest data is preserved. The two copies are independent, not synchronized.
- JSON backup imports replace only the current workspace. Backups contain no Firebase UID, password, auth token, or native change journal. A backup may be restored to a different workspace deliberately.

This separation is an application behavior, not protection against a person who can read or modify files under the same OS user. The SQLite database and exports are not encrypted. Firebase authentication does not secure local filesystem access.

## SQLite migration and sync preparation

`repository.rs` migrates SQLite `user_version` 1 to 2 in a transaction. The legacy singleton document and its snapshots are copied once into the guest workspace. Original tables are retained as a migration safety copy; subsequent writes go to the new tables. Existing entity IDs and JSON backup version 1 are preserved.

Do not downgrade to 0.4.0 after editing in 0.5.0: older binaries read the retained legacy document and will not see newer edits. Export a JSON backup before updating and use a current app to recover current data. Newer unknown SQLite versions are rejected rather than overwritten.

| Table | Purpose |
| --- | --- |
| `local_workspaces` | Scope, stable local workspace ID, current JSON document, monotonically increasing workspace revision, and UTC modification time. |
| `local_backups` | Up to 14 previous daily snapshots per workspace. |
| `local_record_versions` | Last local revision of each profile/student/lesson/payment and durable deletion tombstones. |
| `local_changes` | Ordered local upserts/deletes with record payloads and local workspace revision. |
| `local_notifications` | Per-workspace notification deduplication. |

A save atomically updates the document, snapshot, changed-record versions, and journal. Unchanged saves create no revisions. Snapshot/backup restore produces ordinary updates and deletion tombstones by comparing entity IDs. Migrated records can be included in an initial full snapshot even if no subsequent change exists in the journal.

These revisions order changes on one device only. They are not cloud versions, conflict resolution, or server authorization. The journal is retained locally and is not uploaded or automatically pruned. A future sync implementation must define compaction after server acknowledgement.

The React UI depends on `WorkspaceRepository` (`storage.ts`), separating UI actions from Tauri persistence. No remote database is selected yet.

## Firebase setup

1. In Firebase Console, use the `lessavio-1fa05` project or create your own project and register a **Web app** for the Tauri webview client.
2. Enable **Authentication → Sign-in method → Email/Password**. Other providers are not required by this version.
3. Configure the password policy and verification/reset email templates. Registration requires at least eight characters locally and obeys additional Firebase policy requirements.
4. Enable email enumeration protection. Password reset uses a neutral confirmation message; credential errors use a generic message.
5. Review authorized domains and API key restrictions for the intended web and packaged desktop environments. Verify on a packaged macOS and Windows build. No OAuth redirect domain or browser callback is needed for email/password sign-in.
6. Copy `desktop/.env.example` to `desktop/.env` and fill in your Firebase Web app configuration. `.env` and `.env.local` are ignored by Git; no project values are checked into the source. Restart Vite or rebuild after editing. Without configuration, local guest mode remains available but authentication is unavailable. Configuration is embedded at build time and remains readable in the distributed app. Never put service account keys or Admin SDK credentials in `VITE_*` values.

For release builds, configure repository Actions secrets named `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_FIREBASE_MEASUREMENT_ID`. The workflow validates their presence without printing values. Removing a file from current source does not erase older commits or already published installers.
7. Never put Admin SDK private keys or service-account JSON into the frontend, environment example, or repository. Future cloud access must verify Firebase identity and enforce ownership on the server/security rules; trusting a client-supplied UID is insufficient.

Native CSP allows the Auth API endpoints and the specific Google endpoints required by optional Analytics. Authentication does not enable Analytics. See [Analytics](analytics.md) for consent, allowed events, and network destinations.

## Local Auth emulator checks

From the repository root, start the official emulator:

```sh
npx firebase-tools emulators:start --only auth --project demo-lessavio --config desktop/firebase.emulator.json
```

In a second terminal:

```sh
VITE_FIREBASE_PROJECT_ID=demo-lessavio \
VITE_FIREBASE_API_KEY=demo-key \
VITE_FIREBASE_AUTH_DOMAIN=demo-lessavio.firebaseapp.com \
VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099 \
npm run dev --prefix desktop -- --port 1421
```

Open the displayed localhost URL. Emulator mode is accepted only in development, with a `demo-` project and a loopback address. Production builds ignore the emulator URL. The emulator creates no production users and sends no real emails; verification/reset actions are available in its output.

Verified through the browser UI: registration, verification status refresh, reset-email request, sign-out, local guest mode, repeat sign-in to the original workspace, session restoration after reload, and restoration while the emulator was stopped. Browser workspace data is intentionally session-only; SQLite tests verify durable migration and separation. Real Firebase email delivery and packaged WebView behavior on macOS/Windows require a platform smoke test with a user-controlled test account.

## Future cloud implementation

Keep local SQLite as the working copy. Add an authenticated sync transport behind the repository boundary only after deciding the server database and protocol. Before enabling it, implement:

1. Explicit connection/upload of a local workspace and a preview if cloud data already exists.
2. Server-issued workspace membership and per-record authorization; verified email where required.
3. Initial snapshot upload, change acknowledgements, stable operation IDs, retries, and idempotency.
4. Server revisions / concurrency tokens and a deliberate conflict policy for edits, deletions, and series changes.
5. Remote tombstone handling, migration/version negotiation, account deletion, and retention policy.
6. Offline queue limits, compaction, encryption choices, recovery, and multi-device integration tests.

Firebase sign-in alone does not upload, synchronize, back up, or encrypt teaching data.

References: [Password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Session persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence), [User management](https://firebase.google.com/docs/auth/web/manage-users).


## Google sign-in on desktop

The welcome screen has separate **Create an account** and **Sign in** actions, plus **Continue with Google**. The same Google action is offered in the email form. Guest mode remains available.

Desktop Google sign-in opens the system browser, uses Authorization Code + PKCE (S256) and a temporary `127.0.0.1` callback on an ephemeral port, then exchanges the Google ID token for a Firebase session. No hosted backend or Google refresh token storage is added. State/path checks, a two-minute timeout and cancellation protect the local callback. Error responses never expose tokens.

Enabling Google in Firebase is necessary but does not create a Desktop OAuth client:

1. Open Google Cloud Console / Google Auth Platform **Clients** in the same project as Firebase.
2. Create an OAuth client of type **Desktop app**. Use only its client ID; do not use a service account or a Web client secret.
3. Set `VITE_GOOGLE_DESKTOP_CLIENT_ID` in ignored `desktop/.env` and in a matching repository Actions secret, then rebuild.
4. In Firebase Authentication → Google provider, authorize that client ID under the external-project/client-ID allowlist if required by your project configuration. Configure the consent screen/audience and test users as appropriate.
5. Test browser approval, denial, cancellation, restart persistence and sign-out on both macOS and Windows. Until configured, the desktop Google action is disabled with an explanation; email/password and local mode still work.

Browser preview uses Firebase's popup flow; its origin must be in Firebase authorized domains. Real Google sign-in is not verified until the Desktop client is configured.
