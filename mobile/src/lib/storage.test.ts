import * as SecureStore from 'expo-secure-store';
import { storage } from './storage';
import { AuthTokens } from '@/types';

// Mock expo-secure-store
jest.mock('expo-secure-store');

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('storage', () => {
  const mockTokens: AuthTokens = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveTokens', () => {
    it('stores access and refresh tokens securely', async () => {
      await storage.saveTokens(mockTokens);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(2);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'habitcraft_access_token',
        mockTokens.accessToken
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'habitcraft_refresh_token',
        mockTokens.refreshToken
      );
    });
  });

  describe('getTokens', () => {
    it('retrieves stored tokens', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      const result = await storage.getTokens();

      expect(result).toEqual(mockTokens);
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('habitcraft_access_token');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('habitcraft_refresh_token');
    });

    it('returns null when access token is missing', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await storage.getTokens();

      expect(result).toBeNull();
    });

    it('returns null when refresh token is missing', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(null);

      const result = await storage.getTokens();

      expect(result).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('removes all tokens from storage', async () => {
      await storage.clearTokens();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('habitcraft_access_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('habitcraft_refresh_token');
    });
  });

  describe('hasTokens', () => {
    it('returns true when access token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(mockTokens.accessToken);

      const result = await storage.hasTokens();

      expect(result).toBe(true);
    });

    it('returns false when access token does not exist', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await storage.hasTokens();

      expect(result).toBe(false);
    });
  });
});
