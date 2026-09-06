import { Suspense } from 'react'
import { InventoryView } from './views/InventoryView'

export const metadata = {
  title: 'Inventory | Business Central Warehouse',
  description:
    'Inventory analytics dashboard with stock levels, turnover metrics, valuation, and movement trends',
}

export default function BCWarehouseInventoryPage() {
  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          </div>
        }
      >
        <InventoryView />
      </Suspense>
    </div>
  )
}
