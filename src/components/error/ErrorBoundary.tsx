'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: unknown[]
  componentName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Generic React Error Boundary component
 * Catches JavaScript errors in child component tree and displays fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught error', {
      component: this.props.componentName || 'Unknown',
      error: error.message,
      stack: errorInfo.componentStack,
    })

    this.props.onError?.(error, errorInfo)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasKeyChanged = prevProps.resetKeys?.some((key, i) => key !== this.props.resetKeys?.[i])
      if (hasKeyChanged) {
        this.reset()
      }
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-red-800 dark:text-red-200">Something went wrong</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1 break-words">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={this.reset}
                className="mt-2 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Try again
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
