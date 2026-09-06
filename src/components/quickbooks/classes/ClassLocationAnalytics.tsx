// src/components/quickbooks/classes/ClassLocationAnalytics.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Building2, MapPin, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react'
import { BaseCard } from '../shared/BaseCard'
import { QuickBooksComponentProps, PerformanceMetrics } from '../shared/types'
import { ClassPerformance, LocationPerformance } from '@/lib/providers/quickbooks/classes'
import { apiClient } from '@/lib/apiClient'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { logger } from '@/lib/logger'

interface ClassLocationAnalyticsProps extends QuickBooksComponentProps {
  organizationId: string
  type: 'class' | 'location' | 'both'
  startDate?: string
  endDate?: string
  limit?: number
  onItemClick?: (id: string, type: 'class' | 'location') => void
}

export function ClassLocationAnalytics({
  organizationId,
  type = 'both',
  startDate,
  endDate,
  limit = 10,
  onItemClick,
  className,
  isLoading: externalLoading,
  error: externalError,
  printOptimized,
  ...props
}: ClassLocationAnalyticsProps) {
  const [classData, setClassData] = useState<ClassPerformance[]>([])
  const [locationData, setLocationData] = useState<LocationPerformance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'class' | 'location'>(
    type === 'location' ? 'location' : 'class'
  )

  useEffect(() => {
    loadData()
  }, [organizationId, startDate, endDate])

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const dateRange = {
        start_date:
          startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
      }

      if (type === 'class' || type === 'both') {
        const response = await apiClient(`/api/classes?action=comparison&classId=all`)
        if (!response.ok) {
          throw new Error('Failed to fetch class comparison data')
        }
        const classComparison = await response.json()
        setClassData(classComparison.classes.slice(0, limit))
      }

      if (type === 'location' || type === 'both') {
        // Get all locations first
        const response = await apiClient('/api/classes')
        if (!response.ok) {
          throw new Error('Failed to fetch locations data')
        }
        const data = await response.json()
        const locations = data.locations || []

        // For now, we'll use basic location data
        // TODO: Add location performance endpoint
        const locationPerformances: LocationPerformance[] = locations
          .slice(0, limit)
          .map((location: any) => ({
            location,
            metrics: {
              revenue: 0,
              expenses: 0,
              profit: 0,
              profit_margin: 0,
              invoice_count: 0,
              customer_count: 0,
              growth_rate: 0,
              year_over_year: 0,
            },
            trend_direction: 'stable' as const,
            top_customers: [],
          }))

        setLocationData(locationPerformances)
      }
    } catch (err) {
      logger.error('Failed to load class/location data:', {
        error: err,
        component: 'ClassLocationAnalytics',
      })
      setError('Unable to load analytics data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    loadData()
  }

  // Prepare chart data
  const chartData =
    activeTab === 'class'
      ? classData.map((c) => ({
          name: c.class_name.length > 15 ? c.class_name.substring(0, 15) + '...' : c.class_name,
          revenue: c.revenue,
          expenses: c.expenses,
          profit: c.profit,
        }))
      : locationData.map((l) => ({
          name: l.location_name,
          revenue: l.revenue,
          expenses: l.expenses,
          profit: l.profit,
        }))

  if (externalLoading || isLoading) {
    return (
      <BaseCard className={className} {...props}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
            <p className="text-sm theme-text-secondary">Loading analytics...</p>
          </div>
        </div>
      </BaseCard>
    )
  }

  if (externalError || error) {
    return (
      <BaseCard className={className} {...props}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-400">{externalError || error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 text-xs text-amber-500 hover:text-amber-400"
            >
              Try again
            </button>
          </div>
        </div>
      </BaseCard>
    )
  }

  const currentData = activeTab === 'class' ? classData : locationData
  const totalRevenue = currentData.reduce((sum, item) => sum + item.revenue, 0)
  const totalProfit = currentData.reduce((sum, item) => sum + item.profit, 0)
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return (
    <BaseCard
      title="Class & Location Analytics"
      subtitle={`Performance breakdown by ${activeTab}`}
      headerAction={
        <button
          onClick={handleRefresh}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4 theme-text-secondary" />
        </button>
      }
      className={className}
      {...props}
    >
      {/* Tab Selector */}
      {type === 'both' && (
        <div className="flex space-x-1 mb-6 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setActiveTab('class')}
            className={cn(
              'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === 'class'
                ? 'bg-amber-500/20 text-amber-400'
                : 'theme-text-secondary hover:text-amber-400'
            )}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Classes
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={cn(
              'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === 'location'
                ? 'bg-amber-500/20 text-amber-400'
                : 'theme-text-secondary hover:text-amber-400'
            )}
          >
            <MapPin className="w-4 h-4 inline mr-2" />
            Locations
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-white/5 rounded-lg">
          <p className="text-xs theme-text-secondary mb-1">Total Revenue</p>
          <p className="text-lg font-bold theme-text-primary">
            ${(totalRevenue / 1000).toFixed(1)}k
          </p>
        </div>
        <div className="text-center p-3 bg-white/5 rounded-lg">
          <p className="text-xs theme-text-secondary mb-1">Total Profit</p>
          <p className="text-lg font-bold text-emerald-400">${(totalProfit / 1000).toFixed(1)}k</p>
        </div>
        <div className="text-center p-3 bg-white/5 rounded-lg">
          <p className="text-xs theme-text-secondary mb-1">Avg Margin</p>
          <p className="text-lg font-bold text-blue-400">{avgMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Chart */}
      {!printOptimized && chartData.length > 0 && (
        <div className="mb-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="name"
                stroke="var(--theme-text-secondary)"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="var(--theme-text-secondary)"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--theme-card-bg)',
                  border: '1px solid var(--theme-card-border)',
                  borderRadius: '8px',
                  color: 'var(--theme-text-primary)',
                }}
                formatter={(value: any) => `$${value.toLocaleString()}`}
                labelStyle={{ color: 'var(--theme-text-secondary)' }}
              />
              <Legend />
              <Bar dataKey="revenue" fill="rgba(245,158,11,0.8)" name="Revenue" />
              <Bar dataKey="expenses" fill="rgba(239,68,68,0.8)" name="Expenses" />
              <Bar dataKey="profit" fill="rgba(34,197,94,0.8)" name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {currentData.map((item, index) => {
          const isClass = 'class_id' in item
          const itemId = isClass
            ? (item as ClassPerformance).class_id
            : (item as LocationPerformance).location_id
          const itemName = isClass
            ? (item as ClassPerformance).class_name
            : (item as LocationPerformance).location_name

          return (
            <div
              key={itemId}
              onClick={() => onItemClick?.(itemId, activeTab)}
              className={cn(
                'p-3 rounded-lg border transition-all duration-200',
                'bg-white/5 border-white/10',
                'hover:bg-white/10 hover:border-amber-500/30',
                onItemClick && 'cursor-pointer',
                'print:bg-white print:border-gray-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xs theme-text-secondary w-6">#{index + 1}</span>
                  <div>
                    <h5 className="font-medium theme-text-primary">{itemName}</h5>
                    {!isClass && (
                      <p className="text-xs theme-text-secondary">
                        {(item as LocationPerformance).customer_count} customers
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold theme-text-primary">
                    ${(item.profit / 1000).toFixed(1)}k
                  </p>
                  <p
                    className={cn(
                      'text-xs flex items-center justify-end',
                      item.profit_margin > 20 ? 'text-emerald-400' : 'text-amber-400'
                    )}
                  >
                    {item.profit_margin > 20 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {item.profit_margin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {currentData.length === 0 && (
        <div className="text-center py-8">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="theme-text-secondary">No {activeTab} data found</p>
        </div>
      )}
    </BaseCard>
  )
}
