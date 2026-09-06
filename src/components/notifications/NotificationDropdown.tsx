// NotificationDropdown - Displays metric-based alerts in the TopBar
'use client'

import { useState, useRef, useEffect, forwardRef, useMemo } from 'react'
import Link from 'next/link'
import {
  Bell,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  Receipt,
  FileText,
  TrendingDown,
  Wallet,
  ExternalLink,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAlertsOptional } from '@/contexts/AlertsContext'
import { MetricAlert, AlertSeverity, AlertCategory } from '@/lib/types/metric-alert'
import { PIIText } from '@/components/ui/PIIText'

interface NotificationDropdownProps {
  className?: string
}

// Icon mapping for categories
const categoryIcons: Record<AlertCategory, typeof Receipt> = {
  billing: Receipt,
  receivables: FileText,
  cash_flow: TrendingDown,
  liquidity: Wallet,
  profitability: TrendingDown,
  general: Bell,
}

// Severity styling
const severityStyles: Record<
  AlertSeverity,
  {
    icon: typeof AlertTriangle
    bg: string
    text: string
    border: string
    dot: string
  }
> = {
  critical: {
    icon: AlertTriangle,
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500',
  },
}

interface AlertItemProps {
  alert: MetricAlert
  onDismiss: (alertId: string) => void
  onClose: () => void
}

function AlertItem({ alert, onDismiss, onClose }: AlertItemProps) {
  const severity = severityStyles[alert.severity]
  const CategoryIcon = categoryIcons[alert.category] || Bell

  const handleAction = () => {
    onClose()
  }

  return (
    <div className={cn('group relative px-3 py-2.5 transition-colors hover:bg-white/5')}>
      <div className="flex items-start gap-3">
        {/* Severity indicator */}
        <div className="mt-0.5">
          <CategoryIcon className={cn('w-4 h-4', severity.text)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn('text-sm font-medium', severity.text)}>{alert.title}</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">{alert.message}</p>

          {/* Action button */}
          {alert.actionUrl && (
            <Link
              href={alert.actionUrl}
              onClick={handleAction}
              className={cn(
                'inline-flex items-center gap-1 mt-2 text-xs font-medium',
                severity.text,
                'hover:underline'
              )}
            >
              {alert.actionLabel || 'View Details'}
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => onDismiss(alert.id)}
          className={cn(
            'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-white/10 theme-text-secondary hover:theme-text-primary'
          )}
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const alertsContext = useAlertsOptional()

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // If context is not available, show a simple "coming soon" state
  if (!alertsContext) {
    return (
      <div className={cn('relative', className)} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'p-2 rounded-md transition-colors',
            isOpen
              ? 'text-amber-500 bg-amber-500/20'
              : 'theme-text-secondary hover:text-amber-500 hover:bg-amber-500/10'
          )}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>

        {isOpen && (
          <div
            className="absolute top-full right-0 mt-1 w-64 py-2 rounded-lg border border-amber-500/20 shadow-xl z-50"
            style={{
              background: 'var(--theme-bg)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="px-3 py-4 text-center">
              <Bell className="w-8 h-8 mx-auto mb-2 theme-text-secondary opacity-40" />
              <div className="text-xs theme-text-secondary opacity-40 mt-1">
                Loading notifications...
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const {
    activeAlerts,
    unreadCount,
    isLoading,
    dismissAlert,
    dismissAllAlerts,
    alertsByCompany,
    companies,
    hasMultipleCompanies,
  } = alertsContext

  const handleDismiss = (alertId: string) => {
    dismissAlert(alertId)
  }

  const handleDismissAll = () => {
    dismissAllAlerts()
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  // Build company name lookup
  const companyNameMap = useMemo(() => {
    const map = new Map<string, string>()
    companies.forEach((c) => map.set(c.realmId, c.companyName))
    return map
  }, [companies])

  // Get ordered list of companies with alerts
  const companiesWithAlerts = useMemo(() => {
    const result: Array<{ realmId: string; companyName: string; alerts: MetricAlert[] }> = []
    alertsByCompany.forEach((alerts, realmId) => {
      result.push({
        realmId,
        companyName: companyNameMap.get(realmId) || 'Unknown Company',
        alerts,
      })
    })
    // Sort by company name
    result.sort((a, b) => a.companyName.localeCompare(b.companyName))
    return result
  }, [alertsByCompany, companyNameMap])

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Bell Button with Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-md transition-colors',
          isOpen
            ? 'text-amber-500 bg-amber-500/20'
            : 'theme-text-secondary hover:text-amber-500 hover:bg-amber-500/10'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
              'flex items-center justify-center',
              'text-[10px] font-bold text-white rounded-full',
              activeAlerts.some((a) => a.severity === 'critical')
                ? 'bg-red-500'
                : activeAlerts.some((a) => a.severity === 'warning')
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
            )}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1 w-80 rounded-lg border border-amber-500/20 shadow-xl z-50 overflow-hidden"
          style={{
            background: 'var(--theme-bg)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold theme-text-primary">Alerts</span>
              {unreadCount > 0 && (
                <span className="text-xs theme-text-secondary">({unreadCount})</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {activeAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={handleDismissAll}
                  className="p-1.5 text-xs theme-text-secondary hover:text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                  title="Dismiss all"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 theme-text-secondary hover:text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-8 text-center">
                <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs theme-text-secondary">Loading alerts...</p>
              </div>
            ) : activeAlerts.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm font-medium theme-text-primary mb-1">All caught up!</p>
                <p className="text-xs theme-text-secondary">No alerts at this time</p>
              </div>
            ) : hasMultipleCompanies && companiesWithAlerts.length > 0 ? (
              // Multi-company view with dividers
              <div>
                {companiesWithAlerts.map((company, index) => (
                  <div key={company.realmId}>
                    {/* Company Header */}
                    <div
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 bg-white/5',
                        index > 0 && 'border-t border-white/10'
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                      <PIIText className="text-xs font-medium text-emerald-400 truncate">
                        {company.companyName}
                      </PIIText>
                      <span className="text-[10px] theme-text-secondary ml-auto">
                        {company.alerts.length} alert{company.alerts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {/* Company Alerts */}
                    <div className="divide-y divide-white/5">
                      {company.alerts.map((alert) => (
                        <AlertItem
                          key={alert.id}
                          alert={alert}
                          onDismiss={handleDismiss}
                          onClose={handleClose}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Single company view (original behavior)
              <div className="divide-y divide-white/5">
                {activeAlerts.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onDismiss={handleDismiss}
                    onClose={handleClose}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer - only show when there are alerts */}
          {activeAlerts.length > 0 && (
            <div className="px-3 py-2 border-t border-white/10">
              <p className="text-[10px] theme-text-secondary text-center">
                Alerts reset daily • Dismiss to hide for 24h
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
