import { Suspense } from 'react'
import { WarehouseSummaryView } from './views/WarehousePnLView'

export const metadata = {
  title: 'Summary | Business Central Warehouse',
  description:
    'Business Central warehouse executive summary with GL entries, trial balance, and financial analytics',
}

export default function BCWarehouseSummaryPage() {
  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          </div>
        }
      >
        <WarehouseSummaryView />
      </Suspense>
    </div>
  )
}
