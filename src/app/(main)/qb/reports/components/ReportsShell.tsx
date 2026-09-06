// src/app/(main)/reports/components/ReportsShell.tsx
'use client'

import { ReportsSidebar } from './ReportsSidebar'
import { ReportContentArea } from './ReportContentArea'

export function ReportsShell() {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden relative">
      {/* Top-origin cyan radial gradient - matching dashboard */}
      {/* <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[55vh] bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.15)_0%,rgba(34,211,238,0.08)_35%,transparent_70%)] blur-2xl"
      /> */}

      {/* Sidebar - 15% on desktop, full width on mobile, vertical layout */}
      <div className="w-full lg:w-[20%] flex-shrink-0 flex flex-col border-l border-r border-gray-200/10 relative z-10">
        <ReportsSidebar />
      </div>

      {/* Content Area - 85% on desktop, flex-1 fills remaining space */}
      <div className="flex-1 overflow-y-auto styled-scrollbar relative z-10">
        <ReportContentArea />
      </div>
    </div>
  )
}
