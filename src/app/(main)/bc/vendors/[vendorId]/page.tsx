'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { BCVendorDetailView } from './views/BCVendorDetailView'
import { useBCConnection } from '@/hooks/useBCConnection'

export default function VendorDetailPage() {
  const params = useParams()
  const vendorId = params.vendorId as string
  const { activeConnection, isLoading } = useBCConnection()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    )
  }

  if (!activeConnection) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm theme-text-secondary">
          No Business Central OAuth connection found. Please connect via Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          </div>
        }
      >
        <BCVendorDetailView connectionId={activeConnection.id} vendorId={vendorId} />
      </Suspense>
    </div>
  )
}
