/**
 * @module colors
 * @description Centralized color system for all visualizations
 * Provides consistent theming across charts with WCAG 2.1 AA compliance
 */

/**
 * Primary color palette for charts
 * Designed for dark theme with high contrast
 */
export const COLORS = {
  amber: '#f59e0b',
  blue: '#3b82f6',
  emerald: '#10b981',
  purple: '#8b5cf6',
  red: '#ef4444',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
  lime: '#84cc16',
  indigo: '#6366f1',
} as const

/**
 * Color palette array for sequential chart data
 */
export const colorPalette = Object.values(COLORS)

/**
 * Map CSS named colors to hex values
 * Used for resolving user-provided color names
 */
export const namedColorMap: Record<string, string> = {
  royalblue: '#4169E1',
  blue: '#3b82f6',
  emerald: '#10b981',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  orange: '#f97316',
  purple: '#8b5cf6',
  seagreen: '#2E8B57',
  darkorange: '#FF8C00',
  slategray: '#708090',
  crimson: '#DC143C',
  midnightblue: '#191970',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  lime: '#84cc16',
  indigo: '#6366f1',
}

/**
 * Semantic colors for specific chart states
 */
export const semanticColors = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
} as const

/**
 * Resolve a color string to hex value
 * Supports hex, rgb, and named colors
 *
 * @param color - Color string (hex, rgb, or named color)
 * @param fallback - Fallback color if resolution fails
 * @returns Hex color string
 */
export function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback
  if (color.startsWith('#') || color.startsWith('rgb')) return color
  return namedColorMap[color.toLowerCase()] || fallback
}

/**
 * Get color from palette by index with wrap-around
 *
 * @param index - Index in the palette
 * @returns Color from palette
 */
export function getColorByIndex(index: number): string {
  return colorPalette[index % colorPalette.length]
}
