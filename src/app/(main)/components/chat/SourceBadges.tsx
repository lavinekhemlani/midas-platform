// src/app/(main)/components/chat/SourceBadges.tsx
// Renders data source badges on assistant messages to show which providers were queried
'use client'

import { cn } from '@/lib/utils'
import { memo } from 'react'

interface Source {
  provider: string
  tool: string
  report?: string
  entityName?: string
}

interface SourceBadgesProps {
  sources: Source[]
  className?: string
}

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  quickbooks: {
    label: 'QuickBooks',
    color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/25',
  },
  dynamics: {
    label: 'Business Central',
    color: 'bg-blue-500/15 text-blue-500 border-blue-500/20 hover:bg-blue-500/25',
  },
}

function formatReport(report?: string): string {
  if (!report) return ''
  return report.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const SourceBadges = memo(function SourceBadges({ sources, className }: SourceBadgesProps) {
  if (!sources || sources.length === 0) return null

  // Deduplicate by provider:entity:report combination
  // Include entityName so multiple companies under the same provider each get a badge
  const seen = new Set<string>()
  const unique = sources.filter((s) => {
    const key = `${s.provider}:${s.entityName || ''}:${s.report || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return (
    <div className={cn('flex flex-wrap gap-1.5 mt-2', className)}>
      {unique.map((source, idx) => {
        const meta = PROVIDER_META[source.provider] || {
          label: source.provider,
          color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/25',
        }
        // Use entity name (e.g. "Aquaculture") when available, fallback to provider name
        const displayLabel = source.entityName || meta.label
        const reportLabel = formatReport(source.report)
        // Tooltip shows full context: "Aquaculture (Business Central) — Profit Loss"
        const providerNote = source.entityName ? ` (${meta.label})` : ''
        const tooltip = reportLabel
          ? `${displayLabel}${providerNote} \u2014 ${reportLabel}`
          : `${displayLabel}${providerNote}`

        return (
          <span
            key={`source-${idx}`}
            title={tooltip}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border',
              'transition-colors duration-200 cursor-default',
              meta.color
            )}
          >
            {displayLabel}
            {reportLabel && (
              <>
                <span className="opacity-40">&middot;</span>
                {reportLabel}
              </>
            )}
          </span>
        )
      })}
    </div>
  )
})

SourceBadges.displayName = 'SourceBadges'
