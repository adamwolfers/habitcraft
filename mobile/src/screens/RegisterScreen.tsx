import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
// Imported directly, not through '@/components': that barrel pulls in
// SkeletonLoader -> react-native-reanimated, whose jest mock throws
// WorkletsError at module load and takes the whole suite down with an error
// pointing nowhere near the cause (habitcraft-ma03). Restore the barrel import
// once that is fixed.
import { FormField } from '@/components/FormField';
import { AuthStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { useAuthContext } from '@/context/AuthContext';
import {
  validateRegisterForm,
  hasErrors,
  RegisterFieldErrors,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '@/utils/authUtils';

type RegisterNavigation = StackNavigationProp<AuthStackParamList, 'Register'>;

/**
 * iOS reads these rules to generate a Strong Password that the server will
 * actually accept, instead of one the 72-character cap would reject.
 */
const PASSWORD_RULES = `minlength: ${PASSWORD_MIN_LENGTH}; maxlength: ${PASSWORD_MAX_LENGTH};`;

export function RegisterScreen() {
  const navigation = useNavigation<RegisterNavigation>();
  const { register, error: authError, clearError } = useAuthContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [emailInUse, setEmailInUse] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // The auth error lives in the context and outlives the screen that caused
  // it, so a failed login used to render above this empty form
  // (habitcraft-tvro.2).
  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleChange = (setValue: (value: string) => void, field: keyof RegisterFieldErrors) => {
    return (value: string) => {
      setValue(value);
      // Clear the complaint the moment the user acts on it, rather than making
      // them submit again to find out whether they fixed it.
      setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
      setEmailInUse(false);
      if (authError) {
        clearError();
      }
    };
  };

  const handleRegister = async () => {
    setEmailInUse(false);
    const errors = validateRegisterForm({ name, email, password });
    setFieldErrors(errors);
    if (hasErrors(errors)) {
      return;
    }

    setIsLoading(true);
    try {
      await register({ email: email.trim(), password, name: name.trim() });
    } catch (err) {
      // The server owns the definitive answer on whether this email is taken;
      // a 409 gets a way forward rather than a dead end.
      if (err && typeof err === 'object' && 'status' in err && err.status === 409) {
        setEmailInUse(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    // navigate, not goBack: Welcome sits under this screen now, so going back
    // would land on Welcome rather than Login.
    navigation.navigate('Login', { email: email.trim() || undefined });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join HabitCraft and start building better habits</Text>

        <View style={styles.form}>
          <FormField
            label="Name"
            testID="register-name-input"
            placeholder="Your name"
            value={name}
            onChangeText={handleChange(setName, 'name')}
            error={fieldErrors.name}
            maxLength={NAME_MAX_LENGTH}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="name"
            autoComplete="name"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current?.focus()}
            editable={!isLoading}
          />

          <FormField
            ref={emailRef}
            label="Email"
            testID="register-email-input"
            placeholder="you@example.com"
            value={email}
            onChangeText={handleChange(setEmail, 'email')}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isLoading}
          />

          <FormField
            ref={passwordRef}
            label="Password"
            testID="register-password-input"
            placeholder="••••••••"
            value={password}
            onChangeText={handleChange(setPassword, 'password')}
            error={fieldErrors.password}
            // Stated up front. This used to live only in an accessibilityHint,
            // so a sighted user learned the minimum by being rejected.
            hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
            secure
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            autoComplete="new-password"
            passwordRules={PASSWORD_RULES}
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            editable={!isLoading}
          />

          {authError && (
            <View testID="register-error-container" style={styles.errorBanner}>
              <Text
                testID="register-error"
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {authError}
              </Text>

              {emailInUse && (
                <TouchableOpacity
                  testID="register-login-instead"
                  onPress={goToLogin}
                  accessibilityRole="link"
                  accessibilityLabel="Log in instead"
                  accessibilityHint="Double tap to log in with this email"
                >
                  <Text style={styles.errorAction}>Log in instead</Text>
                </TouchableOpacity>
              )}
            </View>
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
          onPress={goToLogin}
          disabled={isLoading}
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Log in"
          accessibilityHint="Double tap to go to the login screen"
        >
          <Text style={styles.loginLink}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
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
  errorBanner: {
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  errorAction: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: '600',
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
  loginLink: {
    ...typography.body,
    color: colors.primary,
    marginTop: spacing.lg,
  },
});

export default RegisterScreen;
