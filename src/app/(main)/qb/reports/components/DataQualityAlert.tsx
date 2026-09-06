'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface DataQualityAlertProps {
  metadata?: {
    dataQuality?: {
      isComplete: boolean
      hasPartialData: boolean
      errors?: Array<{
        type: string
        message: string
        component?: string
        severity: 'warning' | 'error'
      }>
      warnings?: string[]
    }
  }
  onRetry?: () => void
  className?: string
}

export function DataQualityAlert({ metadata, onRetry, className }: DataQualityAlertProps) {
  const dataQuality = metadata?.dataQuality

  if (!dataQuality || dataQuality.isComplete) {
    return null
  }

  const hasRateLimitError = dataQuality.errors?.some((err) => err.type === 'rate_limit')
  const warnings = dataQuality.warnings || []

  return (
    <Alert variant={hasRateLimitError ? 'default' : 'destructive'} className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold mb-1">
            {hasRateLimitError
              ? 'Some data is unavailable due to rate limiting'
              : 'Incomplete data'}
          </p>
          {warnings.length > 0 && (
            <ul className="text-sm space-y-1 mt-2">
              {warnings.map((warning, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}
          {hasRateLimitError && (
            <p className="text-sm mt-2 text-muted-foreground">
              QuickBooks limits the number of requests per minute. Core financial data is available,
              but some details are missing.
            </p>
          )}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
