'use client'

import { useRef, useState, useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ResponsiveChartContainerProps {
  children: (dimensions: { width: number; height: number }) => ReactNode
  aspectRatio: string // e.g., '16/9', '4/3', '2/1'
  className?: string
  minHeight?: number
  maxHeight?: number
}

/**
 * Responsive container that calculates explicit pixel dimensions for ECharts
 * based on container width and aspect ratio.
 */
export function ResponsiveChartContainer({
  children,
  aspectRatio,
  className,
  minHeight = 200,
  maxHeight = 500,
}: ResponsiveChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const calculateDimensions = () => {
      const width = container.offsetWidth
      if (width === 0) return

      // Parse aspect ratio (e.g., '16/9' -> 16/9 = 1.778)
      const [w, h] = aspectRatio.split('/').map(Number)
      const ratio = w / h

      // Calculate height from width and aspect ratio
      let height = Math.round(width / ratio)

      // Clamp height to min/max bounds
      height = Math.max(minHeight, Math.min(maxHeight, height))

      setDimensions({ width, height })
    }

    // Initial calculation
    calculateDimensions()

    // Observe resize
    const resizeObserver = new ResizeObserver(() => {
      calculateDimensions()
    })

    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [aspectRatio, minHeight, maxHeight])

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      {dimensions.width > 0 && dimensions.height > 0 && children(dimensions)}
    </div>
  )
}
