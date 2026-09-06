'use client'

import { Suspense } from 'react'
import { SunburstChart, type SunburstNode } from '@/components/chat/visualizations/charts/advanced'

const balanceSheetData: SunburstNode = {
  name: 'Balance Sheet',
  value: 1000000, // Total: Assets 500k + Liabilities 200k + Equity 300k
  children: [
    {
      name: 'Assets',
      value: 500000,
      children: [
        {
          name: 'Cash & Bank',
          value: 150000,
          children: [
            { name: 'Checking Account', value: 80000 },
            { name: 'Savings Account', value: 50000 },
            { name: 'Petty Cash', value: 20000 },
          ],
        },
        {
          name: 'Accounts Receivable',
          value: 200000,
          children: [
            { name: 'Customer Invoices', value: 150000 },
            { name: 'Pending Payments', value: 50000 },
          ],
        },
        {
          name: 'Fixed Assets',
          value: 150000,
          children: [
            { name: 'Equipment', value: 60000 },
            { name: 'Vehicles', value: 50000 },
            { name: 'Furniture', value: 40000 },
          ],
        },
      ],
    },
    {
      name: 'Liabilities',
      value: 200000,
      children: [
        {
          name: 'Accounts Payable',
          value: 80000,
          children: [
            { name: 'Vendor Bills', value: 50000 },
            { name: 'Supplier Credits', value: 30000 },
          ],
        },
        {
          name: 'Short-term Loans',
          value: 70000,
          children: [
            { name: 'Bank Line of Credit', value: 40000 },
            { name: 'Credit Cards', value: 30000 },
          ],
        },
        {
          name: 'Accrued Expenses',
          value: 50000,
          children: [
            { name: 'Wages Payable', value: 25000 },
            { name: 'Taxes Payable', value: 15000 },
            { name: 'Utilities Payable', value: 10000 },
          ],
        },
      ],
    },
    {
      name: 'Equity',
      value: 300000,
      children: [
        {
          name: "Owner's Capital",
          value: 200000,
          children: [
            { name: 'Initial Investment', value: 150000 },
            { name: 'Additional Contributions', value: 50000 },
          ],
        },
        {
          name: 'Retained Earnings',
          value: 100000,
          children: [
            { name: 'Prior Year Earnings', value: 70000 },
            { name: 'Current Year Earnings', value: 30000 },
          ],
        },
      ],
    },
  ],
}

const categoryColors: Record<string, string> = {
  Assets: '#10b981',
  Liabilities: '#ef4444',
  Equity: '#3b82f6',
}

function BSBurstContent() {
  return (
    <div className="min-h-[calc(100vh-180px)] flex items-center justify-center p-4">
      <div className="glass-luxury-card rounded-lg h-[70vh] w-full max-w-5xl flex overflow-hidden">
        {/* Left: Sunburst Chart */}
        <div className="flex-1 flex flex-col p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-3xl theme-text-primary">Balance Sheet Sunburst</h2>
          </div>
          <p className="text-xs theme-text-tertiary mb-4">
            Click on segments to expand or collapse. Use center button to expand/collapse all.
          </p>
          <div className="flex-1 min-h-0">
            <SunburstChart data={balanceSheetData} colors={categoryColors} showCenterButton />
          </div>
        </div>

        {/* Right: JSON Display */}
        <div className="w-96 flex flex-col border-l border-white/10">
          <div className="flex items-center px-4 py-3 border-b border-white/10">
            <span className="text-sm theme-text-secondary font-medium">Balance Sheet JSON</span>
          </div>
          <pre className="flex-1 p-4 text-[11px] font-mono theme-text-secondary overflow-auto leading-relaxed">
            {JSON.stringify(balanceSheetData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function BSBurstPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-180px)] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BSBurstContent />
    </Suspense>
  )
}
