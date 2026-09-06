/**
 * Centralized date range utilities for consistent date calculations
 * across the application
 */

export interface DateRange {
  start: string // YYYY-MM-DD format
  end: string // YYYY-MM-DD format
}

export interface PeriodOption {
  value: string
  label: string
}

export interface PeriodOptionGroup {
  label: string
  options: PeriodOption[]
}

/**
 * Grouped period options for organized dropdown display
 * Note: "This X" options always mean "to date" (up to today) for financial reporting
 */
export const PERIOD_OPTION_GROUPS: PeriodOptionGroup[] = [
  {
    label: 'Quick Access',
    options: [
      { value: 'all_dates', label: 'All Dates' },
      { value: 'custom', label: 'Custom Range' },
    ],
  },
  {
    label: 'Days',
    options: [
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: 'last_7_days', label: 'Last 7 Days' },
      { value: 'last_30_days', label: 'Last 30 Days' },
      { value: 'last_90_days', label: 'Last 90 Days' },
    ],
  },
  {
    label: 'Weeks',
    options: [
      { value: 'this_week', label: 'This Week' },
      { value: 'last_week', label: 'Last Week' },
    ],
  },
  {
    label: 'Months',
    options: [
      { value: 'this_month', label: 'This Month' },
      { value: 'last_month', label: 'Last Month' },
      { value: 'last_6_months', label: 'Last 6 Months' },
      { value: 'last_12_months', label: 'Last 12 Months' },
    ],
  },
  {
    label: 'Quarters',
    options: [
      { value: 'this_quarter', label: 'This Quarter' },
      { value: 'last_quarter', label: 'Last Quarter' },
    ],
  },
  {
    label: 'Years',
    options: [
      { value: 'this_year', label: 'This Year' },
      { value: 'last_year', label: 'Last Year' },
    ],
  },
]

/**
 * Flat list of all period options (for simple dropdowns)
 */
export const PERIOD_OPTIONS: PeriodOption[] = PERIOD_OPTION_GROUPS.flatMap((group) => group.options)

/**
 * Compact period options for space-constrained UIs
 */
export const PERIOD_OPTIONS_COMPACT: PeriodOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
]

/**
 * Standard period options (most commonly used for financial reports)
 */
export const PERIOD_OPTIONS_STANDARD: PeriodOption[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_12_months', label: 'Last 12 Months' },
  { value: 'custom', label: 'Custom Range' },
]

/**
 * Get the start and end dates for various preset periods
 * @param period - The preset period identifier
 * @returns DateRange object with start and end dates
 */
