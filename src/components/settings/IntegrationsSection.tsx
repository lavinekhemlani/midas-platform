// src/components/settings/IntegrationsSection.tsx
'use client'

import React from 'react'
import { Zap } from 'lucide-react'
import IntegrationsSettings from '@/components/settings/IntegrationsSettings'

export default function IntegrationsSection() {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Connected Services</h3>
        </div>
        <p className="text-sm theme-text-secondary">Manage your accounting software integrations</p>
      </div>

      {/* Integration Manager */}
      <div className="rounded-lg p-6 metric-card-bg">
        <IntegrationsSettings />
      </div>
    </div>
  )
}
