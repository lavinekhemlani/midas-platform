'use client'

import { ReportsProvider } from '@/contexts/ReportsProvider'

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <ReportsProvider>{children}</ReportsProvider>
}
