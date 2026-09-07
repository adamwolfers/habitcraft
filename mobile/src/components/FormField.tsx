import React, { forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';

export interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Base testID; the input, error and toggle derive theirs from it. */
  testID: string;
  /** Helper text shown under the input. An `error` replaces it. */
  hint?: string;
  error?: string;
  /** Renders a password field with a reveal toggle. */
  secure?: boolean;
  containerStyle?: ViewStyle;
}

/**
 * A labelled text input with its error attached to it.
 *
 * The auth screens used to render a single message above the submit button,
 * which left the user to work out which field it meant. Keeping the message
 * with the field it belongs to is the point of this component.
 *
 * `secure` renders the reveal toggle that let the Confirm Password field go
 * away: on a phone, being able to check what you typed beats typing it twice.
 */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, testID, hint, error, secure = false, containerStyle, ...inputProps },
  ref
) {
  const [isRevealed, setIsRevealed] = useState(false);
  const errorTestID = `${testID}-error`;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label} nativeID={`${testID}-label`}>
        {label}
      </Text>

      <View style={[styles.inputRow, !!error && styles.inputRowError]}>
        {/*
          One TextInput whose `secureTextEntry` prop flips, never two elements
          swapped by the toggle: remounting the input breaks the iOS autofill
          association and can drop what the user already typed.
        */}
        <TextInput
          ref={ref}
          testID={testID}
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && !isRevealed}
          accessibilityLabel={label}
          accessibilityHint={error || hint}
          {...inputProps}
        />

        {secure && (
          <TouchableOpacity
            testID={`${testID}-reveal`}
            onPress={() => setIsRevealed((revealed) => !revealed)}
            style={styles.reveal}
            accessibilityRole="button"
            accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'}
            // The eye is a small glyph; widen what a thumb has to hit.
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.revealIcon}>{isRevealed ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text
          testID={errorTestID}
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : (
        hint && (
          <Text testID={`${testID}-hint`} style={styles.hint}>
            {hint}
          </Text>
        )
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRowError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  reveal: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  revealIcon: {
    fontSize: 18,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.xs,
  },
});

export default FormField;
