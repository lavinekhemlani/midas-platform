import React from 'react'
import { Button, buttonVariants } from './button'
import { LoadingSpinner } from './loading-spinner'
import { cn } from '@/lib/utils'
import { type VariantProps } from 'class-variance-authority'

export interface ButtonLoaderProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Whether the button is in a loading state
   */
  loading?: boolean
  /**
   * Text to display when loading (defaults to "Loading...")
   */
  loadingText?: string
  /**
   * Icon to display when not loading
   */
  icon?: React.ReactNode
  /**
   * Position of the icon/spinner
   */
  iconPosition?: 'left' | 'right'
}

/**
 * Button component with built-in loading state.
 * Automatically handles disabled state and shows spinner when loading.
 */
export const ButtonLoader = React.forwardRef<HTMLButtonElement, ButtonLoaderProps>(
  (
    {
      children,
      loading = false,
      loadingText = 'Loading...',
      disabled,
      icon,
      iconPosition = 'left',
      className,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    const content = loading ? loadingText : children

    const iconElement = loading ? (
      <LoadingSpinner size="sm" inline />
    ) : icon ? (
      <span className={cn(iconPosition === 'left' ? 'mr-2' : 'ml-2', 'inline-flex')}>{icon}</span>
    ) : null

    return (
      <Button
        ref={ref}
        disabled={isDisabled}
        className={cn('relative', loading && 'cursor-not-allowed', className)}
        {...props}
      >
        {iconPosition === 'left' && iconElement}
        {content}
        {iconPosition === 'right' && iconElement}
      </Button>
    )
  }
)

ButtonLoader.displayName = 'ButtonLoader'

/**
 * Icon button variant with loading state.
 * Shows only spinner when loading, no text.
 */
export const IconButtonLoader = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonLoaderProps, 'loadingText' | 'iconPosition'>
>(({ children, loading = false, disabled, className, ...props }, ref) => {
  return (
    <Button ref={ref} disabled={disabled || loading} className={cn('p-2', className)} {...props}>
      {loading ? <LoadingSpinner size="sm" /> : children}
    </Button>
  )
})

IconButtonLoader.displayName = 'IconButtonLoader'
