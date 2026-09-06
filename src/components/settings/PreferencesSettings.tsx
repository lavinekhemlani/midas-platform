// src/components/settings/PreferencesSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  GraduationCap,
  Loader2,
  CheckCircle,
  AlertTriangle,
  EyeOff,
} from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { apiClient } from '@/lib/apiClient'
import FinancialHealthSettingsForm, {
  MetricTarget,
} from '@/components/settings/FinancialHealthSettingsForm'

// Default metrics (must match SummaryView defaults)
const DEFAULT_METRICS = ['gross_margin', 'cash_runway', 'cash_flow', 'working_capital']

export default function PreferencesSettings() {
  const { user, organization, refetchSession } = useSession()
  const [mounted, setMounted] = useState(false)
  const [proficiencyLevel, setProficiencyLevel] = useState<'beginner' | 'intermediate' | 'expert'>(
    'beginner'
  )
  const [piiMode, setPiiMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingPii, setIsSavingPii] = useState(false)
  const [isSavingHealth, setIsSavingHealth] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sync local state when user data loads (user is null during session loading)
  useEffect(() => {
    setMounted(true)
    if (user?.preferences?.proficiency_level) {
      setProficiencyLevel(user.preferences.proficiency_level)
    }
    if (user?.preferences?.pii_mode !== undefined) {
      setPiiMode(user.preferences.pii_mode)
    }
  }, [user?.preferences?.proficiency_level, user?.preferences?.pii_mode])

  const handleSaveProficiency = async () => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await apiClient('/api/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          preferences: {
            ...user?.preferences,
            proficiency_level: proficiencyLevel,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update proficiency level')
      }

      await refetchSession()
      setSuccessMessage('Financial proficiency updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update proficiency')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTogglePiiMode = async () => {
    setIsSavingPii(true)
    setError(null)
    setSuccessMessage(null)

    const newPiiMode = !piiMode

    try {
      const response = await apiClient('/api/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          preferences: {
            ...user?.preferences,
            pii_mode: newPiiMode,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update PII mode')
      }

      setPiiMode(newPiiMode)
      await refetchSession()
      setSuccessMessage(`PII protection ${newPiiMode ? 'enabled' : 'disabled'} successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update PII mode')
    } finally {
      setIsSavingPii(false)
    }
  }

  const handleSaveHealthSettings = async (
    metrics: string[],
    targets: MetricTarget[],
    revenueModel: string
  ) => {
    if (!organization) return

    setIsSavingHealth(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await apiClient(`/api/organizations/${organization.organization_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          organizationData: {
            revenue_model: revenueModel,
            financial_health_metrics: metrics,
            financial_health_targets: targets,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update financial health settings')
      }

      await refetchSession()
      setSuccessMessage('Financial health settings updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      throw err // Re-throw so form can handle it
    } finally {
      setIsSavingHealth(false)
    }
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-md text-sm border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" /> {successMessage}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Financial Proficiency Section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Financial Proficiency</h3>
        </div>
        <p className="text-sm theme-text-secondary mb-4">
          Help us tailor insights and recommendations to your financial expertise level
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {['beginner', 'intermediate', 'expert'].map((level) => (
              <button
                key={level}
                onClick={() => setProficiencyLevel(level as any)}
                disabled={isLoading}
                className={`relative flex flex-col items-center p-4 rounded-lg transition-all cursor-pointer ${
                  proficiencyLevel === level
                    ? 'border-2 border-amber-500 bg-amber-500/10'
                    : `metric-card-bg ${isLoading ? '' : 'hover:brightness-110'}`
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div
                  className={`text-sm font-medium capitalize ${proficiencyLevel === level ? 'text-amber-500' : 'theme-text-primary'}`}
                >
                  {level}
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveProficiency}
              disabled={isLoading || proficiencyLevel === user?.preferences?.proficiency_level}
              className={`py-2 px-5 rounded-lg text-sm flex items-center min-w-[110px] justify-center ${
                proficiencyLevel !== user?.preferences?.proficiency_level && !isLoading
                  ? 'btn-get-started'
                  : 'btn-get-started opacity-50 cursor-not-allowed'
              }`}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--theme-card-border)]"></div>

      {/* PII Protection Section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <EyeOff className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold theme-text-primary">PII Protection</h3>
        </div>
        <p className="text-sm theme-text-secondary mb-4">
          Enable to blur sensitive information like company names for privacy during screen sharing
          or demos
        </p>

        <div className="flex items-center justify-between p-4 rounded-lg metric-card-bg">
          <div className="flex-1">
            <div className="text-sm font-medium theme-text-primary">Hide Company Names</div>
            <div className="text-xs theme-text-secondary mt-0.5">
              Blurs organization and company names throughout the app
            </div>
          </div>
          <button
            onClick={handleTogglePiiMode}
            disabled={isSavingPii}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              piiMode ? 'bg-purple-500' : 'bg-slate-600'
            } ${isSavingPii ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isSavingPii ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              </div>
            ) : (
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  piiMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            )}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--theme-card-border)]"></div>

      {/* Financial Health Settings Section - Combined Revenue Model + Metrics */}
      {organization && (
        <>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-semibold theme-text-primary">
                Financial Health Configuration
              </h3>
            </div>
            <p className="text-sm theme-text-secondary mb-4">
              Configure your revenue model and the 4 metrics used to calculate your financial health
              score
            </p>

            <FinancialHealthSettingsForm
              initialMetrics={
                organization.financial_health_metrics &&
                organization.financial_health_metrics.length === 4
                  ? organization.financial_health_metrics
                  : DEFAULT_METRICS
              }
              initialTargets={organization.financial_health_targets || []}
              initialRevenueModel={organization.revenue_model || 'SaaS'}
              onSave={handleSaveHealthSettings}
              isSaving={isSavingHealth}
              renderMode="inline"
              showRevenueModel={true}
              showActions={true}
            />
          </div>
        </>
      )}
    </div>
  )
}
