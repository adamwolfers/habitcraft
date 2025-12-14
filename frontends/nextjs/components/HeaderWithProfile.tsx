'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Header from './Header';
import ProfileModal from './ProfileModal';

export default function HeaderWithProfile() {
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

  return (
    <>
      <Header onOpenProfileModal={handleOpenProfileModal} />
      {user && (
        <ProfileModal
          user={user}
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfileModal}
          onUpdate={handleUpdateProfile}
        />
      )}
    </>
  );
}
