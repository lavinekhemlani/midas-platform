import { cn } from '@/lib/utils'
import { LoadingSpinner } from './loading-spinner'

export type LoadingMessageVariant = 'default' | 'inline' | 'subtle'

interface LoadingMessageProps {
  /**
   * The loading message to display
   */
  message: string
  /**
   * Visual variant of the loading message
   */
  variant?: LoadingMessageVariant
  /**
   * Whether to show a spinner alongside the message
   */
  showSpinner?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Standardized loading message component.
 * Ensures consistent loading message display across the app.
 */
export function LoadingMessage({
  message,
  variant = 'default',
  showSpinner = true,
  className,
}: LoadingMessageProps) {
  const variantClasses = {
    default: 'text-sm theme-text-secondary',
    inline: 'text-sm theme-text-primary inline-flex items-center',
    subtle: 'text-xs theme-text-tertiary',
  }

  return (
    <div className={cn(variantClasses[variant], className)} role="status" aria-live="polite">
      {showSpinner && (
        <LoadingSpinner size={variant === 'subtle' ? 'xs' : 'sm'} inline={variant === 'inline'} />
      )}
      <span>{message}</span>
    </div>
  )
}

/**
 * Progressive loading messages that change over time.
 * Use for long-running operations to keep users engaged.
 */
interface ProgressiveLoadingMessageProps {
  messages: string[]
  /**
   * Duration in ms for each message
   */
  interval?: number
  variant?: LoadingMessageVariant
  className?: string
}

export function ProgressiveLoadingMessage({
  messages,
  interval = 2000,
  variant = 'default',
  className,
}: ProgressiveLoadingMessageProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0)

  React.useEffect(() => {
    if (messages.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length)
    }, interval)

    return () => clearInterval(timer)
  }, [messages, interval])

  return <LoadingMessage message={messages[currentIndex]} variant={variant} className={className} />
}

import React from 'react'
