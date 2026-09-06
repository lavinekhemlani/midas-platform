// src/components/settings/OrganizationSwitcher.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Building2, ChevronDown, Check, Loader2, RefreshCw } from 'lucide-react'
import { useSession } from '@/contexts/SessionContext'
import { Organization } from '@/lib/data'
import { apiClient } from '@/lib/apiClient'

interface OrganizationSwitcherProps {
  onSwitchSuccess?: (organization: Organization) => void
}

export default function OrganizationSwitcher({ onSwitchSuccess }: OrganizationSwitcherProps) {
  const { user, organization, switchOrganization, refetchSession } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch available organizations for the user
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!user?.user_id) return

      setIsLoading(true)
      setError(null)

      try {
        const response = await apiClient(`/api/users/${user.user_id}/organizations`)
        if (!response.ok) {
          throw new Error('Failed to fetch organizations')
        }
        const orgs = await response.json()
        setAvailableOrgs(orgs)
      } catch (err) {
        console.error('Error fetching organizations:', err)
        setError('Failed to load organizations')
        // Fallback: at least show current org if available
        if (organization) {
          setAvailableOrgs([organization])
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrganizations()
  }, [user?.user_id, organization])

  const handleSwitch = async (targetOrg: Organization) => {
    if (targetOrg.PK === organization?.PK) {
      setIsOpen(false)
      return
    }

    setIsSwitching(true)
    setError(null)

    try {
      const success = await switchOrganization(targetOrg.PK)
      if (success) {
        setIsOpen(false)
        onSwitchSuccess?.(targetOrg)
      } else {
        setError('Failed to switch organization')
      }
    } catch (err) {
      console.error('Error switching organization:', err)
      setError('Failed to switch organization')
    } finally {
      setIsSwitching(false)
    }
  }

  // Don't render if user has no organizations or only one
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg metric-card-bg">
        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        <span className="text-sm theme-text-secondary">Loading organizations...</span>
      </div>
    )
  }

  if (!organization && availableOrgs.length === 0) {
    return (
      <div className="px-4 py-3 rounded-lg metric-card-bg">
        <p className="text-sm theme-text-secondary">No organization linked to your account.</p>
      </div>
    )
  }

  // If user only has one organization, just show it without dropdown
  if (availableOrgs.length <= 1 && !isOpen) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg metric-card-bg">
        <Building2 className="w-5 h-5 text-amber-500" />
        <div className="flex-1">
          <p className="text-sm font-medium theme-text-primary">
            {organization?.name || 'Unknown Organization'}
          </p>
          <p className="text-xs theme-text-secondary">Active organization</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg metric-card-bg transition-colors cursor-pointer"
      >
        <Building2 className="w-5 h-5 text-amber-500" />
        <div className="flex-1 text-left">
          <p className="text-sm font-medium theme-text-primary">
            {organization?.name || 'Select Organization'}
          </p>
          <p className="text-xs theme-text-secondary">
            {availableOrgs.length} organization{availableOrgs.length !== 1 ? 's' : ''} available
          </p>
        </div>
        {isSwitching ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        ) : (
          <ChevronDown
            className={`w-4 h-4 theme-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-2 py-2 rounded-lg shadow-xl z-50 overflow-hidden"
          style={{
            background: 'var(--theme-bg)',
            border: '1px solid var(--theme-card-border)',
          }}
        >
          {error && (
            <div
              className="px-4 py-2 text-sm text-red-400"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              {error}
            </div>
          )}

          {availableOrgs.map((org) => {
            const isActive = org.PK === organization?.PK
            return (
              <button
                key={org.PK}
                onClick={() => handleSwitch(org)}
                disabled={isSwitching}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer
                  ${isActive ? 'bg-amber-500/10' : 'hover:bg-[var(--theme-card-bg)]'}
                `}
              >
                <Building2
                  className={`w-4 h-4 ${isActive ? 'text-amber-500' : 'theme-text-secondary'}`}
                />
                <div className="flex-1 text-left">
                  <p
                    className={`text-sm font-medium ${isActive ? 'text-amber-500' : 'theme-text-primary'}`}
                  >
                    {org.name}
                  </p>
                  {org.legal_name && org.legal_name !== org.name && (
                    <p className="text-xs theme-text-secondary">{org.legal_name}</p>
                  )}
                </div>
                {isActive && <Check className="w-4 h-4 text-amber-500" />}
              </button>
            )
          })}

          {/* Refresh button */}
          <div
            className="mt-2 pt-2 px-4"
            style={{ borderTop: '1px solid var(--theme-card-border)' }}
          >
            <button
              onClick={async () => {
                setIsLoading(true)
                await refetchSession()
                setIsLoading(false)
              }}
              className="flex items-center gap-2 text-xs theme-text-secondary hover:text-amber-500 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh organizations
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  )
}
