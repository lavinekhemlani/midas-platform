// src/components/learn/core/TermCard.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Star, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { GlossaryEntry } from '@/lib/data'

interface TermCardProps {
  term: GlossaryEntry
  className?: string
  variant?: 'grid' | 'list'
}

// Simplified category colors
const categoryColors: Record<string, string> = {
  fundamentals: 'text-blue-500',
  growth: 'text-emerald-500',
  'cash flow': 'text-purple-500',
  fundraising: 'text-orange-500',
  operations: 'text-amber-500',
}

export function TermCard({ term, className, variant = 'grid' }: TermCardProps) {
  const difficultyStars = Array.from({ length: 5 }, (_, i) => i < term.difficulty)
  const accentColor = categoryColors[term.category.toLowerCase()] || 'text-slate-500'

  if (variant === 'list') {
    return (
      <Link href={`/learn/${term.id}`} className="block group">
        <div
          className={`learn-term-card-list relative overflow-hidden rounded-lg transition-all duration-200 ${className || ''}`}
        >
          <div className="flex items-center gap-4 p-3.5">
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-sm font-medium theme-text-primary group-hover:text-[var(--theme-purple)] transition-colors">
                  {term.title}
                </h3>
                <span className={`text-[10px] font-medium uppercase tracking-wide ${accentColor}`}>
                  {term.category}
                </span>
              </div>
              <p className="text-xs theme-text-secondary line-clamp-1">{term.definitions.basic}</p>
            </div>

            {/* Difficulty */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {difficultyStars.map((filled, index) => (
                <Star
                  key={index}
                  className={`w-2.5 h-2.5 ${
                    filled ? 'text-amber-500 fill-amber-500' : 'text-gray-300 dark:text-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Arrow */}
            <ChevronRight className="w-4 h-4 theme-text-secondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/learn/${term.id}`} className="block group">
      <Card
        className={`learn-term-card border border-[var(--theme-card-border)] hover:border-[rgba(255,255,255,0.12)] transition-all duration-200 ${className || ''}`}
      >
        <CardContent className="p-4">
          {/* Header: Category + Difficulty */}
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${accentColor}`}>
              {term.category}
            </span>
            <div className="flex items-center gap-0.5">
              {difficultyStars.map((filled, index) => (
                <Star
                  key={index}
                  className={`w-2.5 h-2.5 ${
                    filled ? 'text-amber-500 fill-amber-500' : 'text-gray-300 dark:text-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold theme-text-primary mb-1.5 group-hover:text-[var(--theme-purple)] transition-colors">
            {term.title}
          </h3>

          {/* Description */}
          <p className="text-sm theme-text-secondary leading-relaxed line-clamp-2 mb-3">
            {term.definitions.basic}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-[var(--theme-card-border)]">
            {term.relatedTerms.length > 0 && (
              <span className="text-[10px] theme-text-secondary">
                {term.relatedTerms.length} related
              </span>
            )}
            <ChevronRight className="w-4 h-4 theme-text-secondary opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
