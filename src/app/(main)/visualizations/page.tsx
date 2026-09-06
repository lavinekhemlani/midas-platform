'use client'

import { Suspense, useState } from 'react'
import { ChartRenderer } from '@/components/chat/visualizations/charts/ChartRenderer'
import { Button } from '@/components/ui/button'
import type { ChartBlock } from '@/lib/chat/visualizationBlocks'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'

// =============================================================================
// Chart Options
// =============================================================================

interface ChartOption {
  id: string
  label: string
  block: ChartBlock
}

// Grouped chart options for 3-row layout
const chartRows = [
  ['line', 'line-multi', 'area-stacked', 'donut'],
  ['bar', 'bar-diverging', 'bar-stacked', 'bar-horizontal', 'waterfall'],
  ['radar', 'scatter', 'treemap', 'sankey'],
]

const chartOptions: ChartOption[] = [
  // Lines & Pie
  {
    id: 'line',
    label: 'Line',
    block: {
      type: 'chart',
      chartType: 'line',
      title: 'Revenue Trend',
      data: [
        { label: 'Jan', value: 120000 },
        { label: 'Feb', value: 135000 },
        { label: 'Mar', value: 128000 },
        { label: 'Apr', value: 145000 },
        { label: 'May', value: 160000 },
        { label: 'Jun', value: 175000 },
      ],
    } as ChartBlock,
  },
  {
    id: 'line-multi',
    label: 'Multi-Line',
    block: {
      type: 'chart',
      chartType: 'line',
      title: 'Revenue vs Expenses',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      series: [
        {
          name: 'Revenue',
          data: [120000, 135000, 128000, 145000, 160000, 175000],
          color: '#10b981',
        },
        {
          name: 'Expenses',
          data: [95000, 102000, 98000, 110000, 115000, 125000],
          color: '#ef4444',
        },
      ],
    } as ChartBlock,
  },
  {
    id: 'area-stacked',
    label: 'Stacked Area',
    block: {
      type: 'chart',
      chartType: 'area',
      title: 'Revenue Sources',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      series: [
        { name: 'Sales', data: [50000, 55000, 60000, 58000, 65000] },
        { name: 'Services', data: [20000, 22000, 25000, 28000, 30000] },
        { name: 'Subscriptions', data: [10000, 12000, 14000, 15000, 18000] },
      ],
    } as ChartBlock,
  },
  // Bars
  {
    id: 'bar',
    label: 'Bar',
    block: {
      type: 'chart',
      chartType: 'bar',
      title: 'Monthly Revenue',
      data: [
        { label: 'Jan', value: 45000 },
        { label: 'Feb', value: 52000 },
        { label: 'Mar', value: 48000 },
        { label: 'Apr', value: 61000 },
        { label: 'May', value: 55000 },
        { label: 'Jun', value: 67000 },
      ],
    } as ChartBlock,
  },
  {
    id: 'bar-horizontal',
    label: 'Horizontal Bar',
    block: {
      type: 'chart',
      chartType: 'bar',
      orientation: 'horizontal',
      title: 'Top Customers',
      data: [
        { label: 'Prime Partners', value: 38000 },
        { label: 'Smart Industries', value: 45000 },
        { label: 'Global Services', value: 58000 },
        { label: 'Tech Solutions', value: 72000 },
        { label: 'Acme Corp', value: 85000 },
      ],
    } as ChartBlock,
  },
  {
    id: 'bar-stacked',
    label: 'Stacked Bar',
    block: {
      type: 'chart',
      chartType: 'bar',
      title: 'Revenue by Product',
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [
        { name: 'Product A', data: [30000, 35000, 32000, 40000] },
        { name: 'Product B', data: [25000, 28000, 30000, 35000] },
        { name: 'Product C', data: [15000, 18000, 20000, 22000] },
      ],
    } as ChartBlock,
  },
  {
    id: 'bar-diverging',
    label: 'Diverging Bar',
    block: {
      type: 'chart',
      chartType: 'bar',
      title: 'Monthly Profit/Loss',
      data: [
        { label: 'Jan', value: 15000 },
        { label: 'Feb', value: -8000 },
        { label: 'Mar', value: 22000 },
        { label: 'Apr', value: -5000 },
        { label: 'May', value: 18000 },
        { label: 'Jun', value: 12000 },
      ],
    } as ChartBlock,
  },
  {
    id: 'waterfall',
    label: 'Waterfall',
    block: {
      type: 'chart',
      chartType: 'waterfall',
      title: 'Cash Flow Analysis',
      data: [
        { label: 'Opening', value: 100000, type: 'initial' },
        { label: 'Revenue', value: 85000, type: 'positive' },
        { label: 'Payroll', value: -45000, type: 'negative' },
        { label: 'Rent', value: -12000, type: 'negative' },
        { label: 'Marketing', value: -8000, type: 'negative' },
        { label: 'Investments', value: 25000, type: 'positive' },
      ],
    } as ChartBlock,
  },
  // Other
  {
    id: 'donut',
    label: 'Donut',
    block: {
      type: 'chart',
      chartType: 'donut',
      title: 'Expense Categories',
      data: [
        { label: 'Payroll', value: 65000 },
        { label: 'Rent', value: 12000 },
        { label: 'Marketing', value: 8500 },
        { label: 'Software', value: 4800 },
        { label: 'Utilities', value: 3200 },
      ],
    } as ChartBlock,
  },
  {
    id: 'radar',
    label: 'Radar',
    block: {
      type: 'chart',
      chartType: 'radar',
      title: 'Department Performance',
      data: [
        { label: 'Sales', value: 85 },
        { label: 'Marketing', value: 72 },
        { label: 'Operations', value: 90 },
        { label: 'Finance', value: 88 },
        { label: 'HR', value: 75 },
        { label: 'R&D', value: 82 },
      ],
    } as ChartBlock,
  },
  {
    id: 'scatter',
    label: 'Scatter',
    block: {
      type: 'chart',
      chartType: 'scatter',
      title: 'Revenue vs Marketing Spend',
      data: [
        { label: 'Jan', value: 45000, x: 10000 },
        { label: 'Feb', value: 52000, x: 15000 },
        { label: 'Mar', value: 48000, x: 12000 },
        { label: 'Apr', value: 61000, x: 20000 },
        { label: 'May', value: 55000, x: 18000 },
        { label: 'Jun', value: 67000, x: 25000 },
      ],
    } as ChartBlock,
  },
  {
    id: 'treemap',
    label: 'Treemap',
    block: {
      type: 'chart',
      chartType: 'treemap',
      title: 'Expense Breakdown',
      data: [
        {
          label: 'Operations',
          value: 45000,
          children: [
            { label: 'Payroll', value: 30000 },
            { label: 'Utilities', value: 8000 },
            { label: 'Supplies', value: 7000 },
          ],
        },
        {
          label: 'Marketing',
          value: 25000,
          children: [
            { label: 'Digital Ads', value: 15000 },
            { label: 'Events', value: 10000 },
          ],
        },
        {
          label: 'Technology',
          value: 20000,
          children: [
            { label: 'Software', value: 12000 },
            { label: 'Hardware', value: 8000 },
          ],
        },
      ],
    } as ChartBlock,
  },
  {
    id: 'sankey',
    label: 'Sankey',
    block: {
      type: 'chart',
      chartType: 'sankey',
      title: 'Revenue to Profit Flow',
      data: [],
      sankeyData: {
        nodes: [
          { name: 'Product Sales' },
          { name: 'Service Revenue' },
          { name: 'Subscriptions' },
          { name: 'Gross Revenue' },
          { name: 'COGS' },
          { name: 'Operating Costs' },
          { name: 'Marketing' },
          { name: 'Net Profit' },
          { name: 'Taxes' },
        ],
        links: [
          { source: 'Product Sales', target: 'Gross Revenue', value: 80000 },
          { source: 'Service Revenue', target: 'Gross Revenue', value: 45000 },
          { source: 'Subscriptions', target: 'Gross Revenue', value: 25000 },
          { source: 'Gross Revenue', target: 'COGS', value: 45000 },
          { source: 'Gross Revenue', target: 'Operating Costs', value: 35000 },
          { source: 'Gross Revenue', target: 'Marketing', value: 20000 },
          { source: 'Gross Revenue', target: 'Net Profit', value: 40000 },
          { source: 'Gross Revenue', target: 'Taxes', value: 10000 },
        ],
      },
    } as ChartBlock,
  },
]

