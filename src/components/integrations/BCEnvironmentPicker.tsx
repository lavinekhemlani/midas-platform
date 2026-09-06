'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  Building2,
  Server,
  Check,
  ChevronRight,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'

interface BCEnvironment {
  name: string
  type: 'Production' | 'Sandbox'
  friendlyName: string
}

interface BCCompany {
  id: string
  name: string
  displayName: string
}

interface BCEnvironmentPickerProps {
  onComplete: (connectionId: string, companyName: string, environmentName: string) => void
  onCancel: () => void
  onAdminConsentNeeded?: () => void
}

export default function BCEnvironmentPicker({
  onComplete,
  onCancel,
  onAdminConsentNeeded,
}: BCEnvironmentPickerProps) {
  const [step, setStep] = useState<'environments' | 'companies' | 'confirming'>('environments')
  const [environments, setEnvironments] = useState<BCEnvironment[]>([])
  const [companies, setCompanies] = useState<BCCompany[]>([])
  const [selectedEnvironment, setSelectedEnvironment] = useState<BCEnvironment | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<BCCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch environments on mount
  useEffect(() => {
    fetchEnvironments()
  }, [])

  async function fetchEnvironments() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/providers/dynamics/environments')
      if (!response.ok) {
        const data = await response.json()
        // Check for admin consent required errors
        if (
          response.status === 403 ||
          data.error?.includes('consent') ||
          data.error?.includes('AADSTS65001') ||
          data.details?.includes('consent')
        ) {
          setError('Admin approval is required to access Business Central environments.')
          return
        }
        throw new Error(data.error || 'Failed to fetch environments')
      }
      const data = await response.json()
      setEnvironments(data.environments || [])

      // Auto-select if only one environment
      if (data.environments?.length === 1) {
        handleSelectEnvironment(data.environments[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load environments')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectEnvironment(env: BCEnvironment) {
    setSelectedEnvironment(env)
    setStep('companies')
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/providers/dynamics/companies?environment=${encodeURIComponent(env.name)}`
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch companies')
      }
      const data = await response.json()
      setCompanies(data.companies || [])

      // Auto-select if only one company
      if (data.companies?.length === 1) {
        setSelectedCompany(data.companies[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!selectedEnvironment || !selectedCompany) return

    setStep('confirming')
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/providers/dynamics/select-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environmentName: selectedEnvironment.name,
          companyId: selectedCompany.id,
          companyName: selectedCompany.displayName || selectedCompany.name,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to finalize connection')
      }

      const data = await response.json()
      onComplete(
        data.connectionId,
        selectedCompany.displayName || selectedCompany.name,
        selectedEnvironment.name
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize connection')
      setStep('companies')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {[
          { num: 1, label: 'Environment', active: step === 'environments' },
          { num: 2, label: 'Company', active: step === 'companies' || step === 'confirming' },
          { num: 3, label: 'Confirm', active: step === 'confirming' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                s.active ? 'bc-step-active' : 'bc-step-inactive'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  s.active ? 'bg-amber-500 text-white' : 'bc-step-number'
                }`}
              >
                {s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < 2 && <ChevronRight className="w-4 h-4 bc-step-chevron hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bc-error-box rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 bc-error-icon flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="bc-error-text text-sm">{error}</p>
            {error.includes('Admin approval') && onAdminConsentNeeded && (
              <button
                onClick={onAdminConsentNeeded}
                className="mt-2 text-sm bc-setup-link hover:underline font-medium"
              >
                Request Admin Approval
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-12 h-12 rounded-full bc-loading-bg flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
          <span className="text-sm theme-text-secondary">
            {step === 'environments'
              ? 'Discovering environments...'
              : step === 'companies'
                ? 'Loading companies...'
                : 'Finalizing connection...'}
          </span>
        </div>
      )}

      {/* Environment selection */}
      {!loading && step === 'environments' && environments.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium theme-text-primary">Select Environment</h3>
            <p className="text-sm theme-text-secondary mt-1">
              Choose which Business Central environment to connect.
            </p>
          </div>
          <div className="grid gap-3">
            {environments.map((env) => (
              <button
                key={env.name}
                onClick={() => handleSelectEnvironment(env)}
                className="bc-list-item flex items-center gap-4 p-4 rounded-xl transition-all text-left group"
              >
                <div className="w-11 h-11 bc-env-icon-bg rounded-xl flex items-center justify-center">
                  <Server className="w-5 h-5 bc-env-icon" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium theme-text-primary truncate">
                    {env.friendlyName || env.name}
                  </p>
                  <p className="text-sm theme-text-secondary">
                    {env.type === 'Production' ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Production
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Sandbox
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 bc-list-chevron transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No environments found */}
      {!loading && step === 'environments' && environments.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bc-empty-icon-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Server className="w-8 h-8 bc-empty-icon" />
          </div>
          <p className="font-medium theme-text-primary mb-1">No environments found</p>
          <p className="text-sm theme-text-secondary max-w-xs mx-auto">
            Make sure your account has access to at least one Business Central environment.
          </p>
        </div>
      )}

      {/* Company selection */}
      {!loading && step === 'companies' && companies.length > 0 && (
        <div className="space-y-4">
          {/* Back button and breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setStep('environments')
                setSelectedEnvironment(null)
                setSelectedCompany(null)
              }}
              className="flex items-center gap-1.5 text-sm theme-text-secondary bc-back-btn transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <span className="bc-breadcrumb-separator">|</span>
            <span className="text-sm theme-text-secondary truncate">
              {selectedEnvironment?.friendlyName}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-medium theme-text-primary">Select Company</h3>
            <p className="text-sm theme-text-secondary mt-1">
              Choose which company to connect from {selectedEnvironment?.friendlyName}.
            </p>
          </div>

          <div className="grid gap-3">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className={`bc-list-item flex items-center gap-4 p-4 rounded-xl transition-all text-left group ${
                  selectedCompany?.id === company.id ? 'bc-list-item-selected' : ''
                }`}
              >
                <div className="w-11 h-11 bc-company-icon-bg rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 bc-company-icon" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium theme-text-primary truncate">
                    {company.displayName || company.name}
                  </p>
                </div>
                {selectedCompany?.id === company.id && (
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {selectedCompany && (
            <div className="flex justify-end gap-3 pt-4 bc-action-border">
              <button
                onClick={onCancel}
                className="px-4 py-2.5 text-sm font-medium theme-text-secondary bc-cancel-btn transition-colors rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors font-medium text-sm flex items-center gap-2"
              >
                Connect
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* No companies found */}
      {!loading && step === 'companies' && companies.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bc-empty-icon-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 bc-empty-icon" />
          </div>
          <p className="font-medium theme-text-primary mb-1">No companies found</p>
          <p className="text-sm theme-text-secondary max-w-xs mx-auto mb-4">
            This environment doesn&apos;t have any accessible companies.
          </p>
          <button
            onClick={() => {
              setStep('environments')
              setSelectedEnvironment(null)
            }}
            className="inline-flex items-center gap-1.5 text-sm bc-setup-link font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Choose a different environment
          </button>
        </div>
      )}
    </div>
  )
}
