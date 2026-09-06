// src/components/reports/CompanyInfoCard.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import {
  Building2,
  Calendar,
  Users,
  CreditCard,
  Clock,
  MapPin,
  Link2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Banknote,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompanyMetadata } from '@/hooks/useCompanyMetadata'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

interface CompanyInfoCardProps {
  className?: string
}

export function CompanyInfoCard({ className }: CompanyInfoCardProps) {
  const { data: metadata, isLoading, error, mutate } = useCompanyMetadata()

  // Helper function to get connection status icon and color
  const getConnectionStatus = () => {
    if (!metadata?.integration)
      return { icon: XCircle, color: 'text-gray-400', text: 'Not Connected' }

    const { connected, connectionHealth } = metadata.integration

    if (!connected) return { icon: XCircle, color: 'text-gray-400', text: 'Disconnected' }

    switch (connectionHealth) {
      case 'healthy':
        return { icon: CheckCircle2, color: 'text-emerald-400', text: 'Connected' }
      case 'warning':
        return { icon: AlertCircle, color: 'text-amber-400', text: 'Warning' }
      case 'error':
        return { icon: XCircle, color: 'text-red-400', text: 'Error' }
      default:
        return { icon: AlertCircle, color: 'text-gray-400', text: 'Unknown' }
    }
  }

  // Helper function to format address
  const formatAddress = () => {
    if (!metadata?.contact?.address) return null
    const { city, state, country } = metadata.contact.address
    return [city, state, country].filter(Boolean).join(', ')
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn('glass-luxury-card border border-gray-200/10', className)}>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="border-t border-gray-200/5" />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('glass-luxury-card border border-gray-200/10', className)}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-0.5 rounded bg-red-500/10">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              </div>
              <span className="text-sm text-red-400">Failed to load company information</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => mutate()}
              className="text-xs text-red-400 hover:text-red-300 h-auto py-0 px-2"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const connectionStatus = getConnectionStatus()

  return (
    <Card className={cn('glass-luxury-card border border-gray-200/10', className)}>
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            {/* Company Identity */}
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold theme-text-primary leading-tight">
                  {metadata?.identity?.name || 'Company Overview'}
                </h3>
                {metadata?.contact?.email && (
                  <span className="text-xs theme-text-secondary">{metadata.contact.email}</span>
                )}
              </div>
            </div>

            {/* Connection Status */}
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                connectionStatus.color === 'text-emerald-400' && 'bg-emerald-500/10',
                connectionStatus.color === 'text-amber-400' && 'bg-amber-500/10',
                connectionStatus.color === 'text-red-400' && 'bg-red-500/10',
                connectionStatus.color === 'text-gray-400' && 'bg-gray-500/10'
              )}
            >
              <connectionStatus.icon className={cn('w-3 h-3', connectionStatus.color)} />
              <span className={connectionStatus.color}>{connectionStatus.text}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200/5" />

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-4 gap-y-2">
            {/* Fiscal Year */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-gray-500 leading-none">Fiscal Year</p>
                <p className="text-xs font-medium theme-text-primary truncate">
                  {metadata?.financial?.fiscalYearEnd || 'Dec 31'}
                </p>
              </div>
            </div>

            {/* Currency */}
            <div className="flex items-center gap-1.5">
              <Banknote className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-gray-500 leading-none">Currency</p>
                <p className="text-xs font-medium theme-text-primary">
                  {metadata?.financial?.currencyCode || 'USD'}
                </p>
              </div>
            </div>

            {/* Location */}
            {formatAddress() && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-purple-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-gray-500 leading-none">Location</p>
                  <p className="text-xs font-medium theme-text-primary truncate">
                    {formatAddress()}
                  </p>
                </div>
              </div>
            )}

            {/* Timezone */}
            <div className="flex items-center gap-1.5">
              <Clock
                className={cn(
                  'w-3 h-3 flex-shrink-0',
                  metadata?.financial?.timezone ? 'text-cyan-400' : 'text-gray-500'
                )}
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-gray-500 leading-none">Timezone</p>
                <p
                  className={cn(
                    'text-xs font-medium truncate',
                    metadata?.financial?.timezone ? 'theme-text-primary' : 'text-gray-500'
                  )}
                >
                  {metadata?.financial?.timezone?.split('/').pop()?.replace('_', ' ') || 'Not set'}
                </p>
              </div>
            </div>

            {/* Provider */}
            {metadata?.integration?.provider && (
              <div className="flex items-center gap-1.5">
                <Link2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-gray-500 leading-none">Provider</p>
                  <p className="text-xs font-medium theme-text-primary capitalize">
                    {metadata.integration.provider}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Operational Metrics - Show if any metric is available */}
          {(metadata?.operational?.activeCustomers !== null ||
            metadata?.operational?.activeVendors !== null ||
            metadata?.operational?.activeEmployees !== null ||
            metadata?.operational?.bankAccounts !== null) && (
            <>
              <div className="border-t border-gray-200/5" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {metadata?.operational?.activeCustomers !== null && (
                  <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 rounded p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Users className="w-3 h-3 text-blue-400" />
                      <p className="text-[10px] uppercase text-blue-400/80">Customers</p>
                    </div>
                    <p className="text-base font-semibold theme-text-primary">
                      {metadata?.operational?.activeCustomers?.toLocaleString()}
                    </p>
                  </div>
                )}
                {metadata?.operational?.activeVendors !== null && (
                  <div className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 rounded p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Briefcase className="w-3 h-3 text-purple-400" />
                      <p className="text-[10px] uppercase text-purple-400/80">Vendors</p>
                    </div>
                    <p className="text-base font-semibold theme-text-primary">
                      {metadata?.operational?.activeVendors?.toLocaleString()}
                    </p>
                  </div>
                )}
                {metadata?.operational?.activeEmployees !== null && (
                  <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 rounded p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Users className="w-3 h-3 text-emerald-400" />
                      <p className="text-[10px] uppercase text-emerald-400/80">Employees</p>
                    </div>
                    <p className="text-base font-semibold theme-text-primary">
                      {metadata?.operational?.activeEmployees?.toLocaleString()}
                    </p>
                  </div>
                )}
                {metadata?.operational?.bankAccounts !== null && (
                  <div className="bg-gradient-to-br from-cyan-500/5 to-cyan-500/10 rounded p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CreditCard className="w-3 h-3 text-cyan-400" />
                      <p className="text-[10px] uppercase text-cyan-400/80">Bank Accounts</p>
                    </div>
                    <p className="text-base font-semibold theme-text-primary">
                      {metadata?.operational?.bankAccounts?.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Token Expiry Warning */}
          {metadata?.integration?.tokenStatus === 'expiring_soon' && (
            <>
              <div className="border-t border-gray-200/5" />
              <div className="flex items-center gap-2 p-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">
                  Token expires in {metadata.integration.tokenExpiryDays} days
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 h-auto py-0 px-1.5"
                >
                  Reconnect
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
