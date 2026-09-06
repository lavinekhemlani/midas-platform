// src/components/ui/CleanMetricSelector.tsx
'use client'

import React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'
import { FINANCIAL_METRICS, getMetricsByCategory } from '@/lib/data/financialMetrics'
import { cn } from '@/lib/utils'

interface CleanMetricSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  label?: string
  placeholder?: string
  recommended?: boolean
  disabled?: boolean
  className?: string
  compact?: boolean
}

export default function CleanMetricSelector({
  value,
  onValueChange,
  label,
  placeholder = 'Select a metric',
  recommended = false,
  disabled = false,
  className,
  compact = false,
}: CleanMetricSelectorProps) {
  const categories = [
    { key: 'liquidity', label: 'Liquidity' },
    { key: 'profitability', label: 'Profitability' },
    { key: 'efficiency', label: 'Efficiency' },
    { key: 'leverage', label: 'Leverage & Returns' },
  ]

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-2">
          <label className="text-sm font-medium theme-text-primary">
            {label}
            {recommended && (
              <span className="ml-2 text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-medium">
                Recommended
              </span>
            )}
          </label>
        </div>
      )}

      <SelectPrimitive.Root value={value || ''} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex w-full items-center justify-between rounded-sm border bg-transparent text-sm theme-text-primary placeholder:theme-text-secondary focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-50',
            'data-[placeholder]:theme-text-secondary hover:border-amber-500/40 transition-all duration-200',
            compact
              ? 'h-9 px-3 py-2 border-amber-500/20 font-medium'
              : 'h-14 px-4 py-3 border-2 border-amber-500/30 font-semibold focus:border-amber-500/70'
          )}
          style={compact ? { backgroundColor: 'var(--theme-bg)' } : undefined}
        >
          <div className="flex-1 text-left">
            <SelectPrimitive.Value
              placeholder={placeholder}
              className="block truncate whitespace-nowrap overflow-hidden text-ellipsis"
            />
          </div>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={cn(
              'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-sm metric-selector-dropdown border-2 border-amber-500/30 shadow-lg',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
              'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
            )}
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="p-1 max-h-[384px] overflow-y-auto w-full min-w-[var(--radix-select-trigger-width)]">
              {categories.map((category, index) => {
                const categoryMetrics = getMetricsByCategory(category.key)
                if (categoryMetrics.length === 0) return null

                return (
                  <React.Fragment key={category.key}>
                    {index > 0 && (
                      <SelectPrimitive.Separator className="-mx-1 my-1 h-px bg-amber-500/20" />
                    )}

                    <SelectPrimitive.Group>
                      <SelectPrimitive.Label className="py-2 pl-4 pr-2 text-xs font-semibold uppercase tracking-wider theme-text-secondary">
                        {category.label}
                      </SelectPrimitive.Label>

                      {categoryMetrics.map((metric) => (
                        <SelectPrimitive.Item
                          key={metric.id}
                          value={metric.id}
                          className={cn(
                            'relative flex w-full cursor-default select-none items-center rounded-sm py-2.5 px-4 text-sm font-medium outline-none',
                            'focus:bg-amber-500/10 focus:text-amber-400 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                            'theme-text-primary hover:bg-amber-500/10 transition-colors'
                          )}
                        >
                          <SelectPrimitive.ItemText>{metric.name}</SelectPrimitive.ItemText>
                        </SelectPrimitive.Item>
                      ))}
                    </SelectPrimitive.Group>
                  </React.Fragment>
                )
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  )
}
