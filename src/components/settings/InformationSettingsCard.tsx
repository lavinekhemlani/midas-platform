// src/components/settings/InformationSettingsCard.tsx
'use client';

import React from 'react';
import { User, Building2, KeyRound } from 'lucide-react';
import SettingsCard from './SettingsCard';
import ProfileForm from './ProfileForm';
import OrganizationForm from './OrganizationForm';
import CorporateProfileUpload from '@/components/account/CorporateProfileUpload';
import CognitoSecuritySettings from '@/components/account/CognitoSecuritySettings';
import { Organization } from '@/lib/data';
import { useSession } from '@/hooks/useSession';

interface InformationSettingsCardProps {
  profileData: {
    firstName?: string;
    lastName?: string;
    role_title?: string;
  };
  organization: Organization | null;
  onUpdateSuccess?: (message?: string) => void;
}

export default function InformationSettingsCard({
  profileData,
  organization,
  onUpdateSuccess,
}: InformationSettingsCardProps) {
  const { user } = useSession();
  const isOAuthUser = !!user?.oauth_provider;
  return (
    <SettingsCard
      title="Information"
      icon={User}
      iconColor="text-blue-500"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-start lg:divide-x lg:divide-gray-200/20">
        {/* Left Column: Profile Section */}
        <div className="space-y-4 lg:pr-6">
          {/* Profile Header */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            <h4 className="text-sm font-semibold theme-text-primary">Profile</h4>
          </div>

          {/* Profile Form */}
          <ProfileForm
            initialData={profileData}
            onUpdateSuccess={() => onUpdateSuccess?.()}
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

        {/* Right Column: Organization Section */}
        <div className="space-y-4 lg:pl-6 mt-4 lg:mt-0">
          {/* Organization Header */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-500" />
            <h4 className="text-sm font-semibold theme-text-primary">Organization</h4>
          </div>

          {organization ? (
            <>
              {/* Organization Form */}
              <OrganizationForm
                initialData={organization}
                orgId={organization.organization_id}
                onUpdateSuccess={(message) => onUpdateSuccess?.(message)}
              />

              {/* Divider */}
              <div className="border-t border-gray-200/10 my-4"></div>

              {/* Corporate Profile Upload */}
              <CorporateProfileUpload
                organization={organization}
                orgId={organization.organization_id.replace('ORG#', '')}
                onUpdateSuccess={(message) => onUpdateSuccess?.(message)}
              />
            </>
          ) : (
            <div className="text-center py-8">
              <p className="theme-text-secondary text-sm">No organization is linked to your account.</p>
            </div>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}
