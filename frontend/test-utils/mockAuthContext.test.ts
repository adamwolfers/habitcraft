import { createMockAuth } from './mockAuthContext';
import type { User } from '@/context/AuthContext';

const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: '2025-01-01T00:00:00.000Z',
};

describe('createMockAuth', () => {
  describe('defaults', () => {
    it('returns a logged-out context when called with no arguments', () => {
      const auth = createMockAuth();

      expect(auth.user).toBeNull();
      expect(auth.isLoading).toBe(false);
      expect(auth.isAuthenticated).toBe(false);
    });

    it('supplies a jest mock for every context function', () => {
      const auth = createMockAuth();

      expect(jest.isMockFunction(auth.login)).toBe(true);
      expect(jest.isMockFunction(auth.register)).toBe(true);
      expect(jest.isMockFunction(auth.logout)).toBe(true);
      expect(jest.isMockFunction(auth.updateUser)).toBe(true);
    });

    it('returns fresh mock functions on each call so state cannot leak between tests', () => {
      const first = createMockAuth();
      const second = createMockAuth();

      first.login('test@example.com', 'password');

      expect(first.login).toHaveBeenCalledTimes(1);
      expect(second.login).not.toHaveBeenCalled();
    });
  });

  describe('derived isAuthenticated', () => {
    it('derives true when a user is supplied', () => {
      expect(createMockAuth({ user: mockUser }).isAuthenticated).toBe(true);
    });

    it('derives false when user is explicitly null', () => {
      expect(createMockAuth({ user: null }).isAuthenticated).toBe(false);
    });

    it('lets an explicit isAuthenticated override win over a supplied user', () => {
      const auth = createMockAuth({ user: mockUser, isAuthenticated: false });

      expect(auth.user).toEqual(mockUser);
      expect(auth.isAuthenticated).toBe(false);
    });

    it('lets an explicit isAuthenticated override win over a null user', () => {
      const auth = createMockAuth({ user: null, isAuthenticated: true });

      expect(auth.user).toBeNull();
      expect(auth.isAuthenticated).toBe(true);
    });
  });

  describe('overrides', () => {
    it('uses a caller-supplied function in place of the default mock', () => {
      const logout = jest.fn();
      const auth = createMockAuth({ logout });

      expect(auth.logout).toBe(logout);
    });

    it('applies overrides without dropping unrelated defaults', () => {
      const auth = createMockAuth({ isLoading: true });

      expect(auth.isLoading).toBe(true);
      expect(auth.user).toBeNull();
      expect(jest.isMockFunction(auth.updateUser)).toBe(true);
    });
  });
});
