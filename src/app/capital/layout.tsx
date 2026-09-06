import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ZenithOS — Find the Right Capital for Your Biotech',
  description:
    '3,262 life sciences investors mapped with named contacts and real email addresses. Match your stage, area, and raise — then email them directly.',
}

import CapitalNav from './CapitalNav'

export default function CapitalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <header className="fixed top-0 inset-x-0 z-50 border-b border-black/6 bg-[#faf8f5]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <CapitalNav />
        </div>
      </header>
      <div className="pt-14">{children}</div>
    </div>
  )
}
