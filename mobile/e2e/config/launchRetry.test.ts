import { LAUNCH_ATTEMPTS, isLaunchThatNeverStarted, withLaunchRetry } from './launchRetry';

// The message Detox's AndroidDriver throws when the app process never appears
// after `am instrument` (detox 20.x, AndroidDriver._queryPID).
const neverStarted = () => new Error('PID still not available');

describe('isLaunchThatNeverStarted', () => {
  it('recognises the error Detox throws when no app process ever appeared', () => {
    expect(isLaunchThatNeverStarted(neverStarted())).toBe(true);
  });

  it('does not treat an app that started and then crashed as a launch to retry', () => {
    // A crash is the app's fault and must stay red, not be retried away.
    expect(isLaunchThatNeverStarted(new Error('Failed to run application on the device'))).toBe(
      false
    );
  });

  it('is false for anything that is not an Error', () => {
    expect(isLaunchThatNeverStarted('PID still not available')).toBe(false);
    expect(isLaunchThatNeverStarted(undefined)).toBe(false);
  });
});

describe('withLaunchRetry', () => {
  const quiet = { beforeRetry: jest.fn(), warn: jest.fn() };

  beforeEach(() => {
    quiet.beforeRetry.mockReset().mockResolvedValue(undefined);
    quiet.warn.mockReset();
  });

  it('returns the first launch when it succeeds, without retrying', async () => {
    const launch = jest.fn().mockResolvedValue(42);

    await expect(withLaunchRetry(launch, quiet)).resolves.toBe(42);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(quiet.beforeRetry).not.toHaveBeenCalled();
    expect(quiet.warn).not.toHaveBeenCalled();
  });

  it('cleans up and launches again when the app never started', async () => {
    const launch = jest.fn().mockRejectedValueOnce(neverStarted()).mockResolvedValueOnce(7);

    await expect(withLaunchRetry(launch, quiet)).resolves.toBe(7);
    expect(launch).toHaveBeenCalledTimes(2);
    expect(quiet.beforeRetry).toHaveBeenCalledTimes(1);
  });

  it('says it retried, so a flaky launch stays visible in the CI log', async () => {
    const launch = jest.fn().mockRejectedValueOnce(neverStarted()).mockResolvedValueOnce(7);

    await withLaunchRetry(launch, quiet);

    expect(quiet.warn).toHaveBeenCalledWith(expect.stringContaining('PID still not available'));
    expect(quiet.warn).toHaveBeenCalledWith(expect.stringContaining('habitcraft-nu7h'));
  });

  it('gives up after a bounded number of attempts and rethrows the last error', async () => {
    const launch = jest.fn().mockRejectedValue(neverStarted());

    await expect(withLaunchRetry(launch, quiet)).rejects.toThrow('PID still not available');
    expect(launch).toHaveBeenCalledTimes(LAUNCH_ATTEMPTS);
  });

  it('does not retry any other failure', async () => {
    const crash = new Error('Failed to run application on the device');
    const launch = jest.fn().mockRejectedValue(crash);

    await expect(withLaunchRetry(launch, quiet)).rejects.toBe(crash);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(quiet.beforeRetry).not.toHaveBeenCalled();
  });
});
