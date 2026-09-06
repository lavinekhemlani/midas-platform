import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const alertVariants = cva('relative w-full rounded-lg border p-4', {
  variants: {
    variant: {
      default: 'bg-background text-foreground',
      destructive:
        'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
      success:
        'border-green-500/50 bg-green-500/10 text-green-900 dark:text-green-100 [&>svg]:text-green-600',
      warning:
        'border-amber-400/50 text-amber-700 dark:text-amber-200 [&>svg]:text-amber-500 dark:[&>svg]:text-amber-200',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  )
)
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
