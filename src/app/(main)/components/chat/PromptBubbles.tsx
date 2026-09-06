// src/app/(main)/components/chat/PromptBubbles.tsx
// Renders suggestion pills for follow-ups, clarifications, and starters
// Unified gold glow design across all variants
'use client'

import { cn } from '@/lib/utils'
import { memo, useState } from 'react'
import { ArrowRight } from 'lucide-react'

export interface Suggestion {
  label: string
  prompt: string
  type?: string // 'follow_up' | 'drill_down' | 'compare' | 'clarify'
}

interface PromptBubblesProps {
  suggestions: Suggestion[]
  onSelect: (prompt: string, label: string) => void
  variant: 'inline' | 'input-bar' // inline = in message, input-bar = starters at top
  disabled?: boolean
}

export const PromptBubbles = memo(function PromptBubbles({
  suggestions,
  onSelect,
  variant,
  disabled = false,
}: PromptBubblesProps) {
  const [selected, setSelected] = useState(false)

  if (!suggestions || suggestions.length === 0) return null

  // Hide entirely once user has picked a suggestion
  if (selected) return null

  const clarifications = suggestions.filter((s) => s.type === 'clarify')
  const followUps = suggestions.filter((s) => s.type !== 'clarify')

  const handleSelect = (suggestion: Suggestion) => {
    if (disabled || selected) return
    setSelected(true)
    onSelect(suggestion.prompt, suggestion.label)
  }

  if (variant === 'inline') {
    // Inline variant: gold glow bubbles under assistant messages
    return (
      <div className="mt-4 space-y-2.5">
        {clarifications.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {clarifications.map((suggestion, idx) => (
              <button
                key={`clarify-${idx}`}
                onClick={() => handleSelect(suggestion)}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-xl',
                  'border transition-all duration-300',
                  disabled
                    ? 'opacity-25 cursor-not-allowed border-zinc-700/20 text-zinc-600'
                    : 'border-amber-400/30 bg-amber-400/[0.08] text-amber-300 hover:bg-amber-400/[0.16] hover:border-amber-300/50 hover:text-amber-200 hover:shadow-[0_0_18px_rgba(251,191,36,0.3)] cursor-pointer'
                )}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
        {followUps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {followUps.map((suggestion, idx) => (
              <button
                key={`follow-${idx}`}
                onClick={() => handleSelect(suggestion)}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-xl',
                  'border transition-all duration-300',
                  disabled
                    ? 'opacity-25 cursor-not-allowed border-zinc-700/20 text-zinc-600'
                    : 'border-amber-400/25 bg-amber-400/[0.06] text-amber-300/90 hover:bg-amber-400/[0.14] hover:border-amber-300/45 hover:text-amber-200 hover:shadow-[0_0_16px_rgba(251,191,36,0.25)] cursor-pointer'
                )}
              >
                {suggestion.label}
                <ArrowRight className="w-3 h-3 opacity-50" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Input-bar / starter variant: same gold glow design, rendered at top of chat
  return (
    <div className="flex flex-wrap gap-2 px-1">
      {suggestions.map((suggestion, idx) => (
        <button
          key={`starter-${idx}`}
          onClick={() => handleSelect(suggestion)}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-xl',
            'border transition-all duration-300',
            disabled
              ? 'opacity-25 cursor-not-allowed border-zinc-700/20 text-zinc-600'
              : 'border-amber-400/25 bg-amber-400/[0.06] text-amber-300/90 hover:bg-amber-400/[0.14] hover:border-amber-300/45 hover:text-amber-200 hover:shadow-[0_0_16px_rgba(251,191,36,0.25)] cursor-pointer'
          )}
        >
          {suggestion.label}
          <ArrowRight className="w-3 h-3 opacity-50" />
        </button>
      ))}
    </div>
  )
})

PromptBubbles.displayName = 'PromptBubbles'
