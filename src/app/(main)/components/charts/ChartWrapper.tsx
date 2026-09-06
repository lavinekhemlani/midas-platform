// src/app/(main)/components/ChartWrapper.tsx
'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ChartWrapperProps {
  title?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  isLoading?: boolean
  error?: string | null
  height?: number | string
  actions?: ReactNode
}

export function ChartWrapper({
  title,
  icon,
  children,
  className,
  isLoading = false,
  error = null,
  height = 400,
  actions
}: ChartWrapperProps) {
  return (
    <Card className={cn("chart-container", className)}>
      {(title || actions) && (
        <CardHeader className="pb-4">
          {title && (
            <CardTitle className="chart-title">
              {icon}
              {title}
            </CardTitle>
          )}
          {actions && (
            <div className="ml-auto">{actions}</div>
          )}
        </CardHeader>
      )}
      <CardContent>
        <div style={{ height, position: 'relative' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
                <p className="text-sm theme-text-secondary">Loading data...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-4">
                <p className="text-sm text-red-400 mb-2">Error loading chart</p>
                <p className="text-xs theme-text-secondary">{error}</p>
              </div>
            </div>
          )}
          
          {!isLoading && !error && children}
        </div>
      </CardContent>
    </Card>
  )
}