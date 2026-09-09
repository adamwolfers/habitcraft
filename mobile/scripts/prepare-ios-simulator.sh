#!/usr/bin/env bash
#
# Prepares an iOS simulator for the Detox suite. Run before `npm run e2e:test:ios`.
#
# Two device-level facts break the suite, and neither can be fixed from inside a
# test:
#
#   1. iOS offers its AutoFill "Save Password?" prompt after any successful
#      credential submit. It dims the screen, so Detox's visibility checks fail
#      against a screen that is genuinely there, and it keeps the main run loop
#      awake so the app never reads as idle. Detox cannot see or dismiss it
#      (by.system.label and by.system.type both find nothing), backgrounding does
#      not clear it, and the app cannot suppress it -- iOS reacts to the secure
#      field itself, not to textContentType (habitcraft-bqhe.11).
#
#   2. expo-secure-store keeps its items in the keychain, which survives app
#      deletion. So `launchApp({ delete: true })` leaves the previous run's
#      session in place and every spec that expects a logged-out app fails
#      (habitcraft-bqhe.7).
#
# MEASURED, not assumed. On a fresh iPhone 17 Pro (iOS 26.5), registering
# through the form timed out after 20s with the prompt up; with
# AutoFillPasswords written false it passed in 146ms. Same device, same build,
# one changed key.
#
# The key must be written while the device is SHUT DOWN. Writing it to a booted
# device through `simctl spawn ... defaults write` reads back as changed but the
# running system does not act on it.
#
set -euo pipefail

DEVICE_NAME="${DETOX_IOS_DEVICE:-iPhone 17}"

# EVERY device with this name, not just the first. A machine can carry the same
# model under several runtimes, and Detox does not necessarily choose the one a
# `head -1` would -- it picked a different iPhone 17 Pro than this script did on
# the machine where that was found. Preparing only one of them fails silently,
# which is the worst shape this failure could take.
udids="$(
  xcrun simctl list devices available |
    grep -F "$DEVICE_NAME (" |
    sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/'
)"

if [ -z "$udids" ]; then
  echo "prepare-ios-simulator: no available simulator named '$DEVICE_NAME'." >&2
  echo "Set DETOX_IOS_DEVICE to one of:" >&2
  xcrun simctl list devices available | grep -E "^\s+iPhone" | sed 's/^/  /' >&2
  exit 1
fi

for udid in $udids; do
  echo "prepare-ios-simulator: $DEVICE_NAME ($udid)"
  prefs="$HOME/Library/Developer/CoreSimulator/Devices/$udid/data/Library/Preferences/com.apple.WebUI.plist"

  xcrun simctl shutdown "$udid" 2>/dev/null || true
  # simctl returns before the device has finished shutting down, and a write
  # that lands while it is still up is the failure mode this script exists to
  # avoid.
  for _ in $(seq 1 30); do
    xcrun simctl list devices | grep -F "$udid" | grep -q "Booted" || break
    sleep 1
  done

  mkdir -p "$(dirname "$prefs")"
  /usr/libexec/PlistBuddy -c "Set :AutoFillPasswords false" "$prefs" 2>/dev/null ||
    /usr/libexec/PlistBuddy -c "Add :AutoFillPasswords bool false" "$prefs" 2>/dev/null ||
    /usr/libexec/PlistBuddy -c "Add :AutoFillPasswords bool false" -c "Save" "$prefs"

  # Boot before clearing the keychain: `simctl keychain reset` fails on a
  # shut-down device with 'Unable to lookup in current state: Shutdown', and
  # with the error suppressed the whole suite then runs against a surviving
  # session -- 36 of 38 tests failed that way before this was caught.
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true

  # Cheaper and far less destructive than `simctl erase`, which wipes the whole
  # device (habitcraft-bqhe.7).
  if ! xcrun simctl keychain "$udid" reset 2>/dev/null; then
    echo "prepare-ios-simulator: could not clear the keychain on $udid" >&2
    exit 1
  fi

  echo "prepare-ios-simulator:   AutoFill prompts disabled, keychain cleared"
done
