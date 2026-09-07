import axios from 'axios';
import { authApi } from './auth';
import { storage } from './storage';
import { api } from './api';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock the shared api instance (used for authenticated calls that need token refresh)
jest.mock('./api', () => ({
  api: {
    get: jest.fn(),
  },
}));
const mockApi = api as jest.Mocked<typeof api>;

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
        user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '2024-01-01' },
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
          data: { error: 'Invalid credentials' },
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
      name: 'Test User',
    };

    const mockResponse = {
      data: {
        user: { id: '2', email: 'new@example.com', name: 'Test User', createdAt: '2024-01-01' },
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
          data: { error: 'User with this email already exists' },
        },
      };
      mockAxios.post.mockRejectedValueOnce(error);

      await expect(authApi.register(registerData)).rejects.toThrow(
        'User with this email already exists'
      );
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

      expect(mockAxios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), {
        refreshToken: 'old-refresh-token',
      });
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
          data: { error: 'Invalid refresh token' },
        },
      };
      mockAxios.post.mockRejectedValueOnce(error);

      await expect(authApi.refreshToken('invalid-token')).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('getCurrentUser', () => {
    it('makes GET request to /users/me via the shared api instance', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: '2024-01-01',
      };
      mockStorage.getTokens.mockResolvedValueOnce({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      mockApi.get.mockResolvedValueOnce({ data: mockUser });

      await authApi.getCurrentUser();

      expect(mockApi.get).toHaveBeenCalledWith('/users/me');
    });

    it('returns user data', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: '2024-01-01',
      };
      mockStorage.getTokens.mockResolvedValueOnce({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      mockApi.get.mockResolvedValueOnce({ data: mockUser });

      const result = await authApi.getCurrentUser();

      expect(result).toEqual(mockUser);
    });

    it('returns null when no token exists', async () => {
      mockStorage.getTokens.mockResolvedValueOnce(null);

      const result = await authApi.getCurrentUser();

      expect(result).toBeNull();
      expect(mockApi.get).not.toHaveBeenCalled();
    });
  });
});

/**
 * The auth routes do not speak one error shape. shared/api-spec/openapi.yaml
 * declares three, and only one of them carries `message` -- which is all the
 * client used to read, so a duplicate-email signup surfaced as axios's own
 * "Request failed with status code 409" (habitcraft-tvro.1).
 *
 * These cases use the shapes the server actually sends. The suite previously
 * asserted against `{ message }` bodies for 401 and 409, which the server has
 * never returned, so it passed while the flow was broken.
 */
describe('server error shapes', () => {
  const credentials = { email: 'test@example.com', password: 'password123' };
  const registerData = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the express-validator message out of a 400 ValidationErrors body', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          errors: [
            { type: 'field', path: 'password', msg: 'Password must be at least 8 characters' },
          ],
        },
      },
    });

    await expect(authApi.register(registerData)).rejects.toThrow(
      'Password must be at least 8 characters'
    );
  });

  it('reads `error` out of the 409 the duplicate-email path returns', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: 'User with this email already exists' },
      },
    });

    await expect(authApi.register(registerData)).rejects.toThrow(
      'User with this email already exists'
    );
  });

  it('exposes the status so the screen can offer a 409 a way out', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: 'User with this email already exists' },
      },
    });

    await expect(authApi.register(registerData)).rejects.toMatchObject({ status: 409 });
  });

  it('prefers `message` over `error` on a rate-limit body that carries both', async () => {
    // The limiter sends both: `error` is the terse label, `message` the
    // sentence telling the user how long to wait.
    mockAxios.post.mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          error: 'Too many registration attempts',
          message: 'Too many accounts created from this IP, please try again after an hour',
          statusCode: 429,
        },
      },
    });

    await expect(authApi.register(registerData)).rejects.toThrow(
      'Too many accounts created from this IP, please try again after an hour'
    );
  });

  it('reads `error` out of the 401 a bad login returns', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: { status: 401, data: { error: 'Invalid credentials' } },
    });

    await expect(authApi.login(credentials)).rejects.toThrow('Invalid credentials');
  });

  it('falls back to the axios message when the response carries no body', async () => {
    mockAxios.post.mockRejectedValueOnce(new Error('Network Error'));

    await expect(authApi.login(credentials)).rejects.toThrow('Network Error');
  });

  it('falls back to a generic message when nothing recognisable is thrown', async () => {
    mockAxios.post.mockRejectedValueOnce('kaboom');

    await expect(authApi.login(credentials)).rejects.toThrow('An unexpected error occurred');
  });

  it('ignores an empty errors array rather than reading errors[0].msg off it', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: { status: 400, data: { errors: [], error: 'Bad request' } },
    });

    await expect(authApi.register(registerData)).rejects.toThrow('Bad request');
  });
});