// =============================================================================
// Main Page
// =============================================================================

// Hints for each chart type
const chartHints: Record<string, string> = {
  line: 'Use series[] + labels[] for multi-line',
  'line-multi': 'Each series has name, data[], optional color',
  'area-stacked': 'Series stack automatically',
  donut: 'Use chartType: "pie" for full pie',
  bar: 'Add orientation: "horizontal" for horizontal bars',
  'bar-diverging': 'Auto-detected from negative values',
  'bar-stacked': 'Use series[] + labels[] for stacking',
  'bar-horizontal': 'Set orientation: "horizontal"',
  waterfall: 'Use type: initial | positive | negative | final',
  radar: 'Values shown on radial axes',
  scatter: 'Use x, y coordinates in data',
  treemap: 'Use children[] for hierarchy',
  sankey: 'Requires sankeyData with nodes[] and links[]',
}

function VisualizationsContent() {
  const [selected, setSelected] = useState(chartOptions[0].id)
  const [copied, setCopied] = useState(false)

  const selectedOption = chartOptions.find((o) => o.id === selected) || chartOptions[0]

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(selectedOption.block, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-[calc(100vh-180px)] flex items-center justify-center">
      {/* Combined Card */}
      <div className="glass-luxury-card rounded-lg h-[65vh] w-full max-w-5xl flex overflow-hidden">
        {/* Left: Chart + Selection */}
        <div className="flex-1 flex flex-col border-r border-white/10 overflow-hidden">
          {/* Chart Area */}
          <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
            {/* Header - Top aligned */}
            <div className="shrink-0 mb-2">
              <h2 className="font-serif text-4xl theme-text-primary">{selectedOption.label}</h2>
              <p className="text-[11px] theme-text-tertiary mt-0.5">{chartHints[selected]}</p>
            </div>
            {/* Chart - Centered */}
            <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
              <div className="w-full h-full">
                <ChartRenderer block={selectedOption.block} />
              </div>
            </div>
          </div>

          {/* Selection Grid - 3 Rows */}
          <div className="shrink-0 border-t border-white/10 px-4 py-4">
            <div className="flex flex-col gap-2.5">
              {chartRows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-2">
                  {row.map((id) => {
                    const opt = chartOptions.find((o) => o.id === id)
                    if (!opt) return null
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSelected(opt.id)}
                        className={cn(
                          'flex-1 px-3 py-3.5 rounded-md text-xs font-medium transition-colors text-center',
                          selected === opt.id
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5 border border-white/10'
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: JSON */}
        <div className="w-80 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs theme-text-secondary font-medium">JSON Schema</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 theme-text-secondary hover:theme-text-primary"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <pre className="flex-1 p-3 text-[11px] font-mono theme-text-secondary overflow-auto leading-relaxed">
            {JSON.stringify(selectedOption.block, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function VisualizationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-180px)] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VisualizationsContent />
    </Suspense>
  )
}
