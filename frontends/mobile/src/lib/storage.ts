import * as SecureStore from 'expo-secure-store';
import { AuthTokens } from '@/types';

const ACCESS_TOKEN_KEY = 'habitcraft_access_token';
const REFRESH_TOKEN_KEY = 'habitcraft_refresh_token';

export const storage = {
  /**
   * Save authentication tokens to secure storage
   */
  async saveTokens(tokens: AuthTokens): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  /**
   * Retrieve authentication tokens from secure storage
   */
  async getTokens(): Promise<AuthTokens | null> {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  },

  /**
   * Clear all authentication tokens from secure storage
   */
  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  /**
   * Check if tokens exist in secure storage
   */
  async hasTokens(): Promise<boolean> {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    return accessToken !== null;
  },
};

export default storage;
