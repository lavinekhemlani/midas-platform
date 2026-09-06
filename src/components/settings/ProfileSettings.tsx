// src/components/settings/ProfileSettings.tsx
'use client'

import React, { useState } from 'react'
import { KeyRound, ChevronDown, ChevronUp } from 'lucide-react'
import ProfileForm from './ProfileForm'
import CognitoSecuritySettings from '@/components/account/CognitoSecuritySettings'
import { useSession } from '@/hooks/useSession'

interface ProfileSettingsProps {
  initialData: {
    firstName?: string
    lastName?: string
    role_title?: string
  }
  onUpdateSuccess?: () => void
}

export default function ProfileSettings({ initialData, onUpdateSuccess }: ProfileSettingsProps) {
  const { user } = useSession()
  const isOAuthUser = !!user?.oauth_provider
  const [isSecurityExpanded, setIsSecurityExpanded] = useState(false)

  return (
    <div className="space-y-8">
      {/* Profile Information Section */}
      <div>
        <h3 className="text-lg font-semibold theme-text-primary mb-1">Profile Information</h3>
        <p className="text-sm theme-text-secondary mb-4">Update your personal details</p>
        <ProfileForm initialData={initialData} onUpdateSuccess={onUpdateSuccess} />
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700/30"></div>

      {/* Password Change Section - Collapsible */}
      <div>
        <button
          onClick={() => setIsSecurityExpanded(!isSecurityExpanded)}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold theme-text-primary">Security</h3>
          </div>
          {isSecurityExpanded ? (
            <ChevronUp className="w-5 h-5 theme-text-secondary group-hover:text-amber-500 transition-colors" />
          ) : (
            <ChevronDown className="w-5 h-5 theme-text-secondary group-hover:text-amber-500 transition-colors" />
          )}
        </button>
        <p className="text-sm theme-text-secondary mb-4">
          Change your password and manage security settings
        </p>

        {isSecurityExpanded && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <CognitoSecuritySettings
              minPasswordLength={8}
              isOAuthUser={isOAuthUser}
              oauthProvider={user?.oauth_provider}
            />
          </div>
        )}
      </div>
    </div>
  )
}
