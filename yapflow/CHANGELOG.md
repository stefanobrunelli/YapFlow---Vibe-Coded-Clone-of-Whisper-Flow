# Changelog

All notable changes to YapFlow are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

---

## [Unreleased] — feature/v0.2.0-groq

### Added
- Groq API integration for dramatically faster transcription (`whisper-large-v3-turbo`)
- Groq LLaMA 3.3 70B for text rewriting (~10x faster than GPT-4o-mini)
- Groq API key management in Settings — stored securely in macOS Keychain
- Automatic fallback to OpenAI if no Groq key is set (zero config change needed)
- Provider badge in Settings shows "Active — faster" when Groq is configured

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
