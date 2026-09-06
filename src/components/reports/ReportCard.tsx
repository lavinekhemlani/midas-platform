'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface ReportCardProps {
  title?: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  variant?: 'default' | 'glass' | 'bordered' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'default'
}

export function ReportCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  variant = 'glass',
  padding = 'md',
}: ReportCardProps) {
  const variantClasses = {
    default: '',
    glass: 'glass-luxury-card',
    bordered: 'border border-gray-200 dark:border-gray-800',
    elevated: 'shadow-lg',
  }

  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
    default: '', // Uses Card component's default px-6 padding
  }

  return (
    <Card className={cn(variantClasses[variant], className)}>
      {(title || description) && (
        <CardHeader
          className={cn(
            padding === 'none' ? 'p-0' : '',
            padding === 'sm' ? 'p-3 pb-2' : '',
            padding === 'md' ? 'pb-3' : '',
            padding === 'lg' ? 'pb-6' : '',
            padding === 'default' ? '' : '' // Uses default CardHeader styling
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {title && (
                <CardTitle className="flex items-center ">
                  {Icon && <Icon className=" text-muted-foreground" />}
                  {title}
                </CardTitle>
              )}
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent
        className={cn(
          paddingClasses[padding],
          !title && !description && padding !== 'none' ? paddingClasses[padding] : ''
        )}
      >
        {children}
      </CardContent>
    </Card>
  )
}
