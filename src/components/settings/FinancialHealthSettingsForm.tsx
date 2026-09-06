// src/components/settings/FinancialHealthSettingsForm.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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

// Default metrics (must match SummaryView defaults)
const DEFAULT_METRICS = ['gross_margin', 'cash_runway', 'cash_flow', 'working_capital']

export interface MetricTarget {
  metric_id: string
  target: number
  unit: string
}

export interface FinancialHealthSettingsFormProps {
  initialMetrics: string[]
  initialTargets: MetricTarget[]
  initialRevenueModel: string
  onSave: (metrics: string[], targets: MetricTarget[], revenueModel: string) => Promise<void>
  onCancel?: () => void
  onMetricsChange?: (metrics: string[], targets: MetricTarget[]) => void // For controlled mode in onboarding
  isSaving?: boolean
  renderMode?: 'inline' | 'modal' | 'onboarding'
  showRevenueModel?: boolean
  showActions?: boolean
  allowSkip?: boolean // Allow submitting with 0 metrics (onboarding)
  controlledMode?: boolean // If true, calls onMetricsChange instead of managing state internally
}

export default function FinancialHealthSettingsForm({
  initialMetrics,
  initialTargets,
  initialRevenueModel,
  onSave,
  onCancel,
  onMetricsChange,
  isSaving = false,
  renderMode = 'inline',
  showRevenueModel = true,
  showActions = true,
  allowSkip = false,
  controlledMode = false,
}: FinancialHealthSettingsFormProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(initialMetrics)
  const [targets, setTargets] = useState<MetricTarget[]>(initialTargets)
  const [revenueModel, setRevenueModel] = useState<string>(initialRevenueModel)
  const [hasUserModified, setHasUserModified] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Track last processed revenue model to prevent infinite loops
  const lastProcessedRevenueModel = useRef<string>('')

  const recommendedMetrics = getRecommendedMetrics(revenueModel)
  const isModal = renderMode === 'modal'
  const isOnboarding = renderMode === 'onboarding'

  // Update local state when props change
  // In controlled mode, sync from parent props (parent handles auto-population)
  useEffect(() => {
    // Safety check: Only sync when we have consistent data
    // Prevent partial updates where metrics arrive without matching targets
    const filledMetricsCount = initialMetrics.filter(Boolean).length
    const hasConsistentData =
      filledMetricsCount === 0 || initialTargets.length >= filledMetricsCount

    if (hasConsistentData) {
      setSelectedMetrics(initialMetrics)
      setTargets(initialTargets)
      setRevenueModel(initialRevenueModel)
      setValidationError(null)
    }
  }, [initialMetrics, initialTargets, initialRevenueModel])

  // Auto-populate recommended metrics when revenue model changes
  useEffect(() => {
    // Skip auto-population in controlled mode - parent handles it
    if (controlledMode) return

    // Only process if revenue model exists and has actually changed
    if (initialRevenueModel && initialRevenueModel !== lastProcessedRevenueModel.current) {
      lastProcessedRevenueModel.current = initialRevenueModel

      const recommended = getRecommendedMetrics(initialRevenueModel)
      if (recommended.length >= 4) {
        const newMetrics = recommended.slice(0, 4).map((m) => m.id)
        const newTargets = newMetrics.map((metricId) => {
          const metric = FINANCIAL_METRICS.find((m) => m.id === metricId)
          return {
            metric_id: metricId,
            target: getDefaultTarget(metricId, initialRevenueModel),
            unit: metric?.unit || 'currency',
          }
        })

        setSelectedMetrics(newMetrics)
        setTargets(newTargets)
      }
    }
  }, [initialRevenueModel, controlledMode]) // Only trigger on revenue model change, not callback reference changes

  const handleMetricChange = (index: number, value: string) => {
    const newMetrics = [...selectedMetrics]

    // Don't do anything if the value hasn't changed - prevents unnecessary duplicate detection
    if (newMetrics[index] === value) {
      return
    }

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

    // Update targets to match selected metrics
    const newTargets = newMetrics.filter(Boolean).map((metricId) => {
      // Try to keep existing target if metric already has one
      const existingTarget = targets.find((t) => t.metric_id === metricId)
      if (existingTarget) return existingTarget

      // Otherwise create a new target with default value
      const metric = FINANCIAL_METRICS.find((m) => m.id === metricId)
      return {
        metric_id: metricId,
        target: getDefaultTarget(metricId, revenueModel),
        unit: metric?.unit || 'currency',
      }
    })

    setTargets(newTargets)

    // If in controlled mode, notify parent of changes
    if (controlledMode && onMetricsChange) {
      onMetricsChange(newMetrics, newTargets)
    }
  }

  const handleTargetChange = (metricId: string, value: string) => {
    // Allow empty string for better UX during editing
    if (value === '') {
      const updatedTargets = targets.map((t) =>
        t.metric_id === metricId ? { ...t, target: NaN } : t
      )
      setTargets(updatedTargets)

      if (controlledMode && onMetricsChange) {
        onMetricsChange(selectedMetrics, updatedTargets)
      }
      return
    }

    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      const updatedTargets = targets.map((t) =>
        t.metric_id === metricId ? { ...t, target: numValue } : t
      )
      setTargets(updatedTargets)

      if (controlledMode && onMetricsChange) {
        onMetricsChange(selectedMetrics, updatedTargets)
      }
    }
  }

  const handleRevenueModelChange = (value: string) => {
    setRevenueModel(value)
    // Auto-update metrics based on new revenue model
    const recommended = getRecommendedMetrics(value)
    if (recommended.length >= 4) {
      const newMetrics = recommended.slice(0, 4).map((m) => m.id)
      setSelectedMetrics(newMetrics)
      setHasUserModified(false)

      // Update targets for new metrics
      const newTargets = newMetrics.map((metricId) => {
        const metric = FINANCIAL_METRICS.find((m) => m.id === metricId)
        return {
          metric_id: metricId,
          target: getDefaultTarget(metricId, value),
          unit: metric?.unit || 'currency',
        }
      })
      setTargets(newTargets)

      // Notify parent in controlled mode
      if (controlledMode && onMetricsChange) {
        onMetricsChange(newMetrics, newTargets)
      }
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

    // Validate before saving
    const filledMetrics = selectedMetrics.filter(Boolean)

    // In onboarding with allowSkip, 0 metrics is valid (skipped configuration)
    if (allowSkip && filledMetrics.length === 0) {
      try {
        await onSave([], [], revenueModel)
        return
      } catch (error) {
        console.error('Error saving settings:', error)
        setValidationError(
          error instanceof Error
            ? `Failed to save: ${error.message}`
            : 'An unexpected error occurred. Please try again.'
        )
        return
      }
    }

    // Otherwise, require exactly 4 metrics
    if (filledMetrics.length !== 4) {
      if (allowSkip && filledMetrics.length > 0) {
        setValidationError('Please select all 4 metrics, or leave empty to skip.')
      } else {
        setValidationError('Please select exactly 4 metrics before saving.')
      }
      return
    }

    // Check for duplicates
    const uniqueMetrics = new Set(filledMetrics)
    if (uniqueMetrics.size !== 4) {
      setValidationError('Please select 4 different metrics. Duplicates are not allowed.')
      return
    }

    // Validate targets
    for (const metricId of filledMetrics) {
      const target = targets.find((t) => t.metric_id === metricId)
      if (!target || isNaN(target.target) || target.target < 0) {
        setValidationError('Please enter valid target values for all metrics.')
        return
      }
    }

    try {
      await onSave(
        filledMetrics,
        targets.filter((t) => filledMetrics.includes(t.metric_id)),
        revenueModel
      )
    } catch (error) {
      console.error('Error saving settings:', error)
      setValidationError(
        error instanceof Error
          ? `Failed to save: ${error.message}`
          : 'An unexpected error occurred. Please try again.'
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
        return 'months'
      case 'days':
        return 'days'
      case 'currency':
        return '$'
      case 'ratio':
        return ':1'
      case 'count':
        return ''
      default:
        return ''
    }
  }

  // Check if form has unsaved changes
  const hasChanges = () => {
    if (revenueModel !== initialRevenueModel) return true
    if (
      JSON.stringify(selectedMetrics.filter(Boolean).sort()) !==
      JSON.stringify(initialMetrics.sort())
    ) {
      return true
    }
    for (const target of targets) {
      const initialTarget = initialTargets.find((t) => t.metric_id === target.metric_id)
      if (!initialTarget || initialTarget.target !== target.target) {
        return true
      }
    }
    return false
  }

  // Determine container and action classes based on render mode
  const containerClass = isModal ? 'space-y-6' : 'space-y-4'
  const actionClass = isModal
    ? 'flex-row justify-between'
    : 'flex justify-between items-center pt-2'

  // Onboarding-specific classes
  const inputClass = isOnboarding
    ? 'zenith-input h-14 text-sm font-semibold'
    : 'theme-text-primary h-14 text-sm font-semibold border-2 border-amber-500/30 hover:border-amber-500/50 focus:border-amber-500/70 transition-colors'

  return (
    <div className={containerClass}>
      {validationError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{validationError}</p>
          </div>
        </div>
      )}

      {/* Revenue Model Selector */}
      {showRevenueModel && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold theme-text-primary">Revenue Model</Label>
          <Select value={revenueModel} onValueChange={handleRevenueModelChange} disabled={isSaving}>
            <SelectTrigger className="w-full theme-text-primary h-14 text-sm font-semibold border-2 border-amber-500/30 hover:border-amber-500/50 transition-colors">
              <SelectValue placeholder="Select revenue model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SaaS">SaaS (Software as a Service)</SelectItem>
              <SelectItem value="Retail">Retail / E-commerce</SelectItem>
              <SelectItem value="Services">Professional Services / Consulting</SelectItem>
              <SelectItem value="Marketplace">Marketplace / Platform</SelectItem>
              <SelectItem value="Subscription">Subscription (Non-SaaS)</SelectItem>
              <SelectItem value="Hardware">Hardware / Physical Products</SelectItem>
              <SelectItem value="Freemium">Freemium Model</SelectItem>
              <SelectItem value="Advertising">Advertising Revenue</SelectItem>
              <SelectItem value="Commission">Commission Based</SelectItem>
              <SelectItem value="Licensing">Licensing / IP</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Metric Selection with Targets */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold theme-text-primary">Metrics & Targets</Label>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((index) => {
            const metricId = selectedMetrics[index] || ''
            const target = targets.find((t) => t.metric_id === metricId)
            const unit = getMetricUnit(metricId)
            const suffix = formatTargetSuffix(unit)
            const isRecommended =
              !hasUserModified && recommendedMetrics.some((m) => m.id === metricId)

            return (
              <div key={index} className="flex gap-3 items-start">
                {/* Metric Selector */}
                <div className="flex-1">
                  <CleanMetricSelector
                    value={metricId}
                    onValueChange={(value) => handleMetricChange(index, value)}
                    placeholder={isModal ? 'Choose metric' : `Select metric ${index + 1}`}
                    recommended={isRecommended}
                    disabled={isSaving}
                  />
                </div>

                {/* Target Input */}
                <div className="w-48">
                  <div className="relative">
                    {unit === 'currency' && metricId && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-secondary text-sm font-medium z-10">
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
                      className={`${inputClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${unit === 'currency' ? 'pl-7' : ''}`}
                    />
                    {unit !== 'currency' && suffix && metricId && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-secondary text-sm font-medium z-10">
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

      {/* Action Buttons */}
      {showActions && (
        <div className={actionClass}>
          {isModal ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetToDefaults}
                disabled={isSaving}
                className="text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset to defaults
              </Button>
              <div className="flex gap-2">
                {onCancel && (
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="!text-gray-900 dark:!text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                )}
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Hide reset button in onboarding mode */}
              {!isOnboarding && (
                <button
                  onClick={handleResetToDefaults}
                  disabled={isSaving}
                  className="text-sm theme-text-secondary hover:theme-text-primary transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to defaults
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSaving || (!isOnboarding && !allowSkip && !hasChanges())}
                className={`py-2 px-5 rounded-lg text-sm flex items-center min-w-[110px] justify-center ${
                  (hasChanges() || isOnboarding || allowSkip) && !isSaving
                    ? 'btn-get-started'
                    : 'btn-get-started opacity-50 cursor-not-allowed'
                }`}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
