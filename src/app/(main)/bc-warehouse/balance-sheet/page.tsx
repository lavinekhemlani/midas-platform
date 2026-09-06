import { Suspense } from 'react'
import { BalanceSheetView } from './views/BalanceSheetView'

export const metadata = {
  title: 'Balance Sheet | Business Central Warehouse',
  description: 'Balance sheet with assets, liabilities, and equity breakdown',
}

export default function BCWarehouseBalanceSheetPage() {
  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          </div>
        }
      >
        <BalanceSheetView />
      </Suspense>
    </div>
  )
}
