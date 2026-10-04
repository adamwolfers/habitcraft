#!/usr/bin/env bash
#
# Waits until a booted Android emulator is quiet enough for Detox. Run after
# the emulator is up and before `npm run e2e:test:android:release:smoke`.
#
# sys.boot_completed=1 does not mean the device is ready. After a cold boot the
# guest spends minutes on dexopt and stock-app startup. MEASURED on the
# Detox_API_36 AVD (habitcraft-bqhe.20): the load average sat at 25-40 for
# about 15 minutes. Under that load `pm install` took ~22s, the app took ~50s
# to go idle, and auth.test.ts's 120s beforeAll timed out. The same load made
# Google Messages raise an ANR dialog. The dialog held window focus, and Detox
# reported it as 'Waited for the root of the view hierarchy to have window
# focus'. Once the load fell below ~4 and the dialog was gone, the smoke set
# passed 12/12.
#
# So this script waits on the load average, not on a fixed sleep, and then
# clears anything that could hold focus. The load has to STAY low for a
# window, not just dip once: the spike starts after boot_completed, and the
# 1-minute average lags it. A single sample taken at boot_completed read 0.52
# and called the device settled; seconds later it read 4.64.
#
# It fails if the device never settles. That failure names the cause, where a
# Detox timeout twenty minutes later would not.
#
# Environment:
#   SETTLE_MAX_LOAD         1-minute load to wait below (default: guest CPUs)
#   SETTLE_QUIET_SECONDS    how long the load must stay below it (default: 90)
#   SETTLE_TIMEOUT_SECONDS  give up after this long (default: 1200)

set -euo pipefail

sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
adb="${sdk:+$sdk/platform-tools/}adb"

quiet_seconds="${SETTLE_QUIET_SECONDS:-90}"
timeout_seconds="${SETTLE_TIMEOUT_SECONDS:-1200}"

"$adb" wait-for-device
until [ "$("$adb" shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do
  sleep 2
done

# A load equal to the CPU count means every core is busy. Below that, the
# device has spare capacity for an install and an app launch.
max_load="${SETTLE_MAX_LOAD:-$("$adb" shell nproc | tr -d '\r')}"

echo "Waiting for the 1-minute load average to stay below $max_load for ${quiet_seconds}s (timeout ${timeout_seconds}s)"
start=$SECONDS
quiet_since=""
last_report=-30
while :; do
  load="$("$adb" shell cat /proc/loadavg | awk '{print $1}')"
  elapsed=$((SECONDS - start))

  if awk -v l="$load" -v m="$max_load" 'BEGIN { exit !(l < m) }'; then
    quiet_since="${quiet_since:-$elapsed}"
    if [ $((elapsed - quiet_since)) -ge "$quiet_seconds" ]; then
      echo "Settled after ${elapsed}s: load $load"
      break
    fi
  else
    quiet_since=""
  fi

  if [ "$elapsed" -ge "$timeout_seconds" ]; then
    echo "::error title=Emulator never settled::1-minute load was still $load after ${elapsed}s (threshold $max_load). Detox would time out on this device, so the run stops here."
    exit 1
  fi

  if [ $((elapsed - last_report)) -ge 30 ]; then
    echo "  ${elapsed}s: load $load"
    last_report=$elapsed
  fi
  sleep 5
done

# Messages is the app that raised the ANR dialog. The suite never uses it, so
# disable it rather than hope it stays quiet. The package is absent on some
# images; that is fine.
"$adb" shell pm disable-user --user 0 com.google.android.apps.messaging >/dev/null 2>&1 || true

# Close any dialog that is already up, ANR prompts included.
"$adb" shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null

echo "Focused window: $("$adb" shell dumpsys window | grep -m1 mCurrentFocus | tr -d '\r' || true)"
