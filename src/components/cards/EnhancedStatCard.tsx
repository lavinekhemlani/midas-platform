'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info, ChevronRight } from 'lucide-react'

interface ChangeIndicator {
  value: number
  percentage?: number
  direction: 'up' | 'down' | 'flat'
  period?: string
}

interface BreakdownItem {
  label: string
  value: number | string
  percentage?: number
  color?: string
}

interface Action {
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

interface AlertConfig {
  type: 'warning' | 'danger' | 'info'
  message: string
}

interface EnhancedStatCardProps {
  title: string
  value: number | string
  subtitle?: string
  change?: ChangeIndicator
  sparkline?: number[]
  breakdown?: BreakdownItem[]
  actions?: Action[]
  alert?: AlertConfig
  loading?: boolean
  clickable?: boolean
  onClick?: () => void
  formatValue?: (value: number | string) => string
}

const EnhancedStatCard: React.FC<EnhancedStatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  sparkline,
  breakdown,
  actions,
  alert,
  loading = false,
  clickable = false,
  onClick,
  formatValue = (v) => (typeof v === 'number' ? v.toLocaleString() : v),
}) => {
  const [expanded, setExpanded] = React.useState(false)

  // Generate sparkline SVG path
  const generateSparklinePath = () => {
    if (!sparkline || sparkline.length < 2) return ''

    const width = 80
    const height = 30
    const max = Math.max(...sparkline)
    const min = Math.min(...sparkline)
    const range = max - min || 1

    const points = sparkline.map((val, i) => {
      const x = (i / (sparkline.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  const getTrendIcon = () => {
    if (!change) return null

    switch (change.direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />
      case 'down':
        return <TrendingDown className="w-4 h-4" />
      default:
        return <Minus className="w-4 h-4" />
    }
  }

  const getTrendColor = () => {
    if (!change) return 'text-slate-400'

    switch (change.direction) {
      case 'up':
        return change.value >= 0 ? 'text-emerald-500' : 'text-red-500'
      case 'down':
        return change.value >= 0 ? 'text-red-500' : 'text-emerald-500'
      default:
        return 'text-slate-400'
    }
  }

  const getAlertIcon = () => {
    if (!alert) return null

    switch (alert.type) {
      case 'warning':
      case 'danger':
        return <AlertTriangle className="w-4 h-4" />
      case 'info':
        return <Info className="w-4 h-4" />
      default:
        return null
    }
  }

  const getAlertColor = () => {
    if (!alert) return ''

    switch (alert.type) {
      case 'warning':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'danger':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'info':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/2 mb-2" />
        <div className="h-8 bg-slate-700 rounded w-3/4 mb-2" />
        <div className="h-3 bg-slate-700 rounded w-1/3" />
      </div>
    )
  }

  return (
    <div
      className={`
        p-4 bg-slate-800/50 rounded-lg border border-slate-700
        ${clickable ? 'cursor-pointer hover:bg-slate-800/70 transition-colors' : ''}
        ${expanded ? 'ring-2 ring-amber-500/50' : ''}
      `}
      onClick={() => clickable && onClick && onClick()}
    >
      {/* Alert Banner */}
      {alert && (
        <div className={`flex items-center gap-2 p-2 rounded mb-3 border ${getAlertColor()}`}>
          {getAlertIcon()}
          <span className="text-xs">{alert.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-slate-400">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Sparkline */}
        {sparkline && sparkline.length > 0 && (
          <svg width="80" height="30" className="ml-2">
            <path
              d={generateSparklinePath()}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-slate-100">{formatValue(value)}</span>

        {/* Change Indicator */}
        {change && (
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-sm font-medium">
              {change.percentage !== undefined ? `${change.percentage}%` : `${change.value}`}
            </span>
            {change.period && <span className="text-xs text-slate-500">({change.period})</span>}
          </div>
        )}
      </div>

      {/* Breakdown */}
      {breakdown && breakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 mb-2"
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
            {expanded ? 'Hide' : 'Show'} breakdown
          </button>

          {expanded && (
            <div className="space-y-1">
              {breakdown.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {item.color && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    )}
                    <span className="text-xs text-slate-400">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-slate-300">
                      {formatValue(item.value)}
                    </span>
                    {item.percentage !== undefined && (
                      <span className="text-xs text-slate-500">({item.percentage}%)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                action.onClick()
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/50 hover:bg-slate-700 rounded transition-colors"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default EnhancedStatCard