export function getDateRangeForPeriod(period: string): DateRange {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const dayOfMonth = today.getDate()
  const dayOfWeek = today.getDay()

  switch (period) {
    // === Quick Access ===
    case 'all_dates':
      // Return a very wide range (10 years back to today)
      return {
        start: formatDate(new Date(year - 10, 0, 1)),
        end: formatDate(today),
      }

    // === Days ===
    case 'today':
      return {
        start: formatDate(today),
        end: formatDate(today),
      }

    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(dayOfMonth - 1)
      return {
        start: formatDate(yesterday),
        end: formatDate(yesterday),
      }
    }

    case 'last_7_days': {
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(dayOfMonth - 7)
      return {
        start: formatDate(sevenDaysAgo),
        end: formatDate(today),
      }
    }

    case 'last_30_days': {
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(dayOfMonth - 30)
      return {
        start: formatDate(thirtyDaysAgo),
        end: formatDate(today),
      }
    }

    case 'last_60_days': {
      const sixtyDaysAgo = new Date(today)
      sixtyDaysAgo.setDate(dayOfMonth - 60)
      return {
        start: formatDate(sixtyDaysAgo),
        end: formatDate(today),
      }
    }

    case 'last_90_days': {
      const ninetyDaysAgo = new Date(today)
      ninetyDaysAgo.setDate(dayOfMonth - 90)
      return {
        start: formatDate(ninetyDaysAgo),
        end: formatDate(today),
      }
    }

    // === Weeks ===
    case 'this_week':
    case 'this_week_to_date': {
      // "This Week" always means week-to-date (Sunday to today)
      const weekStart = new Date(today)
      weekStart.setDate(dayOfMonth - dayOfWeek) // Sunday as week start
      return {
        start: formatDate(weekStart),
        end: formatDate(today),
      }
    }

    case 'last_week': {
      const lastWeekStart = new Date(today)
      lastWeekStart.setDate(dayOfMonth - dayOfWeek - 7) // Previous Sunday
      const lastWeekEnd = new Date(lastWeekStart)
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6) // Previous Saturday
      return {
        start: formatDate(lastWeekStart),
        end: formatDate(lastWeekEnd),
      }
    }

    // === Months ===
    case 'this_month':
    case 'this_month_to_date':
      // "This Month" always means month-to-date (1st to today)
      return {
        start: formatDate(new Date(year, month, 1)),
        end: formatDate(today),
      }

    case 'last_month': {
      const lastMonthStart = new Date(year, month - 1, 1)
      const lastMonthEnd = new Date(year, month, 0) // 0th day of current month = last day of previous month
      return {
        start: formatDate(lastMonthStart),
        end: formatDate(lastMonthEnd),
      }
    }

    case 'last_6_months': {
      const sixMonthsAgo = new Date(year, month - 6, dayOfMonth)
      return {
        start: formatDate(sixMonthsAgo),
        end: formatDate(today),
      }
    }

    case 'last_12_months': {
      const twelveMonthsAgo = new Date(year, month - 12, dayOfMonth)
      return {
        start: formatDate(twelveMonthsAgo),
        end: formatDate(today),
      }
    }

    // === Quarters ===
    case 'this_quarter':
    case 'this_quarter_to_date': {
      // "This Quarter" always means quarter-to-date (Q start to today)
      const quarter = Math.floor(month / 3)
      const quarterStart = new Date(year, quarter * 3, 1)
      return {
        start: formatDate(quarterStart),
        end: formatDate(today),
      }
    }

    case 'last_quarter': {
      const currentQuarter = Math.floor(month / 3)
      const lastQuarter = currentQuarter - 1

      let quarterStartMonth: number
      let quarterYear = year

      if (lastQuarter < 0) {
        quarterStartMonth = 9 // Q4 of previous year
        quarterYear = year - 1
      } else {
        quarterStartMonth = lastQuarter * 3
      }

      const quarterStart = new Date(quarterYear, quarterStartMonth, 1)
      const quarterEnd = new Date(quarterYear, quarterStartMonth + 3, 0)

      return {
        start: formatDate(quarterStart),
        end: formatDate(quarterEnd),
      }
    }

    // === Years ===
    case 'this_year':
    case 'this_year_to_date':
      // "This Year" always means year-to-date (Jan 1 to today)
      return {
        start: formatDate(new Date(year, 0, 1)),
        end: formatDate(today),
      }

    case 'last_year':
      return {
        start: formatDate(new Date(year - 1, 0, 1)),
        end: formatDate(new Date(year - 1, 11, 31)),
      }

    default:
      // Default to this month to date
      return {
        start: formatDate(new Date(year, month, 1)),
        end: formatDate(today),
      }
  }
}

/**
 * Get single "as of" date for balance sheet style reports
 * @param period - The preset period identifier
 * @returns Single date string in YYYY-MM-DD format
 */
