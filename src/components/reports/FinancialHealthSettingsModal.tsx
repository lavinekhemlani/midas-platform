// src/components/reports/FinancialHealthSettingsModal.tsx
'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSession } from '@/hooks/useSession'
import FinancialHealthSettingsForm, {
  MetricTarget,
} from '@/components/settings/FinancialHealthSettingsForm'

interface FinancialHealthSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentMetrics: string[]
  currentTargets: MetricTarget[]
  onSave: (metrics: string[], targets: MetricTarget[], revenueModel: string) => Promise<void>
  isSaving?: boolean
}

export default function FinancialHealthSettingsModal({
  open,
  onOpenChange,
  currentMetrics,
  currentTargets,
  onSave,
  isSaving = false,
}: FinancialHealthSettingsModalProps) {
  const { organization } = useSession()

  const handleSave = async (metrics: string[], targets: MetricTarget[], revenueModel: string) => {
    await onSave(metrics, targets, revenueModel)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto settings-modal-content backdrop-blur-xl shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="theme-text-primary text-xl font-semibold">
            Financial Health Settings
          </DialogTitle>
          <DialogDescription className="theme-text-secondary">
            Configure your revenue model, select 4 metrics to track, and set target values.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <FinancialHealthSettingsForm
            initialMetrics={currentMetrics}
            initialTargets={currentTargets}
            initialRevenueModel={organization?.revenue_model || 'SaaS'}
            onSave={handleSave}
            onCancel={() => onOpenChange(false)}
            isSaving={isSaving}
            renderMode="modal"
            showRevenueModel={true}
            showActions={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
