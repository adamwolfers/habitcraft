import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useAuthContext } from '@/context/AuthContext';
import { FormField } from '@/components/FormField';
import {
  PROFILE_EMAIL_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  ProfileField,
  ProfileFieldErrors,
  getProfileChanges,
  hasErrors,
  validateProfileForm,
} from '@/utils/authUtils';

export function ProfileScreen() {
  const { user, logout, updateProfile, deleteAccount } = useAuthContext();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const startEditing = () => {
    if (!user) {
      return;
    }
    // Prefilled on each open, so Cancel needs no undo: the next open starts
    // from the profile as it is now.
    setName(user.name);
    setEmail(user.email);
    setFieldErrors({});
    setFormError(null);
    setSaved(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleChange = (field: ProfileField, setValue: (value: string) => void) => {
    return (value: string) => {
      setValue(value);
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
      setFormError(null);
    };
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    const values = { name, email };
    const errors = validateProfileForm(values);
    if (hasErrors(errors)) {
      setFieldErrors(errors);
      return;
    }

    const changes = getProfileChanges(user, values);
    if (Object.keys(changes).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await updateProfile(changes);
      setIsEditing(false);
      setSaved(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      // A 409 is the duplicate-email case: the message belongs under the
      // email field, where the user has to fix it.
      if (err && typeof err === 'object' && 'status' in err && err.status === 409) {
        setFieldErrors({ email: message });
      } else {
        setFormError(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const startDeleting = () => {
    setDeletePassword('');
    setDeleteError(null);
    setIsConfirmingDelete(true);
  };

  // Drops the typed password, so backing out never leaves it on screen.
  const cancelDeleting = () => {
    setIsConfirmingDelete(false);
    setDeletePassword('');
    setDeleteError(null);
  };

  const handleDeletePasswordChange = (value: string) => {
    setDeletePassword(value);
    setDeleteError(null);
  };

  const performDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // On success AuthContext signs the user out and RootNavigator swaps to
      // the auth flow, unmounting this screen; there is no state left to set.
      await deleteAccount(deletePassword);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  // The password step already asks for intent; this native alert is the
  // last chance to back out, the same confirmation HabitDetailScreen uses
  // before deleting a habit.
  const confirmDelete = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, habits, and history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]
    );
  };

  const canDelete = deletePassword.length > 0 && !isDeleting;

  return (
    <ScrollView
      testID="profile-screen"
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Profile</Text>

      {user && !isEditing && (
        <>
          {!!user.name && (
            <Text testID="profile-name" style={styles.name}>
              {user.name}
            </Text>
          )}
          <Text testID="profile-email" style={styles.email}>
            {user.email}
          </Text>

          {saved && (
            <Text testID="profile-success" style={styles.success} accessibilityLiveRegion="polite">
              Profile updated
            </Text>
          )}

          <TouchableOpacity
            testID="edit-profile-button"
            style={styles.editButton}
            onPress={startEditing}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            accessibilityHint="Double tap to change your name or email"
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </>
      )}

      {user && isEditing && (
        <View style={styles.form}>
          <FormField
            label="Name"
            testID="profile-name-input"
            value={name}
            onChangeText={handleChange('name', setName)}
            error={fieldErrors.name}
            maxLength={PROFILE_NAME_MAX_LENGTH}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
          <FormField
            label="Email"
            testID="profile-email-input"
            value={email}
            onChangeText={handleChange('email', setEmail)}
            error={fieldErrors.email}
            maxLength={PROFILE_EMAIL_MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          {formError && (
            <Text
              testID="profile-form-error"
              style={styles.formError}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {formError}
            </Text>
          )}

          <TouchableOpacity
            testID="save-profile-button"
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={isSaving ? 'Saving profile' : 'Save profile'}
            accessibilityState={{ disabled: isSaving }}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="cancel-edit-profile-button"
            style={styles.cancelButton}
            onPress={cancelEditing}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
            accessibilityState={{ disabled: isSaving }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {user && !isEditing && !isConfirmingDelete && (
        <TouchableOpacity
          testID="delete-account-button"
          style={styles.deleteButton}
          onPress={startDeleting}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          accessibilityHint="Double tap to permanently delete your account"
        >
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>
      )}

      {user && !isEditing && isConfirmingDelete && (
        <View style={styles.form}>
          <Text style={styles.deleteWarning}>
            Deleting your account removes all of your habits and their history. This cannot be
            undone. Enter your password to confirm.
          </Text>
          <FormField
            label="Password"
            testID="delete-account-password-input"
            value={deletePassword}
            onChangeText={handleDeletePasswordChange}
            secure
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
          />

          {deleteError && (
            <Text
              testID="delete-account-error"
              style={styles.formError}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {deleteError}
            </Text>
          )}

          <TouchableOpacity
            testID="confirm-delete-account-button"
            style={[styles.confirmDeleteButton, !canDelete && styles.buttonDisabled]}
            onPress={confirmDelete}
            disabled={!canDelete}
            accessibilityRole="button"
            accessibilityLabel={isDeleting ? 'Deleting account' : 'Permanently delete account'}
            accessibilityState={{ disabled: !canDelete }}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Permanently Delete</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="cancel-delete-account-button"
            style={styles.cancelButton}
            onPress={cancelDeleting}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Keep account"
            accessibilityState={{ disabled: isDeleting }}
          >
            <Text style={styles.cancelButtonText}>Keep Account</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        testID="logout-button"
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out"
        accessibilityHint="Double tap to sign out of your account"
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
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
    color: colors.text,
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  success: {
    ...typography.body,
    color: colors.success,
    marginBottom: spacing.md,
  },
  editButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xl,
  },
  editButtonText: {
    ...typography.button,
    color: colors.primary,
  },
  form: {
    alignSelf: 'stretch',
    marginBottom: spacing.xl,
  },
  formError: {
    color: colors.error,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.white,
  },
  cancelButton: {
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  deleteButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.error,
  },
  deleteWarning: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  confirmDeleteButton: {
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  logoutText: {
    ...typography.button,
    color: colors.white,
  },
});

export default ProfileScreen;
