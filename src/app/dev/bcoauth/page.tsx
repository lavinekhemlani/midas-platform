'use client'

import React from 'react'
import Link from 'next/link'
import { useBCOAuthDev } from './_shared/BCOAuthDevLayout'

const SECTIONS = [
  {
    href: '/dev/bcoauth/pnl',
    title: 'P&L Diagnostics',
    description:
      'Income Statement preview, P&L filter diagnostics, chart hierarchy analysis, GL entries comparison, and comprehensive entity testing.',
    color: 'blue',
    tests: ['P&L Preview', 'P&L Diagnostics', 'Full Diagnostic'],
  },
  {
    href: '/dev/bcoauth/cash-flow',
    title: 'Cash Flow',
    description:
      'Cash flow statement preview, comprehensive CF diagnostic (entity probes, method comparison, monthly movements), and balance sheet diagnostics.',
    color: 'emerald',
    tests: ['CF Statement', 'CF Diagnostic', 'BS Preview', 'BS Diagnostics'],
  },
  {
    href: '/dev/bcoauth/inventory',
    title: 'Inventory',
    description:
      'Comprehensive inventory diagnostic: entity probes, item metrics, movement analysis, category breakdown, turnover analysis, and location data.',
    color: 'amber',
    tests: ['Entity Probes', 'Item Metrics', 'Movement Analysis', 'Turnover'],
  },
  {
    href: '/dev/bcoauth/api',
    title: 'API & All Calls',
    description:
      'Run all BC API endpoints individually or together. Tests every available route: P&L, BS, CF, inventory, customers, vendors, bank accounts, enhanced data.',
    color: 'purple',
    tests: ['All API Calls', 'Individual Tests'],
  },
]

const colorMap: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  blue: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    badge: 'bg-blue-500/20 text-blue-400',
    text: 'text-blue-400',
  },
  emerald: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-400',
    text: 'text-emerald-400',
  },
  amber: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-400',
    text: 'text-amber-400',
  },
  purple: {
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    badge: 'bg-purple-500/20 text-purple-400',
    text: 'text-purple-400',
  },
}

export default function BCOAuthDevHubPage() {
  const { connectionId, connections } = useBCOAuthDev()

  return (
    <div className="space-y-6">
      {/* Quick Status */}
      <div className="glass-luxury-card p-6">
        <h2 className="text-lg font-medium theme-text-primary mb-3">Quick Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-[10px] uppercase tracking-wider theme-text-secondary">Connections</p>
            <p className="text-lg font-semibold theme-text-primary mt-1">{connections.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-[10px] uppercase tracking-wider theme-text-secondary">Active</p>
            <p className="text-lg font-semibold text-emerald-400 mt-1">
              {connections.filter((c) => c.connected).length}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-[10px] uppercase tracking-wider theme-text-secondary">Selected</p>
            <p className="text-sm font-medium theme-text-primary mt-1 truncate">
              {connectionId
                ? connections.find((c) => c.connectionId === connectionId)?.companyName || 'Unknown'
                : 'None'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
              Test Sections
            </p>
            <p className="text-lg font-semibold theme-text-primary mt-1">{SECTIONS.length}</p>
          </div>
        </div>
      </div>

      {/* Section Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const colors = colorMap[section.color]
          return (
            <Link
              key={section.href}
              href={section.href}
              className={`glass-luxury-card p-6 border rounded-xl transition-all ${colors.border} ${colors.bg} group`}
            >
              <h3 className={`text-lg font-semibold ${colors.text} mb-2 group-hover:underline`}>
                {section.title}
              </h3>
              <p className="text-sm theme-text-secondary mb-4">{section.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {section.tests.map((test) => (
                  <span key={test} className={`text-[10px] px-2 py-0.5 rounded ${colors.badge}`}>
                    {test}
                  </span>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
