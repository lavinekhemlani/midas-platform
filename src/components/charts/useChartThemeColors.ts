'use client'

import { useState, useEffect, useMemo } from 'react'

interface ChartThemeColors {
  textColor: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  gridColor: string
}

const DARK_COLORS: ChartThemeColors = {
  textColor: '#94a3b8',
  tooltipBg: 'rgba(17, 24, 39, 0.95)',
  tooltipBorder: 'rgba(75, 85, 99, 0.3)',
  tooltipText: '#e5e7eb',
  gridColor: 'rgba(75, 85, 99, 0.2)',
}

const LIGHT_COLORS: ChartThemeColors = {
  textColor: '#374151',
  tooltipBg: 'rgba(255, 255, 255, 0.95)',
  tooltipBorder: 'rgba(0, 0, 0, 0.1)',
  tooltipText: '#1f2937',
  gridColor: 'rgba(0, 0, 0, 0.1)',
}

export function useChartThemeColors(): ChartThemeColors {
  const [isLight, setIsLight] = useState(() => {
    if (typeof window === 'undefined') return false
    return document.documentElement.className.includes('theme-light')
  })

  useEffect(() => {
    const update = () => {
      setIsLight(document.documentElement.className.includes('theme-light'))
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return isLight ? LIGHT_COLORS : DARK_COLORS
}
