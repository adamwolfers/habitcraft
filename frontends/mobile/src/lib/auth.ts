import axios from 'axios';
import { storage } from './storage';
import { User, AuthTokens, LoginCredentials, RegisterData } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

function extractErrorMessage(error: unknown): string {
  // Handle axios-like errors (including mocks)
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data
  ) {
    return (error.response.data as { message: string }).message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
      const { user, accessToken, refreshToken } = response.data;

      await storage.saveTokens({ accessToken, refreshToken });

      return {
        user,
        tokens: { accessToken, refreshToken },
      };
    } catch (error) {
      throw new Error(extractErrorMessage(error));
    }
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, data);
      const { user, accessToken, refreshToken } = response.data;

      await storage.saveTokens({ accessToken, refreshToken });

      return {
        user,
        tokens: { accessToken, refreshToken },
      };
    } catch (error) {
      throw new Error(extractErrorMessage(error));
    }
  },

  async logout(): Promise<void> {
    try {
      const tokens = await storage.getTokens();
      if (tokens) {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }
        );
      }
    } catch {
      // Ignore logout errors - we still want to clear local tokens
    } finally {
      await storage.clearTokens();
    }
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });
      const { accessToken, refreshToken: newRefreshToken } = response.data;

      await storage.saveTokens({ accessToken, refreshToken: newRefreshToken });

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new Error(extractErrorMessage(error));
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const tokens = await storage.getTokens();
    if (!tokens) {
      return null;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      return response.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error));
    }
  },
};
