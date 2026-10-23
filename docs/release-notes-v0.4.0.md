## Lessavio Desktop 0.4.0

Tutorly is now Lessavio. Existing local workspaces and JSON backups remain compatible.

### Downloads

- **macOS (Apple Silicon and Intel):** `Lessavio-macOS.dmg`
- **Windows x64:** `Lessavio-Windows-Setup.exe`

Open the DMG and drag Lessavio into Applications, or run the Windows installer. If Tutorly is still installed, use Lessavio from now on; both versions use the existing local workspace location.

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

### What's new

- Edit future lessons or all scheduled lessons in a recurring series, with preview and conflict checks. Completed/cancelled history and payments are preserved.
- Drag scheduled lessons to another day in Month view or a time slot in Week view, then confirm the exact date and time.
- Monthly financial overview: received payments, completed lesson value, planned value, outstanding debt, and prepayments.
- Local lesson reminders: 5, 10, 15, 30, or 60 minutes before a lesson, with system permission and a test notification.
- Russian, Ukrainian, and English interface.

### Preview limitations

Reminders work while Lessavio is running, including minimized. They stop when the app exits and depend on system notification settings and the computer being awake. Native notification delivery and full installation testing on both platforms remain pending. Week-view drag completion requires further platform testing.

These preview installers are unsigned and the macOS app is not notarized. There is no hosted backend; tutor data stays in local SQLite. Export a backup from Settings before installing an update.
