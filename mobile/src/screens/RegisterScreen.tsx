import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { requestLimits } from '@/types/apiLimits.generated';
import { colors, spacing, typography } from '@/theme';
import { useAuthContext } from '@/context/AuthContext';

// From the spec, not literals (habitcraft-467). The server validates the same
// numbers, so a literal that drifts below them just moves the rejection from
// this screen to a 400 the user cannot act on (habitcraft-h7q7).
const NAME_MAX_LENGTH = requestLimits.register.name.maxLength;
const EMAIL_MAX_LENGTH = requestLimits.register.email.maxLength;
const PASSWORD_MIN_LENGTH = requestLimits.register.password.minLength;
const PASSWORD_MAX_LENGTH = requestLimits.register.password.maxLength;

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function RegisterScreen() {
  const navigation = useNavigation();
  const { register, error: authError } = useAuthContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleRegister = async () => {
    setValidationError(null);

    // Validate name -- the server requires it (users.name is NOT NULL), so a
    // body without it comes back 400 (habitcraft-7ggs).
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }

    // Validate email
    if (!email.trim()) {
      setValidationError('Email is required');
      return;
    }

    if (!isValidEmail(email)) {
      setValidationError('Please enter a valid email');
      return;
    }

    if (email.trim().length > EMAIL_MAX_LENGTH) {
      setValidationError(`Email must be ${EMAIL_MAX_LENGTH} characters or less`);
      return;
    }

    // Validate password
    if (!password) {
      setValidationError('Password is required');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setValidationError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }

    // Capped rather than truncated with maxLength on the input: silently
    // trimming a pasted passphrase here would leave the account with a password
    // the user cannot type back into the login screen.
    if (password.length > PASSWORD_MAX_LENGTH) {
      setValidationError(`Password must be ${PASSWORD_MAX_LENGTH} characters or less`);
      return;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await register({ email: email.trim(), password, name: name.trim() });
    } catch {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginPress = () => {
    navigation.goBack();
  };

  const displayError = validationError || authError;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join HabitCraft and start building better habits</Text>

        <View style={styles.form}>
          <TextInput
            testID="register-name-input"
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX_LENGTH}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isLoading}
            accessibilityLabel="Name"
            accessibilityHint="Enter your name"
          />

          <TextInput
            testID="register-email-input"
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            accessibilityLabel="Email address"
            accessibilityHint="Enter your email address"
          />

          <TextInput
            testID="register-password-input"
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            accessibilityLabel="Password"
            accessibilityHint={`Enter a password with at least ${PASSWORD_MIN_LENGTH} characters`}
          />

          <TextInput
            testID="register-confirm-password-input"
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!isLoading}
            accessibilityLabel="Confirm password"
            accessibilityHint="Re-enter your password to confirm"
          />

          {displayError && (
            <Text
              testID="register-error"
              style={styles.error}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {displayError}
            </Text>
          )}

          <TouchableOpacity
            testID="register-button"
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isLoading ? 'Creating account' : 'Sign up'}
            accessibilityState={{ disabled: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="register-login-link"
          onPress={handleLoginPress}
          disabled={isLoading}
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Log in"
          accessibilityHint="Double tap to go to the login screen"
        >
          <Text style={styles.loginLink}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  loginLink: {
    ...typography.body,
    color: colors.primary,
    marginTop: spacing.lg,
  },
});

export default RegisterScreen;
