# YapFlow

> Voice-to-text for Mac that actually understands what you're saying.

Hold a key, speak, release — YapFlow transcribes your voice and rewrites it into clean text or a polished AI prompt, instantly pasted wherever you're typing.

![Platform](https://img.shields.io/badge/platform-macOS%2013%2B-lightgrey?logo=apple)
![Version](https://img.shields.io/badge/version-2.0.2-blue)
![Stack](https://img.shields.io/badge/stack-Electron%20%2B%20React%20%2B%20TypeScript-informational)
![Powered by](https://img.shields.io/badge/powered%20by-OpenAI-412991)

---

## What It Does

YapFlow lives quietly in your Mac's menu bar. Press and hold **⌘⌥Space**, say what you want, then release — your words appear instantly as clean text (or a structured AI prompt) in whatever app you were just typing in.

Built as a fast, private, low-cost alternative to Wispr Flow. No subscription. No cloud sync. Just your voice and your API key.

---

## Features

- **Hold-to-record** — global shortcut works in any app, any window
- **Three output modes** — Raw transcript · Clean text · AI Prompt
- **Auto-paste** — result lands directly in whatever you were typing in (optional)
- **Floating HUD** — minimal pill window stays above all other apps
- **Local history** — last 100 recordings stored on your Mac, never sent anywhere
- **Cost tracking** — see the USD cost of every recording, down to fractions of a cent
- **Secure API key storage** — key encrypted in macOS Keychain, never stored in plaintext
- **Customisable shortcut** — remap to any key combo in Settings

---

## Showcase Status

This repository is a portfolio/showcase project for YapFlow. It is not packaged as a polished public installer, and macOS permissions can be sensitive to bundle identity, signing, and where the app is launched from.

If you run it locally, expect to provide your own OpenAI or Groq API key and grant macOS Microphone, Accessibility, and Input Monitoring permissions.

---

## For Developers

### Prerequisites

| Requirement | Details |
|---|---|
| macOS | 13 Ventura or later |
| Node.js | 20 LTS — `nvm install 20` |
| Xcode CLI | `xcode-select --install` |
| OpenAI API key | Needs access to `gpt-4o-mini-transcribe` and `gpt-4o-mini` |

### Quick Start

```bash
# Clone and enter the project
git clone <repo-url>
cd yapflow

# Install dependencies
npm install

# Rebuild native modules for Electron
npx electron-rebuild -f -w uiohook-napi

# Start in development mode (hot reload on renderer changes)
npm run dev
```

On first launch the Settings window opens automatically. Enter your OpenAI API key (`sk-...`) and click Save.

### Grant macOS Permissions

The app needs three permissions to work fully:

| Permission | Why | Where to grant |
|---|---|---|
| **Input Monitoring** | Detect the global shortcut | System Settings → Privacy & Security → Input Monitoring |
| **Microphone** | Record your voice | Auto-prompted on first use |
| **Accessibility** | Auto-paste into the active app | System Settings → Privacy & Security → Accessibility |

Input Monitoring is required. Accessibility is optional (clipboard-only mode works without it).

### Build Locally

```bash
# Production build output
npm run build

# Optional local macOS package
npm run package:mac:unsigned
```

Package output files land in `releases/`, which is intentionally ignored by git.

| File | For |
|---|---|
| `YapFlow-2.0.2-arm64.dmg` | Apple Silicon Macs (M1/M2/M3/M4 — any Mac from late 2020) |
| `YapFlow-2.0.2-arm64.zip` | Apple Silicon Macs, zipped app bundle |

This GitHub repo is meant to show the app and code, not to distribute binaries to external users.

---

## Output Modes

| Mode | What it does | Typical cost |
|---|---|---|
| **Raw** | Exact transcription, nothing changed | ~$0.0005 per 10s clip |
| **Clean** | Removes filler words, fixes punctuation, keeps your voice | ~$0.001 per clip |
| **AI Prompt** | Structures your rambling into a Goal / Context / Tasks / Output prompt | ~$0.001 per clip |

Typical usage: **less than $0.001 per recording**. A €5 / $5 OpenAI credit covers thousands of uses.

---

## Architecture

```
src/
├── shared/              # Types + IPC channel names (shared by main & renderer)
│   ├── types.ts         # All TypeScript interfaces
│   └── constants.ts     # IPC channels, key codes, OpenAI model config
│
├── main/                # Electron main process (Node.js — full OS access)
│   ├── index.ts             # App lifecycle + bootstrap order
│   ├── openaiClient.ts      # ★ Security boundary — all OpenAI calls live here
│   ├── settingsStore.ts     # electron-store + macOS safeStorage (Keychain)
│   ├── shortcutManager.ts   # Hold-to-record via uiohook-napi
│   ├── windowManager.ts     # Floating HUD + Settings window
│   ├── historyStore.ts      # Local history CRUD (up to 100 entries)
│   ├── autoPaste.ts         # AppleScript paste (Accessibility-gated)
│   ├── permissionChecker.ts # macOS permission status
│   └── ipcHandlers.ts       # Registers all IPC channels
│
├── preload/             # Secure bridge between main and renderer
│   └── index.ts         # contextBridge.exposeInMainWorld('api', ...)
│
└── renderer/            # React app (sandboxed — no Node.js access)
    └── src/
        ├── App.tsx              # Root — HUD vs Settings routing
        ├── hooks/               # useAppState, useRecording, useIPCListener
        └── components/          # FloatingWindow, Settings, History
```

**Security model:**
- The renderer runs with Node.js disabled and no direct filesystem access
- The preload script is the only bridge and explicitly whitelists every channel
- The OpenAI API key never leaves the main process; it's encrypted via macOS Keychain
- `contextIsolation: true` · `nodeIntegration: false` · `sandbox: false`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Shortcut does nothing | System Settings → Privacy & Security → Input Monitoring → add YapFlow |
| "Unidentified developer" warning | System Settings → Privacy & Security → scroll down → "Open Anyway" |
| Microphone access denied | System Settings → Privacy & Security → Microphone → add YapFlow |
| Auto-paste doesn't work | System Settings → Privacy & Security → Accessibility → add YapFlow |
| `uiohook-napi` build error | Run `xcode-select --install`, then `npx electron-rebuild -f -w uiohook-napi` |
| Settings lost after update | Config: `~/Library/Application Support/YapFlow/config.json` — API key is in Keychain |

Additional private-tester troubleshooting notes: [Setup Guide → Troubleshooting section](yapflow/SETUP_GUIDE.md#troubleshooting)

---

## Tech Stack

- **[Electron 41](https://electronjs.org)** — Desktop app shell
- **[React 18](https://react.dev) + [TypeScript](https://typescriptlang.org)** — UI and type safety
- **[electron-vite](https://electron-vite.org)** — Build tooling
- **[Tailwind CSS](https://tailwindcss.com)** — Styling
- **[OpenAI SDK](https://github.com/openai/openai-node)** — Transcription + rewriting
- **[uiohook-napi](https://github.com/nicholasgasior/uiohook-napi)** — Global keyboard events
- **[electron-store](https://github.com/sindresorhus/electron-store)** — Persistent settings

---

## License

MIT — do whatever you want with it.
