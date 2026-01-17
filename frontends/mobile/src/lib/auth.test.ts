import axios from 'axios';
import { authApi } from './auth';
import { storage } from './storage';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock storage
jest.mock('./storage', () => ({
  storage: {
    saveTokens: jest.fn(),
    getTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('authApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockResponse = {
      data: {
        user: { id: '1', email: 'test@example.com', created_at: '2024-01-01' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    };

    it('makes POST request to /auth/login with credentials', async () => {
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      await authApi.login(credentials);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        credentials
      );
    });

    it('saves tokens on successful login', async () => {
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      await authApi.login(credentials);

      expect(mockStorage.saveTokens).toHaveBeenCalledWith({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('returns user on successful login', async () => {
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.login(credentials);

      expect(result).toEqual({
        user: mockResponse.data.user,
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });
    });

    it('throws error on invalid credentials', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
      };
      mockAxios.post.mockRejectedValueOnce(error);

      await expect(authApi.login(credentials)).rejects.toThrow('Invalid credentials');
    });

    it('throws generic error on network failure', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('Network Error'));

      await expect(authApi.login(credentials)).rejects.toThrow('Network Error');
    });
  });

  describe('register', () => {
    const registerData = {
      email: 'new@example.com',
      password: 'password123',
    };

    const mockResponse = {
      data: {
        user: { id: '2', email: 'new@example.com', created_at: '2024-01-01' },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      },
    };

    it('makes POST request to /auth/register with data', async () => {
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      await authApi.register(registerData);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        registerData
      );
    });

    it('saves tokens on successful registration', async () => {
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      await authApi.register(registerData);

      expect(mockStorage.saveTokens).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('returns user on successful registration', async () => {
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.register(registerData);

      expect(result).toEqual({
        user: mockResponse.data.user,
        tokens: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      });
    });

    it('throws error when email already exists', async () => {
      const error = {
        response: {
          status: 409,
          data: { message: 'Email already registered' },
        },
      };
      mockAxios.post.mockRejectedValueOnce(error);

      await expect(authApi.register(registerData)).rejects.toThrow('Email already registered');
    });
  });

  describe('logout', () => {
    it('clears tokens from storage', async () => {
      await authApi.logout();

      expect(mockStorage.clearTokens).toHaveBeenCalled();
    });

    it('makes POST request to /auth/logout when token exists', async () => {
      mockStorage.getTokens.mockResolvedValueOnce({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      mockAxios.post.mockResolvedValueOnce({ data: {} });

      await authApi.logout();

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        {},
        expect.objectContaining({
          headers: { Authorization: 'Bearer token' },
        })
      );
    });

    it('clears tokens even if logout request fails', async () => {
      mockStorage.getTokens.mockResolvedValueOnce({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      mockAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await authApi.logout();

      expect(mockStorage.clearTokens).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('makes POST request to /auth/refresh with refresh token', async () => {
      const mockResponse = {
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      await authApi.refreshToken('old-refresh-token');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh'),
        { refreshToken: 'old-refresh-token' }
      );
    });

    it('saves new tokens on successful refresh', async () => {
      const mockResponse = {
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      await authApi.refreshToken('old-refresh-token');

      expect(mockStorage.saveTokens).toHaveBeenCalledWith({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });

    it('returns new tokens on successful refresh', async () => {
      const mockResponse = {
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.refreshToken('old-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });

    it('throws error when refresh token is invalid', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid refresh token' },
        },
      };
      mockAxios.post.mockRejectedValueOnce(error);

      await expect(authApi.refreshToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });
  });

  describe('getCurrentUser', () => {
    it('makes GET request to /auth/me with auth header', async () => {
      const mockUser = { id: '1', email: 'test@example.com', created_at: '2024-01-01' };
      mockStorage.getTokens.mockResolvedValueOnce({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      mockAxios.get.mockResolvedValueOnce({ data: mockUser });

      await authApi.getCurrentUser();

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token' },
        })
      );
    });

    it('returns user data', async () => {
      const mockUser = { id: '1', email: 'test@example.com', created_at: '2024-01-01' };
      mockStorage.getTokens.mockResolvedValueOnce({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      mockAxios.get.mockResolvedValueOnce({ data: mockUser });

      const result = await authApi.getCurrentUser();

      expect(result).toEqual(mockUser);
    });

    it('returns null when no token exists', async () => {
      mockStorage.getTokens.mockResolvedValueOnce(null);

      const result = await authApi.getCurrentUser();

      expect(result).toBeNull();
      expect(mockAxios.get).not.toHaveBeenCalled();
    });
  });
});
