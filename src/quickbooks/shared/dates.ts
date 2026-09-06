/**
 * QuickBooks Date/Time Utilities
 *
 * QB API returns dates in these formats:
 * - Date only: "2024-01-15"
 * - DateTime: "2024-01-15T10:30:00-08:00"
 */

/**
 * Parse a QuickBooks date string to ISO format
 * Returns null for invalid/empty dates
 */
export function parseQBDate(value: string | undefined | null): string | null {
  if (!value || value === '') return null

  // Already a valid date format - just validate
  const date = new Date(value)
  if (isNaN(date.getTime())) return null

  // Return ISO string (preserves timezone info)
  return value
}

/**
 * Parse a QuickBooks datetime to ISO format
 * Handles QB's datetime format with timezone
 */
export function parseQBDateTime(value: string | undefined | null): string | null {
  if (!value || value === '') return null

  const date = new Date(value)
  if (isNaN(date.getTime())) return null

  return date.toISOString()
}

/**
 * Format a date for QB API request (YYYY-MM-DD)
 * Uses local timezone to avoid UTC conversion issues
 * IMPORTANT: Do NOT use toISOString() as it converts to UTC and can shift dates
 * across midnight boundaries (e.g., 11pm PST becomes next day in UTC)
 */
export function formatQBDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse MetaData timestamps
 */
export function parseMetaDataDates(metaData?: { CreateTime?: string; LastUpdatedTime?: string }): {
  createdAt: string | null
  updatedAt: string | null
} {
  return {
    createdAt: parseQBDateTime(metaData?.CreateTime),
    updatedAt: parseQBDateTime(metaData?.LastUpdatedTime),
  }
}
