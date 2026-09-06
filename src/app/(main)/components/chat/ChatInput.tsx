// src/app/(main)/components/chat/ChatInput.tsx
'use client'

import { cn } from '@/lib/utils'
import { ArrowUp, Square } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

interface ChatInputProps {
  onSend: (message: string, displayContent?: string) => void
  onCancel: () => void
  loading: boolean
}

export const ChatInput = memo(function ChatInput({ onSend, onCancel, loading }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || loading) return

    const userInput = inputValue.trim()
    setInputValue('')

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    onSend(userInput)
  }, [inputValue, loading, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    // Auto-resize textarea with smooth transition
    const target = e.target
    target.style.height = 'auto'
    const newHeight = Math.min(target.scrollHeight, 160)
    target.style.height = `${newHeight}px`
  }, [])

  const handleCancel = useCallback(() => {
    onCancel()
  }, [onCancel])

  // Focus input on mount and after sending
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [loading])

  const canSend = inputValue.trim().length > 0 && !loading

  return (
    <div className="chat-input-wrapper">
      {/* Floating Container */}
      <div
        ref={containerRef}
        className={cn(
          'chat-input-container',
          isFocused && 'chat-input-container--focused',
          loading && 'chat-input-container--loading'
        )}
      >
        {/* Main Input Area */}
        <div className="chat-input-main">
          {/* Text Input */}
          <div className="chat-input-field-wrapper">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask about your finances..."
              disabled={loading}
              rows={1}
              className="chat-input-field"
              aria-label="Message input"
              aria-describedby="chat-input-help"
            />
            <span id="chat-input-help" className="sr-only">
              Press Enter to send, Shift+Enter for new line
            </span>
          </div>

          {/* Right Actions */}
          <div className="chat-input-actions-right">
            {loading ? (
              <button
                type="button"
                onClick={handleCancel}
                className="chat-input-stop-btn"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square className="w-3.5 h-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'chat-input-send-btn',
                  canSend && 'chat-input-send-btn--active',
                  isFocused && 'chat-input-send-btn--focused'
                )}
                title="Send message"
                aria-label="Send message"
              >
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
