import { render, screen } from '@testing-library/react';
import Providers from './Providers';

// Mock the AuthProvider
jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

// Mock PostHogProvider
jest.mock('@/components/PostHogProvider', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="posthog-provider">{children}</div>
  ),
}));

// Mock PostHogPageView
jest.mock('@/components/PostHogPageView', () => ({
  PostHogPageView: () => null,
}));

// Mock HeaderWithProfile component
jest.mock('@/components/HeaderWithProfile', () => {
  return function MockHeaderWithProfile() {
    return <div data-testid="header">Header</div>;
  };
});

describe('Providers', () => {
  describe('AuthProvider Integration', () => {
    it('should render children inside AuthProvider', () => {
      render(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should wrap all children with AuthProvider', () => {
      render(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      const authProvider = screen.getByTestId('auth-provider');
      const testChild = screen.getByTestId('test-child');

      expect(authProvider).toContainElement(testChild);
    });

    it('should render multiple children correctly inside AuthProvider', () => {
      render(
        <Providers>
          <div data-testid="child1">First Child</div>
          <div data-testid="child2">Second Child</div>
          <div data-testid="child3">Third Child</div>
        </Providers>
      );

      const authProvider = screen.getByTestId('auth-provider');

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
      expect(screen.getByTestId('child3')).toBeInTheDocument();
      expect(authProvider).toBeInTheDocument();
    });
  });

  describe('Header Integration', () => {
    it('should render Header component', () => {
      render(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      expect(screen.getByTestId('header')).toBeInTheDocument();
    });

    it('should render Header inside AuthProvider', () => {
      render(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      const authProvider = screen.getByTestId('auth-provider');
      const header = screen.getByTestId('header');

      expect(authProvider).toContainElement(header);
    });

    it('should render Header before children', () => {
      render(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      const authProvider = screen.getByTestId('auth-provider');
      const children = authProvider.children;

      expect(children[0]).toHaveAttribute('data-testid', 'header');
    });
  });

  describe('PostHogProvider Integration', () => {
    it('should wrap content with PostHogProvider', () => {
      render(
        <Providers>
          <div data-testid="test-child">Test Content</div>
        </Providers>
      );

      const posthogProvider = screen.getByTestId('posthog-provider');
      const authProvider = screen.getByTestId('auth-provider');

      expect(posthogProvider).toContainElement(authProvider);
    });
  });
});
