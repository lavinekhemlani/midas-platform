'use client'

import { useSearchParams } from 'next/navigation'
import { useQBCompanies } from '@/hooks/useQBCompanies'
import { AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useMemo } from 'react'

interface QBConnectionGuardProps {
  children: React.ReactNode
}

/**
 * Guards QB pages by checking if the current company (via realmId) is connected.
 * If disconnected, shows a reconnect UI instead of loading data.
 * This prevents API calls for disconnected companies and provides clear UX.
 */
export function QBConnectionGuard({ children }: QBConnectionGuardProps) {
  const searchParams = useSearchParams()
  const realmIdFromUrl = searchParams.get('realmId')
  const { connections, activeRealmId, isLoading, error } = useQBCompanies()

  // Determine which realmId we're trying to view
  const targetRealmId = realmIdFromUrl || activeRealmId

  // Find the connection for this realmId
  const targetConnection = useMemo(() => {
    if (!targetRealmId) return null
    return connections.find((c) => c.realmId === targetRealmId) || null
  }, [connections, targetRealmId])

  // Check if we have any connected companies at all
  const hasAnyConnected = connections.some((c) => c.connected)

  // Still loading connection status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border border-amber-500/20" />
            <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-transparent border-t-amber-500 animate-spin" />
          </div>
          <p className="text-sm theme-text-secondary">Checking connection status...</p>
        </div>
      </div>
    )
  }

  // Error fetching connection status
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-lg font-medium theme-text-primary">Unable to Check Connection</h2>
          <p className="text-sm theme-text-secondary">
            We couldn&apos;t verify your QuickBooks connection status. Please try refreshing the
            page.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh Page
          </Button>
        </div>
      </div>
    )
  }

  // No QB connections at all
  if (connections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-lg font-medium theme-text-primary">No QuickBooks Connected</h2>
          <p className="text-sm theme-text-secondary">
            Connect your QuickBooks account to view financial reports and insights.
          </p>
          <Link href="/settings">
            <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-black">
              Connect QuickBooks
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Target company is disconnected
  if (targetConnection && !targetConnection.connected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6 text-center max-w-lg p-8">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold theme-text-primary">Connection Expired</h2>
            <p className="text-base theme-text-secondary">
              <span className="font-medium text-amber-500">
                {targetConnection.companyName || 'This QuickBooks company'}
              </span>{' '}
              needs to be reconnected to continue viewing data.
            </p>
            {targetConnection.lastError && (
              <p className="text-xs theme-text-secondary mt-2 px-4 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                Error: {targetConnection.lastError}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/settings">
              <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-black min-w-[180px]">
                <RefreshCw className="w-4 h-4" />
                Reconnect QuickBooks
              </Button>
            </Link>

            {/* If there are other connected companies, offer to switch */}
            {hasAnyConnected && (
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2 min-w-[180px]">
                  Back to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // No target realmId and no connected companies
  if (!targetRealmId && !hasAnyConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-lg font-medium theme-text-primary">
            All QuickBooks Companies Disconnected
          </h2>
          <p className="text-sm theme-text-secondary">
            Your QuickBooks connections have expired. Please reconnect to continue.
          </p>
          <Link href="/settings">
            <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-black">
              <RefreshCw className="w-4 h-4" />
              Reconnect QuickBooks
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Target company not found (but we have some connections)
  if (targetRealmId && !targetConnection && connections.length > 0) {
    // This might be a stale URL - redirect to first connected company or dashboard
    const firstConnected = connections.find((c) => c.connected)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-lg font-medium theme-text-primary">Company Not Found</h2>
          <p className="text-sm theme-text-secondary">
            The QuickBooks company you&apos;re trying to access is no longer connected.
          </p>
          <Link
            href={firstConnected ? `/qb/reports?realmId=${firstConnected.realmId}` : '/dashboard'}
          >
            <Button className="gap-2">
              {firstConnected ? 'View Another Company' : 'Back to Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // All good - render children
  return <>{children}</>
}
