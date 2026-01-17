import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { networkStatus } from './networkStatus';

jest.mock('@react-native-community/netinfo');

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('networkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetch', () => {
    it('returns network state from NetInfo', async () => {
      const mockState: Partial<NetInfoState> = {
        isConnected: true,
        isInternetReachable: true,
      };
      mockNetInfo.fetch.mockResolvedValue(mockState as NetInfoState);

      const result = await networkStatus.fetch();

      expect(result).toEqual({
        isConnected: true,
        isInternetReachable: true,
      });
      expect(mockNetInfo.fetch).toHaveBeenCalled();
    });

    it('handles null isConnected as false', async () => {
      const mockState: Partial<NetInfoState> = {
        isConnected: null,
        isInternetReachable: null,
      };
      mockNetInfo.fetch.mockResolvedValue(mockState as NetInfoState);

      const result = await networkStatus.fetch();

      expect(result).toEqual({
        isConnected: false,
        isInternetReachable: null,
      });
    });

    it('returns offline state on fetch error', async () => {
      mockNetInfo.fetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await networkStatus.fetch();

      expect(result).toEqual({
        isConnected: false,
        isInternetReachable: false,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'networkStatus.fetch error:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('subscribe', () => {
    it('subscribes to network state changes', () => {
      const mockUnsubscribe = jest.fn();
      mockNetInfo.addEventListener.mockReturnValue(mockUnsubscribe);
      const callback = jest.fn();

      const unsubscribe = networkStatus.subscribe(callback);

      expect(mockNetInfo.addEventListener).toHaveBeenCalledWith(expect.any(Function));
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('transforms NetInfo state before calling callback', () => {
      let capturedHandler: ((state: NetInfoState) => void) | undefined;
      mockNetInfo.addEventListener.mockImplementation((handler) => {
        capturedHandler = handler;
        return jest.fn();
      });
      const callback = jest.fn();

      networkStatus.subscribe(callback);

      expect(capturedHandler).toBeDefined();
      capturedHandler!({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      expect(callback).toHaveBeenCalledWith({
        isConnected: true,
        isInternetReachable: true,
      });
    });

    it('handles null isConnected in subscription as false', () => {
      let capturedHandler: ((state: NetInfoState) => void) | undefined;
      mockNetInfo.addEventListener.mockImplementation((handler) => {
        capturedHandler = handler;
        return jest.fn();
      });
      const callback = jest.fn();

      networkStatus.subscribe(callback);
      capturedHandler!({
        isConnected: null,
        isInternetReachable: null,
      } as NetInfoState);

      expect(callback).toHaveBeenCalledWith({
        isConnected: false,
        isInternetReachable: null,
      });
    });
  });

  describe('isOnline', () => {
    it('returns true when connected and internet reachable', async () => {
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      } as NetInfoState);

      const result = await networkStatus.isOnline();

      expect(result).toBe(true);
    });

    it('returns true when connected but reachability unknown', async () => {
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: null,
      } as NetInfoState);

      const result = await networkStatus.isOnline();

      expect(result).toBe(true);
    });

    it('returns false when not connected', async () => {
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      } as NetInfoState);

      const result = await networkStatus.isOnline();

      expect(result).toBe(false);
    });

    it('returns false when connected but internet not reachable', async () => {
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      } as NetInfoState);

      const result = await networkStatus.isOnline();

      expect(result).toBe(false);
    });
  });
});
