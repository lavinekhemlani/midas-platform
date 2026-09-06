// src/app/(main)/reports/components/summary/FinancialHealthCard.tsx
'use client'

import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { BookOpen, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LearnSheetContent } from '@/components/learn/core/LearnSheetContent'
import { MetricTooltip } from '../MetricTooltip'
import { getMetricById } from '@/lib/data/financialMetrics'
import { ReactECharts, canvasHighDpiOpts } from '@/components/chat/visualizations/shared'
import { FinancialHealthSettingsPopover, MetricTarget } from './FinancialHealthSettingsPopover'

interface HealthScoreComponent {
  metricId: string
  name: string
  score: number
  weight: number
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
}

interface HealthScore {
  score: number
  rating: string
  components: HealthScoreComponent[]
}

interface TooltipData {
  formula: string
  components: Array<{ label: string; value: string | number; highlight?: boolean }>
  description: string
}

interface FinancialHealthCardProps {
  healthScore: HealthScore
  selectedMetricIds: string[]
  customTargets: MetricTarget[]
  getMetricValue: (metricId: string) => number | null
  getMetricIcon: (metricId: string) => any
  getMetricColor: (metricId: string) => string
  getMetricTermId: (metricId: string) => string
  formatMetricValue: (metricId: string, value: number) => string
  formatTargetValue: (metricId: string, target: number | undefined) => string
  getFinancialHealthMetricTooltip: (metricId: string) => TooltipData | null
  contextData: Record<string, any>
  isLoading: boolean
  isSaving: boolean
  currentRevenueModel: string
  onSaveSettings: (
    metrics: string[],
    targets: MetricTarget[],
    revenueModel: string
  ) => Promise<void>
}

