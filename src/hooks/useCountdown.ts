/**
 * useCountdown Hook
 * Provides a countdown timer for rate limit and retry scenarios
 */

import { useEffect, useState, useCallback, useRef } from 'react'

interface UseCountdownOptions {
  /** Callback when countdown reaches zero */
  onComplete?: () => void
  /** Whether to auto-start the countdown */
  autoStart?: boolean
}

interface UseCountdownReturn {
  /** Remaining seconds */
  remaining: number
  /** Whether countdown is active */
  isActive: boolean
  /** Start or restart the countdown */
  start: (seconds: number) => void
  /** Stop the countdown */
  stop: () => void
  /** Reset to initial value without starting */
  reset: (seconds: number) => void
  /** Formatted time string (e.g., "1:30") */
  formatted: string
}

/**
 * Countdown timer hook
 *
 * @param initialSeconds - Initial countdown value in seconds
 * @param options - Configuration options
 * @returns Countdown state and controls
 *
 * @example
 * // Basic usage
 * const { remaining, isActive } = useCountdown(error?.retryAfter)
 *
 * @example
 * // With callback
 * const { remaining, start } = useCountdown(0, {
 *   onComplete: () => handleRetry()
 * })
 */
export function useCountdown(
  initialSeconds: number | undefined,
  options: UseCountdownOptions = {}
): UseCountdownReturn {
  const { onComplete, autoStart = true } = options

  const [remaining, setRemaining] = useState(initialSeconds || 0)
  const [isActive, setIsActive] = useState(false)

  // Format seconds as M:SS or S
  const formatted =
    remaining >= 60
      ? `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`
      : `${remaining}s`

  // Start the countdown
  const start = useCallback((seconds: number) => {
    setRemaining(Math.max(0, Math.floor(seconds)))
    setIsActive(true)
  }, [])

  // Stop the countdown
  const stop = useCallback(() => {
    setIsActive(false)
  }, [])

  // Reset without starting
  const reset = useCallback((seconds: number) => {
    setRemaining(Math.max(0, Math.floor(seconds)))
    setIsActive(false)
  }, [])

  // Auto-start when initialSeconds changes
  useEffect(() => {
    if (initialSeconds && initialSeconds > 0 && autoStart) {
      start(initialSeconds)
    }
  }, [initialSeconds, autoStart, start])

  // Stable ref for onComplete to avoid interval teardown on callback change
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Countdown effect — only depends on isActive, not remaining
  useEffect(() => {
    if (!isActive) return

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1
        if (next <= 0) {
          setIsActive(false)
          onCompleteRef.current?.()
          return 0
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive])

  return {
    remaining,
    isActive,
    start,
    stop,
    reset,
    formatted,
  }
}

export default useCountdown
