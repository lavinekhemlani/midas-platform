'use client'

import { cn } from '@/lib/utils'

interface LegendItem {
  name: string
  color: string
}

interface ChartLegendProps {
  items: LegendItem[]
  selected: Record<string, boolean>
  onToggle: (name: string) => void
  className?: string
}

export function ChartLegend({ items, selected, onToggle, className }: ChartLegendProps) {
  return (
    <div className={cn('flex flex-wrap gap-4 justify-center pt-2', className)}>
      {items.map((item) => {
        // Default to selected (true) if not explicitly set in the selected object
        const isSelected = selected[item.name] !== false
        return (
          <button
            key={item.name}
            type="button"
            onClick={() => onToggle(item.name)}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {/* Radio-style indicator with dot */}
            <div
              className="w-3.5 h-3.5 border-2 rounded-full flex items-center justify-center"
              style={{ borderColor: item.color }}
            >
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              )}
            </div>
            {/* Label - always visible */}
            <span className="text-sm theme-text-secondary">{item.name}</span>
          </button>
        )
      })}
    </div>
  )
}
