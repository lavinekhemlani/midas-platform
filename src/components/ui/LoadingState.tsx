'use client'

import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'

interface LoadingStateProps {
  variant?: 'dashboard' | 'page' | 'minimal'
  showSpinner?: boolean
  customSteps?: string[]
}

export default function LoadingState({ 
  variant = 'page', 
  showSpinner = true,
  customSteps 
}: LoadingStateProps) {
  const defaultSteps = [
    "Connecting to your books",
    "Fetching financial data",
    "Calculating metrics",
    "Adding finishing touches"
  ]
  
  const loadingSteps = customSteps || defaultSteps
  const [currentStep, setCurrentStep] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        // Stop at the last step
        if (prev < loadingSteps.length - 1) {
          return prev + 1
        }
        return prev
      })
    }, 2000)
    
    return () => clearInterval(interval)
  }, [loadingSteps.length])

  if (variant === 'minimal') {
    return (
      <div className="space-y-6">
        <div className="skeleton skeleton-shimmer h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`skeleton skeleton-shimmer skeleton-delay-${i} h-32`} />
          ))}
        </div>
        <div className="skeleton skeleton-shimmer h-96" />
      </div>
    )
  }

  if (variant === 'page') {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 skeleton skeleton-shimmer" />
            <div className="h-5 w-80 skeleton skeleton-shimmer skeleton-delay-1" />
          </div>
        </div>

        {showSpinner && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-amber-500" />
                </div>
              </div>
              
              <p className="text-sm font-medium theme-text-secondary">
                {loadingSteps[currentStep]}...
              </p>
            </div>
          </div>
        )}

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`skeleton skeleton-shimmer skeleton-delay-${i} h-32`} />
          ))}
        </div>
        <div className="skeleton skeleton-shimmer h-96" />
      </div>
    )
  }

  // Dashboard variant
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 skeleton" />
          <div className="h-5 w-80 skeleton" />
        </div>
      </div>

      {/* Loading indicator - centered in middle panel */}
      {showSpinner && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            
            <p className="text-sm font-medium theme-text-secondary">
              {loadingSteps[currentStep]}...
            </p>
          </div>
        </div>
      )}
      
      {/* KPI Grid skeleton */}
      <div className="space-y-10">
        {[1, 2, 3].map((section) => (
          <div key={section}>
            <div className="mb-6">
              <div className="h-6 w-48 skeleton skeleton-shimmer mb-2" />
              <div className="h-4 w-64 skeleton skeleton-shimmer skeleton-delay-1" />
            </div>
            <div className="grid gap-6 kpi-grid">
              {[1, 2, 3].map((card) => (
                <div key={card} className="kpi-skeleton" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}