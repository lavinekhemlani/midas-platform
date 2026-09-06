// src/contexts/WelcomeContext.tsx
'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface WelcomeContextValue {
  /** Whether data is currently loading (set by report views) */
  isDataLoading: boolean
  /** Set the data loading state */
  setDataLoading: (loading: boolean) => void
  /** Whether the welcome overlay has completed its sequence */
  welcomeComplete: boolean
  /** Mark the welcome sequence as complete */
  markWelcomeComplete: () => void
}

const WelcomeContext = createContext<WelcomeContextValue | undefined>(undefined)

export function WelcomeProvider({ children }: { children: ReactNode }) {
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [welcomeComplete, setWelcomeComplete] = useState(false)

  const setDataLoading = useCallback((loading: boolean) => {
    setIsDataLoading(loading)
  }, [])

  const markWelcomeComplete = useCallback(() => {
    setWelcomeComplete(true)
  }, [])

  return (
    <WelcomeContext.Provider
      value={{
        isDataLoading,
        setDataLoading,
        welcomeComplete,
        markWelcomeComplete,
      }}
    >
      {children}
    </WelcomeContext.Provider>
  )
}

export function useWelcomeContext() {
  const context = useContext(WelcomeContext)
  if (!context) {
    throw new Error('useWelcomeContext must be used within WelcomeProvider')
  }
  return context
}

// Hook for components that may or may not be within the provider
export function useWelcomeContextOptional() {
  return useContext(WelcomeContext)
}
