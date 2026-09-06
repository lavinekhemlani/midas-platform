'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext'
import { User, Building2, Zap, FilePen, Check, Lock, Loader2 } from 'lucide-react'

const steps = [
  { id: 'setup', label: 'Setup', icon: User, path: '/onboarding/setup' },
  { id: 'connect', label: 'Connect', icon: Zap, path: '/onboarding/connect' },
]

export default function OnboardingNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useSession()
  const { navigateWithCheck } = useUnsavedChanges()
  const completedSteps = user?.onboarding_audit?.completed_steps || []
  const skippedSteps = user?.onboarding_audit?.skipped_steps || []
  const savingStep = null
  const [shakeStep, setShakeStep] = useState<string | null>(null)
  const [animatingStep, setAnimatingStep] = useState<string | null>(null)

  // Extract the step from pathname, handling both /onboarding and /onboarding/[step] cases
  const pathParts = pathname?.split('/').filter(Boolean) || []
  const lastPart = pathParts[pathParts.length - 1]
  // If we're at /onboarding root or the last part is 'onboarding', default to setup
  const currentStepFromPath = lastPart === 'onboarding' || !lastPart ? 'setup' : lastPart
  const currentStepIndex = steps.findIndex((step) => step.id === currentStepFromPath)

  // Animate current step on mount and route change
  useEffect(() => {
    setAnimatingStep(currentStepFromPath)
    const timer = setTimeout(() => setAnimatingStep(null), 300)
    return () => clearTimeout(timer)
  }, [currentStepFromPath])

  // Debug logging for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('OnboardingNav Debug:', {
        pathname,
        currentStepFromPath,
        currentStepIndex,
        completedSteps,
      })
    }
  }, [pathname, currentStepFromPath, currentStepIndex, completedSteps])

  const isStepAccessible = (step: (typeof steps)[0], index: number) => {
    const isCompleted = completedSteps.includes(step.id)
    if (isCompleted) return true

    // Connect step is unlocked after Setup step is completed
    if (step.id === 'connect') {
      return completedSteps.includes('setup')
    }

    return index <= currentStepIndex
  }

  const handleStepClick = (step: (typeof steps)[0], index: number) => {
    const isCompleted = completedSteps.includes(step.id)
    const isCurrent = step.id === currentStepFromPath
    const isAccessible = isStepAccessible(step, index)

    if (isAccessible && !isCurrent) {
      // Use navigateWithCheck to handle unsaved changes
      navigateWithCheck(step.path)
    } else if (!isAccessible) {
      setShakeStep(step.id)
      setTimeout(() => setShakeStep(null), 600)
    }
  }

  const getStepState = (step: (typeof steps)[0], index: number) => {
    const isCompleted = completedSteps.includes(step.id)
    const isSkipped = skippedSteps.includes(step.id)
    const isCurrent = step.id === currentStepFromPath
    const isAccessible = isStepAccessible(step, index)
    const isSaving = savingStep === step.id

    if (isSaving) return 'saving'
    // Current state takes priority over completed to show the glow
    if (isCurrent) return 'current'
    if (isCompleted) return 'completed'
    if (isSkipped) return 'skipped'
    if (!isAccessible) return 'locked'
    return 'available'
  }

  const getProgressPercentage = () => {
    const completed = completedSteps.length
    const total = steps.length
    return (completed / total) * 100
  }

  return (
    <>
      {/* Mobile Top Navigation */}
      <nav className="fixed top-20 left-0 right-0 z-20 md:hidden">
        <div className="flex items-center justify-center gap-6">
          {steps.map((step, index) => {
            const state = getStepState(step, index)
            const Icon = step.icon
            const isCompleted = completedSteps.includes(step.id)
            const isCurrent = step.id === currentStepFromPath

            return (
              <div key={step.id} className="flex items-center">
                <div className="relative">
                  {/* Glowing ring for current step */}
                  {isCurrent && (
                    <>
                      <div className="absolute inset-0 w-10 h-10 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
                      <div
                        className="absolute inset-0 w-10 h-10 rounded-full ring-2 ring-amber-500 ring-offset-2 animate-pulse"
                        style={
                          { '--tw-ring-offset-color': 'var(--theme-bg)' } as React.CSSProperties
                        }
                      />
                    </>
                  )}

                  <button
                    onClick={() => handleStepClick(step, index)}
                    className={`
                      relative w-10 h-10 rounded-full flex items-center justify-center
                      transition-all duration-300 z-10
                      ${shakeStep === step.id ? 'animate-shake' : ''}
                      ${state !== 'locked' && state !== 'current' ? 'hover:scale-105' : ''}
                    `}
                    style={{
                      background:
                        state === 'current'
                          ? 'linear-gradient(to bottom right, #f59e0b, #d97706)'
                          : 'var(--theme-bg)',
                      border:
                        state === 'completed'
                          ? '2px solid #f59e0b'
                          : state === 'locked'
                            ? '1px solid rgba(245, 158, 11, 0.2)'
                            : '1px solid rgba(245, 158, 11, 0.3)',
                      boxShadow:
                        state === 'current'
                          ? '0 8px 20px rgba(245, 158, 11, 0.5)'
                          : state === 'completed'
                            ? '0 4px 6px rgba(0, 0, 0, 0.1)'
                            : 'none',
                    }}
                    disabled={state === 'locked'}
                  >
                    {state === 'saving' ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : state === 'locked' ? (
                      <Lock
                        className="w-4 h-4"
                        style={{ color: 'var(--theme-text-secondary)', opacity: 0.5 }}
                      />
                    ) : (
                      <Icon
                        className="w-4 h-4"
                        style={{
                          color:
                            state === 'current'
                              ? '#ffffff'
                              : state === 'completed'
                                ? '#f59e0b'
                                : 'var(--theme-text-secondary)',
                        }}
                      />
                    )}
                  </button>

                  {/* Checkmark for completed steps */}
                  {isCompleted && (
                    <div className="absolute -bottom-1 -right-1 flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div
                    className="w-12 h-0.5 ml-3"
                    style={{
                      background: completedSteps.includes(step.id)
                        ? 'linear-gradient(to right, #f59e0b, #d97706)'
                        : 'rgba(245, 158, 11, 0.2)',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Desktop Side Navigation */}
      <nav className="fixed left-5 top-1/2 transform -translate-y-1/2 z-20 hidden md:block">
        <div className="relative">
          {/* Steps */}
          <div className="relative space-y-8">
            {/* Timeline connector line - connects centers of circles */}
            <div
              className="absolute left-6 w-0.5 -translate-x-1/2"
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                top: '24px',
                bottom: '24px' /* Use top/bottom to stretch between circle centers */,
              }}
            >
              <div
                className="absolute top-0 left-0 w-full bg-gradient-to-b from-amber-500 to-amber-600 transition-all duration-500"
                style={{ height: `${getProgressPercentage()}%` }}
              />
            </div>
            {steps.map((step, index) => {
              const state = getStepState(step, index)
              const Icon = step.icon
              const isAnimating = animatingStep === step.id
              const isCompleted = completedSteps.includes(step.id)
              const isCurrent = step.id === currentStepFromPath

              return (
                <div key={step.id} className="relative group flex items-center">
                  {/* Checkmark for completed steps - positioned on the right */}
                  {isCompleted && (
                    <div className="absolute -right-7 flex items-center justify-center">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-[checkmark_0.4s_ease-in-out]"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Glowing ring for current step */}
                  {isCurrent && (
                    <>
                      <div className="absolute left-0 w-12 h-12 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
                      <div
                        className="absolute left-0 w-12 h-12 rounded-full ring-2 ring-amber-500 ring-offset-2 animate-pulse"
                        style={
                          { '--tw-ring-offset-color': 'var(--theme-bg)' } as React.CSSProperties
                        }
                      />
                    </>
                  )}

                  <button
                    onClick={() => handleStepClick(step, index)}
                    className={`
                      relative w-12 h-12 rounded-full flex items-center justify-center
                      transition-all duration-300 z-10
                      ${shakeStep === step.id ? 'animate-shake' : ''}
                      ${isAnimating ? 'animate-pulse-once' : ''}
                      ${state !== 'locked' && state !== 'current' ? 'hover:scale-105' : ''}
                    `}
                    style={{
                      background:
                        state === 'current'
                          ? 'linear-gradient(to bottom right, #f59e0b, #d97706)'
                          : state === 'completed'
                            ? 'var(--theme-bg)'
                            : state === 'locked'
                              ? 'var(--theme-bg)'
                              : 'var(--theme-bg)',
                      border:
                        state === 'completed'
                          ? '2px solid #f59e0b'
                          : state === 'locked'
                            ? '1px solid rgba(245, 158, 11, 0.2)'
                            : '1px solid rgba(245, 158, 11, 0.3)',
                      boxShadow:
                        state === 'current'
                          ? '0 10px 25px rgba(245, 158, 11, 0.5)'
                          : state === 'completed'
                            ? '0 4px 6px rgba(0, 0, 0, 0.1)'
                            : 'none',
                    }}
                    disabled={state === 'locked'}
                  >
                    {/* Main icon */}
                    {state === 'saving' ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : state === 'locked' ? (
                      <Lock
                        className="w-5 h-5"
                        style={{ color: 'var(--theme-text-secondary)', opacity: 0.5 }}
                      />
                    ) : (
                      <Icon
                        className="w-5 h-5"
                        style={{
                          color:
                            state === 'current'
                              ? '#ffffff'
                              : state === 'completed'
                                ? '#f59e0b'
                                : 'var(--theme-text-secondary)',
                        }}
                      />
                    )}
                  </button>

                  {/* Tooltip on hover */}
                  <div
                    className="absolute left-16 ml-2 px-3 py-2 rounded-lg backdrop-blur-sm whitespace-nowrap pointer-events-none transition-all duration-200 opacity-0 group-hover:opacity-100 group-hover:translate-x-2"
                    style={{
                      background: 'rgba(var(--theme-bg-rgb), 0.95)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                    }}
                  >
                    <div className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                      {step.label}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}
