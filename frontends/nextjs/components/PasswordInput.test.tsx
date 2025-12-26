import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordInput from './PasswordInput';

describe('PasswordInput Component', () => {
  describe('Initial Rendering', () => {
    it('should render an input field', () => {
      render(<PasswordInput id="password" data-testid="password-input" />);

      expect(screen.getByTestId('password-input')).toBeInTheDocument();
    });

    it('should render with type="password" by default', () => {
      render(<PasswordInput id="password" data-testid="password-input" />);

      const input = screen.getByTestId('password-input');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should render a toggle button', () => {
      render(<PasswordInput id="password" />);

      expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    });

    it('should pass through standard input props', () => {
      render(
        <PasswordInput
          id="password"
          placeholder="Enter password"
          disabled
          required
          className="custom-class"
          data-testid="password-input"
        />
      );

      const input = screen.getByTestId('password-input');
      expect(input).toHaveAttribute('placeholder', 'Enter password');
      expect(input).toBeDisabled();
      expect(input).toBeRequired();
      expect(input).toHaveClass('custom-class');
    });

    it('should pass the id to the input element', () => {
      render(<PasswordInput id="my-password" data-testid="password-input" />);

      expect(screen.getByTestId('password-input')).toHaveAttribute('id', 'my-password');
    });
  });

  describe('Toggle Visibility', () => {
    it('should show password when toggle button is clicked', async () => {
      const user = userEvent.setup();
      render(<PasswordInput id="password" data-testid="password-input" />);

      const input = screen.getByTestId('password-input');
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      await user.click(toggleButton);

      expect(input).toHaveAttribute('type', 'text');
    });

    it('should update button aria-label to "Hide password" when visible', async () => {
      const user = userEvent.setup();
      render(<PasswordInput id="password" />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);

      expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
    });

    it('should hide password again when toggle button is clicked twice', async () => {
      const user = userEvent.setup();
      render(<PasswordInput id="password" data-testid="password-input" />);

      const input = screen.getByTestId('password-input');
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');

      const hideButton = screen.getByRole('button', { name: /hide password/i });
      await user.click(hideButton);

      expect(input).toHaveAttribute('type', 'password');
    });

    it('should restore aria-label to "Show password" after hiding', async () => {
      const user = userEvent.setup();
      render(<PasswordInput id="password" />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      await user.click(toggleButton);
      await user.click(screen.getByRole('button', { name: /hide password/i }));

      expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    });
  });

  describe('Value Handling', () => {
    it('should accept and display a controlled value', () => {
      render(
        <PasswordInput
          id="password"
          value="secret123"
          onChange={() => {}}
          data-testid="password-input"
        />
      );

      const input = screen.getByTestId('password-input');
      expect(input).toHaveValue('secret123');
    });

    it('should call onChange when user types', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();

      render(
        <PasswordInput
          id="password"
          value=""
          onChange={handleChange}
          data-testid="password-input"
        />
      );

      const input = screen.getByTestId('password-input');
      await user.type(input, 'a');

      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have type="button" on toggle to prevent form submission', () => {
      render(<PasswordInput id="password" />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toHaveAttribute('type', 'button');
    });

    it('should contain an svg icon in the toggle button', () => {
      render(<PasswordInput id="password" />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton.querySelector('svg')).toBeInTheDocument();
    });
  });
});
