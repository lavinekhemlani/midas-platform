// Re-export all date utilities from the centralized module for backward compatibility
export {
  getDateRangeForPeriod,
  getAsOfDateForPeriod,
  formatDateToDisplay,
  parseDateFromDisplay,
  validateDateRange
} from '@/lib/utils/dateRanges'

// Format last updated time
export function formatLastUpdated(lastUpdated: Date | null): string {
  if (!lastUpdated) return 'Never updated'

  const now = Date.now()
  const age = now - lastUpdated.getTime()
  const minutes = Math.floor(age / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`

  return lastUpdated.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}