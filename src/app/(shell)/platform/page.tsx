'use client'

import Link from 'next/link'
import { DM_Sans, EB_Garamond, STIX_Two_Text } from 'next/font/google'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import {
  Building2,
  CreditCard,
  Users,
  Puzzle,
  ArrowRight,
  Check,
  Sparkles,
  TrendingUp,
  BarChart3,
  Wallet,
  Target,
  Package,
  LineChart,
  ChevronRight,
  Calendar,
} from 'lucide-react'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-stix-two-text',
})

// Abstract visual components for each product
function FinancialHealthVisual() {
  // Calculate path length for stroke-dashoffset animation
  const pastPathLength = 120 // approximate length of past trend curve
  const forecastPathLength = 100 // approximate length of forecast curve

  return (
    <div className="relative w-full h-48 sm:h-56 flex items-center justify-center overflow-hidden">
      <style jsx>{`
        @keyframes drawPastLine {
          0%,
          20% {
            stroke-dashoffset: 120;
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          45% {
            stroke-dashoffset: 0;
          }
          85% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          95%,
          100% {
            stroke-dashoffset: 0;
            opacity: 0;
          }
        }
        @keyframes drawForecastLine {
          0%,
          45% {
            stroke-dashoffset: 100;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          65% {
            stroke-dashoffset: 0;
          }
          85% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          95%,
          100% {
            stroke-dashoffset: 0;
            opacity: 0;
          }
        }
        @keyframes fadeBand {
          0%,
          65% {
            opacity: 0;
          }
          75% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          95%,
          100% {
            opacity: 0;
          }
        }
        @keyframes showPoint {
          0%,
          3% {
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          95%,
          100% {
            opacity: 0;
          }
        }
        @keyframes pulsePoint {
          0%,
          12% {
            opacity: 0;
            r: 0;
          }
          18% {
            opacity: 1;
            r: 4;
          }
          30% {
            r: 5;
          }
          42% {
            r: 4;
          }
          85% {
            opacity: 1;
            r: 4;
          }
          95%,
          100% {
            opacity: 0;
            r: 0;
          }
        }
        .past-line {
          stroke-dasharray: 120;
          animation: drawPastLine 7s ease-in-out infinite;
        }
        .forecast-line {
          stroke-dasharray: 100;
          animation: drawForecastLine 7s ease-in-out infinite;
        }
        .confidence-band {
          animation: fadeBand 7s ease-in-out infinite;
        }
        .now-point {
          animation: pulsePoint 7s ease-in-out infinite;
        }
        .data-point-1 {
          animation: showPoint 7s ease-in-out infinite;
        }
        .data-point-2 {
          animation: showPoint 7s ease-in-out infinite;
          animation-delay: 0.15s;
        }
        .data-point-3 {
          animation: showPoint 7s ease-in-out infinite;
          animation-delay: 0.3s;
        }
      `}</style>

      {/* Timeline / Runway visualization */}
      <div className="relative flex flex-col items-center scale-[0.85] sm:scale-100">
        {/* Chart area */}
        <div className="relative w-56 h-32 sm:w-64 sm:h-36 lg:w-72 lg:h-40">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-full h-px bg-blue-500/10" />
            ))}
          </div>

          {/* Main SVG with animated graph */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 192 96">
            {/* Confidence band for forecast */}
            <path
              d="M 96 40 Q 120 20, 144 12 T 192 5 L 192 25 Q 144 38, 96 40 Z"
              fill="rgba(59, 130, 246, 0.1)"
              className="confidence-band"
            />

            {/* Past trend line - draws along path */}
            <path
              d="M 0 70 Q 24 65, 48 55 T 96 40"
              fill="none"
              stroke="rgba(59, 130, 246, 0.6)"
              strokeWidth="2"
              strokeLinecap="round"
              className="past-line"
            />

            {/* Forecast line (dashed) - draws along path */}
            <path
              d="M 96 40 Q 120 30, 144 25 T 192 15"
              fill="none"
              stroke="rgba(59, 130, 246, 0.4)"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              className="forecast-line"
              style={{ strokeDasharray: '100', strokeDashoffset: '100' }}
            />

            {/* Current point (Now) */}
            <circle cx="96" cy="40" r="4" fill="rgb(59, 130, 246)" className="now-point" />

            {/* Data points along past trend */}
            <circle cx="24" cy="65" r="3" fill="rgba(59, 130, 246, 0.5)" className="data-point-1" />
            <circle cx="48" cy="55" r="3" fill="rgba(59, 130, 246, 0.5)" className="data-point-2" />
            <circle cx="72" cy="47" r="3" fill="rgba(59, 130, 246, 0.5)" className="data-point-3" />
          </svg>

          {/* Now marker */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center">
            <div className="w-px h-2 bg-blue-500/50" />
            <span className="text-[10px] text-blue-500">Now</span>
          </div>
        </div>

        {/* Timeline labels */}
        <div className="flex justify-between w-56 sm:w-64 lg:w-72 mt-4 text-[10px] theme-text-secondary">
          <span>Past</span>
          <span>18 mo runway</span>
        </div>
      </div>

      {/* Floating KPIs - static, no animation */}
      <div className="absolute top-2 right-2 sm:right-4 px-2 py-1 rounded-lg bg-[var(--theme-card-bg)] border border-emerald-500/30 shadow-lg">
        <span className="text-[10px] text-emerald-500 font-semibold">+24% MoM</span>
      </div>
      <div className="absolute top-2 left-2 sm:left-4 px-2 py-1 rounded-lg bg-[var(--theme-card-bg)] border border-blue-500/30 shadow-lg">
        <span className="text-[10px] text-blue-500 font-semibold">$2.4M ARR</span>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded border border-amber-500/20 bg-[var(--theme-card-bg)]">
        <div className="w-2 h-2 rounded-full bg-amber-500/60" />
        <span className="text-[10px] text-amber-500">3 risks flagged</span>
      </div>
    </div>
  )
}

