import { render, screen } from '@testing-library/react';
import RootLayout from './layout';

// Mock the AuthProvider
jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

// Mock Next.js fonts
jest.mock('next/font/google', () => ({
  Geist: () => ({
    variable: '--font-geist-sans',
  }),
  Geist_Mono: () => ({
    variable: '--font-geist-mono',
  }),
}));

// Mock Header component
jest.mock('@/components/Header', () => {
  return function MockHeader() {
    return <div data-testid="header">Header</div>;
  };
});

describe('RootLayout', () => {
  describe('AuthProvider Integration', () => {
    it('should render children inside AuthProvider', () => {
      render(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      // Verify AuthProvider is present
      expect(screen.getByTestId('auth-provider')).toBeInTheDocument();

      // Verify children are rendered
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should wrap all children with AuthProvider', () => {
      render(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      const authProvider = screen.getByTestId('auth-provider');
      const testChild = screen.getByTestId('test-child');

      // Verify the child is inside the AuthProvider
      expect(authProvider).toContainElement(testChild);
    });

    it('should render multiple children correctly inside AuthProvider', () => {
      render(
        <RootLayout>
          <div data-testid="child1">First Child</div>
          <div data-testid="child2">Second Child</div>
          <div data-testid="child3">Third Child</div>
        </RootLayout>
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
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      expect(screen.getByTestId('header')).toBeInTheDocument();
    });

    it('should render Header inside AuthProvider', () => {
      render(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      const authProvider = screen.getByTestId('auth-provider');
      const header = screen.getByTestId('header');

      expect(authProvider).toContainElement(header);
    });

    it('should render Header before children', () => {
      render(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      const authProvider = screen.getByTestId('auth-provider');
      const children = authProvider.children;

      // Header should be the first child
      expect(children[0]).toHaveAttribute('data-testid', 'header');
    });
  });
});
