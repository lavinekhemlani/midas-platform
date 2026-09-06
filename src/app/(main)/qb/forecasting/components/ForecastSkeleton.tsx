'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useTheme } from '@/hooks/useTheme'

/**
 * Skeleton loading state for the forecast chart
 * Shows an animated placeholder that mimics the chart structure
 * Uses useTheme hook for proper light/dark mode support
 */
export function ForecastSkeleton() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Theme-aware shimmer background
  const shimmer = isLight ? 'bg-black/[0.08] animate-pulse' : 'bg-gray-200/10 animate-pulse'

  const shimmerSubtle = isLight ? 'bg-black/[0.05]' : 'bg-gray-200/5'

  // SVG colors based on theme
  const historicalStroke = isLight ? 'rgba(37, 99, 235, 0.5)' : 'rgba(59, 130, 246, 0.3)'
  const forecastStroke = isLight ? 'rgba(220, 38, 38, 0.5)' : 'rgba(248, 113, 113, 0.3)'
  const bandFill = isLight ? 'rgba(220, 38, 38, 0.12)' : 'rgba(248, 113, 113, 0.08)'
  const todayStroke = isLight ? 'rgba(100, 116, 139, 0.5)' : 'rgba(148, 163, 184, 0.3)'

  return (
    <div className="@container space-y-4">
      {/* Horizon tabs skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <div className={`h-9 w-28 ${shimmer}`} />
          <div className={`h-9 w-28 ${shimmer}`} />
        </div>
        <div className={`h-9 w-24 ${shimmer}`} />
      </div>

      {/* Chart card skeleton */}
      <Card className="glass-luxury-card overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className={`h-5 w-40 ${shimmer}`} />
            <div className="flex items-center gap-2">
              <div className={`h-5 w-24 ${shimmer}`} />
              <div className={`h-5 w-9 ${shimmer}`} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Chart area skeleton */}
          <div className="relative px-6" style={{ height: 400 }}>
            {/* Y-axis labels */}
            <div className="absolute left-4 top-8 bottom-8 w-12 flex flex-col justify-between">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-3 w-10 ${shimmer}`} />
              ))}
            </div>

            {/* Chart content area */}
            <div className="absolute left-20 right-8 top-8 bottom-12">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`h-px ${shimmerSubtle}`} />
                ))}
              </div>

              {/* Animated fake chart line */}
              <svg className="absolute inset-0 w-full h-full overflow-visible">
                {/* Historical line path */}
                <path
                  d="M 0 180 Q 60 160, 120 170 T 240 150"
                  fill="none"
                  stroke={historicalStroke}
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="animate-pulse"
                />
                {/* Forecast line path (dashed) */}
                <path
                  d="M 240 150 Q 320 130, 400 120 T 560 80"
                  fill="none"
                  stroke={forecastStroke}
                  strokeWidth="2.5"
                  strokeDasharray="8 4"
                  strokeLinecap="round"
                  className="animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                {/* Confidence band */}
                <path
                  d="M 240 150 Q 320 100, 400 80 T 560 40 L 560 120 Q 400 160, 320 160 T 240 150"
                  fill={bandFill}
                  stroke="none"
                  className="animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                {/* Today line */}
                <line
                  x1="240"
                  y1="0"
                  x2="240"
                  y2="100%"
                  stroke={todayStroke}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              </svg>
            </div>

            {/* X-axis labels */}
            <div className="absolute left-20 right-8 bottom-2 flex justify-between">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-8 ${shimmer}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>
          </div>

          {/* Legend skeleton */}
          <div className="flex items-center justify-center gap-4 px-6 pt-2 pb-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-5 h-1 ${shimmer}`} />
                <div className={`h-3 w-12 ${shimmer}`} style={{ animationDelay: `${i * 75}ms` }} />
              </div>
            ))}
          </div>

          {/* Summary stats skeleton */}
          <div className="grid grid-cols-2 @lg:grid-cols-4 gap-4 px-6 py-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <div
                  className={`h-2.5 w-16 mx-auto ${shimmer}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                />
                <div
                  className={`h-6 w-20 mx-auto ${shimmer}`}
                  style={{ animationDelay: `${i * 100 + 50}ms` }}
                />
              </div>
            ))}
          </div>

          {/* Assumptions skeleton */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-center mb-4">
              <div className={`h-4 w-24 ${shimmer}`} />
            </div>
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className={`h-3 w-24 ${shimmer}`} />
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`h-7 w-24 ${shimmer}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 @lg:grid-cols-4 gap-x-6 gap-y-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <div
                      className={`h-3 w-20 ${shimmer}`}
                      style={{ animationDelay: `${i * 75}ms` }}
                    />
                    <div
                      className={`h-3 w-8 ${shimmer}`}
                      style={{ animationDelay: `${i * 75 + 25}ms` }}
                    />
                  </div>
                  <div
                    className={`h-2 w-full ${shimmer}`}
                    style={{ animationDelay: `${i * 75 + 50}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table skeleton */}
      <Card className="glass-luxury-card">
        <CardHeader className="pb-2">
          <div className={`h-5 w-32 ${shimmer}`} />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`h-4 w-32 ${shimmer}`} />
                <div className="flex-1 flex justify-end gap-4">
                  {[...Array(6)].map((_, j) => (
                    <div
                      key={j}
                      className={`h-4 w-16 ${shimmer}`}
                      style={{ animationDelay: `${(i * 6 + j) * 20}ms` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
