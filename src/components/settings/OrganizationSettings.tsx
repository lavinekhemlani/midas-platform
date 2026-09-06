// src/components/settings/OrganizationSettings.tsx
'use client'

import React from 'react'
import { FileText, Building2 } from 'lucide-react'
import OrganizationForm from './OrganizationForm'
import OrganizationSwitcher from './OrganizationSwitcher'
import CorporateProfileUpload from '@/components/account/CorporateProfileUpload'
import { Organization } from '@/lib/data'

interface OrganizationSettingsProps {
  organization: Organization | null
  onUpdateSuccess?: (message: string) => void
}

export default function OrganizationSettings({
  organization,
  onUpdateSuccess,
}: OrganizationSettingsProps) {
  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="theme-text-secondary">No organization is linked to your account.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Active Organization Section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Active Organization</h3>
        </div>
        <p className="text-sm theme-text-secondary mb-4">
          Switch between organizations you have access to. Memories and data are scoped to your
          active organization.
        </p>
        <OrganizationSwitcher
          onSwitchSuccess={(org) => onUpdateSuccess?.(`Switched to ${org.name}`)}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700/30"></div>

      {/* Organization Details Section */}
      <div>
        <h3 className="text-lg font-semibold theme-text-primary mb-1">Organization Details</h3>
        <p className="text-sm theme-text-secondary mb-4">Manage your organization information</p>
        <OrganizationForm
          initialData={organization}
          orgId={organization.organization_id}
          onUpdateSuccess={onUpdateSuccess || (() => {})}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700/30"></div>

      {/* Corporate Profile Section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Corporate Profile</h3>
        </div>
        <p className="text-sm theme-text-secondary mb-4">
          Upload and manage your corporate profile documents
        </p>
        <CorporateProfileUpload
          organization={organization}
          orgId={organization.organization_id.replace('ORG#', '')}
          onUpdateSuccess={onUpdateSuccess || (() => {})}
        />
      </div>
    </div>
  )
}
