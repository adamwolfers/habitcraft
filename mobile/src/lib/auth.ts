import axios from 'axios';
import { api } from './api';
import { storage } from './storage';
import { User, AuthTokens, LoginCredentials, RegisterData } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1';

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getResponseBody(error: unknown): Record<string, unknown> | undefined {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }
  return isRecord(error.response.data) ? error.response.data : undefined;
}

function getResponseStatus(error: unknown): number | undefined {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }
  return typeof error.response.status === 'number' ? error.response.status : undefined;
}

/**
 * The auth routes do not speak one error shape. shared/api-spec/openapi.yaml
 * declares three, and this reads all of them in the order that yields the most
 * actionable sentence:
 *
 *   1. ValidationErrors -- `errors[].msg`, express-validator's 400.
 *   2. DetailedError    -- `message`, e.g. every rate limiter's 429.
 *   3. Error/BriefError -- `error`, e.g. the duplicate-email 409 and login 401.
 *
 * `message` must precede `error`: a DetailedError carries both, where `error`
 * is a terse label ("Too many registration attempts") and `message` is the
 * sentence a user can act on ("...please try again after an hour").
 *
 * This used to read `message` alone, which none of the shapes the register
 * route returns actually has -- so signing up with an address already on file
 * told the user "Request failed with status code 409" (habitcraft-tvro.1).
 */
function extractErrorMessage(error: unknown): string {
  const body = getResponseBody(error);

  if (body) {
    if (Array.isArray(body.errors)) {
      const failure = body.errors.find((entry) => isRecord(entry) && typeof entry.msg === 'string');
      if (isRecord(failure) && typeof failure.msg === 'string') {
        return failure.msg;
      }
    }

    if (typeof body.message === 'string' && body.message) {
      return body.message;
    }

    if (typeof body.error === 'string' && body.error) {
      return body.error;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * An Error carrying the HTTP status alongside the message, so a screen can
 * treat a specific failure specially -- RegisterScreen turns a 409 into a
 * "Log in instead" shortcut rather than a dead end.
 *
 * Built by hand rather than as an `extends Error` subclass: Babel's class
 * transform does not reliably preserve `instanceof Error` for built-in
 * subclasses, and AuthContext branches on exactly that.
 */
export interface AuthApiError extends Error {
  status?: number;
}

function toAuthApiError(error: unknown): AuthApiError {
  const authError = new Error(extractErrorMessage(error)) as AuthApiError;
  authError.status = getResponseStatus(error);
  return authError;
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
      throw toAuthApiError(error);
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
      throw toAuthApiError(error);
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
      throw toAuthApiError(error);
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const tokens = await storage.getTokens();
    if (!tokens) {
      return null;
    }

    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error) {
      throw toAuthApiError(error);
    }
  },
};
