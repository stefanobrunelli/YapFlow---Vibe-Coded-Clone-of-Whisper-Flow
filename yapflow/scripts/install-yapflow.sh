#!/usr/bin/env bash
# install-yapflow.sh — one-shot installer for a fresh YapFlow build.
#
# Usage:
#   ./scripts/install-yapflow.sh                         # installs newest DMG from releases/prod
#   ./scripts/install-yapflow.sh path/to/YapFlow.dmg     # installs from a specific DMG
#   ./scripts/install-yapflow.sh path/to/YapFlow.zip     # installs from a specific ZIP
#   WIPE_CONFIG=1 ./scripts/install-yapflow.sh           # also wipe ~/Library/Application Support/YapFlow
#   RESET_YAPFLOW_TCC=1 ./scripts/install-yapflow.sh     # reset privacy rows for com.yapflow.app only
#
# What it does:
#   1. Kills any running YapFlow instances
#   2. Removes every prior YapFlow.app copy (/Applications, ~/Applications, ~/Downloads, ~/Desktop)
#   3. Optionally resets YapFlow-only TCC entries when RESET_YAPFLOW_TCC=1
#   4. Extracts the new DMG or ZIP
#   5. Strips the quarantine xattr
#   6. Verifies the signature
#   7. Launches the fresh copy
#
# Safety rule:
#   This script never resets Accessibility, Input Monitoring, Microphone, or
#   any other privacy category globally. It must not affect unrelated apps.

set -euo pipefail

APP_NAME="YapFlow"
APP_BUNDLE_ID="com.yapflow.app"
APP_PATH="/Applications/${APP_NAME}.app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

err() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m[install]\033[0m %s\n' "$*"; }

# ─── Resolve source artifact ───────────────────────────────────────────────
SOURCE="${1:-}"
if [[ -z "${SOURCE}" ]]; then
  # Pick the most recent DMG in releases/prod
  SOURCE="$(ls -t "${PROJECT_ROOT}/releases/prod/"*.dmg 2>/dev/null | head -1 || true)"
  [[ -z "${SOURCE}" ]] && err "No DMG found in releases/prod/ — pass a path explicitly."
fi
[[ -f "${SOURCE}" ]] || err "Source artifact not found: ${SOURCE}"
info "Source: ${SOURCE}"

# ─── Kill any running instances ────────────────────────────────────────────
if pgrep -xi "${APP_NAME}" > /dev/null; then
  info "Killing running ${APP_NAME} instances"
  pkill -xi "${APP_NAME}" || true
  # Also kill any helper processes left behind by older experimental builds.
  pkill -f "${APP_NAME}.app" || true
  sleep 1
fi

# ─── Remove old installs from every likely location ────────────────────────
# Each ad-hoc build had a different CDHash, which means macOS saw each as
# a distinct app. Stray copies in ~/Downloads, ~/Desktop, ~/Applications
# contribute to the duplicate-permission-entries problem even if the main
# copy in /Applications is replaced.
for loc in \
  "/Applications/${APP_NAME}.app" \
  "${HOME}/Applications/${APP_NAME}.app" \
  "${HOME}/Downloads/${APP_NAME}.app" \
  "${HOME}/Desktop/${APP_NAME}.app"; do
  if [[ -e "${loc}" ]]; then
    info "Removing prior copy: ${loc}"
    rm -rf "${loc}"
  fi
done

# ─── Optional: wipe YapFlow-only TCC entries ───────────────────────────────
# This is intentionally opt-in and bundle-scoped. Never call tccutil without
# ${APP_BUNDLE_ID}; that would reset permissions for unrelated apps.
if [[ "${RESET_YAPFLOW_TCC:-}" == "1" ]]; then
  info "RESET_YAPFLOW_TCC=1 — resetting privacy rows for ${APP_BUNDLE_ID} only"
  tccutil reset Accessibility "${APP_BUNDLE_ID}" 2>/dev/null || true
  tccutil reset ListenEvent "${APP_BUNDLE_ID}" 2>/dev/null || true   # Input Monitoring
  tccutil reset Microphone "${APP_BUNDLE_ID}" 2>/dev/null || true
  tccutil reset AppleEvents "${APP_BUNDLE_ID}" 2>/dev/null || true
else
  info "Leaving macOS privacy permissions untouched"
fi

# ─── Optional: wipe app config (opt-in) ────────────────────────────────────
if [[ "${WIPE_CONFIG:-}" == "1" ]]; then
  info "WIPE_CONFIG=1 — clearing app state"
  rm -rf \
    "${HOME}/Library/Application Support/${APP_NAME}" \
    "${HOME}/Library/Logs/${APP_NAME}" \
    "${HOME}/Library/Caches/${APP_BUNDLE_ID}" \
    "${HOME}/Library/Saved Application State/${APP_BUNDLE_ID}.savedState" \
    "${HOME}/Library/Preferences/${APP_BUNDLE_ID}.plist" || true
fi

# ─── Extract new bundle ────────────────────────────────────────────────────
TMP_DIR="$(mktemp -d -t yapflow-install.XXXXXX)"
trap 'rm -rf "${TMP_DIR}"' EXIT

SOURCE_LOWER="$(echo "${SOURCE}" | tr '[:upper:]' '[:lower:]')"
case "${SOURCE_LOWER}" in
  *.dmg)
    info "Mounting DMG"
    MOUNT_OUTPUT="$(hdiutil attach "${SOURCE}" -nobrowse -readonly -plist)"
    MOUNT_POINT="$(echo "${MOUNT_OUTPUT}" | grep -A1 '<key>mount-point</key>' | tail -1 | sed -E 's/.*<string>(.*)<\/string>.*/\1/')"
    [[ -z "${MOUNT_POINT}" ]] && err "Could not parse DMG mount point"
    info "DMG mounted at: ${MOUNT_POINT}"
    cp -R "${MOUNT_POINT}/${APP_NAME}.app" "${APP_PATH}"
    hdiutil detach "${MOUNT_POINT}" -quiet
    ;;
  *.zip)
    info "Unzipping"
    unzip -q "${SOURCE}" -d "${TMP_DIR}"
    [[ -d "${TMP_DIR}/${APP_NAME}.app" ]] || err "ZIP did not contain ${APP_NAME}.app"
    cp -R "${TMP_DIR}/${APP_NAME}.app" "${APP_PATH}"
    ;;
  *)
    err "Unsupported source extension — must be .dmg or .zip"
    ;;
