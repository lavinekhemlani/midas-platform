'use client'

import { useState, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { Layers, BarChart3, Zap, Shield, ArrowRight, Check, Sparkles } from 'lucide-react'
import { DM_Sans, STIX_Two_Text, EB_Garamond } from 'next/font/google'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-stix-two-text',
})

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

const features = [
  {
    id: 'unified',
    icon: Layers,
    title: 'Unified Data Layer',
    description:
      'All your business data in one place. No more switching between 15 different dashboards.',
    highlights: [
      'Real-time sync across all platforms',
      'Single source of truth',
      'Cross-platform queries',
    ],
    visual: UnifiedDataVisual,
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Intelligent Analytics',
    description: 'AI that understands your business context and delivers insights that matter.',
    highlights: ['Natural language queries', 'Automated reporting', 'Predictive insights'],
    visual: AnalyticsVisual,
  },
  {
    id: 'automation',
    icon: Zap,
    title: 'Smart Automation',
    description:
      'Automate repetitive tasks and get proactive alerts before issues become problems.',
    highlights: ['Anomaly detection', 'Scheduled reports', 'Workflow triggers'],
    visual: AutomationVisual,
  },
  {
    id: 'security',
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-grade encryption and compliance. Your data never leaves your control.',
    highlights: ['SOC 2 compliant', '256-bit encryption', 'Zero data retention'],
    visual: SecurityVisual,
  },
]

