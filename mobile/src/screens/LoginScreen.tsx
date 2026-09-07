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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
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
import { validateLoginForm, hasErrors, LoginFieldErrors } from '@/utils/authUtils';

type LoginNavigation = StackNavigationProp<AuthStackParamList, 'Login'>;
type LoginRoute = RouteProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<LoginNavigation>();
  const route = useRoute<LoginRoute>();
  const { login, error: authError, clearError } = useAuthContext();

  // Prefilled when Register hands a user over after a duplicate-email 409.
  const routeEmail = route.params?.email;
  const [email, setEmail] = useState(routeEmail ?? '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    clearError();
  }, [clearError]);

  // Not just the useState initial value: navigating here from Register pops
  // back to an ALREADY-MOUNTED Login screen when the user reached Register via
  // Login, and initial state does not re-read on that path.
  useEffect(() => {
    if (routeEmail) {
      setEmail(routeEmail);
    }
  }, [routeEmail]);

  const handleChange = (setValue: (value: string) => void, field: keyof LoginFieldErrors) => {
    return (value: string) => {
      setValue(value);
      setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
      if (authError) {
        clearError();
      }
    };
  };

  const handleLogin = async () => {
    const errors = validateLoginForm({ email, password });
    setFieldErrors(errors);
    if (hasErrors(errors)) {
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch {
      // Surfaced through the context's error state.
    } finally {
      setIsLoading(false);
    }
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
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Log in to keep your streak going</Text>

        <View style={styles.form}>
          <FormField
            label="Email"
            testID="login-email-input"
            placeholder="you@example.com"
            value={email}
            onChangeText={handleChange(setEmail, 'email')}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            // `username` rather than `emailAddress`: it is what pairs an email
            // with a password in the OS credential store, so the account saved
            // at sign-up is offered back here.
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isLoading}
          />

          <FormField
            ref={passwordRef}
            label="Password"
            testID="login-password-input"
            placeholder="••••••••"
            value={password}
            onChangeText={handleChange(setPassword, 'password')}
            error={fieldErrors.password}
            secure
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            editable={!isLoading}
          />

          {authError && (
            <View style={styles.errorBanner}>
              <Text
                testID="login-error"
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {authError}
              </Text>
            </View>
          )}

          <TouchableOpacity
            testID="login-button"
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isLoading ? 'Logging in' : 'Log in'}
            accessibilityState={{ disabled: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="login-signup-link"
          onPress={() => navigation.navigate('Register')}
          disabled={isLoading}
          accessibilityRole="link"
          accessibilityLabel="Don't have an account? Sign up"
          accessibilityHint="Double tap to create a new account"
        >
          <Text style={styles.signUpLink}>Don&apos;t have an account? Sign up</Text>
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
  signUpLink: {
    ...typography.body,
    color: colors.primary,
    marginTop: spacing.lg,
  },
});

export default LoginScreen;
