'use client'

import { usePIIMode } from '@/hooks/usePIIMode'
import { cn } from '@/lib/utils'

interface PIITextProps {
  children: React.ReactNode
  className?: string
  /** If true, uses a placeholder instead of blur effect */
  usePlaceholder?: boolean
  /** Custom placeholder text when usePlaceholder is true */
  placeholder?: string
}

/**
 * Component that blurs its content when PII protection mode is enabled.
 * Use this for sensitive data like company names, customer names, etc.
 */
export function PIIText({
  children,
  className,
  usePlaceholder = false,
  placeholder = '••••••••',
}: PIITextProps) {
  const isPIIMode = usePIIMode()

  if (!isPIIMode) {
    return <span className={className}>{children}</span>
  }

  if (usePlaceholder) {
    return <span className={cn('text-slate-400', className)}>{placeholder}</span>
  }

  return (
    <span
      className={cn('select-none', className)}
      style={{
        filter: 'blur(6px)',
        WebkitFilter: 'blur(6px)',
      }}
    >
      {children}
    </span>
  )
}
