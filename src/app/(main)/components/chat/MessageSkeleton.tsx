'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface MessageSkeletonProps {
  role: 'user' | 'assistant'
  /** Number of content lines to show */
  lines?: number
  /** Show avatar for assistant messages */
  showAvatar?: boolean
}

/**
 * Skeleton placeholder for loading chat messages
 * Mimics the ChatMessage layout for consistent visual appearance
 */
export function MessageSkeleton({ role, lines = 2, showAvatar = true }: MessageSkeletonProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('flex gap-3', isUser ? 'flex-row-reverse ml-4' : 'flex-row')}
        style={{
          maxWidth: isUser ? '70%' : '100%',
          width: isUser ? undefined : '100%',
        }}
      >
        {/* Avatar skeleton for assistant messages */}
        {!isUser && showAvatar && <Skeleton className="w-8 h-8 rounded-full shrink-0" />}

        {/* Message content skeleton */}
        <div
          className={cn(
            'space-y-2',
            isUser ? 'chat-message-user rounded-lg p-3' : 'chat-message-assistant flex-1'
          )}
        >
          {/* Generate skeleton lines with varying widths */}
          {Array.from({ length: lines }, (_, i) => {
            // Vary the widths for more natural appearance
            const widths = isUser ? ['w-32', 'w-24', 'w-28'] : ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6']
            const width = widths[i % widths.length]

            return (
              <Skeleton
                key={i}
                className={cn('h-4', width)}
                style={{
                  animationDelay: `${i * 75}ms`,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Multiple message skeletons for initial chat loading
 */
export function ChatHistorySkeleton({ messageCount = 4 }: { messageCount?: number }) {
  // Alternate between user and assistant messages
  const messages = Array.from({ length: messageCount }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : ('assistant' as 'user' | 'assistant'),
    lines: i % 2 === 0 ? 1 : Math.floor(Math.random() * 2) + 2,
  }))

  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading chat history">
      {messages.map((msg, i) => (
        <MessageSkeleton
          key={i}
          role={msg.role}
          lines={msg.lines}
          showAvatar={msg.role === 'assistant'}
        />
      ))}
    </div>
  )
}

export default MessageSkeleton
