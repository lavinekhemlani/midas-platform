/**
 * @module useThemeTooltip
 * @description Theme-reactive tooltip configuration for ECharts
 * Matches the tooltip styling from ReportChart.tsx in /reports
 */

'use client'

import { useState, useEffect, useMemo } from 'react'

interface ThemeTooltipColors {
  backgroundColor: string
  borderColor: string
  textPrimary: string
  textSecondary: string
}

const DARK_THEME_COLORS: ThemeTooltipColors = {
  backgroundColor: 'rgba(30, 30, 35, 0.95)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
  textPrimary: '#f3f4f6',
  textSecondary: '#9ca3af',
}

const LIGHT_THEME_COLORS: ThemeTooltipColors = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderColor: 'rgba(0, 0, 0, 0.1)',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
}

/**
 * Hook to detect current theme and return appropriate colors
 */
export function useThemeColors(): ThemeTooltipColors {
  const [colors, setColors] = useState<ThemeTooltipColors>(DARK_THEME_COLORS)

  useEffect(() => {
    const getThemeColors = () => {
      const theme = document.documentElement.className
      if (theme.includes('theme-light')) {
        setColors(LIGHT_THEME_COLORS)
      } else {
        setColors(DARK_THEME_COLORS)
      }
    }

    // Initial check
    getThemeColors()

    // Listen for theme changes via class mutation
    const observer = new MutationObserver(() => {
      getThemeColors()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  return colors
}

/**
 * Hook to get theme-reactive ECharts tooltip style
 * Use this in chart components that need theme-reactive tooltips
 */
export function useThemeTooltipStyle() {
  const colors = useThemeColors()

  return useMemo(
    () => ({
      backgroundColor: colors.backgroundColor,
      borderColor: colors.borderColor,
      borderWidth: 1,
      borderRadius: 4,
      padding: [8, 12],
      textStyle: { color: colors.textPrimary, fontSize: 12 },
      extraCssText: `box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);`,
    }),
    [colors]
  )
}

/**
 * Hook to get theme-reactive axis label style
 */
export function useThemeAxisLabelStyle() {
  const colors = useThemeColors()

  return useMemo(
    () => ({
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'DM Sans, sans-serif',
    }),
    [colors]
  )
}

/**
 * Hook to get theme-reactive axis line style
 */
export function useThemeAxisLineStyle() {
  const colors = useThemeColors()

  return useMemo(() => {
    const isLight = colors.textPrimary === '#1f2937'
    return {
      color: isLight ? '#d1d5db' : '#374151',
    }
  }, [colors])
}

/**
 * Hook to get theme-reactive split line style
 */
export function useThemeSplitLineStyle() {
  const colors = useThemeColors()

  return useMemo(() => {
    const isLight = colors.textPrimary === '#1f2937'
    return {
      color: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
    }
  }, [colors])
}

/**
 * Hook to get all theme-reactive ECharts configuration
 * Convenience hook that returns all theme-aware config objects
 */
export function useThemeEChartsConfig() {
  const tooltipStyle = useThemeTooltipStyle()
  const axisLabelStyle = useThemeAxisLabelStyle()
  const axisLineStyle = useThemeAxisLineStyle()
  const splitLineStyle = useThemeSplitLineStyle()
  const colors = useThemeColors()

  return useMemo(
    () => ({
      tooltipStyle,
      axisLabelStyle,
      axisLineStyle,
      splitLineStyle,
      isLightTheme: colors.textPrimary === '#1f2937',
      colors,
    }),
    [tooltipStyle, axisLabelStyle, axisLineStyle, splitLineStyle, colors]
  )
}

export { DARK_THEME_COLORS, LIGHT_THEME_COLORS }
export type { ThemeTooltipColors }
