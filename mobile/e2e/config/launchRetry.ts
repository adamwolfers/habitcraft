/**
 * A bounded retry for the one launch failure that is the device's, not the app's.
 *
 * WHAT IT COVERS (habitcraft-nu7h). On the CI emulator, device.launchApp()
 * occasionally starts `am instrument` and no app process ever appears. Detox's
 * AndroidDriver then polls `pidof` for about 100 seconds and throws "PID still
 * not available". CI run 41238333025 is the recorded case. The test body never
 * ran: logout.test.ts's beforeEach was relaunching after `pm clear`. The final
 * `ps` dump showed no app process and no instrumentation process either, so the
 * instrumentation had already exited and waiting longer could not have helped. A
 * re-run passed unchanged. A fresh launch is the remedy, so that is what this
 * does, once.
 *
 * WHAT IT DOES NOT COVER. An app that starts and then crashes surfaces as a
 * different error ("Failed to run application on the device"), and that one is
 * the app's fault. Retrying it would hide a real bug, so it is rethrown at once.
 * An app that never starts on every attempt also stays red: the retry is
 * bounded, and the last error is rethrown.
 *
 * WHY IT SAYS SO. A silent retry would turn a flake into an invisible one, so
 * every retry warns with the original error and this bead's id. If the warning
 * becomes routine in CI logs, the cause needs finding, not more attempts.
 *
 * Pure on purpose: it imports nothing from Detox, so its unit tests run under
 * the mobile package's ordinary jest run without a device.
 */

/** First attempt plus one retry. */
export const LAUNCH_ATTEMPTS = 2;

/** Detox 20.x's message when the app process never appeared after a launch. */
const NEVER_STARTED = 'PID still not available';

export function isLaunchThatNeverStarted(err: unknown): boolean {
  return err instanceof Error && err.message.includes(NEVER_STARTED);
}

export interface LaunchRetryOptions {
  /** Puts the device back in a launchable state before the next attempt. */
  beforeRetry: () => Promise<unknown>;
  warn?: (message: string) => void;
}

export async function withLaunchRetry<T>(
  launch: () => Promise<T>,
  { beforeRetry, warn = console.warn }: LaunchRetryOptions
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await launch();
    } catch (err) {
      if (!isLaunchThatNeverStarted(err) || attempt >= LAUNCH_ATTEMPTS) {
        throw err;
      }
      warn(
        `[e2e] launch attempt ${attempt}/${LAUNCH_ATTEMPTS} failed with "${(err as Error).message}"; ` +
          'relaunching (habitcraft-nu7h)'
      );
      await beforeRetry();
    }
  }
}
