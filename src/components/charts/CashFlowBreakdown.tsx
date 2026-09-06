'use client'

import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'

interface CashFlowLineItem {
  item: string
  amount: number
  isSubItem?: boolean
}

interface CashFlowSection {
  title: string
  items: CashFlowLineItem[]
  total: number
  color: 'emerald' | 'green' | 'amber' | 'blue' | 'red' | 'gray'
}

interface CashFlowBreakdownProps {
  sections: CashFlowSection[]
  currency?: string
  title?: string
}

const CashFlowBreakdown: React.FC<CashFlowBreakdownProps> = ({
  sections,
  currency = 'USD',
  title = 'Cash Flow Details',
}) => {
  const { theme } = useTheme()
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(sections.map((s) => s.title))
  )

  // Theme-reactive color classes with less saturated colors
  const getColorClasses = (color: 'emerald' | 'green' | 'amber' | 'blue' | 'red' | 'gray') => {
    // Normalize color aliases
    const normalizedColor = color === 'green' ? 'emerald' : color === 'gray' ? 'blue' : color
    const isDark = theme === 'dark' || theme === 'dark'
    const isLight = theme === 'light'

    const colorMap = {
      emerald: {
        header: 'border-emerald-500/20',
        text: isDark ? 'text-emerald-400' : isLight ? 'text-emerald-600' : 'text-emerald-400',
        border: isDark
          ? 'border-emerald-500/10'
          : isLight
            ? 'border-emerald-500/20'
            : 'border-emerald-500/10',
      },
      amber: {
        header: 'border-amber-500/20',
        text: isDark ? 'text-amber-400' : isLight ? 'text-amber-600' : 'text-amber-400',
        border: isDark
          ? 'border-amber-500/10'
          : isLight
            ? 'border-amber-500/20'
            : 'border-amber-500/10',
      },
      blue: {
        header: 'border-blue-500/20',
        text: isDark ? 'text-blue-400' : isLight ? 'text-blue-600' : 'text-blue-400',
        border: isDark
          ? 'border-blue-500/10'
          : isLight
            ? 'border-blue-500/20'
            : 'border-blue-500/10',
      },
      red: {
        header: 'border-red-500/20',
        text: isDark ? 'text-red-400' : isLight ? 'text-red-600' : 'text-red-400',
        border: isDark ? 'border-red-500/10' : isLight ? 'border-red-500/20' : 'border-red-500/10',
      },
    }

    return colorMap[normalizedColor] || colorMap.blue
  }

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  return (
    <div className="space-y-0">
      {sections.length > 0 && (
        <h3 className="text-base font-semibold theme-text-primary mb-3 px-4">{title}</h3>
      )}

      {sections.map((section, sectionIndex) => {
        const isExpanded = expandedSections.has(section.title)
        const colors = getColorClasses(section.color)
        const isFirst = sectionIndex === 0
        const isLast = sectionIndex === sections.length - 1

        return (
          <div
            key={section.title}
            className={`border-t ${colors.border} ${isLast ? 'border-b' : ''}`}
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.title)}
              className={`w-full px-4 py-3 flex items-center justify-between ${isExpanded ? `border-b ${colors.header}` : ''} hover:bg-accent/5 transition-all`}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className={`w-3.5 h-3.5 theme-text-secondary`} />
                ) : (
                  <ChevronRight className={`w-3.5 h-3.5 theme-text-secondary`} />
                )}
                <span className={`font-medium text-sm ${colors.text}`}>{section.title}</span>
              </div>
              <span className={`font-semibold text-sm ${colors.text}`}>
                {formatCurrency(section.total, { currency })}
              </span>
            </button>

            {/* Section Items */}
            {isExpanded && section.items.length > 0 && (
              <div className="divide-y divide-border/30">
                {section.items.map((item, idx) => (
                  <div
                    key={`${item.item}-${idx}`}
                    className={`flex items-center justify-between px-4 py-2 transition-colors ${
                      theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <span
                      className={`text-sm theme-text-secondary ${item.isSubItem ? 'pl-6' : ''}`}
                    >
                      {item.item}
                    </span>
                    <span
                      className={`text-sm text-right font-mono ${
                        item.amount < 0
                          ? theme === 'light'
                            ? 'text-red-600'
                            : 'text-red-400'
                          : 'theme-text-primary'
                      }`}
                    >
                      {formatCurrency(item.amount, { currency })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {isExpanded && section.items.length === 0 && (
              <div className="px-4 py-6 text-center text-sm theme-text-secondary">
                No line items available
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default CashFlowBreakdown
