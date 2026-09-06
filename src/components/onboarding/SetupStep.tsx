// src/components/onboarding/SetupStep.tsx
'use client'

import React, { useState, useEffect, useCallback, FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { User } from '@/lib/data'
import FinancialHealthSettingsForm, {
  MetricTarget,
} from '@/components/settings/FinancialHealthSettingsForm'
import {
  getRecommendedMetrics,
  FINANCIAL_METRICS,
  getDefaultTarget,
} from '@/lib/data/financialMetrics'

type OnboardingAudit = User['onboarding_audit']

interface SetupData {
  revenue_model: string
  financial_health_metrics?: string[]
  financial_health_targets?: MetricTarget[]
}

interface SetupStepProps {
  onNext: (data: SetupData) => Promise<void>
  isLoading: boolean
  initialData?: OnboardingAudit | null
  initialFirstName?: string | null
  apiError?: string | null
}

const revenueModelOptions = [
  { value: '', label: 'Select Revenue Model' },
  { value: 'SaaS', label: 'SaaS (Software as a Service)' },
  { value: 'Retail', label: 'Retail / E-commerce' },
  { value: 'Services', label: 'Professional Services / Consulting' },
  { value: 'Marketplace', label: 'Marketplace / Platform' },
  { value: 'Subscription', label: 'Subscription (Non-SaaS)' },
  { value: 'Hardware', label: 'Hardware / Physical Products' },
  { value: 'Freemium', label: 'Freemium Model' },
  { value: 'Advertising', label: 'Advertising Revenue' },
  { value: 'Commission', label: 'Commission Based' },
  { value: 'Licensing', label: 'Licensing / IP' },
  { value: 'Other', label: 'Other' },
]

export default function SetupStep({
  onNext,
  isLoading,
  initialData,
  initialFirstName,
  apiError,
}: SetupStepProps) {
  const [revenueModel, setRevenueModel] = useState('')
  const [financialHealthMetrics, setFinancialHealthMetrics] = useState<string[]>([])
  const [financialHealthTargets, setFinancialHealthTargets] = useState<MetricTarget[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const savedData = initialData?.step_data?.setup
    if (savedData?.revenue_model) {
      setRevenueModel(savedData.revenue_model)
      setFinancialHealthMetrics(savedData.financial_health_metrics || [])
      setFinancialHealthTargets(savedData.financial_health_targets || [])
    }
  }, [initialData])

  // Auto-populate financial health metrics and targets when revenue model changes
  useEffect(() => {
    if (revenueModel) {
      const recommendedMetrics = getRecommendedMetrics(revenueModel)
      const metricIds = recommendedMetrics.slice(0, 4).map((m) => m.id)

      // Also generate default targets for each metric
      const defaultTargets: MetricTarget[] = metricIds.map((metricId) => {
        const metric = FINANCIAL_METRICS.find((m) => m.id === metricId)
        const defaultTarget = getDefaultTarget(metricId, revenueModel)
        return {
          metric_id: metricId,
          target: defaultTarget,
          unit: metric?.unit || 'currency',
        }
      })

      React.startTransition(() => {
        setFinancialHealthMetrics(metricIds)
        setFinancialHealthTargets(defaultTargets)
      })
    }
  }, [revenueModel])

  const handleMetricsChange = useCallback((metrics: string[], targets: MetricTarget[]) => {
    setFinancialHealthMetrics(metrics)
    setFinancialHealthTargets(targets)
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!revenueModel) {
      setError('Please select a revenue model.')
      return
    }

    if (revenueModel && financialHealthMetrics.filter(Boolean).length !== 4) {
      setError('Please select all 4 financial health metrics.')
      return
    }

    setError(null)
    await onNext({
      revenue_model: revenueModel,
      financial_health_metrics:
        financialHealthMetrics.filter(Boolean).length === 4 ? financialHealthMetrics : undefined,
      financial_health_targets:
        financialHealthTargets.filter(Boolean).length > 0 ? financialHealthTargets : undefined,
    })
  }

  const firstName = initialFirstName?.trim()

  return (
    <div className="min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-100px)] flex flex-col justify-center w-full max-w-2xl mx-auto py-6 px-2">
      {/* Friendly Greeting */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-light theme-text-primary mb-2">
          Hi{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-lg theme-text-secondary font-light mb-1">Welcome to Midas</p>
        <p className="text-sm theme-text-primary">Let&apos;s personalize your experience</p>
      </div>

      {apiError && (
        <div className="mb-6 p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Revenue Model */}
        <div>
          <label htmlFor="revenueModel" className="block text-sm theme-text-secondary mb-2">
            What&apos;s your primary revenue model?
          </label>
          <select
            id="revenueModel"
            value={revenueModel}
            onChange={(e) => {
              setRevenueModel(e.target.value)
              setError(null)
            }}
            className={`zenith-select w-full ${error && !revenueModel ? 'border-red-500' : ''}`}
            disabled={isLoading}
          >
            {revenueModelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Financial Health Metrics - Show only when revenue model is selected */}
        {revenueModel && (
          <div>
            <p className="text-sm theme-text-secondary mb-4">
              Choose 4 metrics to track your financial health
            </p>

            <FinancialHealthSettingsForm
              initialMetrics={financialHealthMetrics}
              initialTargets={financialHealthTargets}
              initialRevenueModel={revenueModel}
              onSave={async () => {}}
              onMetricsChange={handleMetricsChange}
              isSaving={isLoading}
              renderMode="onboarding"
              showRevenueModel={false}
              showActions={false}
              allowSkip={false}
              controlledMode={true}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="glass-next-button glass-next-button-primary w-full text-base py-3 rounded-lg flex items-center justify-center group font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving
              </>
            ) : (
              <>
                Continue
                <span className="ml-2 transform transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
