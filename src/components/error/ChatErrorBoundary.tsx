'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { AlertCircle, MessageSquare, RefreshCw } from 'lucide-react'

interface ChatErrorBoundaryProps {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  messagesCount?: number
}

interface ChatErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Chat-specific Error Boundary
 * Provides chat-friendly error UI with conversation continuation option
 * Auto-resets when messages count changes (new messages added)
 */
export class ChatErrorBoundary extends Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ChatErrorBoundary caught error', {
      component: 'Chat',
      error: error.message,
      stack: errorInfo.componentStack,
    })

    this.props.onError?.(error, errorInfo)
  }

  componentDidUpdate(prevProps: ChatErrorBoundaryProps) {
    // Auto-reset when messages count changes (user sent a new message)
    if (
      this.state.hasError &&
      this.props.messagesCount !== undefined &&
      prevProps.messagesCount !== this.props.messagesCount
    ) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-full p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Chat Display Error
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md">
            {this.state.error?.message || 'Something went wrong while displaying the chat.'}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={this.reset}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                this.reset()
                // Optionally scroll to bottom to continue conversation
              }}
              className="flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Continue Conversation
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ChatErrorBoundary
