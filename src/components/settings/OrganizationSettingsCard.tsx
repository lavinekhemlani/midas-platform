// src/components/settings/OrganizationSettingsCard.tsx
'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import SettingsCard from './SettingsCard';
import OrganizationForm from './OrganizationForm';
import CorporateProfileUpload from '@/components/account/CorporateProfileUpload';
import { Organization } from '@/lib/data';

interface OrganizationSettingsCardProps {
  organization: Organization | null;
  onUpdateSuccess?: (message: string) => void;
}

export default function OrganizationSettingsCard({
  organization,
  onUpdateSuccess,
}: OrganizationSettingsCardProps) {
  if (!organization) {
    return (
      <SettingsCard
        title="Organization"
        description="No organization found"
        icon={Building2}
        iconColor="text-purple-500"
      >
        <div className="text-center py-8">
          <p className="theme-text-secondary">No organization is linked to your account.</p>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Organization"
      icon={Building2}
      iconColor="text-purple-500"
    >
      <div className="space-y-4">
        {/* Organization Details Form */}
        <OrganizationForm
          initialData={organization}
          orgId={organization.organization_id}
          onUpdateSuccess={onUpdateSuccess || (() => {})}
        />

        {/* Divider */}
        <div className="border-t border-gray-200/10 my-4"></div>

        {/* Corporate Profile Upload */}
        <CorporateProfileUpload
          organization={organization}
          orgId={organization.organization_id.replace('ORG#', '')}
          onUpdateSuccess={onUpdateSuccess || (() => {})}
        />
      </div>
    </SettingsCard>
  );
}