esac

# ─── Strip quarantine ──────────────────────────────────────────────────────
# macOS tags every downloaded bundle with com.apple.quarantine, which triggers
# Gatekeeper scrutiny on first launch. Stripping lets the app launch directly.
info "Stripping quarantine xattrs"
xattr -cr "${APP_PATH}" || true

# ─── Verify signature ──────────────────────────────────────────────────────
info "Verifying signature"
if codesign --verify --deep --strict "${APP_PATH}" 2>&1; then
  info "Signature valid"
  # Show the identity so the user knows which cert macOS will TCC-bind to.
  codesign -dvv "${APP_PATH}" 2>&1 | grep -E "^(Identifier|TeamIdentifier|Authority)=" || true
else
  printf '\033[33mWARNING:\033[0m signature verification failed — launching anyway.\n'
fi

# ─── Re-register with LaunchServices ───────────────────────────────────────
# After replacing the bundle, force LaunchServices to re-read the new app's
# Info.plist + code signature. Without this, `open` can briefly use the old
# bundle record and confuse TCC about which identity is launching.
info "Re-registering with LaunchServices"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "${APP_PATH}" > /dev/null 2>&1 || true

# ─── Launch ────────────────────────────────────────────────────────────────
info "Launching ${APP_PATH}"
open "${APP_PATH}"

info "Done. Check the menu bar for the YapFlow icon."
info "First run will ask for Microphone, Accessibility, and Input Monitoring — grant all three."
info ""
info "If System Settings → Privacy & Security still shows MULTIPLE YapFlow rows in"
info "  Accessibility / Input Monitoring / Microphone (from prior ad-hoc builds),"
info "  remove the stale YapFlow rows manually via the minus (−) button."
info "This installer will not reset privacy permissions for other apps."
info ""
info "If the icon doesn't appear in ~30s, tail the log: tail -f \"\$HOME/Library/Logs/YapFlow/app.log\""
