// src/app/(main)/reports/components/summary/FinancialHealthSettingsPopover.tsx
'use client'

import React, { useState, useRef } from 'react'
import { Loader2, RotateCcw, AlertTriangle, Settings } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CleanMetricSelector from '@/components/ui/CleanMetricSelector'
import {
  FINANCIAL_METRICS,
  getRecommendedMetrics,
  getDefaultTarget,
} from '@/lib/data/financialMetrics'
import { cn } from '@/lib/utils'

// Default metrics (must match SummaryView defaults)
const DEFAULT_METRICS = ['gross_margin', 'cash_runway', 'cash_flow', 'working_capital']

export interface MetricTarget {
  metric_id: string
  target: number
  unit: string
}

interface FinancialHealthSettingsPopoverProps {
  currentMetrics: string[]
  currentTargets: MetricTarget[]
  currentRevenueModel: string
  onSave: (metrics: string[], targets: MetricTarget[], revenueModel: string) => Promise<void>
  isSaving?: boolean
  isLoading?: boolean
  disabled?: boolean
}

export function FinancialHealthSettingsPopover({
  currentMetrics,
  currentTargets,
  currentRevenueModel,
  onSave,
  isSaving = false,
  isLoading = false,
  disabled = false,
}: FinancialHealthSettingsPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(currentMetrics)
  const [targets, setTargets] = useState<MetricTarget[]>(currentTargets)
  const [revenueModel, setRevenueModel] = useState<string>(currentRevenueModel)
  const [hasUserModified, setHasUserModified] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const lastProcessedRevenueModel = useRef<string>('')
  const prevOpenRef = useRef(false)
  const recommendedMetrics = getRecommendedMetrics(revenueModel)

  // Reset state when popover opens (not on every prop change while open)
  if (open && !prevOpenRef.current) {
    setSelectedMetrics(currentMetrics)
    setTargets(currentTargets)
    setRevenueModel(currentRevenueModel)
    setValidationError(null)
    setHasUserModified(false)
  }
  prevOpenRef.current = open

  const handleMetricChange = (index: number, value: string) => {
    const newMetrics = [...selectedMetrics]
    if (newMetrics[index] === value) return

    const oldValue = newMetrics[index]
    newMetrics[index] = value

    // Swap: if another slot has this value, give it our old value instead of clearing
    for (let i = 0; i < newMetrics.length; i++) {
      if (i !== index && newMetrics[i] === value) {
        newMetrics[i] = oldValue
      }
    }

    setSelectedMetrics(newMetrics)
    setHasUserModified(true)

    // Update targets
    const newTargets = newMetrics.filter(Boolean).map((metricId) => {
      const existingTarget = targets.find((t) => t.metric_id === metricId)
      if (existingTarget) return existingTarget

      const metric = FINANCIAL_METRICS.find((m) => m.id === metricId)
      return {
        metric_id: metricId,
        target: getDefaultTarget(metricId, revenueModel),
        unit: metric?.unit || 'currency',
      }
    })

    setTargets(newTargets)
  }

  const handleTargetChange = (metricId: string, value: string) => {
    if (value === '') {
      setTargets(targets.map((t) => (t.metric_id === metricId ? { ...t, target: NaN } : t)))
      return
    }

    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      setTargets(targets.map((t) => (t.metric_id === metricId ? { ...t, target: numValue } : t)))
    }
  }

  const handleRevenueModelChange = (value: string) => {
    setRevenueModel(value)
    const recommended = getRecommendedMetrics(value)
    if (recommended.length >= 4) {
      const newMetrics = recommended.slice(0, 4).map((m) => m.id)
      setSelectedMetrics(newMetrics)
      setHasUserModified(false)

      const newTargets = newMetrics.map((metricId) => {
        const metric = FINANCIAL_METRICS.find((m) => m.id === metricId)
        return {
          metric_id: metricId,
          target: getDefaultTarget(metricId, value),
          unit: metric?.unit || 'currency',
        }
      })
      setTargets(newTargets)
    }
  }

  const handleResetToDefaults = () => {
    setSelectedMetrics(DEFAULT_METRICS)
    setHasUserModified(false)
    const defaultTargets = DEFAULT_METRICS.map((metricId) => {
      const metric = FINANCIAL_METRICS.find((m) => m.id === metricId)
      return {
        metric_id: metricId,
        target: getDefaultTarget(metricId, revenueModel),
        unit: metric?.unit || 'currency',
      }
    })
    setTargets(defaultTargets)
  }

  const handleSubmit = async () => {
    setValidationError(null)

    const filledMetrics = selectedMetrics.filter(Boolean)

    if (filledMetrics.length !== 4) {
      setValidationError('Please select exactly 4 metrics.')
      return
    }

    const uniqueMetrics = new Set(filledMetrics)
    if (uniqueMetrics.size !== 4) {
      setValidationError('Please select 4 different metrics.')
      return
    }

    for (const metricId of filledMetrics) {
      const target = targets.find((t) => t.metric_id === metricId)
      if (!target || isNaN(target.target) || target.target < 0) {
        setValidationError('Please enter valid target values.')
        return
      }
    }

    try {
      await onSave(
        filledMetrics,
        targets.filter((t) => filledMetrics.includes(t.metric_id)),
        revenueModel
      )
      setOpen(false)
    } catch (error) {
      console.error('Error saving settings:', error)
      setValidationError(
        error instanceof Error
          ? `Failed to save: ${error.message}`
          : 'An unexpected error occurred.'
      )
    }
  }

  const getMetricUnit = (metricId: string): string => {
    const metric = FINANCIAL_METRICS.find((m) => m.id === metricId)
    return metric?.unit || 'currency'
  }

  const formatTargetSuffix = (unit: string): string => {
    switch (unit) {
      case '%':
        return '%'
      case 'months':
        return 'mo'
      case 'days':
        return 'd'
      case 'currency':
        return '$'
      case 'ratio':
        return ':1'
      default:
        return ''
    }
  }

  const hasChanges = () => {
    if (revenueModel !== currentRevenueModel) return true
    if (
      JSON.stringify(selectedMetrics.filter(Boolean).sort()) !==
      JSON.stringify(currentMetrics.sort())
    ) {
      return true
    }
    for (const target of targets) {
      const initialTarget = currentTargets.find((t) => t.metric_id === target.metric_id)
      if (!initialTarget || initialTarget.target !== target.target) {
        return true
      }
    }
    return false
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={isSaving || isLoading || disabled}
          className="w-5 h-5 p-0 hover:bg-theme-purple/10 disabled:opacity-50"
        >
          <Settings
            className={cn(
              'w-3.5 h-3.5 theme-text-secondary hover:text-theme-purple transition-colors',
              isSaving && 'animate-spin'
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[420px] p-0 border-amber-500/20 shadow-2xl"
        style={{
          backgroundColor: 'var(--theme-bg)',
          backdropFilter: 'none',
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-amber-500/10">
          <h3 className="text-sm font-semibold theme-text-primary">Financial Health Settings</h3>
          <p className="text-xs theme-text-secondary mt-0.5">Configure metrics and targets</p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {validationError && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{validationError}</p>
              </div>
            </div>
          )}

          {/* Revenue Model Selector - styled like time period selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium theme-text-secondary">Revenue Model</Label>
            <Select
              value={revenueModel}
              onValueChange={handleRevenueModelChange}
              disabled={isSaving}
            >
              <SelectTrigger
                className="w-full h-9 text-sm border-amber-500/20 hover:border-amber-500/40 transition-all duration-200"
                style={{ backgroundColor: 'var(--theme-bg)' }}
              >
                <SelectValue placeholder="Select revenue model" />
              </SelectTrigger>
              <SelectContent
                className="border-amber-500/20"
                style={{ backgroundColor: 'var(--theme-bg)' }}
              >
                <SelectItem value="SaaS">SaaS</SelectItem>
                <SelectItem value="Retail">Retail / E-commerce</SelectItem>
                <SelectItem value="Services">Professional Services</SelectItem>
                <SelectItem value="Marketplace">Marketplace</SelectItem>
                <SelectItem value="Subscription">Subscription</SelectItem>
                <SelectItem value="Hardware">Hardware / Products</SelectItem>
                <SelectItem value="Freemium">Freemium</SelectItem>
                <SelectItem value="Advertising">Advertising</SelectItem>
                <SelectItem value="Commission">Commission Based</SelectItem>
                <SelectItem value="Licensing">Licensing / IP</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Metrics & Targets */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium theme-text-secondary">Metrics & Targets</Label>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((index) => {
                const metricId = selectedMetrics[index] || ''
                const target = targets.find((t) => t.metric_id === metricId)
                const unit = getMetricUnit(metricId)
                const suffix = formatTargetSuffix(unit)
                const isRecommended =
                  !hasUserModified && recommendedMetrics.some((m) => m.id === metricId)

                return (
                  <div key={index} className="flex gap-2 items-center">
                    {/* Metric Selector */}
                    <div className="flex-1">
                      <CleanMetricSelector
                        value={metricId}
                        onValueChange={(value) => handleMetricChange(index, value)}
                        placeholder={`Metric ${index + 1}`}
                        recommended={isRecommended}
                        disabled={isSaving}
                        compact
                      />
                    </div>

                    {/* Target Input */}
                    <div className="w-24">
                      <div className="relative">
                        {unit === 'currency' && metricId && (
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 theme-text-secondary text-xs font-medium z-10">
                            $
                          </span>
                        )}
                        <Input
                          type="number"
                          step="any"
                          value={
                            metricId && target?.target !== undefined && !isNaN(target.target)
                              ? target.target
                              : ''
                          }
                          onChange={(e) => handleTargetChange(metricId, e.target.value)}
                          placeholder="Target"
                          disabled={!metricId || isSaving}
                          className={cn(
                            'h-9 text-sm border-amber-500/20 hover:border-amber-500/40 transition-all duration-200',
                            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                            unit === 'currency' ? 'pl-6' : ''
                          )}
                          style={{ backgroundColor: 'var(--theme-bg)' }}
                        />
                        {unit !== 'currency' && suffix && metricId && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 theme-text-secondary text-xs font-medium z-10">
                            {suffix}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-amber-500/10 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToDefaults}
            disabled={isSaving}
            className="text-xs h-8 px-2 theme-text-secondary hover:theme-text-primary"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSaving}
              className="text-xs h-8 px-3"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSaving || !hasChanges()}
              className="text-xs h-8 px-3 bg-amber-500/90 hover:bg-amber-500 text-gray-900 font-medium"
            >
              {isSaving && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
