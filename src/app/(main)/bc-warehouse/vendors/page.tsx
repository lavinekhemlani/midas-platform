import { Suspense } from 'react'
import { VendorInsightsView } from './views/VendorInsightsView'

export const metadata = {
  title: 'Vendors | Business Central Warehouse',
  description: 'Vendor analytics with AP aging, spend concentration, and payment insights',
}

export default function BCWarehouseVendorsPage() {
  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          </div>
        }
      >
        <VendorInsightsView />
      </Suspense>
    </div>
  )
}
