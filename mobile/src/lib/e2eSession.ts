import { Platform, Settings } from 'react-native';
import { storage } from './storage';

/**
 * Seeds a session from Detox launch arguments, so the E2E suite never types a
 * password into the app.
 *
 * WHY THIS EXISTS. iOS offers its AutoFill "Save Password?" prompt after any
 * successful credential submit -- login as well as registration. The prompt
 * dims the screen and keeps the main run loop awake, so Detox's visibility
 * checks fail against a screen that is genuinely there and the app never reads
 * as idle. It blocked 27 of the suite's 38 tests (habitcraft-bqhe.11).
 *
 * Nothing can dismiss it. Detox's system matchers cannot see it at all
 * (by.system.label and by.system.type both find nothing), backgrounding the app
 * does not clear it, and it survives a relaunch. Nor can the app suppress it:
 * setting textContentType="none" with autoComplete="off" changes nothing,
 * because iOS reacts to the secure field itself (facebook/react-native#37236).
 * The only app-side escape would be unmasking the password, which is worse than
 * the problem. wix/Detox#3761 asked for a bypass and was closed unanswered.
 *
 * So the suite obtains a session over HTTP and hands the tokens to the app
 * here. No password is typed, so the prompt is never offered. The registration
 * spec is the exception and still drives the real form -- typing the password
 * is what that test is for.
 *
 * SAFETY. This reads nothing unless EXPO_PUBLIC_E2E is "1" at bundle time, which
 * only the e2e npm scripts set. Production builds do not define it, so the
 * branch is dead code there. Keep it that way: the flag must never appear in an
 * EAS production profile.
 */

// Read at module load, not per call: Expo inlines EXPO_PUBLIC_* at bundle time,
// so this is a constant the bundler can see and strip.
const E2E_ENABLED = process.env.EXPO_PUBLIC_E2E === '1';

const ACCESS_TOKEN_ARG = 'e2eAccessToken';
const REFRESH_TOKEN_ARG = 'e2eRefreshToken';

function readLaunchArg(key: string): string | null {
  // Detox passes launchArgs as `-key value` process arguments, which land in
  // NSUserDefaults' argument domain. React Native's Settings module reads that
  // domain, which is why this needs no extra dependency -- and why it is iOS
  // only. Android passes launch args as intent extras instead and will need
  // react-native-launch-arguments when that platform is wired up
  // (habitcraft-bqhe.1).
  const value = Settings.get(key);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Writes tokens from launch arguments into secure storage.
 *
 * @returns whether a session was seeded, so callers can log or branch in tests.
 */
export async function seedE2ESession(): Promise<boolean> {
  if (!E2E_ENABLED || Platform.OS !== 'ios') {
    return false;
  }

  const accessToken = readLaunchArg(ACCESS_TOKEN_ARG);
  const refreshToken = readLaunchArg(REFRESH_TOKEN_ARG);

  // Both or neither. A half-seeded session would send the app into a refresh
  // loop against a token it cannot renew, which reads as a mysterious logout
  // rather than a missing launch argument.
  if (!accessToken || !refreshToken) {
    return false;
  }

  await storage.saveTokens({ accessToken, refreshToken });
  return true;
}
