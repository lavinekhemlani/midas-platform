'use client'

import { Suspense } from 'react'
import { QBConnectionGuard } from '@/components/providers/QBConnectionGuard'

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border border-amber-500/20" />
          <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-transparent border-t-amber-500 animate-spin" />
        </div>
        <p className="text-sm theme-text-secondary">Loading...</p>
      </div>
    </div>
  )
}

export default function QBLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <QBConnectionGuard>{children}</QBConnectionGuard>
    </Suspense>
  )
}
