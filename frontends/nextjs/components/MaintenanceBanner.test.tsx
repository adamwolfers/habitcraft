import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaintenanceBanner } from './MaintenanceBanner';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// Mock PostHog hooks
const mockUseFeatureFlagEnabled = jest.fn();
const mockUseFeatureFlagPayload = jest.fn();

jest.mock('posthog-js/react', () => ({
  useFeatureFlagEnabled: (flag: string) => mockUseFeatureFlagEnabled(flag),
  useFeatureFlagPayload: (flag: string) => mockUseFeatureFlagPayload(flag),
}));

describe('MaintenanceBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when feature flag is disabled', () => {
    beforeEach(() => {
      mockUseFeatureFlagEnabled.mockReturnValue(false);
      mockUseFeatureFlagPayload.mockReturnValue(null);
    });

    it('should not render anything', () => {
      render(<MaintenanceBanner />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should check the correct feature flag', () => {
      render(<MaintenanceBanner />);

      expect(mockUseFeatureFlagEnabled).toHaveBeenCalledWith(FEATURE_FLAGS.MAINTENANCE_BANNER);
    });
  });

  describe('when feature flag is enabled', () => {
    beforeEach(() => {
      mockUseFeatureFlagEnabled.mockReturnValue(true);
    });

    it('should render the banner with default message when no payload', () => {
      mockUseFeatureFlagPayload.mockReturnValue(null);

      render(<MaintenanceBanner />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/scheduled maintenance coming soon/i)).toBeInTheDocument();
    });

    it('should render the banner with custom message from payload', () => {
      mockUseFeatureFlagPayload.mockReturnValue({
        message: 'Maintenance on Jan 15, 2-3am UTC. Site will be unavailable.',
      });

      render(<MaintenanceBanner />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/maintenance on jan 15, 2-3am utc/i)).toBeInTheDocument();
    });

    it('should render a dismiss button', () => {
      mockUseFeatureFlagPayload.mockReturnValue(null);

      render(<MaintenanceBanner />);

      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should hide the banner when dismiss button is clicked', async () => {
      mockUseFeatureFlagPayload.mockReturnValue(null);
      const user = userEvent.setup();

      render(<MaintenanceBanner />);

      expect(screen.getByRole('alert')).toBeInTheDocument();

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should use default message when payload has empty message', () => {
      mockUseFeatureFlagPayload.mockReturnValue({ message: '' });

      render(<MaintenanceBanner />);

      expect(screen.getByText(/scheduled maintenance coming soon/i)).toBeInTheDocument();
    });

    it('should fetch payload from the correct feature flag', () => {
      mockUseFeatureFlagPayload.mockReturnValue(null);

      render(<MaintenanceBanner />);

      expect(mockUseFeatureFlagPayload).toHaveBeenCalledWith(FEATURE_FLAGS.MAINTENANCE_BANNER);
    });
  });

  describe('when feature flag returns undefined (loading state)', () => {
    it('should not render when flag is undefined', () => {
      mockUseFeatureFlagEnabled.mockReturnValue(undefined);
      mockUseFeatureFlagPayload.mockReturnValue(null);

      render(<MaintenanceBanner />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
