# Changelog

All notable changes to YapFlow are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

---

## [2.0.2] — 2026-04-26

### Fixed
- Global shortcut no longer becomes unresponsive after the Mac sleeps/wakes or the screen locks/unlocks. The `uiohook-napi` listener is now re-armed on `powerMonitor` `resume` and `unlock-screen` events.

### Changed
- Decrypted API keys are cached in memory after the first read (still encrypted at rest in macOS Keychain via `safeStorage`) to reduce repeated Keychain prompts during a session.
- Repository repositioned as a personal portfolio/showcase project rather than a public installer distribution.

### Removed
- Experimental `utilityProcess` shortcut helper (`src/main/hookChild.ts`, `src/shared/hookIpc.ts`). It broke macOS permission identity for Input Monitoring; reverted to in-process `uiohook-napi`.

---

## [2.0.1] — 2026-04-23

### Changed
- Hardcoded `appId` and `productName` in the build pipeline; explicit `artifactName` for predictable output files.
- New packaging scripts: `package:mac`, `package:mac:unsigned`, `package:mac:test`, `package:mac:unsigned:test`.
- Added `scripts/run-electron-builder.mjs` wrapper, `scripts/create-self-signed-cert.mjs` helper, and `scripts/install-yapflow.sh` install helper.
- `scripts/patch-uiohook-napi.mjs` runs in `postinstall` so native bindings stay aligned with the Electron version.

---

## [2.0.0] — 2026-04-21

### Added
- Groq API integration for faster transcription (`whisper-large-v3-turbo`).
- Groq LLaMA 3.3 70B for text rewriting (~10× faster than GPT-4o-mini).
- Groq API key management in Settings — stored securely in macOS Keychain.
- Automatic fallback to OpenAI when no Groq key is set (no config change needed).
- Provider badge in Settings shows "Active — faster" when Groq is configured.

### Changed
- Upgraded to Electron 41.

---

## [0.1.0] — 2025-03-17

### Added
- Initial release
- Voice-to-text via global hotkey ⌘⌥Space (hold to record, release to transcribe)
- Three output modes: Raw transcript, Clean text, AI Prompt
- Auto-paste into active application (requires Accessibility permission)
- Floating HUD pill window — stays above all apps
- Local history of last 100 recordings with cost tracking
- OpenAI API key stored in macOS Keychain via safeStorage
- Light / Dark / System appearance modes
- Configurable global shortcut (hold or toggle behavior)
- Cost tracking per recording
