'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'
import { useForecastCalculation } from '@/hooks/useForecastCalculation'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { ReportLoadingState } from '@/app/(main)/reports/components/ReportLoadingState'
import { ReportErrorState } from '@/app/(main)/reports/components/ReportErrorState'
import type { ForecastHorizon, ForecastAssumptions } from '@/types/forecasting'
import { DEFAULT_ASSUMPTIONS } from '@/types/forecasting'
import { ForecastChart } from './ForecastChart'
import { ForecastTable } from './ForecastTable'
import { ForecastExportDropdown } from './ForecastExportDropdown'
import { ForecastSkeleton } from './ForecastSkeleton'

export function ForecastingView() {
  const { currency } = useCurrency()

  // Core state
  const [horizon, setHorizon] = useState<ForecastHorizon>('13-week')
  const [assumptions, setAssumptions] = useState<ForecastAssumptions>(DEFAULT_ASSUMPTIONS)
  const [allMemoriesEnabled, setAllMemoriesEnabled] = useState(true)

  // No debouncing needed - calculations are now instant on the client!
  // Fetch raw data once, calculate projections client-side
  const { forecastData, isLoading, isValidating, error, refresh, isError } = useForecastCalculation(
    {
      horizon,
      assumptions, // Direct assumptions, no debounce needed
      enabledMemoryIds: allMemoriesEnabled ? undefined : [],
      allMemoriesEnabled,
      enabled: true,
    }
  )

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !forecastData)
  }, [isLoading, forecastData, welcomeContext])

  // Memory toggle handler
  const handleToggleAllMemories = useCallback((enabled: boolean) => {
    setAllMemoriesEnabled(enabled)
  }, [])

  // Reset assumptions
  const handleResetAssumptions = useCallback(() => {
    setAssumptions(DEFAULT_ASSUMPTIONS)
  }, [])

  // Determine if we have any non-default assumptions
  const hasCustomAssumptions = useMemo(() => {
    return (
      assumptions.growthRate !== DEFAULT_ASSUMPTIONS.growthRate ||
      assumptions.inflowGrowthRate !== DEFAULT_ASSUMPTIONS.inflowGrowthRate ||
      assumptions.outflowGrowthRate !== DEFAULT_ASSUMPTIONS.outflowGrowthRate ||
      assumptions.rollingAverageDays !== DEFAULT_ASSUMPTIONS.rollingAverageDays ||
      assumptions.algorithm !== DEFAULT_ASSUMPTIONS.algorithm
    )
  }, [assumptions])

  // Loading state - use skeleton for better perceived performance
  if (isLoading && !forecastData) {
    return <ForecastSkeleton />
  }

  // Error state
  if (isError && !forecastData) {
    const errorObj =
      typeof error === 'string' ? new Error(error) : error || new Error('Failed to load forecast')
    return <ReportErrorState error={errorObj} onRetry={refresh} />
  }

  return (
    <div className="@container space-y-4 overflow-y-auto styled-scrollbar h-full">
      {/* Horizon Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={horizon} onValueChange={(v) => setHorizon(v as ForecastHorizon)}>
          <TabsList className="glass-morphism">
            <TabsTrigger value="13-week" className="text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              13-Week
            </TabsTrigger>
            <TabsTrigger value="6-month" className="text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              6-Month
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {hasCustomAssumptions && (
            <Badge variant="outline" className="border-amber-500/30 text-amber-600">
              Custom Assumptions Active
            </Badge>
          )}
          {forecastData && (
            <ForecastExportDropdown forecastData={forecastData} assumptions={assumptions} />
          )}
        </div>
      </div>

      {/* Chart */}
      {forecastData && (
        <>
          <ForecastChart
            periods={forecastData.periods}
            memories={forecastData.memories}
            horizon={horizon}
            currency={currency}
            currentCash={forecastData.summary.currentCash}
            summary={forecastData.summary}
            assumptions={assumptions}
            onAssumptionsChange={setAssumptions}
            onResetAssumptions={handleResetAssumptions}
            hasCustomAssumptions={hasCustomAssumptions}
            allMemoriesEnabled={allMemoriesEnabled}
            onToggleAllMemories={handleToggleAllMemories}
            isValidating={isValidating}
            welcomeComplete={welcomeContext?.welcomeComplete ?? true}
          />

          {/* Table (separate card) */}
          <ForecastTable
            lineItems={forecastData.lineItems.cashFlow}
            periods={forecastData.periods}
            horizon={horizon}
            currency={currency}
            isValidating={isValidating}
          />
        </>
      )}
    </div>
  )
}
