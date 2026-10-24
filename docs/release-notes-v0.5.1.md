## What is new in 0.5.1

- Separate **Create an account** and **Sign in** buttons on the welcome screen, with direct access to the registration form.
- Twelve selectable student colors, shown in student cards, calendar entries and daily schedules.
- Fixed cancellation of upcoming recurring lessons with an in-app confirmation. Completed lessons and payments are preserved.
- Archived students no longer appear in the calendar, today's schedule, upcoming lesson card or reminders. Their records and finances remain available.
- Fixed shrinking time-zone, currency and interface-language selectors during scrolling.
- Fixed the date picker Close button reopening the calendar, and aligned the Add lesson icon with its text.
- Firebase build configuration now comes from environment variables and GitHub Actions secrets.

**Google sign-in status:** system-browser desktop OAuth with PKCE has been implemented, but Google sign-in is not enabled in this release because a Desktop OAuth Client ID has not been configured. Email/password sign-in and local guest mode remain available.

**Before updating:** export a JSON backup. Teaching data remains local; cloud synchronization is not enabled. Do not downgrade to 0.4.0 after editing in 0.5.x, because older versions read the retained legacy migration snapshot.

Download **Lessavio-macOS.dmg** for Apple Silicon or Intel Macs, or **Lessavio-Windows-Setup.exe** for Windows x64. These are unsigned preview installers.

### Install on macOS (unsigned preview)

Lessavio does not yet have an Apple Developer ID signature or notarization. macOS may block its first launch because Apple cannot verify the developer. Only proceed if you trust this download from this repository.

1. In **Assets** below, download **Lessavio-macOS.dmg** (supports Apple Silicon and Intel). Do not download the Source code archives.
2. Open the DMG and drag **Lessavio.app** into **Applications**.
3. Eject the disk image, then open **Lessavio** from **Finder → Applications**.
4. If macOS blocks the app, dismiss the warning without moving the app to Trash.
5. Open **Apple menu → System Settings → Privacy & Security** and scroll to **Security**.
6. Find the message about Lessavio and click **Open Anyway**. This option appears after an attempted launch; if it is missing, try opening Lessavio again and return to these settings.
7. Authenticate with your Mac password or Touch ID if requested, then click **Open** in the confirmation dialog.
8. Complete the local profile setup. Later launches normally work from Applications.

This grants an exception for this app. You do not need to disable Gatekeeper or run Terminal commands. If macOS explicitly reports malware or damage, stop and obtain a fresh installer from this repository instead of bypassing that warning.

![macOS installation: 1. Select Privacy & Security; 2. Click Open Anyway.](https://raw.githubusercontent.com/Lessavio/Lessavio-desktop/main/docs/images/macos-open-anyway-guide.png)

**1 — Privacy & Security. 2 — Open Anyway.** Scroll down to the Security section first. The button appears after macOS blocks an attempted launch.

*Illustrative screenshot from [Apple Support](https://support.apple.com/en-us/102445), annotated with AI-assisted arrows. “Example App” represents Lessavio; macOS layout and wording may vary.*

See [Apple's official instructions for opening an unverified app](https://support.apple.com/en-us/102445).

