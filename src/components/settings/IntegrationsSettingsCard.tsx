// src/components/settings/IntegrationsSettingsCard.tsx
'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import SettingsCard from './SettingsCard';
import IntegrationsSettings from '@/components/settings/IntegrationsSettings';

export default function IntegrationsSettingsCard() {
  return (
    <SettingsCard
      title="Integrations"
      icon={Zap}
      iconColor="text-amber-500"
    >
      <IntegrationsSettings />
    </SettingsCard>
  );
}
