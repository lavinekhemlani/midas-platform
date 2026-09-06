import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface LoadingSpinnerProps {
  size?: SpinnerSize
  className?: string
  /**
   * Show the spinner inline with text
   */
  inline?: boolean
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
}

/**
 * Unified loading spinner component using Loader2 from lucide-react.
 * This should be used everywhere in the app instead of custom spinners.
 */
export function LoadingSpinner({ size = 'sm', className, inline = false }: LoadingSpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin', sizeClasses[size], inline && 'inline mr-2', className)}
      aria-label="Loading"
    />
  )
}

/**
 * Centered loading spinner with optional message.
 * Use this for full-page or card-level loading states.
 */
interface CenteredSpinnerProps extends LoadingSpinnerProps {
  message?: string
  minHeight?: string | number
}

export function CenteredSpinner({
  message,
  minHeight = 400,
  size = 'lg',
  className,
}: CenteredSpinnerProps) {
  const minHeightValue = typeof minHeight === 'number' ? `${minHeight}px` : minHeight

  return (
    <div
      className={cn('flex flex-col items-center justify-center', className)}
      style={{ minHeight: minHeightValue }}
    >
      <LoadingSpinner size={size} className="text-amber-500" />
      {message && <p className="mt-4 text-sm theme-text-secondary">{message}</p>}
    </div>
  )
}
