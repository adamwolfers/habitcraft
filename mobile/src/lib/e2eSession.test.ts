const mockSaveTokens = jest.fn();
const mockGet = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();

jest.mock('./storage', () => ({
  storage: { saveTokens: mockSaveTokens },
}));

// The RN jest preset does not register SettingsManager, so importing Settings
// throws a TurboModule invariant before any test runs. The mocks are declared
// out here rather than inside the factories because jest.resetModules() rebuilds
// a factory's return value, which would leave the assertions holding stale spies.
jest.mock('react-native/Libraries/Settings/Settings', () => ({
  default: { get: mockGet, set: jest.fn() },
}));

// Local, for the same reason: jest.setup.js's global expo-file-system mock is
// rebuilt by resetModules, so its spies would not be the ones these tests hold.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/documents/',
  getInfoAsync: mockGetInfoAsync,
  readAsStringAsync: mockReadAsStringAsync,
  writeAsStringAsync: mockWriteAsStringAsync,
}));

const SEEDED_ID_PATH = '/mock/documents/e2e-seeded-id';

/** Stand in for the record a previous seeding on this install would have left. */
function seededIdOnDisk(id: string | null) {
  mockGetInfoAsync.mockResolvedValue({ exists: id !== null });
  mockReadAsStringAsync.mockResolvedValue(id);
}

/**
 * The flag is read at module load, because Expo inlines EXPO_PUBLIC_* at bundle
 * time. So each case has to set the environment and then load the module fresh,
 * rather than importing it once at the top.
 */
function loadWithFlag(flag: string | undefined) {
  jest.resetModules();
  if (flag === undefined) {
    delete process.env.EXPO_PUBLIC_E2E;
  } else {
    process.env.EXPO_PUBLIC_E2E = flag;
  }
  return require('./e2eSession') as typeof import('./e2eSession');
}

/** Answer Settings.get() from a table, so a case only states what it cares about. */
function launchArgs(args: Record<string, unknown>) {
  mockGet.mockImplementation((key: string) => args[key] ?? null);
}

const TOKEN_ARGS = {
  e2eAccessToken: 'access-token',
  e2eRefreshToken: 'refresh-token',
  e2eSeedId: 'launch-1',
};

describe('seedE2ESession', () => {
  const originalFlag = process.env.EXPO_PUBLIC_E2E;

  beforeEach(() => {
    jest.clearAllMocks();
    // No previous launch has seeded, unless a case says otherwise.
    seededIdOnDisk(null);
  });

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env.EXPO_PUBLIC_E2E;
    } else {
      process.env.EXPO_PUBLIC_E2E = originalFlag;
    }
  });

  it('does nothing in a build that does not set the E2E flag', async () => {
    const { seedE2ESession } = loadWithFlag(undefined);

    await expect(seedE2ESession()).resolves.toBe(false);
    // The launch arguments are not even read, so a production build cannot be
    // steered by them.
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSaveTokens).not.toHaveBeenCalled();
  });

  it('does nothing when the flag is set to anything but "1"', async () => {
    const { seedE2ESession } = loadWithFlag('true');

    await expect(seedE2ESession()).resolves.toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('saves both tokens when the launch arguments carry them', async () => {
    launchArgs(TOKEN_ARGS);
    const { seedE2ESession } = loadWithFlag('1');

    await expect(seedE2ESession()).resolves.toBe(true);
    expect(mockSaveTokens).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('saves nothing when only one of the two tokens is present', async () => {
    // Half a session would send the app into a refresh it cannot complete,
    // which reads as a mysterious logout rather than a missing launch argument.
    launchArgs({ e2eAccessToken: 'access-token', e2eSeedId: 'launch-1' });
    const { seedE2ESession } = loadWithFlag('1');

    await expect(seedE2ESession()).resolves.toBe(false);
    expect(mockSaveTokens).not.toHaveBeenCalled();
  });

  it('ignores an empty launch argument', async () => {
    mockGet.mockReturnValue('');
    const { seedE2ESession } = loadWithFlag('1');

    await expect(seedE2ESession()).resolves.toBe(false);
    expect(mockSaveTokens).not.toHaveBeenCalled();
  });

  it('ignores a launch argument that is not a string', async () => {
    mockGet.mockReturnValue(42);
    const { seedE2ESession } = loadWithFlag('1');

    await expect(seedE2ESession()).resolves.toBe(false);
    expect(mockSaveTokens).not.toHaveBeenCalled();
  });

  describe('once per launch', () => {
    it('records the seed id it consumed', async () => {
      launchArgs(TOKEN_ARGS);
      const { seedE2ESession } = loadWithFlag('1');

      await seedE2ESession();

      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(SEEDED_ID_PATH, 'launch-1');
    });

    it('does not seed again for a seed id it has already consumed', async () => {
      // What a JS reload looks like from here: the module is evaluated afresh,
      // so no in-memory flag survives, but the process keeps its launch
      // arguments and the store keeps the record of the last seeding.
      launchArgs(TOKEN_ARGS);
      seededIdOnDisk('launch-1');
      const { seedE2ESession } = loadWithFlag('1');

      await expect(seedE2ESession()).resolves.toBe(false);
      expect(mockSaveTokens).not.toHaveBeenCalled();
    });

    it('seeds again when a new launch brings a new seed id', async () => {
      launchArgs({ ...TOKEN_ARGS, e2eSeedId: 'launch-2' });
      seededIdOnDisk('launch-1');
      const { seedE2ESession } = loadWithFlag('1');

      await expect(seedE2ESession()).resolves.toBe(true);
      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(SEEDED_ID_PATH, 'launch-2');
    });

    it('seeds when the record cannot be read at all', async () => {
      // Better to seed and let the reload specs fail than to start every spec
      // logged out because one file read went wrong.
      launchArgs(TOKEN_ARGS);
      mockGetInfoAsync.mockRejectedValue(new Error('no such directory'));
      const { seedE2ESession } = loadWithFlag('1');

      await expect(seedE2ESession()).resolves.toBe(true);
    });

    it('does not seed a token pair that carries no seed id', async () => {
      // Without one there is no way to tell a relaunch from a reload, and
      // seeding anyway is the bug this guards (habitcraft-bqhe.16).
      launchArgs({ e2eAccessToken: 'access-token', e2eRefreshToken: 'refresh-token' });
      const { seedE2ESession } = loadWithFlag('1');

      await expect(seedE2ESession()).resolves.toBe(false);
      expect(mockSaveTokens).not.toHaveBeenCalled();
    });
  });
});
