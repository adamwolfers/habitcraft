'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { changePassword } from '@/lib/api';
import Header from './Header';
import ProfileModal from './ProfileModal';

interface HeaderWithProfileProps {
  variant?: 'app' | 'landing';
}

export default function HeaderWithProfile({ variant }: HeaderWithProfileProps) {
  const { user, updateUser } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleOpenProfileModal = () => {
    setIsProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const handleUpdateProfile = async (updates: { name?: string; email?: string }) => {
    await updateUser(updates);
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => {
    await changePassword(currentPassword, newPassword, confirmPassword);
  };

  return (
    <>
      <Header variant={variant} onOpenProfileModal={handleOpenProfileModal} />
      {user && (
        <ProfileModal
          user={user}
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfileModal}
          onUpdate={handleUpdateProfile}
          onChangePassword={handleChangePassword}
        />
      )}
    </>
  );
}
