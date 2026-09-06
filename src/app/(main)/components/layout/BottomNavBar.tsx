'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  FileBarChart,
  Building2,
  Wallet,
  FileText,
  Brain,
  GraduationCap,
  HelpCircle,
  X,
  Sparkles,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface BottomNavBarProps {
  onOpenChat: () => void
  isChatOpen: boolean
}

const leftNavItems: NavItem[] = [
  { id: 'home', label: 'Home', href: '/reports', icon: LayoutDashboard },
  { id: 'pnl', label: 'P&L', href: '/reports/pnl', icon: FileBarChart },
]

const rightNavItems: NavItem[] = [
  { id: 'cashflow', label: 'Cash Flow', href: '/reports/cash-flow', icon: Wallet },
]

const moreNavItems: NavItem[] = [
  { id: 'sales', label: 'Sales', href: '/sales', icon: TrendingUp },
  { id: 'expenses', label: 'Expenses', href: '/expenses/vendors', icon: TrendingDown },
  { id: 'balance', label: 'Balance Sheet', href: '/reports/balance-sheet', icon: Building2 },
  { id: 'journal', label: 'Journal', href: '/journal', icon: FileText },
  { id: 'memory', label: 'AI Memory', href: '/memories', icon: Brain },
  { id: 'learn', label: 'Learn', href: '/learn', icon: GraduationCap },
  { id: 'support', label: 'Support', href: '/support', icon: HelpCircle },
]

export default function BottomNavBar({ onOpenChat, isChatOpen }: BottomNavBarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/reports') {
      return pathname === '/reports' || pathname === '/'
    }
    return pathname === href || pathname?.startsWith(href + '/')
  }

  const isMoreActive = moreNavItems.some((item) => isActive(item.href))

  return (
    <>
      {/* More menu popup */}
      {moreOpen && (
        <>
          <div className="bottom-nav-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="bottom-nav-more-menu">
            <div className="bottom-nav-more-header">
              <span>More</span>
              <button onClick={() => setMoreOpen(false)} className="bottom-nav-more-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bottom-nav-more-grid">
              {moreNavItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn('bottom-nav-more-item', isActive(item.href) && 'active')}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav className="bottom-nav-bar">
        {/* Left items */}
        {leftNavItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn('bottom-nav-item', isActive(item.href) && 'active')}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}

        {/* Center chat button - prominent with Midas logo */}
        <button
          onClick={onOpenChat}
          className={cn('bottom-nav-center', isChatOpen && 'active')}
          aria-label="Open AI Assistant"
        >
          <Image
            src="/images/hero/logo_gold_new.svg"
            alt="Midas"
            width={35}
            height={35}
            className="object-contain"
          />
        </button>

        {/* Right items */}
        {rightNavItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn('bottom-nav-item', isActive(item.href) && 'active')}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={cn('bottom-nav-item', (moreOpen || isMoreActive) && 'active')}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
