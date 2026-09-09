const mockSaveTokens = jest.fn();
const mockGet = jest.fn();

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

describe('seedE2ESession', () => {
  const originalFlag = process.env.EXPO_PUBLIC_E2E;

  beforeEach(() => {
    jest.clearAllMocks();
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
    mockGet.mockImplementation((key: string) =>
      key === 'e2eAccessToken' ? 'access-token' : 'refresh-token'
    );
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
    mockGet.mockImplementation((key: string) => (key === 'e2eAccessToken' ? 'access-token' : null));
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
});
