// src/components/settings/ProfileSettingsCard.tsx
'use client';

import React from 'react';
import { User, KeyRound } from 'lucide-react';
import SettingsCard from './SettingsCard';
import ProfileForm from './ProfileForm';
import CognitoSecuritySettings from '@/components/account/CognitoSecuritySettings';
import { useSession } from '@/hooks/useSession';

interface ProfileSettingsCardProps {
  initialData: {
    firstName?: string;
    lastName?: string;
    role_title?: string;
  };
  onUpdateSuccess?: () => void;
}

export default function ProfileSettingsCard({
  initialData,
  onUpdateSuccess,
}: ProfileSettingsCardProps) {
  const { user } = useSession();
  const isOAuthUser = !!user?.oauth_provider;
  return (
    <SettingsCard
      title="Profile"
      icon={User}
      iconColor="text-blue-500"
    >
      <div className="space-y-4">
        {/* Profile Form */}
        <ProfileForm
          initialData={initialData}
          onUpdateSuccess={onUpdateSuccess}
        />

        {/* Divider */}
        <div className="border-t border-gray-200/10 my-4"></div>

        {/* Password Change Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-semibold theme-text-primary">Change Password</h4>
          </div>
          <CognitoSecuritySettings
            minPasswordLength={8}
            isOAuthUser={isOAuthUser}
            oauthProvider={user?.oauth_provider}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
