import type { AuthContextType } from '@/context/AuthContext';

/**
 * Builds a complete AuthContextType for mocking useAuth() in tests.
 *
 * The return type is annotated as AuthContextType (not inferred), so adding a
 * field to the context breaks compilation here — in one place — instead of
 * silently drifting across every test file that mocks auth. Prefer this over
 * hand-rolled object literals at call sites.
 *
 * isAuthenticated defaults to `user != null`, mirroring AuthProvider's own
 * derivation. Pass it explicitly to model an inconsistent state; overrides are
 * applied last and always win.
 */
export function createMockAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: overrides.user != null,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    updateUser: jest.fn(),
    ...overrides,
  };
}
