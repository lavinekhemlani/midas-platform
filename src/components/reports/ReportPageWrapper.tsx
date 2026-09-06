'use client'

import { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ReportPageWrapperProps {
  isLoading: boolean
  error: any
  hasData: boolean
  children: ReactNode
}

export function ReportPageWrapper({
  isLoading,
  error,
  hasData,
  children
}: ReportPageWrapperProps) {
  // Loading state
  if (isLoading && !hasData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load report data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}