# YapFlow

A lightweight macOS alternative to Wispr Flow. Hold **⌘⌥Space** to record your voice, release to transcribe and rewrite it, then paste into any app.

## Features

- **Hold to record** — global shortcut (Cmd+Option+Space) captures mic while held
- **Three output modes** — Raw Transcript, Clean Text, or AI Prompt
- **Clipboard + auto-paste** — result goes to clipboard; auto-paste into the active app if Accessibility is granted
- **Local history** — last 500 results stored locally with cost and latency data
- **Secure API key storage** — key encrypted via macOS Keychain (safeStorage), never stored in plaintext
- **Floating always-on-top window** — vibrancy HUD effect, stays above all other apps

## Prerequisites

| Requirement | Version |
|---|---|
| macOS | 13 Ventura or later |
| Node.js | 20 LTS (`nvm install 20`) |
| Xcode CLI | `xcode-select --install` |
| OpenAI API key | With access to `gpt-4o-mini-transcribe` + `gpt-4o-mini` |

## Setup

### 1. Install Node.js

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc

# Install and use Node 20
nvm install 20
nvm use 20
node --version  # Should show v20.x.x
```

### 2. Install dependencies

```bash
cd yapflow
npm install
```

### 3. Rebuild native modules for Electron

`uiohook-napi` is a native module that must be compiled for Electron's specific Node version:

```bash
npx electron-rebuild -f -w uiohook-napi
```

If this fails with a build error, ensure Xcode CLI tools are installed:
```bash
xcode-select --install
```

### 4. Run in development

```bash
npm run dev
```

The app will launch. The renderer has hot module replacement (HMR). Changes to the main process require restarting.

### 5. Configure API key

When the app first launches, the Settings modal opens automatically. Enter your OpenAI API key (`sk-...`) and click Save. The key is encrypted with macOS Keychain and survives restarts.

### 6. Grant macOS permissions

The app needs two permissions to work fully:

**Microphone** (required):
- Granted automatically the first time you record (macOS shows a dialog)
- If you denied it: System Settings → Privacy & Security → Microphone → add YapFlow

**Input Monitoring** (required for the shortcut):
- System Settings → Privacy & Security → Input Monitoring
- Add your **Terminal** app (for `npm run dev`) or the packaged app
- This lets uiohook-napi detect the global shortcut

**Accessibility** (optional, for auto-paste):
- System Settings → Privacy & Security → Accessibility
- Add the Electron binary or packaged app
- Without this, the app works in clipboard-only mode

## Usage

1. Make sure the app is running (look for it in the menu bar)
2. Open any text field (Notes, browser, IDE, etc.)
3. **Hold ⌘⌥Space** — the orb turns red and recording begins
4. **Speak** your text or prompt
5. **Release** — transcription and rewriting happen automatically (~1–3s)
6. The result is copied to your clipboard (and pasted if auto-paste is enabled)
7. The result appears in the floating window for review

## Output Modes

| Mode | What it does | Cost |
|---|---|---|
| **Raw** | Exact transcription, no changes | Transcription only |
| **Clean** | Removes fillers, fixes punctuation, preserves your voice | Transcription + rewrite |
| **AI Prompt** | Transforms rambling speech into a structured AI-ready prompt | Transcription + rewrite |

Switch modes with the tab selector in the window, or set a default in Settings.

## Packaging (distributable DMG)

```bash
# Build for both Intel and Apple Silicon
npm run package:mac
```

Output: `dist/YapFlow-0.1.0-arm64.dmg` and `YapFlow-0.1.0-x64.dmg`

## Architecture

```
src/
├── shared/           # Types + IPC channel names (used by both processes)
│   ├── types.ts      # All TypeScript interfaces
│   └── constants.ts  # IPC channels, key codes, OpenAI config
│
├── main/             # Electron main process (Node.js)
│   ├── index.ts          # Bootstrap + app lifecycle
│   ├── windowManager.ts  # Floating vibrancy window
│   ├── shortcutManager.ts # Hold-to-record via uiohook-napi
│   ├── openaiClient.ts   # SECURITY BOUNDARY — API key + OpenAI calls
│   ├── settingsStore.ts  # electron-store + safeStorage
│   ├── historyStore.ts   # Local history CRUD
│   ├── autoPaste.ts      # AppleScript paste (Accessibility-gated)
│   ├── permissionChecker.ts
│   ├── logger.ts
│   └── ipcHandlers.ts    # All IPC channel registrations
│
├── preload/          # Secure bridge between main and renderer
│   └── index.ts      # contextBridge.exposeInMainWorld('api', ...)
│
└── renderer/         # React app (browser sandbox)
    └── src/
        ├── App.tsx            # Root — pipeline orchestration
        ├── hooks/             # useAppState, useRecording, useIPCListener
        └── components/        # FloatingWindow, Settings, History
```

**Security model:**
- The renderer runs in a sandboxed browser context with no Node.js access
- The preload script is the only bridge — it explicitly whitelists every IPC channel
- The OpenAI API key lives only in the main process, encrypted in the OS Keychain
- `contextIsolation: true`, `nodeIntegration: false` are enforced

## Troubleshooting

**Shortcut not working:**
- Check System Settings → Privacy → Input Monitoring → Terminal is listed
- Restart the app after granting Input Monitoring

**"Failed to access microphone":**
- Check System Settings → Privacy → Microphone → YapFlow is allowed

**Auto-paste not working:**
- Check System Settings → Privacy → Accessibility → app is listed and checked
- The window must fully hide before paste happens (~100ms); if the target app is slow to focus, increase the delay in `autoPaste.ts`

**`uiohook-napi` build fails:**
- Run: `xcode-select --install`
- Then: `npx electron-rebuild -f -w uiohook-napi`
- On Apple Silicon ensure you're using the arm64 Node binary: `node -p process.arch` should show `arm64`

**Settings not persisting:**
- Settings are stored in `~/Library/Application Support/YapFlow/config.json`
- API key is stored encrypted in the OS Keychain — check with Keychain Access app

## Cost Estimates

| Operation | Model | Approx. cost |
|---|---|---|
| 10s voice clip | gpt-4o-mini-transcribe | ~$0.0005 |
| Rewrite (clean/prompt) | gpt-4o-mini | ~$0.0001–$0.0003 |
| Raw mode | — | $0.00 (no rewrite) |

Typical usage cost: **< $0.001 per recording**.
