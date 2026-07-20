import { AxiosError, AxiosHeaders } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { api, tokenManager, isNetworkError, isRetryableError } from './api';

jest.mock('expo-secure-store');

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tokenManager', () => {
    describe('getAccessToken', () => {
      it('returns token from secure store', async () => {
        mockSecureStore.getItemAsync.mockResolvedValue('test-access-token');

        const token = await tokenManager.getAccessToken();

        expect(token).toBe('test-access-token');
        expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('habitcraft_access_token');
      });

      it('returns null when no token stored', async () => {
        mockSecureStore.getItemAsync.mockResolvedValue(null);

        const token = await tokenManager.getAccessToken();

        expect(token).toBeNull();
      });
    });

    describe('getRefreshToken', () => {
      it('returns refresh token from secure store', async () => {
        mockSecureStore.getItemAsync.mockResolvedValue('test-refresh-token');

        const token = await tokenManager.getRefreshToken();

        expect(token).toBe('test-refresh-token');
        expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('habitcraft_refresh_token');
      });
    });

    describe('setTokens', () => {
      it('stores both tokens in secure store', async () => {
        await tokenManager.setTokens('new-access', 'new-refresh');

        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'habitcraft_access_token',
          'new-access'
        );
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'habitcraft_refresh_token',
          'new-refresh'
        );
      });
    });

    describe('clearTokens', () => {
      it('removes both tokens from secure store', async () => {
        await tokenManager.clearTokens();

        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('habitcraft_access_token');
        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('habitcraft_refresh_token');
      });
    });
  });

  describe('api instance', () => {
    it('has correct base configuration', () => {
      expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('isNetworkError', () => {
    it('returns true for AxiosError without response', () => {
      const error = new AxiosError('Network Error');
      error.response = undefined;

      expect(isNetworkError(error)).toBe(true);
    });

    it('returns true for ECONNABORTED error code', () => {
      const error = new AxiosError('Connection aborted');
      error.code = 'ECONNABORTED';
      error.response = { status: 0, data: null, statusText: '', headers: {}, config: {} as never };

      expect(isNetworkError(error)).toBe(true);
    });

    it('returns true for ERR_NETWORK error code', () => {
      const error = new AxiosError('Network error');
      error.code = 'ERR_NETWORK';
      error.response = { status: 0, data: null, statusText: '', headers: {}, config: {} as never };

      expect(isNetworkError(error)).toBe(true);
    });

    it('returns false for AxiosError with response', () => {
      const error = new AxiosError('Server error');
      error.response = {
        status: 500,
        data: { message: 'Internal error' },
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as never,
      };

      expect(isNetworkError(error)).toBe(false);
    });

    it('returns true for Error with network message', () => {
      expect(isNetworkError(new Error('Network request failed'))).toBe(true);
      expect(isNetworkError(new Error('Connection timeout'))).toBe(true);
      expect(isNetworkError(new Error('Network timeout occurred'))).toBe(true);
    });

    it('returns false for Error without network message', () => {
      expect(isNetworkError(new Error('Something went wrong'))).toBe(false);
      expect(isNetworkError(new Error('Invalid input'))).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(isNetworkError('string error')).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
      expect(isNetworkError({ message: 'object error' })).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('returns true for network errors', () => {
      const error = new AxiosError('Network Error');
      error.response = undefined;

      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for 5xx status codes', () => {
      const error500 = new AxiosError('Internal Server Error');
      error500.response = {
        status: 500,
        data: null,
        statusText: '',
        headers: {},
        config: {} as never,
      };
      expect(isRetryableError(error500)).toBe(true);

      const error502 = new AxiosError('Bad Gateway');
      error502.response = {
        status: 502,
        data: null,
        statusText: '',
        headers: {},
        config: {} as never,
      };
      expect(isRetryableError(error502)).toBe(true);

      const error503 = new AxiosError('Service Unavailable');
      error503.response = {
        status: 503,
        data: null,
        statusText: '',
        headers: {},
        config: {} as never,
      };
      expect(isRetryableError(error503)).toBe(true);
    });

    it('returns false for 4xx status codes', () => {
      const error400 = new AxiosError('Bad Request');
      error400.response = {
        status: 400,
        data: null,
        statusText: '',
        headers: {},
        config: {} as never,
      };
      expect(isRetryableError(error400)).toBe(false);

      const error401 = new AxiosError('Unauthorized');
      error401.response = {
        status: 401,
        data: null,
        statusText: '',
        headers: {},
        config: {} as never,
      };
      expect(isRetryableError(error401)).toBe(false);

      const error404 = new AxiosError('Not Found');
      error404.response = {
        status: 404,
        data: null,
        statusText: '',
        headers: {},
        config: {} as never,
      };
      expect(isRetryableError(error404)).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError({ message: 'object' })).toBe(false);
    });
  });

  describe('request interceptor', () => {
    it('adds Authorization header when token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('test-token');

      // Get the request interceptor
      const interceptors = api.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: unknown) => Promise<unknown> }>;
      };
      const requestInterceptor = interceptors.handlers[0].fulfilled;

      const config = {
        headers: new AxiosHeaders(),
        url: '/test',
      };

      const result = await requestInterceptor(config);

      expect((result as { headers: AxiosHeaders }).headers.get('Authorization')).toBe(
        'Bearer test-token'
      );
    });

    it('does not add Authorization header when no token', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const interceptors = api.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: unknown) => Promise<unknown> }>;
      };
      const requestInterceptor = interceptors.handlers[0].fulfilled;

      const config = {
        headers: new AxiosHeaders(),
        url: '/test',
      };

      const result = await requestInterceptor(config);

      expect((result as { headers: AxiosHeaders }).headers.get('Authorization')).toBeUndefined();
    });
  });
});
