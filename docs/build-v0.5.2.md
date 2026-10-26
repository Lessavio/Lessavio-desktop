# Lessavio Desktop 0.5.2 build verification

Build completed on 26 October 2026. Source commit: `1494ad9c3a3aa319d4e1bb10ae33492586046732`; tag: `desktop-v0.5.2`. Source and tag are pushed to `Lessavio/Lessavio-desktop`.

[GitHub Actions run 40327721307](https://github.com/Lessavio/Lessavio-desktop/actions/runs/40327721307) succeeded on both jobs:

- macOS universal app and DMG: 7m 9s.
- Windows x64 NSIS installer: 6m 18s.

The verified release was initially saved as a draft and was published on 26 October 2026 at the user's request. [Release desktop-v0.5.2](https://github.com/Lessavio/Lessavio-desktop/releases/tag/desktop-v0.5.2) is now the latest non-prerelease. Both public stable-name installer URLs returned HTTP 200; README download buttons point to 0.5.2.

## Verification

- Local checks before push: 36 TypeScript tests, translation audit, production frontend build and 9 Rust tests passed.
- Both GitHub jobs passed dependency installation, Firebase environment validation, TypeScript tests and Tauri packaging.
- Every downloaded asset matches its GitHub SHA-256 digest and reported byte size.
- Stable DMG/EXE aliases match their versioned installers byte for byte.
- The extracted macOS application has `CFBundleShortVersionString=0.5.2`, identifier `com.tutorly.desktop`, and both `arm64` and `x86_64` executable slices.
- Windows installer has a valid PE executable header. Windows installation/runtime and macOS installation/notification smoke tests were not performed in this build task.
- macOS has no Developer ID signature/notarization. The unsigned installation guide remains in the release notes.

## Asset checksums

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `Lessavio-macOS.dmg` | 8373908 | `712357e9dc71ac12bbd10c7863a7e6ae69d41cdc950095d52fc1741adbea86bd` |
| `Lessavio-Windows-Setup.exe` | 2971540 | `b71ad3d89670d32e50f13d5133bee0dd8ac5be59ba109d031b879f9a7a685033` |
| `Lessavio_0.5.2_universal.dmg` | 8373908 | `712357e9dc71ac12bbd10c7863a7e6ae69d41cdc950095d52fc1741adbea86bd` |
| `Lessavio_0.5.2_x64-setup.exe` | 2971540 | `b71ad3d89670d32e50f13d5133bee0dd8ac5be59ba109d031b879f9a7a685033` |
| `Lessavio_universal.app.tar.gz` | 8384268 | `a0be677d80d967dda8665be7d16897662d63dd0848c1b38f33b0c0d806bd1f43` |
