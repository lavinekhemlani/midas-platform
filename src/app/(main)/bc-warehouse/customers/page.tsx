import { Suspense } from 'react'
import { CustomerInsightsView } from './views/CustomerInsightsView'

export const metadata = {
  title: 'Customers | Business Central Warehouse',
  description: 'Customer analytics with AR aging, revenue concentration, and payment insights',
}

export default function BCWarehouseCustomersPage() {
  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          </div>
        }
      >
        <CustomerInsightsView />
      </Suspense>
    </div>
  )
}
