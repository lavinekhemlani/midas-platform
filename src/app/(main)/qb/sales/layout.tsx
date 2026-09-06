'use client'

import { SalesProvider } from '@/contexts/SalesContext'

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <SalesProvider>{children}</SalesProvider>
}
