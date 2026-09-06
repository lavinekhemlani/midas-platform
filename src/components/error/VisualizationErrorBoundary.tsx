'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react'

interface VisualizationErrorBoundaryProps {
  children: ReactNode
  chartType?: string
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface VisualizationErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Visualization-specific Error Boundary
 * Shows a placeholder chart on error instead of crashing the entire UI
 */
export class VisualizationErrorBoundary extends Component<
  VisualizationErrorBoundaryProps,
  VisualizationErrorBoundaryState
> {
  constructor(props: VisualizationErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): VisualizationErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('VisualizationErrorBoundary caught error', {
      component: 'Visualization',
      chartType: this.props.chartType || 'unknown',
      error: error.message,
      stack: errorInfo.componentStack,
    })

    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
          {/* Placeholder chart icon */}
          <div className="relative mb-4">
            <BarChart3 className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            <div className="absolute -top-1 -right-1 bg-amber-100 dark:bg-amber-900/50 rounded-full p-1">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Chart failed to render
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-xs text-center">
            {this.props.chartType
              ? `Unable to display ${this.props.chartType} chart`
              : 'Unable to display visualization'}
          </p>

          <Button
            variant="ghost"
            size="sm"
            onClick={this.reset}
            className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

export default VisualizationErrorBoundary
