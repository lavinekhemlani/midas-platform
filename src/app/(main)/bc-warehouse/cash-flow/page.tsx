import { Suspense } from 'react'
import { CashFlowView } from './views/CashFlowView'

export const metadata = {
  title: 'Cash Flow | Business Central Warehouse',
  description: 'Cash flow analysis with operating, investing, and financing activities',
}

export default function BCWarehouseCashFlowPage() {
  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          </div>
        }
      >
        <CashFlowView />
      </Suspense>
    </div>
  )
}