function BankingVisual() {
  return (
    <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
      {/* CSS Animation Keyframes */}
      <style jsx>{`
        @keyframes flowPulse {
          0%,
          100% {
            opacity: 0.3;
            transform: translateX(0);
          }
          50% {
            opacity: 1;
            transform: translateX(4px);
          }
        }
        @keyframes cashFloat {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.8;
          }
          50% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }
        @keyframes balancePulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }
        .flow-dot {
          animation: flowPulse 2s ease-in-out infinite;
        }
        .flow-dot-delayed {
          animation: flowPulse 2s ease-in-out infinite 0.3s;
        }
        .flow-dot-delayed-2 {
          animation: flowPulse 2s ease-in-out infinite 0.6s;
        }
        .cash-float {
          animation: cashFloat 3s ease-in-out infinite;
        }
        .cash-float-delayed {
          animation: cashFloat 3s ease-in-out infinite 1s;
        }
        .balance-pulse {
          animation: balancePulse 4s ease-in-out infinite;
        }
      `}</style>

      {/* Cash flow waterfall visualization */}
      <div className="flex items-end gap-3 sm:gap-4 lg:gap-6 scale-[0.85] sm:scale-95 lg:scale-100">
        {/* Inflow bars */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-emerald-500 font-medium">Inflows</span>
          <div className="flex items-end gap-1">
            {[36, 26, 32, 22, 40].map((h, i) => (
              <div
                key={i}
                className="w-3.5 sm:w-4 rounded-t bg-gradient-to-t from-emerald-500/60 to-emerald-400/80 cash-float"
                style={{ height: `${h}px`, animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>

        {/* Center balance indicator */}
        <div className="relative balance-pulse">
          <div className="w-20 h-28 sm:w-24 sm:h-32 rounded-xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-transparent flex flex-col items-center justify-center gap-1">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] theme-text-secondary">Balance</span>
            <span className="text-xs sm:text-sm text-emerald-500 font-bold">$847K</span>
            <div className="flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">+12%</span>
            </div>
          </div>
          {/* Sync indicator */}
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-emerald-500" />
          </div>
        </div>

        {/* Outflow bars */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-red-400 font-medium">Outflows</span>
          <div className="flex items-end gap-1">
            {[22, 32, 18, 28, 20].map((h, i) => (
              <div
                key={i}
                className="w-3.5 sm:w-4 rounded-t bg-gradient-to-t from-red-500/60 to-red-400/80 cash-float-delayed"
                style={{ height: `${h}px`, animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Animated flow dots */}
      <div className="absolute top-1/2 -translate-y-1/2 left-6 sm:left-8">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flow-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flow-dot-delayed" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flow-dot-delayed-2" />
        </div>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-6 sm:right-8">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 flow-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 flow-dot-delayed" />
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 flow-dot-delayed-2" />
        </div>
      </div>

      {/* Status badges */}
      <div className="absolute top-2 right-2 sm:right-4 px-2 py-1 rounded border border-emerald-500/20 bg-[var(--theme-card-bg)]">
        <span className="text-[10px] text-emerald-700 dark:text-emerald-500">Real-time sync</span>
      </div>
      <div className="absolute bottom-2 left-2 sm:left-4 px-2 py-1 rounded border border-blue-500/20 bg-[var(--theme-card-bg)]">
        <span className="text-[10px] text-blue-700 dark:text-blue-400">4 accounts</span>
      </div>
    </div>
  )
}

function GTMVisual() {
  return (
    <div className="relative w-full h-48 sm:h-56 lg:h-60 flex items-center justify-center overflow-hidden">
      {/* CSS Animation Keyframes */}
      <style jsx>{`
        @keyframes metricPulse {
          0%,
          100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes barGrow {
          0%,
          100% {
            transform: scaleX(0.95);
          }
          50% {
            transform: scaleX(1);
          }
        }
        .metric-pulse {
          animation: metricPulse 2s ease-in-out infinite;
        }
        .bar-grow {
          animation: barGrow 3s ease-in-out infinite;
        }
      `}</style>

      <div className="flex items-center gap-2 sm:gap-3 lg:gap-5 px-2 sm:px-3 scale-[0.85] sm:scale-95 lg:scale-100">
        {/* Channel spend bars */}
        <div className="flex flex-col gap-2.5">
          {[
            { label: 'Paid', value: '$48K', pct: 85, color: 'bg-purple-500' },
            { label: 'Organic', value: '$32K', pct: 65, color: 'bg-blue-500' },
            { label: 'Direct', value: '$18K', pct: 40, color: 'bg-emerald-500' },
          ].map((ch, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px] theme-text-secondary w-11 text-right">{ch.label}</span>
              <div className="w-14 sm:w-20 h-2.5 rounded-full bg-slate-500/10">
                <div
                  className={`h-full rounded-full ${ch.color}/60 bar-grow`}
                  style={{ width: `${ch.pct}%`, animationDelay: `${i * 0.3}s` }}
                />
              </div>
              <span className={`text-[10px] font-semibold text-purple-600 dark:text-purple-400`}>
                {ch.value}
              </span>
            </div>
          ))}
        </div>

        {/* Funnel */}
        <div className="relative">
          <svg className="w-24 h-32 sm:w-28 sm:h-36" viewBox="0 0 100 130">
            <defs>
              <linearGradient id="funnelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(168, 85, 247, 0.18)" />
                <stop offset="100%" stopColor="rgba(16, 185, 129, 0.12)" />
              </linearGradient>
              <path id="funnelPathCenter" d="M 50 8 L 50 122" />
              <path id="funnelPathLeft" d="M 18 8 Q 34 44, 40 80 L 42 122" />
              <path id="funnelPathRight" d="M 82 8 Q 66 44, 60 80 L 58 122" />
            </defs>

            <path
              d="M 4 0 L 96 0 L 70 46 L 64 84 L 64 130 L 36 130 L 36 84 L 30 46 Z"
              fill="url(#funnelGrad)"
            />
            <path
              d="M 4 0 L 96 0 L 70 46 L 64 84 L 64 130 L 36 130 L 36 84 L 30 46 Z"
              fill="none"
              stroke="rgba(168, 85, 247, 0.3)"
              strokeWidth="1.5"
            />
            <line
              x1="30"
              y1="46"
              x2="70"
              y2="46"
              stroke="rgba(168, 85, 247, 0.15)"
              strokeWidth="1"
            />
            <line
              x1="36"
              y1="84"
              x2="64"
              y2="84"
              stroke="rgba(168, 85, 247, 0.15)"
              strokeWidth="1"
            />

            <circle r="3" fill="rgba(168, 85, 247, 0.7)">
              <animateMotion dur="3s" repeatCount="indefinite">
                <mpath href="#funnelPathCenter" />
              </animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle r="2.5" fill="rgba(168, 85, 247, 0.5)">
              <animateMotion dur="3s" repeatCount="indefinite" begin="1s">
                <mpath href="#funnelPathLeft" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="3s"
                repeatCount="indefinite"
                begin="1s"
              />
            </circle>
            <circle r="2.5" fill="rgba(168, 85, 247, 0.5)">
              <animateMotion dur="3s" repeatCount="indefinite" begin="2s">
                <mpath href="#funnelPathRight" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="3s"
                repeatCount="indefinite"
                begin="2s"
              />
            </circle>

            <text
              x="50"
              y="25"
              textAnchor="middle"
              fill="currentColor"
              className="theme-text-secondary"
              fontSize="10"
            >
              Visits
            </text>
            <text
              x="50"
              y="67"
              textAnchor="middle"
              fill="currentColor"
              className="theme-text-secondary"
              fontSize="10"
            >
              Leads
            </text>
            <text
              x="50"
              y="112"
              textAnchor="middle"
              fill="currentColor"
              className="theme-text-secondary"
              fontSize="10"
            >
              Deals
            </text>
          </svg>
        </div>

        {/* Revenue output */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-18 sm:w-20 h-20 sm:h-24 rounded-xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-transparent flex flex-col items-center justify-center gap-1"
            style={{ minWidth: '72px' }}
          >
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span className="text-xs sm:text-sm text-emerald-500 font-bold">$98K</span>
            <span className="text-[10px] theme-text-secondary">MRR</span>
          </div>
          <div className="flex gap-1.5">
            <div className="px-1.5 py-0.5 rounded border border-purple-500/30">
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                $45 CAC
              </span>
            </div>
            <div className="px-1.5 py-0.5 rounded border border-blue-500/30">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                20x LTV
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OperationsVisual() {
  return (
    <div className="relative w-full h-48 sm:h-56 lg:h-60 flex items-center justify-center overflow-hidden pt-4 sm:pt-6">
      {/* CSS Animation Keyframes */}
      <style jsx>{`
        @keyframes inventoryPulse {
          0%,
          100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }
        @keyframes stockFlow {
          0% {
            transform: translateX(-10px);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(10px);
            opacity: 0;
          }
        }
        @keyframes alertBlink {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes syncRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .inv-pulse {
          animation: inventoryPulse 3s ease-in-out infinite;
        }
        .stock-flow {
          animation: stockFlow 2s ease-in-out infinite;
        }
        .stock-flow-delayed {
          animation: stockFlow 2s ease-in-out infinite 0.5s;
        }
        .alert-blink {
          animation: alertBlink 2s ease-in-out infinite;
        }
        .sync-rotate {
          animation: syncRotate 4s linear infinite;
        }
      `}</style>

      <div className="flex items-center gap-3 sm:gap-5 lg:gap-7 scale-[0.85] sm:scale-95 lg:scale-100">
        {/* Warehouse visualization */}
        <div className="relative">
          {/* Inventory grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { fill: 95, alert: false },
              { fill: 80, alert: false },
              { fill: 70, alert: false },
              { fill: 50, alert: false },
              { fill: 25, alert: true },
              { fill: 15, alert: true },
              { fill: 85, alert: false },
              { fill: 10, alert: true },
              { fill: 0, alert: false },
            ].map((item, i) => (
              <div
                key={i}
                className={`relative w-8 h-10 sm:w-9 sm:h-12 rounded-md border ${
                  item.alert
                    ? 'border-amber-500/60 alert-blink'
                    : item.fill > 0
                      ? 'border-emerald-500/30'
                      : 'border-slate-500/20 border-dashed'
                } overflow-hidden inv-pulse`}
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {item.fill > 0 && (
                  <div
                    className={`absolute bottom-0 left-0 right-0 ${
                      item.alert ? 'bg-amber-500/40' : 'bg-emerald-500/30'
                    }`}
                    style={{ height: `${item.fill}%` }}
                  />
                )}
                {item.fill > 0 && (
                  <Package
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 ${
                      item.alert ? 'text-amber-500' : 'text-emerald-500/60'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Stock level legend */}
          <div className="absolute -bottom-5 left-0 right-0 flex justify-center gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-emerald-500/50" />
              <span className="theme-text-secondary">In stock</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-amber-500/50" />
              <span className="theme-text-secondary">Low</span>
            </div>
          </div>
        </div>

        {/* Flow arrows with animated dots on the line */}
        <div className="relative w-12 sm:w-16 h-14">
          <svg className="w-full h-full" viewBox="0 0 48 56">
            <defs>
              <path id="erpFlowPath" d="M 0 28 L 48 28" />
            </defs>

            <path
              d="M 0 28 L 48 28"
              fill="none"
              stroke="rgba(245, 158, 11, 0.3)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <path
              d="M 38 22 L 48 28 L 38 34"
              fill="none"
              stroke="rgba(245, 158, 11, 0.5)"
              strokeWidth="2"
            />

            <circle r="2.5" fill="rgba(245, 158, 11, 0.9)">
              <animateMotion dur="2s" repeatCount="indefinite">
                <mpath href="#erpFlowPath" />
              </animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="2.5" fill="rgba(245, 158, 11, 0.9)">
              <animateMotion dur="2s" repeatCount="indefinite" begin="0.5s">
                <mpath href="#erpFlowPath" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="2s"
                repeatCount="indefinite"
                begin="0.5s"
              />
            </circle>
          </svg>
        </div>

        {/* ERP System hub */}
        <div className="relative">
          <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent flex flex-col items-center justify-center gap-1">
            <Building2 className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] theme-text-secondary">ERP Sync</span>
            <span className="text-xs text-amber-500 font-bold">142 SKUs</span>
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 border border-emerald-500 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      </div>

      {/* Stats badges */}
      <div className="absolute top-2 right-2 sm:right-4 px-2 py-1 rounded border border-emerald-600/30 bg-[var(--theme-card-bg)]">
        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
          83% in stock
        </span>
      </div>
      <div className="absolute top-2 left-2 sm:left-4 px-2 py-1 rounded border border-amber-600/30 bg-[var(--theme-card-bg)]">
        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
          3 low stock
        </span>
      </div>
    </div>
  )
}

function MultiEntityVisual() {
  return (
    <div className="relative w-full h-48 sm:h-56 lg:h-60 flex items-center justify-center overflow-hidden">
      {/* CSS Animation Keyframes */}
      <style jsx>{`
        @keyframes entityPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.02);
            opacity: 1;
          }
        }
        @keyframes flowTop {
          0% {
            offset-distance: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            offset-distance: 100%;
            opacity: 0;
          }
        }
        @keyframes flowMiddle {
          0% {
            offset-distance: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            offset-distance: 100%;
            opacity: 0;
          }
        }
        @keyframes flowBottom {
          0% {
            offset-distance: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            offset-distance: 100%;
            opacity: 0;
          }
        }
        @keyframes consolidatePulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.2);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
          }
        }
        @keyframes reportSlide {
          0%,
          100% {
            transform: translateX(0);
            opacity: 0.7;
          }
          50% {
            transform: translateX(2px);
            opacity: 1;
          }
        }
        @keyframes outputFlow {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateX(24px);
            opacity: 0;
          }
        }
        .entity-pulse {
          animation: entityPulse 3s ease-in-out infinite;
        }
        .flow-top {
          offset-path: path('M 0 20 Q 24 20, 48 64');
          animation: flowTop 2.5s ease-in-out infinite;
        }
        .flow-middle {
          offset-path: path('M 0 64 L 48 64');
          animation: flowMiddle 2.5s ease-in-out infinite 0.4s;
        }
        .flow-bottom {
          offset-path: path('M 0 108 Q 24 108, 48 64');
          animation: flowBottom 2.5s ease-in-out infinite 0.8s;
        }
        .consolidate-pulse {
          animation: consolidatePulse 2s ease-in-out infinite;
        }
        .report-slide {
          animation: reportSlide 2s ease-in-out infinite;
        }
        .output-flow {
          animation: outputFlow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Multiple entities flowing into consolidated view */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-5 px-2 sm:px-4 pt-4 sm:pt-6 scale-[0.8] sm:scale-90 lg:scale-100">
        {/* Entity boxes (left side) */}
        <div className="flex flex-col gap-2">
          {[
            { label: 'Corp A', value: '$1.2M', color: 'blue' },
            { label: 'Corp B', value: '$800K', color: 'blue' },
            { label: 'Corp C', value: '$450K', color: 'blue' },
          ].map((entity, i) => (
            <div
              key={i}
              className="w-16 sm:w-18 h-10 sm:h-11 rounded-lg border border-blue-500/30 bg-blue-500/5 flex flex-col items-center justify-center gap-0.5 entity-pulse"
              style={{ animationDelay: `${i * 0.3}s`, minWidth: '64px' }}
            >
              <span className="text-[10px] theme-text-secondary">{entity.label}</span>
              <span className="text-[11px] text-blue-500 font-semibold">{entity.value}</span>
            </div>
          ))}
        </div>

        {/* Flow arrows converging */}
        <div className="relative w-10 sm:w-14 h-32 sm:h-36">
          <svg className="w-full h-full" viewBox="0 0 48 128">
            <defs>
              <path id="pathTop" d="M 0 20 Q 24 20, 48 64" />
              <path id="pathMiddle" d="M 0 64 L 48 64" />
              <path id="pathBottom" d="M 0 108 Q 24 108, 48 64" />
            </defs>

            <path
              d="M 0 20 Q 24 20, 48 64"
              fill="none"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="2"
            />
            <path d="M 0 64 L 48 64" fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="2" />
            <path
              d="M 0 108 Q 24 108, 48 64"
              fill="none"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="2"
            />

            <circle r="3" fill="rgba(59, 130, 246, 0.8)">
              <animateMotion dur="2.5s" repeatCount="indefinite">
                <mpath href="#pathTop" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </circle>
            <circle r="3" fill="rgba(59, 130, 246, 0.8)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0.4s">
                <mpath href="#pathMiddle" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="2.5s"
                repeatCount="indefinite"
                begin="0.4s"
              />
            </circle>
            <circle r="3" fill="rgba(59, 130, 246, 0.8)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0.8s">
                <mpath href="#pathBottom" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="2.5s"
                repeatCount="indefinite"
                begin="0.8s"
              />
            </circle>
          </svg>
        </div>

        {/* Consolidated view (center) */}
        <div className="relative">
          <div
            className="w-18 sm:w-22 rounded-xl border-2 border-blue-500/40 bg-gradient-to-b from-blue-500/10 to-transparent flex flex-col items-center justify-center gap-1 consolidate-pulse py-3 px-2"
            style={{ minWidth: '72px', minHeight: '88px' }}
          >
            <Building2 className="w-5 h-5 text-blue-500" />
            <span className="text-[10px] theme-text-secondary">Consolidated</span>
            <span className="text-xs text-blue-500 font-bold">$2.45M</span>
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 border border-emerald-500 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" />
          </div>
        </div>

        {/* Output arrow with animated dot */}
        <div className="relative w-8 sm:w-10">
          <div className="w-full h-0.5 bg-gradient-to-r from-blue-500/40 to-purple-500/40 rounded" />
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1.5 h-1.5 rounded-full bg-purple-500 output-flow" />
        </div>

        {/* Reports/Outputs */}
        <div className="flex flex-col gap-1.5">
          {['P&L', 'Balance', 'Cash'].map((report, i) => (
            <div
              key={i}
              className="w-12 sm:w-14 h-6 sm:h-7 rounded-lg border border-purple-500/30 flex items-center justify-center"
            >
              <span className="text-[10px] text-purple-700 dark:text-purple-200">{report}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status indicators */}
      <div className="absolute top-2 right-2 sm:right-4 px-2 py-1 rounded border border-emerald-500/20 bg-[var(--theme-card-bg)]">
        <span className="text-[10px] text-emerald-500">Auto-synced</span>
      </div>
      <div className="absolute top-2 left-2 sm:left-4 px-2 py-1 rounded border border-blue-500/20 bg-[var(--theme-card-bg)]">
        <span className="text-[10px] text-blue-400">3 entities</span>
      </div>
    </div>
  )
}

const products = [
  {
    id: 'financial-health',
    icon: Building2,
    title: 'Financial Health & Planning',
    description:
      'Real-time financial performance and forward-looking plans, grounded in actual business data. Continuously surface trends, risks, and opportunities.',
    outcomes: [
      'Clear financial visibility',
      'Accurate runway planning',
      'Strategy-finance alignment',
    ],
    systems: ['Accounting', 'ERPs', 'Banking'],
    color: 'blue',
    Visual: FinancialHealthVisual,
  },
  {
    id: 'banking',
    icon: CreditCard,
    title: 'Banking & Payments Intelligence',
    description:
      'Real-time understanding of liquidity and cash timing. Identify where cash gets stuck and what actions improve cash flow.',
    outcomes: ['Stronger liquidity', 'Cash predictability', 'Reduced financial stress'],
    systems: ['Banks', 'Payments', 'Cards'],
    color: 'emerald',
    Visual: BankingVisual,
  },
  {
    id: 'gtm',
    icon: Users,
    title: 'Go-to-Market & Customer',
    description:
      'Understand which channels, customers, and strategies drive sustainable growth—and which ones erode margin.',
    outcomes: ['Better GTM ROI', 'Healthier revenue mix', 'Predictable growth'],
    systems: ['Marketing', 'CRMs', 'Sales'],
    color: 'purple',
    Visual: GTMVisual,
  },
  {
    id: 'operations',
    icon: Puzzle,
    title: 'Operations Inventory & ERP',
    description:
      'Understand how operational complexity affects financial performance. Smarter planning around inventory and fulfillment.',
    outcomes: ['Less capital lock-up', 'Ops-finance alignment', 'Fewer surprises'],
    systems: ['ERPs', 'Inventory', 'OMS'],
    color: 'amber',
    Visual: OperationsVisual,
  },
  {
    id: 'multi-entity',
    icon: Building2,
    title: 'Multi-Entity Analysis',
    description:
      'Consolidated financial intelligence across all entities, subsidiaries, and portfolio companies. Automated consolidation with standardized reporting.',
    outcomes: ['Unified visibility', 'Automated consolidation', 'Cross-entity insights'],
    systems: ['Accounting', 'ERPs', 'Consolidation'],
    color: 'blue',
    Visual: MultiEntityVisual,
  },
]

const colorClasses = {
  blue: {
    border: 'border-slate-500/20',
    borderHover: 'hover:border-amber-500/40',
    bg: 'bg-slate-500/5',
    bgGradient: 'from-slate-500/5 to-transparent',
    glow: 'shadow-slate-500/5',
  },
  emerald: {
    border: 'border-slate-500/20',
    borderHover: 'hover:border-amber-500/40',
    bg: 'bg-slate-500/5',
    bgGradient: 'from-slate-500/5 to-transparent',
    glow: 'shadow-slate-500/5',
  },
  purple: {
    border: 'border-slate-500/20',
    borderHover: 'hover:border-amber-500/40',
    bg: 'bg-slate-500/5',
    bgGradient: 'from-slate-500/5 to-transparent',
    glow: 'shadow-slate-500/5',
  },
  amber: {
    border: 'border-slate-500/20',
    borderHover: 'hover:border-amber-500/40',
    bg: 'bg-slate-500/5',
    bgGradient: 'from-slate-500/5 to-transparent',
    glow: 'shadow-slate-500/5',
  },
}

export default function ProductsPage() {
  const { theme } = useTheme()

  return (
    <div
      className={`min-h-screen ${dmSans.variable} ${ebGaramond.variable} ${stixTwoText.variable}`}
      style={{ fontFamily: 'var(--font-dm-sans)' }}
    >
      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          {/* Title */}
          <h1
            className="text-[48px] sm:text-5xl lg:text-6xl font-light theme-text-primary mb-6 leading-[1.05] sm:leading-normal"
            style={{ fontFamily: 'var(--font-eb-garamond)' }}
          >
            One{' '}
            <span
              className="text-transparent bg-clip-text italic px-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #f59e0b, #d97706)',
              }}
            >
              Platform.
            </span>
            <br className="sm:hidden" />
            Complete Intelligence.
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg 2xl:text-xl theme-text-secondary mb-14 sm:mb-20 max-w-xl mx-auto"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Built around decision domains—not features. Each capability answers a core question
            every business needs to understand.
          </p>

          {/* Visual product indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-4 sm:mb-4 max-w-[288px] sm:max-w-none mx-auto">
            {products.map((product) => {
              const Icon = product.icon
              const colors = colorClasses[product.color as keyof typeof colorClasses]
              return (
                <a
                  key={product.id}
                  href={`#${product.id}`}
                  className="group flex flex-col items-center gap-2 transition-all w-[80px] sm:w-auto"
                >
                  <Icon
                    className="w-6 h-6 group-hover:scale-110 transition-transform"
                    style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                  />
                  <span className="text-[12px] theme-text-secondary">
                    {product.title.split(' ')[0]}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8 lg:space-y-12">
          {/* Platform Capabilities Label */}
          <div className="inline-flex items-center gap-2 mb-8 w-full justify-center">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
            <span
              className="text-xs font-semibold tracking-[0.2em] uppercase"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: theme === 'light' ? '#CF6900' : '#f59e0b',
              }}
            >
              Platform Capabilities
            </span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>

          {products.map((product, index) => {
            const Icon = product.icon
            const colors = colorClasses[product.color as keyof typeof colorClasses]
            const Visual = product.Visual
            const isEven = index % 2 === 0

            return (
              <div key={product.id}>
                {/* Decorative divider between sections */}
                {index > 0 && (
                  <div className="relative py-6 lg:py-8 mb-8 lg:mb-12">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl">
                      <div className="h-px bg-gradient-to-r from-transparent via-[var(--theme-card-border)] to-transparent" />
                    </div>
                    <div className="relative flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-[var(--theme-bg)] border border-amber-500/30 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-amber-500/50" />
                      </div>
                    </div>
                  </div>
                )}

                <div
                  id={product.id}
                  className={cn(
                    'rounded-3xl overflow-hidden scroll-mt-24',
                    'border border-[var(--theme-card-border)]',
                    theme === 'light' ? 'bg-[#FFFDFA]' : 'bg-[#1a1a1a]'
                  )}
                >
                  <div className="px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14">
                    <div
                      className={cn(
                        'grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch',
                        !isEven && 'lg:[direction:rtl]'
                      )}
                    >
                      {/* Content */}
                      <div
                        className={cn(
                          'lg:col-span-7 flex flex-col justify-center',
                          !isEven && 'lg:[direction:ltr]'
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-4 mb-4">
                          <Icon
                            className="w-10 h-10"
                            strokeWidth={1.5}
                            style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                          />
                          <h2
                            className="text-2xl sm:text-3xl lg:text-4xl theme-text-primary"
                            style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
                          >
                            {product.title}
                          </h2>
                        </div>

                        {/* Description */}
                        <p
                          className="theme-text-secondary mb-8 leading-relaxed text-base lg:text-lg max-w-2xl"
                          style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
                        >
                          {product.description}
                        </p>

                        {/* Outcomes */}
                        <div className="mb-8">
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                            {product.outcomes.map((outcome) => (
                              <li key={outcome} className="flex items-start gap-3">
                                <ChevronRight
                                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                                  style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                                />
                                <span
                                  className="text-sm theme-text-secondary leading-relaxed"
                                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                                >
                                  {outcome}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Systems */}
                        <div className="flex items-center gap-2 text-xs theme-text-secondary pl-1">
                          <span className="font-medium">Connects:</span>
                          <span>{product.systems.join(' • ')}</span>
                        </div>
                      </div>

                      {/* Visual */}
                      <div
                        className={cn(
                          'lg:col-span-5 flex items-center justify-center rounded-2xl border border-[var(--theme-card-border)] min-h-[220px] sm:min-h-[260px] lg:min-h-[300px] overflow-hidden p-2',
                          !isEven && 'lg:[direction:ltr]'
                        )}
                      >
                        <Visual />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 sm:py-32 lg:py-40 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/[0.02] to-transparent" />

        {/* Decorative elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-30 pointer-events-none">
          <div className="absolute inset-0 rounded-full border border-amber-500/10" />
          <div className="absolute inset-12 rounded-full border border-amber-500/5" />
          <div className="absolute inset-24 rounded-full border border-amber-500/5" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* CTA Content */}
          <div className="text-center">
            {/* Heading */}
            <h2
              className="text-[48px] theme-text-primary mb-6 leading-tight"
              style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
            >
              Ready to connect your{' '}
              <span className="relative inline-block">
                <span
                  className="text-transparent bg-clip-text italic px-[0.15em]"
                  style={{
                    backgroundImage:
                      theme === 'light'
                        ? 'linear-gradient(to right, #CF6900, #CF6900)'
                        : 'linear-gradient(to right, #fbbf24, #d97706)',
                  }}
                >
                  stack
                </span>
              </span>
              ?
            </h2>

            {/* Subheading */}
            <p
              className="text-lg sm:text-xl theme-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed"
              style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
            >
              Start free and explore how Midas unifies your business intelligence.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link
                href="/sign-up"
                className="group inline-flex items-center justify-center gap-2.5 min-w-[210px] px-8 py-4 text-white text-[14px] font-semibold rounded-full transition-all duration-300 hover:scale-[1.02]"
                style={{
                  fontFamily: 'var(--font-dm-sans)',
                  backgroundColor: theme === 'light' ? '#CF6900' : undefined,
                  backgroundImage:
                    theme === 'light' ? 'none' : 'linear-gradient(to right, #f59e0b, #d97706)',
                  boxShadow:
                    theme === 'light'
                      ? '0 20px 25px -5px rgba(207, 105, 0, 0.25)'
                      : '0 20px 25px -5px rgba(245, 158, 11, 0.25)',
                }}
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/schedule-demo"
                className="group inline-flex items-center justify-center gap-2.5 min-w-[210px] px-8 py-4 rounded-full border border-[var(--theme-card-border)] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-300"
                style={{
                  fontFamily: 'var(--font-dm-sans)',
                  backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a',
                }}
              >
                <Calendar className="w-5 h-5 text-amber-500" />
                <span className="text-[14px] font-semibold theme-text-primary">
                  Schedule a Demo
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