function UnifiedDataVisual({ id = 'default' }: { id?: string }) {
  const { theme } = useTheme()

  // Design tokens
  const gold = '#f59e0b'
  const goldLight = 'rgba(245, 158, 11, 0.12)'
  const goldMedium = 'rgba(245, 158, 11, 0.35)'
  const cardBg = theme === 'light' ? '#ffffff' : '#1a1a1a'
  const textPrimary = theme === 'light' ? '#1f2937' : '#f9fafb'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  // Data categories - spread at 60° intervals for 6 nodes
  const sources = [
    { label: 'Revenue', abbr: 'REV', angle: 0, color: theme === 'light' ? '#059669' : '#34d399' },
    {
      label: 'Marketing',
      abbr: 'MKT',
      angle: 60,
      color: theme === 'light' ? '#dc2626' : '#fca5a5',
    },
    {
      label: 'Customers',
      abbr: 'CRM',
      angle: 120,
      color: theme === 'light' ? '#7c3aed' : '#c4b5fd',
    },
    {
      label: 'Operations',
      abbr: 'OPS',
      angle: 180,
      color: theme === 'light' ? '#0284c7' : '#7dd3fc',
    },
    { label: 'Finance', abbr: 'FIN', angle: 240, color: theme === 'light' ? '#d97706' : '#fcd34d' },
    {
      label: 'Inventory',
      abbr: 'INV',
      angle: 300,
      color: theme === 'light' ? '#db2777' : '#f9a8d4',
    },
  ]

  const radius = 85
  const uniqueId = `unified-${id}`

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      <svg
        viewBox="-140 -140 280 280"
        className="w-full h-full max-w-[300px] max-h-[300px]"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Gradient for center glow */}
          <radialGradient id={`${uniqueId}-center-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={gold} stopOpacity="0.3" />
            <stop offset="70%" stopColor={gold} stopOpacity="0.1" />
            <stop offset="100%" stopColor={gold} stopOpacity="0" />
          </radialGradient>

          {/* Filter for subtle shadow */}
          <filter id={`${uniqueId}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={gold} floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Outer decorative ring */}
        <circle
          cx="0"
          cy="0"
          r="120"
          fill="none"
          stroke={borderColor}
          strokeWidth="1"
          strokeDasharray="2 6"
        />

        {/* Main orbit ring with animation */}
        <circle
          cx="0"
          cy="0"
          r={radius}
          fill="none"
          stroke={goldMedium}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;20;0"
            dur="4s"
            repeatCount="indefinite"
          />
          <animate attributeName="opacity" values="0.4;0.7;0.4" dur="4s" repeatCount="indefinite" />
        </circle>

        {/* Data flow streams from sources to center */}
        {sources.map((source, i) => {
          const angleRad = (source.angle * Math.PI) / 180
          // Round to 2 decimal places to prevent SSR hydration mismatch from floating-point precision differences
          const startX = Math.round(Math.cos(angleRad) * (radius - 12) * 100) / 100
          const startY = Math.round(Math.sin(angleRad) * (radius - 12) * 100) / 100
          const endX = Math.round(Math.cos(angleRad) * 38 * 100) / 100
          const endY = Math.round(Math.sin(angleRad) * 38 * 100) / 100

          return (
            <line
              key={`stream-${i}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={gold}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="4 20"
            >
              <animate
                attributeName="stroke-dashoffset"
                values="24;0"
                dur="2.5s"
                repeatCount="indefinite"
                begin={`${i * 0.4}s`}
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.2;0.8;1"
                dur="2.5s"
                repeatCount="indefinite"
                begin={`${i * 0.4}s`}
              />
            </line>
          )
        })}

        {/* Center glow effect */}
        <circle cx="0" cy="0" r="42" fill={`url(#${uniqueId}-center-glow)`}>
          <animate attributeName="r" values="42;48;42" dur="3s" repeatCount="indefinite" />
          <animate
            attributeName="opacity"
            values="0.15;0.25;0.15"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Center hub - main element */}
        <circle
          cx="0"
          cy="0"
          r="36"
          fill={cardBg}
          stroke={gold}
          strokeWidth="2.5"
          filter={`url(#${uniqueId}-shadow)`}
        />

        {/* Inner ring accent */}
        <circle cx="0" cy="0" r="30" fill="none" stroke={goldLight} strokeWidth="1" />

        {/* Midas logo */}
        <image href="/images/hero/logo_gold_new.svg" x="-22" y="-22" width="44" height="44" />

        {/* Data source nodes - rectangular badges with color bar */}
        {sources.map((source, i) => {
          const angleRad = (source.angle * Math.PI) / 180
          // Round to 2 decimal places to prevent SSR hydration mismatch
          const x = Math.round(Math.cos(angleRad) * radius * 100) / 100
          const y = Math.round(Math.sin(angleRad) * radius * 100) / 100
          const dotCx = Math.round(-Math.cos(angleRad) * 28 * 100) / 100
          const dotCy = Math.round(-Math.sin(angleRad) * 28 * 100) / 100

          return (
            <g
              key={source.label}
              transform={`translate(${x}, ${y})`}
              style={{ transition: 'transform 0.3s ease' }}
            >
              {/* Node background with brand color accent */}
              <rect
                x="-22"
                y="-16"
                width="44"
                height="32"
                rx="8"
                fill={cardBg}
                stroke={borderColor}
                strokeWidth="1.5"
              />

              {/* Brand color indicator bar */}
              <rect x="-22" y="-16" width="4" height="32" rx="2" fill={source.color} />

              {/* Abbreviation text */}
              <text
                x="2"
                y="1"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="600"
                fill={textPrimary}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {source.abbr}
              </text>

              {/* Connection dot */}
              <circle cx={dotCx} cy={dotCy} r="3" fill={gold} opacity="0.6" />
            </g>
          )
        })}

        {/* Corner accent elements for visual balance */}
        <circle cx="-110" cy="-110" r="2" fill={goldMedium} />
        <circle cx="110" cy="-110" r="2" fill={goldMedium} />
        <circle cx="-110" cy="110" r="2" fill={goldMedium} />
        <circle cx="110" cy="110" r="2" fill={goldMedium} />
      </svg>

      {/* Bottom status indicator */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{
          backgroundColor:
            theme === 'light' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.12)',
          border: `1px solid ${goldMedium}`,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: '#22c55e' }}
        />
        <span
          className="text-[10px] font-medium tracking-wide"
          style={{
            color: theme === 'light' ? '#92400e' : '#fbbf24',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          6 sources synced
        </span>
      </div>
    </div>
  )
}

function AnalyticsVisual({ id = 'default' }: { id?: string }) {
  const { theme } = useTheme()

  // Premium design tokens
  const gold = '#f59e0b'
  const goldDark = '#b45309'
  const cardBg = theme === 'light' ? '#ffffff' : '#0f0f0f'
  const textPrimary = theme === 'light' ? '#1c1917' : '#fafaf9'
  const textMuted = theme === 'light' ? '#78716c' : '#a8a29e'
  const lineColor = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'
  const gridColor = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'

  const uniqueId = `analytics-${id}`

  // Chart data points for smooth curve
  const dataPoints = [
    { x: 30, y: 140, value: '1.2M', label: 'Jan' },
    { x: 70, y: 120, value: '1.4M', label: 'Feb' },
    { x: 110, y: 95, value: '1.8M', label: 'Mar' },
    { x: 150, y: 110, value: '1.6M', label: 'Apr' },
    { x: 190, y: 70, value: '2.1M', label: 'May' },
    { x: 230, y: 45, value: '2.4M', label: 'Jun' },
  ]

  // Generate smooth curve path using quadratic bezier
  const generateSmoothPath = () => {
    let path = `M ${dataPoints[0].x} ${dataPoints[0].y}`
    for (let i = 0; i < dataPoints.length - 1; i++) {
      const curr = dataPoints[i]
      const next = dataPoints[i + 1]
      const midX = (curr.x + next.x) / 2
      path += ` Q ${curr.x + 20} ${curr.y} ${midX} ${(curr.y + next.y) / 2}`
    }
    const last = dataPoints[dataPoints.length - 1]
    path += ` T ${last.x} ${last.y}`
    return path
  }

  // Area fill path (closes the curve to bottom)
  const generateAreaPath = () => {
    return `${generateSmoothPath()} L 230 180 L 30 180 Z`
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      <svg viewBox="0 0 280 220" className="w-full max-w-[300px] h-auto">
        <defs>
          {/* Premium gold gradient for line */}
          <linearGradient id={`${uniqueId}-line-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={goldDark} />
            <stop offset="50%" stopColor={gold} />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>

          {/* Area fill gradient */}
          <linearGradient id={`${uniqueId}-area-grad`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={gold} stopOpacity="0.25" />
            <stop offset="50%" stopColor={gold} stopOpacity="0.08" />
            <stop offset="100%" stopColor={gold} stopOpacity="0" />
          </linearGradient>

          {/* Glow filter */}
          <filter id={`${uniqueId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Drop shadow */}
          <filter id={`${uniqueId}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Background subtle grid */}
        <g stroke={gridColor} strokeWidth="1">
          {/* Horizontal lines */}
          {[45, 80, 115, 150].map((y) => (
            <line key={y} x1="20" y1={y} x2="260" y2={y} />
          ))}
          {/* Vertical lines */}
          {dataPoints.map((p) => (
            <line key={p.x} x1={p.x} y1="35" x2={p.x} y2="180" strokeDasharray="2 4" />
          ))}
        </g>

        {/* Y-axis labels */}
        <g
          fontSize="9"
          fill={textMuted}
          fontFamily="system-ui, -apple-system, sans-serif"
          textAnchor="end"
        >
          <text x="16" y="48">
            3M
          </text>
          <text x="16" y="83">
            2M
          </text>
          <text x="16" y="118">
            1M
          </text>
          <text x="16" y="153">
            0
          </text>
        </g>

        {/* X-axis line */}
        <line x1="20" y1="180" x2="260" y2="180" stroke={lineColor} strokeWidth="1" />

        {/* Animated area fill */}
        <path d={generateAreaPath()} fill={`url(#${uniqueId}-area-grad)`} opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="1s" fill="freeze" begin="0.3s" />
        </path>

        {/* Main trend line with animation */}
        <path
          d={generateSmoothPath()}
          fill="none"
          stroke={`url(#${uniqueId}-line-grad)`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="400"
          strokeDashoffset="400"
          filter={`url(#${uniqueId}-glow)`}
        >
          <animate
            attributeName="stroke-dashoffset"
            from="400"
            to="0"
            dur="1.5s"
            fill="freeze"
            begin="0.2s"
          />
        </path>

        {/* Data point markers */}
        {dataPoints.map((point, i) => (
          <g key={point.label}>
            {/* Outer glow ring */}
            <circle
              cx={point.x}
              cy={point.y}
              r="0"
              fill="none"
              stroke={gold}
              strokeWidth="1"
              opacity="0.3"
            >
              <animate
                attributeName="r"
                from="0"
                to="12"
                dur="0.4s"
                fill="freeze"
                begin={`${0.5 + i * 0.15}s`}
              />
              <animate
                attributeName="opacity"
                values="0.3;0.1;0.3"
                dur="2s"
                repeatCount="indefinite"
                begin={`${1.5 + i * 0.1}s`}
              />
            </circle>
            {/* Main dot */}
            <circle cx={point.x} cy={point.y} r="0" fill={cardBg} stroke={gold} strokeWidth="2">
              <animate
                attributeName="r"
                from="0"
                to="5"
                dur="0.3s"
                fill="freeze"
                begin={`${0.5 + i * 0.15}s`}
              />
            </circle>
            {/* Inner accent */}
            <circle cx={point.x} cy={point.y} r="0" fill={gold}>
              <animate
                attributeName="r"
                from="0"
                to="2"
                dur="0.3s"
                fill="freeze"
                begin={`${0.6 + i * 0.15}s`}
              />
            </circle>
          </g>
        ))}

        {/* X-axis labels */}
        <g
          fontSize="9"
          fill={textMuted}
          fontFamily="system-ui, -apple-system, sans-serif"
          textAnchor="middle"
        >
          {dataPoints.map((point) => (
            <text key={point.label} x={point.x} y="195">
              {point.label}
            </text>
          ))}
        </g>

        {/* Latest value callout */}
        <g opacity="0" filter={`url(#${uniqueId}-shadow)`}>
          <animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze" begin="1.8s" />

          {/* Callout card */}
          <rect
            x="185"
            y="8"
            width="72"
            height="32"
            rx="6"
            fill={cardBg}
            stroke={theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}
            strokeWidth="1"
          />

          {/* Gold accent */}
          <rect x="185" y="8" width="3" height="32" rx="1.5" fill={gold} />

          {/* Value */}
          <text
            x="224"
            y="22"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={textPrimary}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            $2.4M
          </text>

          {/* Change indicator */}
          <text
            x="224"
            y="34"
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill={theme === 'light' ? '#059669' : '#34d399'}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            ↑ 14.3%
          </text>
        </g>

        {/* Connector line from callout to latest point */}
        <line
          x1="221"
          y1="40"
          x2="230"
          y2="45"
          stroke={gold}
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0"
        >
          <animate attributeName="opacity" from="0" to="0.5" dur="0.3s" fill="freeze" begin="2s" />
        </line>
      </svg>
    </div>
  )
}

function AutomationVisual({ id = 'default' }: { id?: string }) {
  const { theme } = useTheme()
  const accentColor = theme === 'light' ? '#CF6900' : '#f59e0b'
  const lineColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const nodeColors = {
    trigger: theme === 'light' ? '#7c3aed' : '#a78bfa',
    process: accentColor,
    action: theme === 'light' ? '#059669' : '#34d399',
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 280 220" className="w-full max-w-[280px] h-auto">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={lineColor} />
          </marker>
        </defs>

        {/* Flow paths */}
        <g fill="none" stroke={lineColor} strokeWidth="2">
          {/* Trigger to Process */}
          <path d="M80 55 L140 55" strokeDasharray="80" strokeDashoffset="80">
            <animate
              attributeName="stroke-dashoffset"
              from="80"
              to="0"
              dur="0.6s"
              fill="freeze"
              begin="0.5s"
            />
          </path>

          {/* Process to Action 1 */}
          <path d="M200 55 Q240 55 240 95 L240 115" strokeDasharray="100" strokeDashoffset="100">
            <animate
              attributeName="stroke-dashoffset"
              from="100"
              to="0"
              dur="0.6s"
              fill="freeze"
              begin="1.2s"
            />
          </path>

          {/* Process to Action 2 */}
          <path d="M170 85 L170 115" strokeDasharray="40" strokeDashoffset="40">
            <animate
              attributeName="stroke-dashoffset"
              from="40"
              to="0"
              dur="0.4s"
              fill="freeze"
              begin="1.4s"
            />
          </path>

          {/* Process to Action 3 */}
          <path d="M140 85 Q100 85 100 115" strokeDasharray="80" strokeDashoffset="80">
            <animate
              attributeName="stroke-dashoffset"
              from="80"
              to="0"
              dur="0.5s"
              fill="freeze"
              begin="1.6s"
            />
          </path>
        </g>

        {/* Trigger Node */}
        <g opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" fill="freeze" begin="0s" />
          <rect
            x="20"
            y="35"
            width="60"
            height="40"
            rx="8"
            fill={theme === 'light' ? '#ffffff' : '#252525'}
            stroke={nodeColors.trigger}
            strokeWidth="2"
          />
          <text
            x="50"
            y="52"
            textAnchor="middle"
            fontSize="9"
            fontWeight="500"
            fill={nodeColors.trigger}
          >
            TRIGGER
          </text>
          <text
            x="50"
            y="65"
            textAnchor="middle"
            fontSize="8"
            fill={theme === 'light' ? '#666' : 'rgba(255,255,255,0.5)'}
          >
            Revenue ↑
          </text>
          {/* Pulse effect */}
          <circle
            cx="50"
            cy="55"
            r="25"
            fill="none"
            stroke={nodeColors.trigger}
            strokeWidth="1"
            opacity="0"
          >
            <animate
              attributeName="r"
              values="20;30;20"
              dur="2s"
              repeatCount="indefinite"
              begin="0.5s"
            />
            <animate
              attributeName="opacity"
              values="0.5;0;0.5"
              dur="2s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
        </g>

        {/* Process Node (Midas) */}
        <g opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" fill="freeze" begin="0.8s" />
          <rect
            x="140"
            y="30"
            width="60"
            height="50"
            rx="10"
            fill={theme === 'light' ? '#ffffff' : '#252525'}
            stroke={nodeColors.process}
            strokeWidth="2"
          >
            <animate
              attributeName="stroke-width"
              values="2;3;2"
              dur="1.5s"
              repeatCount="indefinite"
              begin="1s"
            />
          </rect>
          <text
            x="170"
            y="52"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={nodeColors.process}
          >
            MIDAS
          </text>
          <text
            x="170"
            y="68"
            textAnchor="middle"
            fontSize="8"
            fill={theme === 'light' ? '#666' : 'rgba(255,255,255,0.5)'}
          >
            Analyzing...
          </text>
          {/* Processing dots */}
          <g fill={nodeColors.process}>
            <circle cx="158" cy="68" r="1.5" opacity="0.3">
              <animate
                attributeName="opacity"
                values="0.3;1;0.3"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="166" cy="68" r="1.5" opacity="0.3">
              <animate
                attributeName="opacity"
                values="0.3;1;0.3"
                dur="1s"
                repeatCount="indefinite"
                begin="0.2s"
              />
            </circle>
            <circle cx="174" cy="68" r="1.5" opacity="0.3">
              <animate
                attributeName="opacity"
                values="0.3;1;0.3"
                dur="1s"
                repeatCount="indefinite"
                begin="0.4s"
              />
            </circle>
          </g>
        </g>

        {/* Action Nodes */}
        {/* Action 1 - Alert */}
        <g opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" fill="freeze" begin="1.8s" />
          <rect
            x="210"
            y="120"
            width="60"
            height="36"
            rx="6"
            fill={theme === 'light' ? '#ffffff' : '#252525'}
            stroke={nodeColors.action}
            strokeWidth="1.5"
          />
          <text
            x="240"
            y="135"
            textAnchor="middle"
            fontSize="8"
            fontWeight="500"
            fill={nodeColors.action}
          >
            ALERT
          </text>
          <text
            x="240"
            y="147"
            textAnchor="middle"
            fontSize="7"
            fill={theme === 'light' ? '#666' : 'rgba(255,255,255,0.5)'}
          >
            Team notified
          </text>
          <circle
            cx="240"
            cy="138"
            r="20"
            fill="none"
            stroke={nodeColors.action}
            strokeWidth="1"
            opacity="0"
          >
            <animate
              attributeName="opacity"
              values="0;0.5;0"
              dur="2s"
              repeatCount="indefinite"
              begin="2s"
            />
            <animate
              attributeName="r"
              values="15;25;15"
              dur="2s"
              repeatCount="indefinite"
              begin="2s"
            />
          </circle>
        </g>

        {/* Action 2 - Report */}
        <g opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" fill="freeze" begin="2s" />
          <rect
            x="140"
            y="120"
            width="60"
            height="36"
            rx="6"
            fill={theme === 'light' ? '#ffffff' : '#252525'}
            stroke={nodeColors.action}
            strokeWidth="1.5"
          />
          <text
            x="170"
            y="135"
            textAnchor="middle"
            fontSize="8"
            fontWeight="500"
            fill={nodeColors.action}
          >
            REPORT
          </text>
          <text
            x="170"
            y="147"
            textAnchor="middle"
            fontSize="7"
            fill={theme === 'light' ? '#666' : 'rgba(255,255,255,0.5)'}
          >
            Generated
          </text>
        </g>

        {/* Action 3 - Sync */}
        <g opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" fill="freeze" begin="2.2s" />
          <rect
            x="70"
            y="120"
            width="60"
            height="36"
            rx="6"
            fill={theme === 'light' ? '#ffffff' : '#252525'}
            stroke={nodeColors.action}
            strokeWidth="1.5"
          />
          <text
            x="100"
            y="135"
            textAnchor="middle"
            fontSize="8"
            fontWeight="500"
            fill={nodeColors.action}
          >
            SYNC
          </text>
          <text
            x="100"
            y="147"
            textAnchor="middle"
            fontSize="7"
            fill={theme === 'light' ? '#666' : 'rgba(255,255,255,0.5)'}
          >
            → QuickBooks
          </text>
        </g>

        {/* Success indicators */}
        <g opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" fill="freeze" begin="2.5s" />
          <circle cx="260" cy="125" r="8" fill={nodeColors.action} />
          <path
            d="M256 125 L259 128 L264 122"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <g opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" fill="freeze" begin="2.7s" />
          <circle cx="190" cy="125" r="8" fill={nodeColors.action} />
          <path
            d="M186 125 L189 128 L194 122"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <g opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" fill="freeze" begin="2.9s" />
          <circle cx="120" cy="125" r="8" fill={nodeColors.action} />
          <path
            d="M116 125 L119 128 L124 122"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Bottom status text */}
        <text
          x="140"
          y="185"
          textAnchor="middle"
          fontSize="10"
          fontWeight="500"
          fill={nodeColors.action}
          opacity="0"
        >
          <animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze" begin="3s" />3
          actions completed automatically
        </text>
      </svg>
    </div>
  )
}

function SecurityVisual({ id = 'default' }: { id?: string }) {
  const { theme } = useTheme()
  const accentColor = theme === 'light' ? '#CF6900' : '#f59e0b'
  const secureColor = theme === 'light' ? '#059669' : '#34d399'
  const cardBg = theme === 'light' ? '#ffffff' : '#252525'

  // Unique IDs to prevent conflicts when multiple instances render
  const gradientId = `secShieldGradient-${id}`
  const clipId = `secShieldClip-${id}`

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 280 280" className="w-full max-w-[280px] h-auto">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.05" />
          </linearGradient>

          <clipPath id={clipId}>
            <path d="M140 35 L70 60 L70 130 Q70 185 140 220 Q210 185 210 130 L210 60 Z" />
          </clipPath>
        </defs>

        {/* Shield background */}
        <path
          d="M140 35 L70 60 L70 130 Q70 185 140 220 Q210 185 210 130 L210 60 Z"
          fill={`url(#${gradientId})`}
          stroke={accentColor}
          strokeWidth="2.5"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.6;1;0.6"
            dur="2s"
            repeatCount="indefinite"
          />
        </path>

        {/* Scanning line - clipped within shield */}
        <g clipPath={`url(#${clipId})`}>
          <line
            x1="70"
            y1="35"
            x2="210"
            y2="35"
            stroke={accentColor}
            strokeWidth="2"
            strokeOpacity="0.6"
          >
            <animate attributeName="y1" values="35;220;35" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="y2" values="35;220;35" dur="2.5s" repeatCount="indefinite" />
          </line>
          {/* Glow effect for scan line */}
          <line
            x1="70"
            y1="35"
            x2="210"
            y2="35"
            stroke={accentColor}
            strokeWidth="8"
            strokeOpacity="0.15"
          >
            <animate attributeName="y1" values="35;220;35" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="y2" values="35;220;35" dur="2.5s" repeatCount="indefinite" />
          </line>
        </g>

        {/* Inner shield outline */}
        <path
          d="M140 50 L85 70 L85 125 Q85 170 140 200 Q195 170 195 125 L195 70 Z"
          fill="none"
          stroke={accentColor}
          strokeWidth="1"
          strokeOpacity="0.3"
          strokeDasharray="6 4"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;20"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </path>

        {/* Lock icon in center */}
        <g transform="translate(140, 125)">
          <rect
            x="-20"
            y="-8"
            width="40"
            height="32"
            rx="4"
            fill={cardBg}
            stroke={accentColor}
            strokeWidth="2"
          />
          <path
            d="M-12 -8 L-12 -20 Q-12 -32 0 -32 Q12 -32 12 -20 L12 -8"
            fill="none"
            stroke={accentColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="0" cy="6" r="5" fill={accentColor} />
          <rect x="-2.5" y="6" width="5" height="10" fill={accentColor} />
        </g>

        {/* Static security badges - positioned around shield */}
        {/* SOC 2 - top left */}
        <g transform="translate(45, 85)">
          <rect
            x="-30"
            y="-11"
            width="60"
            height="22"
            rx="11"
            fill={theme === 'light' ? '#f0fdf4' : 'rgba(52,211,153,0.15)'}
            stroke={secureColor}
            strokeWidth="1.5"
          />
          <text x="0" y="5" textAnchor="middle" fontSize="10" fontWeight="600" fill={secureColor}>
            SOC 2
          </text>
          <animate attributeName="opacity" values="0.85;1;0.85" dur="3s" repeatCount="indefinite" />
        </g>

        {/* 256-bit - top right */}
        <g transform="translate(235, 85)">
          <rect
            x="-32"
            y="-11"
            width="64"
            height="22"
            rx="11"
            fill={theme === 'light' ? '#eff6ff' : 'rgba(56,189,248,0.15)'}
            stroke={theme === 'light' ? '#0284c7' : '#38bdf8'}
            strokeWidth="1.5"
          />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill={theme === 'light' ? '#0284c7' : '#38bdf8'}
          >
            256-bit
          </text>
          <animate
            attributeName="opacity"
            values="0.85;1;0.85"
            dur="3s"
            repeatCount="indefinite"
            begin="1s"
          />
        </g>

        {/* GDPR - bottom */}
        <g transform="translate(140, 248)">
          <rect
            x="-28"
            y="-11"
            width="56"
            height="22"
            rx="11"
            fill={theme === 'light' ? '#faf5ff' : 'rgba(167,139,250,0.15)'}
            stroke={theme === 'light' ? '#7c3aed' : '#a78bfa'}
            strokeWidth="1.5"
          />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill={theme === 'light' ? '#7c3aed' : '#a78bfa'}
          >
            GDPR
          </text>
          <animate
            attributeName="opacity"
            values="0.85;1;0.85"
            dur="3s"
            repeatCount="indefinite"
            begin="2s"
          />
        </g>

        {/* Checkmark indicator */}
        <g transform="translate(140, 175)">
          <circle cx="0" cy="0" r="10" fill={secureColor} opacity="0.15">
            <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.15;0.05;0.15"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="0" cy="0" r="8" fill={secureColor} />
          <path
            d="M-4 0 L-1 3 L4 -3"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  )
}

export function FeaturesAccordion() {
  const { theme } = useTheme()
  const [activeFeature, setActiveFeature] = useState('unified')
  const prevActiveRef = useRef('unified')

  const handleSetActive = (id: string) => {
    prevActiveRef.current = activeFeature
    setActiveFeature(id)
  }

  const activeIndex = features.findIndex((f) => f.id === activeFeature)
  const prevIndex = features.findIndex((f) => f.id === prevActiveRef.current)
  const slideFromBelow = activeIndex > prevIndex

  const active = features.find((f) => f.id === activeFeature) || features[0]
  const ActiveVisual = active.visual

  return (
    <section
      className={`relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 ${dmSans.variable} ${stixTwoText.variable} ${ebGaramond.variable}`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
            <span
              className="text-xs font-semibold tracking-[0.2em] uppercase"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: theme === 'light' ? '#CF6900' : '#f59e0b',
              }}
            >
              Platform
            </span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>
          <h2
            className="text-[48px] sm:text-[60px] font-light theme-text-primary mb-4 leading-[1.1]"
            style={{ fontFamily: 'var(--font-eb-garamond)' }}
          >
            Midas,
            <span
              className="italic bg-clip-text text-transparent pl-[0.05em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #f59e0b, #d97706)',
              }}
            >
              Your Financial Alchemist
            </span>
          </h2>
          <p
            className="text-lg 2xl:text-xl theme-text-secondary"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Everything you need to understand and optimize your business operations.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-stretch">
          {/* Left: Feature Tabs */}
          <div className="space-y-4 flex flex-col">
            {features.map((feature) => {
              const Icon = feature.icon
              const isActive = activeFeature === feature.id
              const FeatureVisual = feature.visual

              return (
                <div key={feature.id}>
                  <button
                    onClick={() => handleSetActive(feature.id)}
                    className={cn(
                      'w-full text-left p-5 rounded-xl border transition-all duration-300',
                      isActive
                        ? 'border-[var(--theme-card-border)] shadow-[0_0_15px_rgba(245,158,11,0.15),0_0_4px_rgba(245,158,11,0.1)]'
                        : 'border-[var(--theme-card-border)] hover:border-[var(--theme-card-border)]'
                    )}
                    style={{
                      backgroundColor: isActive
                        ? theme === 'light'
                          ? '#FFFDFA'
                          : '#1a1a1a'
                        : theme === 'light'
                          ? '#FAF8F5'
                          : '#1a1a1a',
                    }}
                  >
                    <div className="flex items-center gap-6">
                      <Icon
                        className={cn(
                          'w-5 h-5 flex-shrink-0 ml-2 transition-colors',
                          isActive
                            ? theme === 'light'
                              ? 'text-[#CF6900]'
                              : 'text-amber-500'
                            : 'theme-text-secondary'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            'text-base font-semibold transition-colors',
                            isActive ? 'theme-text-primary' : 'theme-text-secondary'
                          )}
                          style={{
                            fontFamily: 'var(--font-dm-sans)',
                          }}
                        >
                          {feature.title}
                        </h3>
                        <p
                          className={cn(
                            'text-sm leading-relaxed',
                            isActive ? 'theme-text-primary' : 'theme-text-secondary'
                          )}
                          style={{ fontFamily: 'var(--font-dm-sans)' }}
                        >
                          {feature.description}
                        </p>

                        {/* Highlights - shown when active */}
                        <div
                          className={cn(
                            'overflow-hidden transition-all duration-300',
                            isActive ? 'max-h-40 opacity-100 mt-3' : 'max-h-0 opacity-0'
                          )}
                        >
                          <div className="flex flex-wrap gap-2">
                            {feature.highlights.map((highlight) => (
                              <span
                                key={highlight}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal theme-text-secondary"
                              >
                                <Check className="w-3 h-3 theme-text-secondary" />
                                {highlight}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Mobile Visual - shown inside accordion when active */}
                    <div
                      className={cn(
                        'lg:hidden overflow-hidden transition-all duration-300',
                        isActive ? 'max-h-[280px] opacity-100 mt-4' : 'max-h-0 opacity-0'
                      )}
                    >
                      <div className="h-[260px] flex items-center justify-center">
                        <FeatureVisual id={`mobile-${feature.id}`} />
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Right: Visual - Desktop only */}
          <div
            className="hidden lg:flex relative min-h-[400px] rounded-2xl border border-[var(--theme-card-border)] backdrop-blur-sm overflow-hidden items-center justify-center"
            style={{ backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a' }}
          >
            <ActiveVisual id={`desktop-${active.id}`} />
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <Link
            href="/platform"
            className="group inline-flex items-center gap-2 transition-colors hover:opacity-80"
            style={{
              fontFamily: 'var(--font-dm-sans)',
              color: theme === 'light' ? '#CF6900' : '#f59e0b',
            }}
          >
            <span className="text-sm font-medium">Explore all features</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  )
}