export function getAsOfDateForPeriod(period: string): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const dayOfMonth = today.getDate()
  const dayOfWeek = today.getDay()

  switch (period) {
    // === Quick Access ===
    case 'all_dates':
      return formatDate(today)

    // === Days ===
    case 'today':
      return formatDate(today)

    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(dayOfMonth - 1)
      return formatDate(yesterday)
    }

    case 'last_7_days':
    case 'last_30_days':
    case 'last_60_days':
    case 'last_90_days':
      return formatDate(today)

    // === Weeks ===
    case 'this_week':
    case 'this_week_to_date':
      return formatDate(today)

    case 'last_week': {
      const lastWeekEnd = new Date(today)
      lastWeekEnd.setDate(dayOfMonth - dayOfWeek - 1) // Previous Saturday
      return formatDate(lastWeekEnd)
    }

    // === Months ===
    case 'this_month':
    case 'this_month_to_date':
      return formatDate(today)

    case 'last_month':
      return formatDate(new Date(year, month, 0)) // Last day of previous month

    case 'last_6_months':
    case 'last_12_months':
      return formatDate(today)

    // === Quarters ===
    case 'this_quarter':
    case 'this_quarter_to_date':
      return formatDate(today)

    case 'last_quarter': {
      const currentQuarter = Math.floor(month / 3)
      const lastQuarter = currentQuarter - 1

      let quarterEndMonth: number
      let quarterYear = year

      if (lastQuarter < 0) {
        quarterEndMonth = 11 // December (end of Q4 previous year)
        quarterYear = year - 1
      } else {
        quarterEndMonth = (lastQuarter + 1) * 3 - 1
      }

      return formatDate(new Date(quarterYear, quarterEndMonth + 1, 0))
    }

    // === Years ===
    case 'this_year':
    case 'this_year_to_date':
      return formatDate(today)

    case 'last_year':
      return formatDate(new Date(year - 1, 11, 31))

    default:
      return formatDate(today)
  }
}

/**
 * Format a Date object to YYYY-MM-DD string
 * @param date - Date object to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse YYYY-MM-DD string to Date object
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format date from YYYY-MM-DD to MM/DD/YYYY for display
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Display formatted date string
 */
export function formatDateToDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${month}/${day}/${year}`
}

/**
 * Parse MM/DD/YYYY to YYYY-MM-DD
 * @param displayStr - Date string in MM/DD/YYYY format
 * @returns Date string in YYYY-MM-DD format or null if invalid
 */
export function parseDateFromDisplay(displayStr: string): string | null {
  if (!displayStr) return null

  const match = displayStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  const m = month.padStart(2, '0')
  const d = day.padStart(2, '0')

  // Validate date
  const date = new Date(`${year}-${m}-${d}`)
  if (isNaN(date.getTime())) return null

  return `${year}-${m}-${d}`
}

/**
 * Validate that a date range is valid
 * @param start - Start date in YYYY-MM-DD format
 * @param end - End date in YYYY-MM-DD format
 * @returns True if valid range
 */
export function validateDateRange(start: string, end: string): boolean {
  if (!start || !end) return false

  const startDate = parseDate(start)
  const endDate = parseDate(end)
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of today

  return startDate <= endDate && endDate <= today
}

/**
 * Get human-readable label for a date range
 * @param start - Start date in YYYY-MM-DD format
 * @param end - End date in YYYY-MM-DD format
 * @returns Human readable date range string
 */
export function getDateRangeLabel(start: string, end: string): string {
  const startDate = parseDate(start)
  const endDate = parseDate(end)

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }

  if (start === end) {
    return startDate.toLocaleDateString('en-US', options)
  }

  const startFormatted = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endFormatted = endDate.toLocaleDateString('en-US', options)

  return `${startFormatted} - ${endFormatted}`
}

/**
 * Calculate the number of days between two dates
 * @param start - Start date in YYYY-MM-DD format
 * @param end - End date in YYYY-MM-DD format
 * @returns Number of days
 */
export function getDaysBetween(start: string, end: string): number {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Get the fiscal quarter for a given date
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Quarter string (e.g., "Q1 2024")
 */
export function getFiscalQuarter(dateStr: string): string {
  const date = parseDate(dateStr)
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `Q${quarter} ${date.getFullYear()}`
}

/**
 * Get the previous period of equal length ending the day before the current period starts.
 * e.g. if current = Mar 1 – Mar 30 (30 days), previous = Jan 30 – Feb 28.
 */
export function getPreviousPeriodRange(start: string, end: string): DateRange {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  const prevEnd = new Date(startDate)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - days)

  return { start: formatDate(prevStart), end: formatDate(prevEnd) }
}

/**
 * Check if a date is in the current period
 * @param dateStr - Date string to check
 * @param period - Period type (today, this_week, this_month, etc.)
 * @returns True if date is in the specified period
 */
export function isInPeriod(dateStr: string, period: string): boolean {
  const range = getDateRangeForPeriod(period)
  const date = parseDate(dateStr)
  const start = parseDate(range.start)
  const end = parseDate(range.end)

  return date >= start && date <= end
}
