# YapFlow — Setup Guide

> This guide is kept for local/private testing context. The GitHub repository is a portfolio showcase of the app and code, not a polished public binary distribution.

## Welcome

This guide will walk you through everything you need to get YapFlow running on your Mac — from zero to dictating your first message. No technical knowledge required.

**What is YapFlow?**
YapFlow is a small Mac app that lives in your menu bar. You hold a keyboard shortcut, speak, then release — and your words appear as text in whatever you were typing in. It can give you the raw transcript, clean up your speech, or turn it into a polished prompt ready for ChatGPT or any other AI tool.

**How much does it cost to use?**
YapFlow itself is free. You pay OpenAI directly for the transcription — typically less than a fraction of a cent per recording. Adding €5 to your OpenAI account is more than enough to try it out extensively (think thousands of recordings).

---

## What You'll Need

Before you start, make sure you have:

- [ ] A Mac running macOS 13 Ventura or later
  *(Not sure? Click the Apple menu () → About This Mac)*
- [ ] An OpenAI account (free to create)
- [ ] A payment method to add €5 in credit to OpenAI
- [ ] The YapFlow `.dmg` file (sent to you separately)

---

## Part 1 — Get Your OpenAI API Key

YapFlow uses OpenAI's technology to understand your speech. You'll need an API key — think of it as a personal password that connects the app to your OpenAI account.

### Step 1.1 — Create an OpenAI Account

1. Open your web browser and go to **platform.openai.com**
2. Click **Sign Up** (top right)
3. Create an account with your email address, or sign in with Google

### Step 1.2 — Add Credit to Your Account

You need to add a small amount of credit before OpenAI will process your requests.

1. Once signed in, click your **profile icon** (top right)
2. Click **Billing**
3. Click **Add payment method** and enter your card details
4. Under **Add to credit balance**, enter **€5** (or your local equivalent)
5. Click **Confirm**

> **Why €5?** At roughly €0.001 per recording, €5 gives you around 5,000 uses. You can always add more later — and if you don't use it, it just sits there.

### Step 1.3 — Create Your API Key

1. In the left sidebar, click **API keys** (or go to **platform.openai.com/api-keys**)
2. Click **+ Create new secret key**
3. Give it a name — something like "YapFlow" — and click **Create secret key**
4. You'll see a key that starts with **sk-...** — this is your API key
5. **Copy it now and paste it somewhere safe** (like a note). You won't be able to see it again after closing this window.

> **Important:** Your API key is like a password. Don't share it publicly or post it online.

---

## Part 2 — Install YapFlow

### Step 2.1 — Identify Which File to Use

You should have received one or two `.dmg` files:

| File name | Use this if... |
|---|---|
| `YapFlow-2.0.2-arm64.dmg` | Your Mac is from **late 2020 or newer** (M1, M2, M3, M4 chip) |
| `YapFlow-2.0.2-arm64.zip` | Your Mac is from **late 2020 or newer** and you prefer a zipped app bundle |

**Not sure which chip you have?**
Click the Apple menu () → About This Mac → look for "Chip" (Apple Silicon) or "Processor" (Intel).

When in doubt, use the **arm64** version — most Macs sold since late 2020 use Apple Silicon.

### Step 2.2 — Open the DMG File

1. Locate the `.dmg` file you received (probably in your Downloads folder)
2. Double-click it to open
3. A window will appear showing the **YapFlow app icon** and an **Applications folder shortcut**
4. **Drag YapFlow into the Applications folder**
5. Wait for the copy to finish, then close the window

### Step 2.3 — Eject the DMG

Right-click the YapFlow disk image in your sidebar (in Finder) and click **Eject**, or drag it to the Trash.

---

## Part 3 — First Launch & Security Warning

### Step 3.1 — Open YapFlow for the First Time

1. Open your **Applications** folder
2. Double-click **YapFlow**

You will likely see this message:

> *"YapFlow" cannot be opened because the developer cannot be verified.*

