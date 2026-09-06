// src/components/account/OrganizationSettingsForm.tsx
'use client'

import React, { useState, useEffect, FormEvent } from 'react'
import {
  Loader2,
  Building,
  Globe,
  Calendar,
  TrendingUp,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { Organization } from '@/lib/data'
import MetricTargetsPanel from '@/components/ui/MetricTargetsPanel'
import { getRecommendedMetrics } from '@/lib/data/financialMetrics'
import { useSession } from '@/hooks/useSession'
import { logger } from '@/lib/logger'

// Re-using options from onboarding, ensure they are comprehensive
const jurisdictionOptions = [
  { value: '', label: 'Select Jurisdiction' },
  { value: 'US-DE', label: 'United States - Delaware' },
  { value: 'US-CA', label: 'United States - California' },
  { value: 'US-NY', label: 'United States - New York' },
  { value: 'US-TX', label: 'United States - Texas' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AE-DU', label: 'UAE - Dubai (Mainland)' },
  { value: 'AE-AZA', label: 'UAE - Abu Dhabi Global Market (ADGM)' },
  { value: 'SG', label: 'Singapore' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'HK', label: 'Hong Kong' },
]

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

interface OrganizationSettingsFormProps {
  initialData: Organization
  orgId: string
  onUpdateSuccess: () => void
  onDirtyChange: (isDirty: boolean) => void
}

export default function OrganizationSettingsForm({
  initialData,
  orgId,
  onUpdateSuccess,
  onDirtyChange,
}: OrganizationSettingsFormProps) {
  const { refetchSession } = useSession()
  const [name, setName] = useState(initialData.name || '')
  const [legalName, setLegalName] = useState(initialData.legal_name || '')
  const [jurisdiction, setJurisdiction] = useState(initialData.jurisdiction || '')
  const [incorporationDate, setIncorporationDate] = useState(initialData.incorporation_date || '')
  const [revenueModel, setRevenueModel] = useState(initialData.revenue_model || '')
  const [financialHealthMetrics, setFinancialHealthMetrics] = useState<string[]>(
    (initialData as any).financial_health_metrics || []
  )
  const [financialHealthTargets, setFinancialHealthTargets] = useState<string[]>(
    (initialData as any).financial_health_targets || []
  )
  const [isDirty, setIsDirty] = useState(false)
  // Add other editable fields from Organization interface as needed (e.g., registration_no, vat_registered)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<
    Partial<
      Omit<
        Organization,
        | 'PK'
        | 'SK'
        | 'organization_id'
        | 'owner_user_id'
        | 'created_at'
        | 'updated_at'
        | 'zoho_credentials'
      >
    >
  >({})

  useEffect(() => {
    setName(initialData.name || '')
    setLegalName(initialData.legal_name || '')
    setJurisdiction(initialData.jurisdiction || '')
    setIncorporationDate(initialData.incorporation_date || '')
    setRevenueModel(initialData.revenue_model || '')
    setFinancialHealthMetrics((initialData as any).financial_health_metrics || [])
    setFinancialHealthTargets((initialData as any).financial_health_targets || [])
    // Reset dirty state when initialData changes (e.g., after parent refetches)
    setIsDirty(false)
  }, [initialData])

  // Effect to check if form is "dirty" AND report it to the parent
  useEffect(() => {
    const metricsChanged =
      JSON.stringify(financialHealthMetrics) !==
      JSON.stringify((initialData as any).financial_health_metrics || [])
    const targetsChanged =
      JSON.stringify(financialHealthTargets) !==
      JSON.stringify((initialData as any).financial_health_targets || [])
    const dirty =
      (name || '') !== (initialData.name || '') ||
      (legalName || '') !== (initialData.legal_name || '') ||
      (jurisdiction || '') !== (initialData.jurisdiction || '') ||
      (incorporationDate || '') !== (initialData.incorporation_date || '') ||
      (revenueModel || '') !== (initialData.revenue_model || '') ||
      metricsChanged ||
      targetsChanged
    setIsDirty(dirty)
    onDirtyChange(dirty) // <-- NEW: Report status to parent
  }, [
    name,
    legalName,
    jurisdiction,
    incorporationDate,
    revenueModel,
    financialHealthMetrics,
    financialHealthTargets,
    initialData,
    onDirtyChange,
  ])

  // Auto-populate financial health metrics when revenue model changes
  // Temporarily disabled - commenting out auto-population
  /*
  useEffect(() => {
    if (revenueModel) {
      const recommendedMetrics = getRecommendedMetrics(revenueModel);
      const metricIds = recommendedMetrics.slice(0, 4).map(m => m.id);
      setFinancialHealthMetrics(metricIds);
    }
  }, [revenueModel]);
  */

  const validate = async (): Promise<boolean> => {
    const newErrors: typeof formErrors = {}

    // Basic validation
    if (!name.trim() || name.length < 2 || name.length > 140) {
      newErrors.name = 'Organization name must be between 2 and 140 characters.'
    }
    if (!jurisdiction) {
      newErrors.jurisdiction = 'Please select a jurisdiction.'
    }
    if (incorporationDate) {
      const today = new Date().toISOString().split('T')[0]
      if (incorporationDate > today) {
        newErrors.incorporation_date = 'Incorporation date cannot be in the future.'
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(incorporationDate)) {
        newErrors.incorporation_date = 'Date must be in YYYY-MM-DD format.'
      }
    }

    // Anti-duplicate check for organization name (only if name changed)
    if (name.trim() !== initialData.name?.trim() && name.trim()) {
      try {
        const response = await fetch(
          `/api/validate/organization?name=${encodeURIComponent(name.trim())}&orgId=${orgId}`
        )
        const data = await response.json()
        if (!response.ok) {
          if (data.error === 'duplicate_name') {
            newErrors.name = 'This organization name is already in use.'
          } else {
            throw new Error(data.error || 'Failed to validate organization name')
          }
        }
      } catch (err) {
        logger.error('Error validating organization name:', {
          error: err,
          component: 'OrganizationSettingsForm',
        })
        // Don't block submission for validation API errors, just log them
      }
    }

    setFormErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    if (!(await validate())) {
      return
    }

    setIsLoading(true)
    const organizationData = {
      name: name.trim(),
      legal_name: legalName.trim() || undefined,
      jurisdiction,
      incorporation_date: incorporationDate || undefined,
      revenue_model: revenueModel || undefined,
      financial_health_metrics:
        financialHealthMetrics.filter(Boolean).length === 4 ? financialHealthMetrics : undefined,
      financial_health_targets:
        financialHealthTargets.filter(Boolean).length > 0 ? financialHealthTargets : undefined,
      // Add other fields being updated
    }

    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationData }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to update organization details.')
      }
      const responseData = await response.json()
      const updatedOrg = responseData.organization

      // Update form state with the saved data to reset dirty state
      if (updatedOrg) {
        setName(updatedOrg.name || '')
        setLegalName(updatedOrg.legal_name || '')
        setJurisdiction(updatedOrg.jurisdiction || '')
        setIncorporationDate(updatedOrg.incorporation_date || '')
        setRevenueModel(updatedOrg.revenue_model || '')
        setFinancialHealthMetrics(updatedOrg.financial_health_metrics || [])
        setFinancialHealthTargets(updatedOrg.financial_health_targets || [])
      }

      setSuccessMessage('Organization details updated successfully!')

      // Refresh session context to get updated organization data
      await refetchSession()

      onUpdateSuccess() // Notify parent to re-fetch or update state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.')
    } finally {
      setIsLoading(false)
      setTimeout(() => setSuccessMessage(null), 4000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30 flex items-center gap-2">
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-md text-sm border border-emerald-500/30">
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        <div className="zenith-form-group">
          <label htmlFor="orgName" className="zenith-label">
            Organization Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
            <input
              id="orgName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`zenith-input pl-10 ${formErrors.name ? 'border-red-500' : ''}`}
              placeholder="e.g., Acme Innovations Inc."
              disabled={isLoading}
            />
          </div>
          {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
        </div>

        <div className="zenith-form-group">
          <label htmlFor="legalName" className="zenith-label">
            Legal Name (if different)
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
            <input
              id="legalName"
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="zenith-input pl-10"
              placeholder="e.g., Acme Innovations LLC"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="zenith-form-group">
            <label htmlFor="jurisdiction" className="zenith-label">
              Jurisdiction <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
              <select
                id="jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className={`zenith-select pl-10 ${formErrors.jurisdiction ? 'border-red-500' : ''}`}
                disabled={isLoading}
              >
                {jurisdictionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {formErrors.jurisdiction && (
              <p className="text-xs text-red-400 mt-1">{formErrors.jurisdiction}</p>
            )}
          </div>

          <div className="zenith-form-group">
            <label htmlFor="incorporationDate" className="zenith-label">
              Incorporation Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
              <input
                id="incorporationDate"
                type="date"
                value={incorporationDate}
                onChange={(e) => setIncorporationDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className={`zenith-input pl-10 appearance-none
                    [&::-webkit-calendar-picker-indicator]:opacity-0
                    [&::-webkit-calendar-picker-indicator]:absolute
                    [&::-webkit-calendar-picker-indicator]:right-0
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer
                    -moz-appearance-none ${formErrors.incorporation_date ? 'border-red-500' : ''}`}
                disabled={isLoading}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            {formErrors.incorporation_date && (
              <p className="text-xs text-red-400 mt-1">{formErrors.incorporation_date}</p>
            )}
          </div>
        </div>

        <div className="zenith-form-group">
          <label htmlFor="revenueModel" className="zenith-label">
            Primary Revenue Model
          </label>
          <div className="relative">
            <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
            <select
              id="revenueModel"
              value={revenueModel}
              onChange={(e) => setRevenueModel(e.target.value)}
              className="zenith-select pl-10"
              disabled={isLoading}
            >
              {revenueModelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Financial Health Metrics and Targets - Show only when revenue model is selected */}
        {/* Temporarily disabled - commenting out financial metrics selection
          {revenueModel && (
            <div className="zenith-form-group">
              <h3 className="text-lg font-medium text-white mb-4">Health Metrics and Targets</h3>
              <MetricTargetsPanel
                selectedMetrics={financialHealthMetrics}
                revenueModel={revenueModel}
                values={financialHealthTargets}
                onChange={setFinancialHealthTargets}
                onMetricsChange={setFinancialHealthMetrics}
                disabled={isLoading}
              />
            </div>
          )}
          */}
      </div>

      <div className="pt-6 flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !isDirty}
          className={`glass-next-button ${isDirty ? 'glass-next-button-primary' : 'opacity-50 cursor-not-allowed'} px-8 py-3 rounded-lg flex items-center justify-center font-semibold`}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  )
}
