/**
 * Shared loading state component for all report views
 * Provides consistent loading UI across P&L, Balance Sheet, Cash Flow, and Summary reports
 */

interface ReportLoadingStateProps {
  /**
   * Custom message to display during loading
   * @default "Generating report..."
   */
  message?: string
}

export function ReportLoadingState({ message = 'Generating report...' }: ReportLoadingStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
        <p className="text-sm theme-text-secondary">{message}</p>
      </div>
    </div>
  )
}
