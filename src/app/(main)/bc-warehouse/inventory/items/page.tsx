import { Suspense } from 'react'
import { WarehouseItemsView } from './views/WarehouseItemsView'

export const metadata = {
  title: 'Items | Business Central Warehouse',
  description:
    'Full inventory items list with ABC classification, health scores, and detailed item views',
}

export default function BCWarehouseInventoryItemsPage() {
  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          </div>
        }
      >
        <WarehouseItemsView />
      </Suspense>
    </div>
  )
}
