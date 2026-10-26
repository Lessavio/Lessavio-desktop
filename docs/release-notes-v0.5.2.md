## What is new in 0.5.2

- Removed Google sign-in from the desktop welcome screen and account forms, including the unused native OAuth callback and configuration. Email/password registration, sign-in, email verification, password reset and local guest mode remain available.
- Fixed the Add lesson button in empty schedules: the plus icon now stays vertically centered with its label. The illustration margin no longer affects icons inside buttons.
- Existing workspaces, backups and account isolation remain compatible. Optional analytics still requires explicit consent. No cloud synchronization is introduced.

**Released:** 0.5.2 installers are available from [GitHub Releases](https://github.com/Lessavio/Lessavio-desktop/releases/tag/desktop-v0.5.2).

**Before updating:** export a JSON backup. Teaching data remains local. Do not downgrade to 0.4.0 after editing in 0.5.x because older versions read the retained legacy migration snapshot.

Installers: **Lessavio-macOS.dmg** (Apple Silicon and Intel) and **Lessavio-Windows-Setup.exe** (Windows x64). macOS builds remain unsigned and unnotarized.

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
