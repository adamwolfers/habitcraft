import { render, screen } from '@testing-library/react';
import LandingPage from './page';

describe('Landing Page', () => {
  describe('Structure', () => {
    it('should render hero section with h1 heading', () => {
      render(<LandingPage />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should render CTA links to register page', () => {
      render(<LandingPage />);

      const ctaLinks = screen.getAllByRole('link', { name: /get started/i });
      expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
      ctaLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/register');
      });
    });

    it('should render features section with three feature cards', () => {
      render(<LandingPage />);

      // Features section has h2 heading and 3 feature cards (h3 headings)
      const h3Headings = screen.getAllByRole('heading', { level: 3 });
      expect(h3Headings.length).toBeGreaterThanOrEqual(3);
    });

    it('should render how it works section', () => {
      render(<LandingPage />);

      // Section exists with numbered steps
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render footer', () => {
      render(<LandingPage />);

      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });
  });
});
