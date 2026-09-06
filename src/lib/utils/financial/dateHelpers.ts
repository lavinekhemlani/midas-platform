/**
 * Date utility functions for financial reports
 * Provider-agnostic date formatting and range calculations
 */

/**
 * Format date to YYYY-MM-DD string using local timezone
 * IMPORTANT: Do NOT use toISOString() as it converts to UTC and can shift dates
 * across midnight boundaries (e.g., 11pm PST becomes next day in UTC)
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format (local timezone)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Alias for formatDate - format date for reports (YYYY-MM-DD)
 * Uses local timezone to avoid UTC conversion issues
 */
export function formatReportDate(date: Date): string {
  return formatDate(date)
}

/**
 * Format date to YYYY-MM-DD string using local timezone
 * Explicit name to clarify this uses local timezone, not UTC
 */
export function formatLocalDate(date: Date): string {
  return formatDate(date)
}

/**
 * Get date range for period-based queries
 * Supports: this_month, last_month, this_quarter, this_year, last_year
 */
export function getDateRange(period: string): { fromDate: string; toDate: string } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()

  let fromDate: string
  let toDate: string = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`

  switch (period) {
    case 'this_month':
      fromDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
      break
    case 'last_month':
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
      fromDate = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-01`
      const lastDayOfLastMonth = new Date(currentYear, currentMonth, 0).getDate()
      toDate = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-${lastDayOfLastMonth}`
      break
    case 'this_quarter':
      const currentQuarter = Math.floor(currentMonth / 3)
      fromDate = `${currentYear}-${String(currentQuarter * 3 + 1).padStart(2, '0')}-01`
      break
    case 'this_year':
      fromDate = `${currentYear}-01-01`
      break
    case 'last_quarter': {
      const cq = Math.floor(currentMonth / 3)
      const lq = cq === 0 ? 3 : cq - 1
      const lqYear = cq === 0 ? currentYear - 1 : currentYear
      const lqStartMonth = lq * 3
      fromDate = `${lqYear}-${String(lqStartMonth + 1).padStart(2, '0')}-01`
      const lqEndDay = new Date(lqYear, lqStartMonth + 3, 0).getDate()
      toDate = `${lqYear}-${String(lqStartMonth + 3).padStart(2, '0')}-${String(lqEndDay).padStart(2, '0')}`
      break
    }
    case 'last_year':
      fromDate = `${currentYear - 1}-01-01`
      toDate = `${currentYear - 1}-12-31`
      break
    default:
      fromDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
  }

  return { fromDate, toDate }
}

/**
 * Get date range by number of days back
 * Returns start and end dates for a period
 */
export function getDateRangeByDays(
  asOfDate: string | Date,
  daysBack: number
): { start: string; end: string; days: number } {
  const end = new Date(asOfDate)
  const start = new Date(end)
  start.setDate(start.getDate() - daysBack)

  return {
    start: formatDate(start),
    end: formatDate(end),
    days: daysBack,
  }
}

/**
 * Get the last N quarters from a given date
 */
export function getLastQuarters(
  asOfDate: string | Date,
  count: number = 3
): Array<{ start: string; end: string; label: string }> {
  const date = new Date(asOfDate)
  const quarters: Array<{ start: string; end: string; label: string }> = []

  for (let i = 0; i < count; i++) {
    const quarterEnd = new Date(date)
    quarterEnd.setMonth(quarterEnd.getMonth() - i * 3)

    // Adjust to quarter end
    const month = quarterEnd.getMonth()
    const quarterMonth = Math.floor(month / 3) * 3 + 2 // 2, 5, 8, 11
    quarterEnd.setMonth(quarterMonth)

    // Set to last day of month
    quarterEnd.setMonth(quarterEnd.getMonth() + 1)
    quarterEnd.setDate(0)

    const quarterStart = new Date(quarterEnd)
    quarterStart.setMonth(quarterStart.getMonth() - 2)
    quarterStart.setDate(1)

    const year = quarterEnd.getFullYear()
    const q = Math.floor(quarterMonth / 3) + 1

    quarters.unshift({
      start: formatDate(quarterStart),
      end: formatDate(quarterEnd),
      label: `Q${q} ${year}`,
    })
  }

  return quarters
}

/**
 * Get the last N months from a given date
 */
export function getLastMonths(
  asOfDate: string | Date,
  count: number = 6
): Array<{ date: string; label: string }> {
  const date = new Date(asOfDate)
  const months: Array<{ date: string; label: string }> = []

  for (let i = count - 1; i >= 0; i--) {
    const monthEnd = new Date(date.getFullYear(), date.getMonth() - i + 1, 0)
    if (monthEnd > date) continue

    months.push({
      date: formatDate(monthEnd),
      label: monthEnd.toLocaleString('default', { month: 'short', year: 'numeric' }),
    })
  }

  return months
}

/**
 * Get default start date for cash flow reports (6 months ago, first day of month)
 */
export function getDefaultCashFlowStartDate(): string {
  const date = new Date()
  date.setMonth(date.getMonth() - 6)
  date.setDate(1)
  return formatDate(date)
}

/**
 * Get default end date for cash flow reports (last day of current month)
 */
export function getDefaultCashFlowEndDate(): string {
  const date = new Date()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return formatDate(lastDay)
}

/**
 * Calculate the aging bucket for a date (used in AR/AP aging reports)
 */
export function getAgingBucket(dueDate: string | Date, asOfDate: string | Date): string {
  const due = new Date(dueDate)
  const asOf = new Date(asOfDate)
  const daysOverdue = Math.floor((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '91+'
}

/**
 * Calculate days between two dates
 */
export function getDaysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Get month start and end dates
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    start: formatDate(start),
    end: formatDate(end),
  }
}

/**
 * Check if a date is within a date range
 */
export function isDateInRange(
  date: string | Date,
  startDate: string | Date,
  endDate: string | Date
): boolean {
  const d = new Date(date)
  const start = new Date(startDate)
  const end = new Date(endDate)
  return d >= start && d <= end
}
