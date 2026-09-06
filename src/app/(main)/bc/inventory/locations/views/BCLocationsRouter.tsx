'use client'

import { useEffect } from 'react'
import { BCOAuthLocationsView } from './BCOAuthLocationsView'
import { useBCConnection } from '@/hooks/useBCConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'

export function BCLocationsRouter() {
  const { activeConnection, isOAuth, isLoading } = useBCConnection()
  const welcomeContext = useWelcomeContextOptional()

  useEffect(() => {
    if (isLoading) {
      welcomeContext?.setDataLoading(true)
    }
  }, [isLoading, welcomeContext])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    )
  }

  if (isOAuth && activeConnection) {
    return <BCOAuthLocationsView connectionId={activeConnection.id} />
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-sm theme-text-secondary">
        Locations view requires an OAuth connection to Business Central.
      </p>
    </div>
  )
}