This is a standard macOS warning for apps downloaded outside the App Store. **YapFlow is not malware** — you only need to dismiss this warning once.

### Step 3.2 — Bypass the Warning

1. Click **Cancel** (don't click Move to Trash)
2. Open **System Settings** (the gear icon in your Dock, or Apple menu → System Settings)
3. Click **Privacy & Security** in the left sidebar
4. Scroll down until you see a message about YapFlow being blocked
5. Click **"Open Anyway"**
6. Enter your Mac password if prompted
7. In the final dialog, click **Open**

YapFlow will now launch successfully. You won't see this warning again for YapFlow.

---

## Part 4 — Set Up YapFlow

### Step 4.1 — Enter Your API Key

When YapFlow opens for the first time, a Settings window will appear automatically asking for your API key.

1. Paste the API key you copied earlier (it starts with `sk-...`)
2. Click **Save** (or Test Connection)
3. You should see a confirmation that the key is valid

> **If you don't see the Settings window:** Look for the YapFlow icon in your menu bar (top right of your screen). Click it, then click Settings.

Your API key is now stored securely in your Mac's built-in Keychain — the same system that stores your Wi-Fi passwords and website logins. YapFlow never stores it in a readable format.

### Step 4.2 — Choose Your Default Mode

In Settings, you'll see three output modes. Pick whichever suits you best as your default:

| Mode | Best for |
|---|---|
| **Raw** | When you want the exact words you said, unedited |
| **Clean** | Everyday use — removes "um", "uh", fixes punctuation |
| **AI Prompt** | When you're about to paste into ChatGPT or another AI tool |

You can always switch modes on the fly using the tabs in the floating window.

---

## Part 5 — Grant macOS Permissions

YapFlow needs three permissions to work. Think of these like giving the app the keys it needs to do its job.

### Permission 1 — Input Monitoring (Required)

This lets YapFlow detect when you press the shortcut key, even when another app is in focus.

1. Open **System Settings → Privacy & Security → Input Monitoring**
2. If YapFlow isn't listed, click the **+** button and add it from your Applications folder
3. Make sure the toggle next to YapFlow is **turned on**
4. **Restart YapFlow** after granting this permission

> Without this permission, the keyboard shortcut won't work at all.

### Permission 2 — Microphone (Required)

This lets YapFlow hear your voice.

- macOS will ask you automatically the first time you try to record
- Just click **OK** or **Allow** when the dialog appears
- If you accidentally clicked Deny: System Settings → Privacy & Security → Microphone → turn on YapFlow

### Permission 3 — Accessibility (Optional but Recommended)

This lets YapFlow automatically paste the result into whatever app you're using, so you don't have to press ⌘V yourself.

1. Open **System Settings → Privacy & Security → Accessibility**
2. Click the **+** button and add YapFlow from your Applications folder
3. Make sure the toggle is **turned on**

> Without this, the result is still copied to your clipboard — you just need to paste it manually with ⌘V.

---

## Part 6 — How to Use YapFlow

Once everything is set up, using YapFlow takes about three seconds:

1. **Click into any text field** — in a browser, email app, notes, anywhere you want to type
2. **Hold ⌘⌥Space** (Command + Option + Space) — a small red circle appears, meaning it's recording
3. **Speak naturally** — say whatever you want to type
4. **Release the keys** — YapFlow transcribes and rewrites your words (takes 1–3 seconds)
5. **The result appears** — in your floating window AND pasted directly into your text field (if Accessibility permission was granted)

That's it. Hold, speak, release.

---

## Understanding the Three Modes

### Raw Mode

Gives you the exact words you said, with no changes. Useful when every word matters.

> You say: *"So basically um the meeting is on Thursday at 3pm I think"*
> You get: *"So basically um the meeting is on Thursday at 3pm I think"*

### Clean Mode

Removes filler words and fixes punctuation, but keeps your voice and meaning intact.

> You say: *"So basically um the meeting is on Thursday at 3pm I think"*
> You get: *"The meeting is on Thursday at 3 PM."*

### AI Prompt Mode

Transforms your rambling thoughts into a structured, well-written prompt ready to paste into ChatGPT or any other AI.

> You say: *"I need help writing an email to my client who's been waiting for a project update, it's been two weeks, I want to apologise but not sound too grovelling"*
> You get a structured prompt with Goal, Context, and Output Format sections already filled in.

---

## How Much Will It Cost?

Very little. Here's a rough breakdown:

| What you do | Approximate cost |
|---|---|
| 10-second voice clip (Raw mode) | ~€0.0005 |
| 10-second voice clip (Clean or AI Prompt mode) | ~€0.001 |
| 100 recordings in a day | ~€0.10 |
| Spending your entire €5 credit | ~5,000 recordings |

The app shows you the exact cost of each recording in real time. You'll also see your cumulative spending in the OpenAI dashboard at **platform.openai.com/usage**.

---

## Troubleshooting

### "Nothing happens when I press the shortcut"

Most likely cause: Input Monitoring permission hasn't been granted or YapFlow needs a restart.

1. Go to **System Settings → Privacy & Security → Input Monitoring**
2. Make sure YapFlow is listed and the toggle is **on**
3. **Quit and reopen YapFlow** — this is important after granting Input Monitoring

### "I can't find YapFlow in my menu bar"

1. Look in the top-right area of your screen, near the battery and Wi-Fi icons
2. If it's hidden, click the **>>** chevron in the menu bar to see hidden icons
3. If YapFlow isn't running at all, open your Applications folder and launch it

### "The mic isn't working"

1. Go to **System Settings → Privacy & Security → Microphone**
2. Make sure YapFlow is listed and turned **on**
3. Try recording again

### "Auto-paste isn't working"

1. Check **System Settings → Privacy & Security → Accessibility** — YapFlow should be listed and on
2. Make sure you're clicked into a text field *before* you use the shortcut
3. If it still doesn't paste automatically, just press **⌘V** after recording — the result is always copied to your clipboard

### "It says my API key is invalid"

1. Double-check that you copied the full key — it starts with `sk-` and is quite long
2. Make sure you have credit in your OpenAI account at **platform.openai.com/billing**
3. Try deleting the key in YapFlow Settings and entering it again

### "The 'unidentified developer' warning keeps coming back"

This should only happen once. If it persists, repeat the steps in Part 3.2 above. You may also need to right-click the app → Open, instead of double-clicking.

---

## Frequently Asked Questions

**Does YapFlow send my recordings anywhere permanently?**
No. Your audio is sent to OpenAI for transcription (the same service that powers voice features in many apps), but it's not stored or used for training. The transcript and rewrite are stored locally on your Mac only.

**Can I use YapFlow without an internet connection?**
No — it needs to reach OpenAI's servers to transcribe your voice.

**Can I change the keyboard shortcut?**
Yes. Open Settings → Shortcut — you can remap it to any key combination you prefer.

**Is my API key safe?**
Yes. YapFlow stores it using Apple's Keychain — the same encrypted system that stores your passwords in Safari. It's never written to a text file.

**What if I run out of OpenAI credit?**
The app will show an error when you try to record. Just add more credit at **platform.openai.com/billing** and you're good to go.

**Can I see my past recordings?**
Yes. Click the clock icon in the floating window to see your last 100 recordings, including the transcript, the rewrite, the cost, and how long it took.

**Does it work with any app?**
Yes — YapFlow uses the global clipboard and macOS Accessibility features to paste into any app, including browsers, email clients, word processors, notes apps, Slack, and more.

---

## Quick Reference Card

| Action | How |
|---|---|
| Start recording | Hold **⌘⌥Space** |
| Stop and transcribe | Release the keys |
| Switch output mode | Click Raw / Clean / Prompt tabs |
| Open Settings | Click YapFlow in menu bar → Settings |
| View history | Click the clock icon in the window |
| Copy last result | Click the copy icon on the result card |

---

*YapFlow v2.0.2 · macOS 13+*