export function FinancialHealthCard({
  healthScore,
  selectedMetricIds,
  customTargets,
  getMetricValue,
  getMetricIcon,
  getMetricColor,
  getMetricTermId,
  formatMetricValue,
  formatTargetValue,
  getFinancialHealthMetricTooltip,
  contextData,
  isLoading,
  isSaving,
  currentRevenueModel,
  onSaveSettings,
}: FinancialHealthCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Create radar chart option directly
  const radarOption = useMemo(() => {
    const data = selectedMetricIds.map((metricId) => {
      const component = healthScore.components.find((c) => c.metricId === metricId)
      const metric = getMetricById(metricId)
      return {
        name: metric?.name || metricId,
        value: component?.score || 0,
      }
    })

    const maxValue = Math.max(...data.map((d) => d.value), 100) * 1.1

    // Shorten long metric names for radar display - just use mapping for common acronyms, otherwise break lines in formatter
    const getDisplayName = (name: string) => {
      const shortNames: Record<string, string> = {
        'Return on Assets': 'ROA',
        'Return on Equity': 'ROE',
        'Debt to Equity': 'D/E',
      }
      return shortNames[name] || name
    }

    return {
      backgroundColor: 'transparent',
      grid: {
        left: '15%',
        right: '15%',
        top: '10%',
        bottom: '10%',
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(17, 24, 39, 0.95)',
        borderColor: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        extraCssText: `backdrop-filter: blur(12px); box-shadow: 0 4px 20px ${isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.4)'}; border-radius: 8px;`,
        textStyle: { color: isLight ? '#1f2937' : '#e5e7eb' },
        position: 'right',
        formatter: (params: any) => {
          const values = params.value as number[]
          const textColor = isLight ? '#1f2937' : '#e5e7eb'
          const subTextColor = isLight ? '#6b7280' : '#9ca3af'
          let html = `<div style="font-weight: 600; margin-bottom: 6px; color: ${textColor};">Health Scores</div>`
          data.forEach((d, i) => {
            html += `<div style="display: flex; justify-content: space-between; gap: 16px; padding: 2px 0;"><span style="color: ${subTextColor};">${d.name}</span><span style="color: ${textColor};"><span style="font-weight: 600;">${values[i]?.toFixed(0) || 0}</span><span style="font-weight: 400;"> pts</span></span></div>`
          })
          return html
        },
      },
      radar: {
        indicator: data.map((d) => ({
          name: getDisplayName(d.name),
          max: maxValue,
        })),
        center: ['50%', '50%'],
        radius: '35%',
        startAngle: 90,
        axisName: {
          color: '#6b7280',
          fontSize: 12,
          formatter: (value: string) => {
            const words = value.split(' ')
            if (words.length <= 1) return value
            const mid = Math.ceil(words.length / 2)
            return words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' ')
          },
          lineHeight: 16,
          padding: [0, 0, 0, 0],
        },
        axisLine: {
          lineStyle: { color: 'rgba(107, 114, 128, 0.3)' },
        },
        splitLine: {
          lineStyle: { color: 'rgba(107, 114, 128, 0.15)' },
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(107, 114, 128, 0.02)', 'rgba(107, 114, 128, 0.05)'],
          },
        },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: data.map((d) => d.value),
              name: 'Health Score',
              areaStyle: {
                color: isLight ? 'rgba(111, 28, 189, 0.2)' : 'rgba(191, 146, 233, 0.2)',
              },
              lineStyle: { color: isLight ? '#6F1CBD' : '#BF92E9', width: 2 },
              itemStyle: { color: isLight ? '#6F1CBD' : '#BF92E9' },
              symbol: 'circle',
              symbolSize: 4,
            },
          ],
        },
      ],
    }
  }, [selectedMetricIds, healthScore.components, isLight])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between w-full theme-text-primary text-base font-normal uppercase tracking-wider mb-3">
        <div className="group cursor-default">
          <span className="relative">
            Financial Health Score
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <FinancialHealthSettingsPopover
          currentMetrics={selectedMetricIds}
          currentTargets={customTargets}
          currentRevenueModel={currentRevenueModel}
          onSave={onSaveSettings}
          isSaving={isSaving}
          isLoading={isLoading}
        />
      </div>

      {/* Score */}
      <div className={cn('flex items-baseline gap-3 mb-4 py-2.5 px-3 -mx-3', isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')}>
        {isLoading ? (
          <span className="inline-block w-16 h-8 bg-gray-700/30 animate-pulse" />
        ) : (
          <>
            <span
              className={cn(
                'text-[28px] font-mono font-semibold tabular-nums',
                healthScore.score >= 80
                  ? isLight ? 'text-green-700' : 'text-green-400'
                  : healthScore.score >= 60
                    ? isLight ? 'text-amber-600' : 'text-amber-400'
                    : isLight ? 'text-red-600' : 'text-red-400'
              )}
            >
              {healthScore.score} pts
            </span>
            <span className={cn('text-[12px] uppercase tracking-wider', isLight ? 'text-stone-500' : 'text-stone-500')}>
              Health Score
            </span>
          </>
        )}
      </div>

      {/* Chart left, Metrics right */}
      <div className="flex gap-4 items-center">
        {/* Left: Radar Chart */}
        <div className="flex-shrink-0 overflow-visible">
          {isLoading ? (
            <div className={cn('w-[280px] h-[280px] rounded-full animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')} />
          ) : (
            <ReactECharts
              option={{ ...radarOption, aria: { enabled: false } }}
              style={{ height: 280, width: 280 }}
              opts={canvasHighDpiOpts}
              notMerge={true}
            />
          )}
        </div>

        {/* Right: 4 metric rows - vertically centered */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {selectedMetricIds.map((metricId, i) => {
          const metric = getMetricById(metricId)
          if (!metric) return null

          const value = getMetricValue(metricId)
          const component = healthScore.components.find((c: any) => c.metricId === metricId)
          const Icon = getMetricIcon(metricId)
          const iconColor = getMetricColor(metricId)
          const termId = getMetricTermId(metricId)
          const tooltipData = getFinancialHealthMetricTooltip(metricId)

          const statusColor = component?.status === 'excellent' || component?.status === 'good'
            ? '#10b981'
            : component?.status === 'fair'
              ? '#f59e0b'
              : '#ef4444'

          return (
            <div
              key={metricId}
              className={cn(
                'group/row flex items-center gap-2 py-1.5 px-2 text-[14px] transition-colors',
                i % 2 === 0 && (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'),
                isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
              )}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
              <span className={cn('flex-1 truncate', isLight ? 'text-stone-700' : 'text-stone-300')}>
                {metric.name}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 flex-shrink-0">
                {tooltipData && (
                  <MetricTooltip
                    calculationTooltip={{ formula: tooltipData.formula, components: tooltipData.components }}
                    description={tooltipData.description}
                  >
                    <span />
                  </MetricTooltip>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-4 h-4 p-0 hover:bg-amber-500/10">
                      <BookOpen className="w-3 h-3 text-amber-500" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                    <DialogHeader className="p-0 h-0 overflow-hidden">
                      <DialogTitle className="sr-only">Learn: {metric.name}</DialogTitle>
                    </DialogHeader>
                    <LearnSheetContent termId={termId} icon={Icon} iconColor={iconColor} onClose={() => {}} startCloseAnimation={() => {}} contextData={contextData} />
                  </DialogContent>
                </Dialog>
              </div>
              <span className={cn('font-mono tabular-nums font-semibold text-[14px] flex-shrink-0 ml-auto text-right', isLight ? 'text-stone-700' : 'text-stone-300')}>
                {isLoading ? (
                  <span className="inline-block w-14 h-4 bg-gray-700/30 animate-pulse" />
                ) : value === null ? (
                  'N/A'
                ) : (
                  formatMetricValue(metricId, value)
                )}
              </span>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
