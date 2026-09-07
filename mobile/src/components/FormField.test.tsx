import React, { createRef } from 'react';
import { TextInput } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { FormField } from './FormField';

describe('FormField', () => {
  it('renders its label and input', () => {
    const { getByText, getByTestId } = render(<FormField label="Email" testID="field-email" />);

    expect(getByText('Email')).toBeTruthy();
    expect(getByTestId('field-email')).toBeTruthy();
  });

  it('passes text input props through to the input', () => {
    const { getByTestId } = render(
      <FormField label="Email" testID="field-email" keyboardType="email-address" value="a@b.com" />
    );

    const input = getByTestId('field-email');
    expect(input.props.keyboardType).toBe('email-address');
    expect(input.props.value).toBe('a@b.com');
  });

  it('forwards its ref to the input, which is what makes keyboard chaining work', () => {
    const ref = createRef<TextInput>();

    render(<FormField label="Email" testID="field-email" ref={ref} />);

    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe('function');
  });

  describe('hint and error', () => {
    it('shows the hint when there is no error', () => {
      const { getByTestId } = render(
        <FormField label="Password" testID="field-password" hint="At least 8 characters" />
      );

      expect(getByTestId('field-password-hint').props.children).toBe('At least 8 characters');
    });

    it('replaces the hint with the error', () => {
      const { getByTestId, queryByTestId } = render(
        <FormField
          label="Password"
          testID="field-password"
          hint="At least 8 characters"
          error="Password is required"
        />
      );

      expect(getByTestId('field-password-error').props.children).toBe('Password is required');
      expect(queryByTestId('field-password-hint')).toBeNull();
    });

    it('renders neither when given neither', () => {
      const { queryByTestId } = render(<FormField label="Email" testID="field-email" />);

      expect(queryByTestId('field-email-hint')).toBeNull();
      expect(queryByTestId('field-email-error')).toBeNull();
    });

    it('announces the error to screen readers', () => {
      const { getByTestId } = render(
        <FormField label="Email" testID="field-email" error="Email is required" />
      );

      const error = getByTestId('field-email-error');
      expect(error.props.accessibilityRole).toBe('alert');
      expect(error.props.accessibilityLiveRegion).toBe('polite');
    });
  });

  describe('reveal toggle', () => {
    it('is absent on a non-secure field', () => {
      const { queryByTestId } = render(<FormField label="Email" testID="field-email" />);

      expect(queryByTestId('field-email-reveal')).toBeNull();
    });

    it('starts masked', () => {
      const { getByTestId } = render(<FormField label="Password" testID="field-password" secure />);

      expect(getByTestId('field-password').props.secureTextEntry).toBe(true);
    });

    it('unmasks and re-masks on tap', () => {
      const { getByTestId } = render(<FormField label="Password" testID="field-password" secure />);

      fireEvent.press(getByTestId('field-password-reveal'));
      expect(getByTestId('field-password').props.secureTextEntry).toBe(false);

      fireEvent.press(getByTestId('field-password-reveal'));
      expect(getByTestId('field-password').props.secureTextEntry).toBe(true);
    });

    it('keeps the same input instance across a toggle', () => {
      // Remounting the input would break the iOS autofill association and can
      // drop what the user typed -- only the prop may change.
      const ref = createRef<TextInput>();
      const { getByTestId } = render(
        <FormField label="Password" testID="field-password" secure ref={ref} value="hunter22" />
      );
      const before = ref.current;

      fireEvent.press(getByTestId('field-password-reveal'));

      expect(ref.current).toBe(before);
      expect(getByTestId('field-password').props.value).toBe('hunter22');
    });

    it('tells screen readers what the toggle will do', () => {
      const { getByTestId } = render(<FormField label="Password" testID="field-password" secure />);

      const toggle = getByTestId('field-password-reveal');
      expect(toggle.props.accessibilityLabel).toBe('Show password');

      fireEvent.press(toggle);
      expect(getByTestId('field-password-reveal').props.accessibilityLabel).toBe('Hide password');
    });
  });
});
