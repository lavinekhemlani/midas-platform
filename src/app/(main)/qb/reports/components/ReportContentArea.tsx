// src/app/(main)/reports/components/ReportContentArea.tsx
'use client'

import { motion, AnimatePresence } from 'motion/react'
import { useReportsContext } from '@/contexts/ReportsContext'
import { SummaryView } from '../views/SummaryView'
import { PnLView } from '../views/PnLView'
import { BalanceSheetView } from '../views/BalanceSheetView'
import { CashFlowView } from '../views/CashFlowView'
import { LayoutDashboard, TrendingUp, Building2, Wallet } from 'lucide-react'
import { useCompanyMetadata } from '@/hooks/useCompanyMetadata'

const viewTitles = {
  summary: { title: 'Executive Summary', icon: LayoutDashboard },
  pnl: { title: 'Profit & Loss Statement', icon: TrendingUp },
  'balance-sheet': { title: 'Balance Sheet', icon: Building2 },
  'cash-flow': { title: 'Cash Flow Statement', icon: Wallet },
}

export function ReportContentArea() {
  const { activeView } = useReportsContext()
  const { data: metadata } = useCompanyMetadata()

  // Optimized motion variants - only animate content opacity
  // Grid structure remains stable across view changes
  const variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  }

  const currentView = viewTitles[activeView]
  const Icon = currentView.icon

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* View Title Header */}
      <div className="px-6 py-4 border-b border-gray-200/10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2">
            <Icon className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold theme-text-primary">{currentView.title}</h1>
            {metadata?.identity?.name && (
              <p className="text-sm theme-text-secondary">{metadata.identity.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* View Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className="flex-1 overflow-y-auto styled-scrollbar relative z-10"
        >
          {activeView === 'summary' && <SummaryView />}
          {activeView === 'pnl' && <PnLView />}
          {activeView === 'balance-sheet' && <BalanceSheetView />}
          {activeView === 'cash-flow' && <CashFlowView />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
