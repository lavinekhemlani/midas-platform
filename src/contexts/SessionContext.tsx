'use client'

import { createContext, useContext } from 'react'
import { User, Organization } from '@/lib/data'
import { ProviderID } from '@/lib/providers/database'

// The possible states of the user's session
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

// The complete state managed by the provider
export interface SessionState {
  status: SessionStatus
  user: User | null
  organization: Organization | null
  activeProvider: ProviderID | null
  connectedProviders: ProviderID[] // Array of all connected providers
  requiresProviderConnection: boolean // true when user is authenticated but no provider connected
  error: string | null
  isSigningOut: boolean // true when sign-out is in progress
}

// The context value exposed to consumers
export interface SessionContextType extends SessionState {
  refetchSession: () => Promise<void>
  updateUserProfile: (data: Partial<User>) => void
  signOut: () => Promise<void>
  switchOrganization: (organizationId: string) => Promise<boolean>
  // Convenience flags for onboarding status
  onboardingRequired: boolean
  hasAcceptedTerms: boolean
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined)

// Hook to use the session context
export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
