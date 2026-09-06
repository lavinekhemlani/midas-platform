/**
 * Shared error state component for all report views
 * Provides consistent error UI and retry functionality
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Unplug } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ReportErrorStateProps {
  /**
   * The error object or message to display
   */
  error: Error | string | null

  /**
   * Optional callback to retry the operation
   */
  onRetry?: () => void

  /**
   * Custom error message (overrides error.message)
   */
  message?: string
}

// Extended error type with authentication-related properties
interface AuthError extends Error {
  requiresReconnect?: boolean
  code?: string
  provider?: string
  userMessage?: string
}

// Type guard to check if error has authentication-related properties
function isAuthError(error: unknown): error is AuthError {
  if (!(error instanceof Error)) return false
  const err = error as AuthError
  return (
    err.requiresReconnect === true ||
    err.code === 'PROVIDER_INVALID_GRANT' ||
    err.code === 'NO_PROVIDER_CONNECTED' ||
    err.code === 'PROVIDER_NOT_CONNECTED'
  )
}

export function ReportErrorState({ error, onRetry, message }: ReportErrorStateProps) {
  const router = useRouter()

  // Check if this is an authentication error requiring reconnection
  const isAuthenticationError = error && isAuthError(error)

  // Determine the error message to display
  const errorMessage =
    message ||
    (error instanceof Error ? error.message : String(error)) ||
    'Failed to load report data. Please try again later.'

  // Handle reconnection navigation
  const handleReconnect = () => {
    router.push('/dashboard')
  }

  if (isAuthenticationError) {
    return (
      <div className="space-y-6 p-6">
        <Alert
          variant="default"
          className="border-amber-500/50 bg-[rgba(var(--theme-card-bg-rgb),0.5)]"
        >
          <Unplug className="h-5 w-5 text-amber-500" />
          <AlertTitle className="theme-text-primary font-semibold mt-4">
            QuickBooks Connection Required
          </AlertTitle>
          <AlertDescription className="theme-text-secondary mt-2">
            {error.userMessage ||
              errorMessage ||
              'Your QuickBooks connection has expired. Please reconnect your account to view reports.'}
          </AlertDescription>
        </Alert>

        <div className="flex justify-center gap-3">
          <Button
            onClick={handleReconnect}
            className="bg-amber-500 hover:bg-amber-600 text-white"
            size="sm"
          >
            <Unplug className="h-4 w-4 mr-2" />
            Reconnect QuickBooks
          </Button>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="default"
              size="sm"
              className="border-white/40 border-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Again
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Generic error display for non-authentication errors
  return (
    <div className="space-y-6 p-6">
      <Alert
        variant="default"
        className="border-red-500/50 bg-[rgba(var(--theme-card-bg-rgb),0.5)]"
      >
        <AlertCircle className="h-4 w-4 text-red-500" />
        <AlertDescription className="theme-text-secondary mt-4">{errorMessage}</AlertDescription>
      </Alert>

      {onRetry && (
        <div className="flex justify-center">
          <Button
            onClick={onRetry}
            variant="default"
            size="sm"
            className="border-white/40 border-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
