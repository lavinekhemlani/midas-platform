// src/components/settings/SecuritySettingsCard.tsx
'use client';

import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronRight, KeyRound } from 'lucide-react';
import SettingsCard from './SettingsCard';
import CognitoSecuritySettings from '@/components/account/CognitoSecuritySettings';
import { useSession } from '@/hooks/useSession';

export default function SecuritySettingsCard() {
  const { user } = useSession();
  const isOAuthUser = !!user?.oauth_provider;
  const [isPasswordChangeExpanded, setIsPasswordChangeExpanded] = useState(false);

  return (
    <SettingsCard
      title="Security"
      icon={ShieldCheck}
      iconColor="text-emerald-500"
    >
      <div className="space-y-4">
        {/* Collapsible Password Change Section */}
        <div className="border border-gray-200/10 rounded-lg">
          <button
            onClick={() => setIsPasswordChangeExpanded(!isPasswordChangeExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium theme-text-primary">Change Password</span>
            </div>
            {isPasswordChangeExpanded ? (
              <ChevronDown className="w-4 h-4 theme-text-secondary" />
            ) : (
              <ChevronRight className="w-4 h-4 theme-text-secondary" />
            )}
          </button>
          {isPasswordChangeExpanded && (
            <div className="px-3 pb-3 pt-1">
              <CognitoSecuritySettings
                minPasswordLength={8}
                isOAuthUser={isOAuthUser}
                oauthProvider={user?.oauth_provider}
              />
            </div>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}
