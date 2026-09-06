'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { MessageSquare, Menu, LogOut, ChevronDown, Check, Plus, AlertTriangle } from 'lucide-react'
import { useCurrency } from '@/contexts/CurrencyContext'
import { getCurrencyInfo } from '@/lib/utils/currency'
import { useCompanyMetadata } from '@/hooks/useCompanyMetadata'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import CSSThemeToggleCompact from '@/components/ui/CSSThemeToggleCompact'
import { PIIText } from '@/components/ui/PIIText'
import { NotificationDropdown } from '@/components/notifications'

// Main navigation sections with their sub-routes
const navigationSections = [
  // Dashboard
  {
    key: 'dashboard',
    label: 'Dashboard',
    basePath: '/dashboard',
    defaultRoute: '/dashboard',
    subRoutes: [],
  },
  // QuickBooks routes — Executive Summary first, then reports, then others
  {
    key: 'qb-executive-summary',
    label: 'Executive Summary',
    basePath: '/qb/reports',
    defaultRoute: '/qb/reports',
    subRoutes: [],
  },
  {
    key: 'qb-pnl',
    label: 'Profit & Loss',
    basePath: '/qb/reports/pnl',
    defaultRoute: '/qb/reports/pnl',
    subRoutes: [],
  },
  {
    key: 'qb-balance-sheet',
    label: 'Balance Sheet',
    basePath: '/qb/reports/balance-sheet',
    defaultRoute: '/qb/reports/balance-sheet',
    subRoutes: [],
  },
  {
    key: 'qb-cash-flow',
    label: 'Cash Flow',
    basePath: '/qb/reports/cash-flow',
    defaultRoute: '/qb/reports/cash-flow',
    subRoutes: [],
  },
  {
    key: 'qb-forecasting',
    label: 'Forecasting',
    basePath: '/qb/forecasting',
    defaultRoute: '/qb/forecasting',
    subRoutes: [],
  },
  {
    key: 'qb-sales',
    label: 'Sales',
    basePath: '/qb/sales',
    defaultRoute: '/qb/sales',
    subRoutes: [],
  },
  {
    key: 'qb-vendors',
    label: 'Vendor Analysis',
    basePath: '/qb/expenses/vendors',
    defaultRoute: '/qb/expenses/vendors',
    subRoutes: [],
  },
  {
    key: 'qb-bills',
    label: 'Bills',
    basePath: '/qb/expenses/bills',
    defaultRoute: '/qb/expenses/bills',
    subRoutes: [],
  },
  {
    key: 'qb-expenses',
    label: 'Expenses',
    basePath: '/qb/expenses',
    defaultRoute: '/qb/expenses',
    subRoutes: [],
  },
  {
    key: 'qb-journal',
    label: 'Journal',
    basePath: '/qb/journal',
    defaultRoute: '/qb/journal',
    subRoutes: [],
  },
  // Business Central routes — Summary first, then reports, then others
  {
    key: 'bc-summary',
    label: 'Summary',
    basePath: '/bc/reports',
    defaultRoute: '/bc/reports',
    subRoutes: [],
  },
  {
    key: 'bc-pnl',
    label: 'Profit & Loss',
    basePath: '/bc/pnl',
    defaultRoute: '/bc/pnl',
    subRoutes: [],
  },
  {
    key: 'bc-balance-sheet',
    label: 'Balance Sheet',
    basePath: '/bc/balance-sheet',
    defaultRoute: '/bc/balance-sheet',
    subRoutes: [],
  },
  {
    key: 'bc-cash-flow',
    label: 'Cash Flow',
    basePath: '/bc/cash-flow',
    defaultRoute: '/bc/cash-flow',
    subRoutes: [],
  },
  {
    key: 'bc-customers',
    label: 'Customers',
    basePath: '/bc/customers',
    defaultRoute: '/bc/customers',
    subRoutes: [],
  },
  {
    key: 'bc-vendors',
    label: 'Vendors',
    basePath: '/bc/vendors',
    defaultRoute: '/bc/vendors',
    subRoutes: [],
  },
  {
    key: 'bc-inventory',
    label: 'Inventory',
    basePath: '/bc/inventory',
    defaultRoute: '/bc/inventory',
    subRoutes: [
      { href: '/bc/inventory', label: 'Overview' },
      { href: '/bc/inventory/items', label: 'Items' },
      { href: '/bc/inventory/stock-analysis', label: 'Stock Analysis' },
      { href: '/bc/inventory/locations', label: 'Locations' },
    ],
  },
  // Business Central Warehouse routes (Fivetran/Redshift data)
  {
    key: 'bcw-summary',
    label: 'Summary',
    basePath: '/bc-warehouse/reports',
    defaultRoute: '/bc-warehouse/reports',
    subRoutes: [],
  },
  {
    key: 'bcw-pnl',
    label: 'Profit & Loss',
    basePath: '/bc-warehouse/pnl',
    defaultRoute: '/bc-warehouse/pnl',
    subRoutes: [],
  },
  {
    key: 'bcw-balance-sheet',
    label: 'Balance Sheet',
    basePath: '/bc-warehouse/balance-sheet',
    defaultRoute: '/bc-warehouse/balance-sheet',
    subRoutes: [],
  },
  {
    key: 'bcw-cash-flow',
    label: 'Cash Flow',
    basePath: '/bc-warehouse/cash-flow',
    defaultRoute: '/bc-warehouse/cash-flow',
    subRoutes: [],
  },
  {
    key: 'bcw-customers',
    label: 'Customers',
    basePath: '/bc-warehouse/customers',
    defaultRoute: '/bc-warehouse/customers',
    subRoutes: [],
  },
  {
    key: 'bcw-vendors',
    label: 'Vendors',
    basePath: '/bc-warehouse/vendors',
    defaultRoute: '/bc-warehouse/vendors',
    subRoutes: [],
  },
  {
    key: 'bcw-inventory',
    label: 'Inventory',
    basePath: '/bc-warehouse/inventory',
    defaultRoute: '/bc-warehouse/inventory',
    subRoutes: [
      { href: '/bc-warehouse/inventory', label: 'Overview' },
      { href: '/bc-warehouse/inventory/items', label: 'Items' },
    ],
  },
  // Shopify routes
  {
    key: 'shopify-summary',
    label: 'Summary',
    basePath: '/shopify/reports',
    defaultRoute: '/shopify/reports',
    subRoutes: [],
  },
  {
    key: 'shopify-orders',
    label: 'Orders',
    basePath: '/shopify/orders',
    defaultRoute: '/shopify/orders',
    subRoutes: [
      { href: '/shopify/orders', label: 'All Orders' },
      { href: '/shopify/draft-orders', label: 'Draft Orders' },
      { href: '/shopify/abandoned-checkouts', label: 'Abandoned Carts' },
    ],
  },
  {
    key: 'shopify-draft-orders',
    label: 'Draft Orders',
    basePath: '/shopify/draft-orders',
    defaultRoute: '/shopify/draft-orders',
    subRoutes: [
      { href: '/shopify/orders', label: 'All Orders' },
      { href: '/shopify/draft-orders', label: 'Draft Orders' },
      { href: '/shopify/abandoned-checkouts', label: 'Abandoned Carts' },
    ],
  },
  {
    key: 'shopify-abandoned-checkouts',
    label: 'Abandoned Carts',
    basePath: '/shopify/abandoned-checkouts',
    defaultRoute: '/shopify/abandoned-checkouts',
    subRoutes: [
      { href: '/shopify/orders', label: 'All Orders' },
      { href: '/shopify/draft-orders', label: 'Draft Orders' },
      { href: '/shopify/abandoned-checkouts', label: 'Abandoned Carts' },
    ],
  },
  {
    key: 'shopify-products',
    label: 'Products',
    basePath: '/shopify/products',
    defaultRoute: '/shopify/products',
    subRoutes: [
      { href: '/shopify/products', label: 'All Products' },
      { href: '/shopify/collections', label: 'Collections' },
      { href: '/shopify/inventory', label: 'Inventory' },
    ],
  },
  {
    key: 'shopify-collections',
    label: 'Collections',
    basePath: '/shopify/collections',
    defaultRoute: '/shopify/collections',
    subRoutes: [
      { href: '/shopify/products', label: 'All Products' },
      { href: '/shopify/collections', label: 'Collections' },
      { href: '/shopify/inventory', label: 'Inventory' },
    ],
  },
  {
    key: 'shopify-inventory',
    label: 'Inventory',
    basePath: '/shopify/inventory',
    defaultRoute: '/shopify/inventory',
    subRoutes: [
      { href: '/shopify/products', label: 'All Products' },
      { href: '/shopify/collections', label: 'Collections' },
      { href: '/shopify/inventory', label: 'Inventory' },
    ],
  },
  {
    key: 'shopify-customers',
    label: 'Customers',
    basePath: '/shopify/customers',
    defaultRoute: '/shopify/customers',
    subRoutes: [],
  },
  {
    key: 'shopify-tags',
    label: 'By Tag',
    basePath: '/shopify/tags',
    defaultRoute: '/shopify/tags',
    subRoutes: [],
  },
  {
    key: 'shopify-returns',
    label: 'Returns',
    basePath: '/shopify/returns',
    defaultRoute: '/shopify/returns',
    subRoutes: [],
  },
  {
    key: 'shopify-refunds',
    label: 'Refunds',
    basePath: '/shopify/refunds',
    defaultRoute: '/shopify/refunds',
    subRoutes: [],
  },
  {
    key: 'shopify-disputes',
    label: 'Disputes',
    basePath: '/shopify/disputes',
    defaultRoute: '/shopify/disputes',
    subRoutes: [],
  },
  {
    key: 'shopify-marketing',
    label: 'Marketing',
    basePath: '/shopify/marketing',
    defaultRoute: '/shopify/marketing',
    subRoutes: [],
  },
  // Legacy routes - redirect to /qb/ routes
  {
    key: 'reports',
    label: 'Reports',
    basePath: '/reports',
    defaultRoute: '/qb/reports',
    subRoutes: [
      { href: '/qb/reports', label: 'Executive Summary' },
      { href: '/qb/reports/pnl', label: 'Profit & Loss' },
      { href: '/qb/reports/balance-sheet', label: 'Balance Sheet' },
      { href: '/qb/reports/cash-flow', label: 'Cash Flow' },
    ],
  },
  {
    key: 'forecasting',
    label: 'Forecasting',
    basePath: '/forecasting',
    defaultRoute: '/qb/forecasting',
    subRoutes: [],
  },
  {
    key: 'sales',
    label: 'Sales',
    basePath: '/sales',
    defaultRoute: '/qb/sales',
    subRoutes: [],
  },
  {
    key: 'expenses',
    label: 'Expenses',
    basePath: '/expenses',
    defaultRoute: '/qb/expenses/vendors',
    subRoutes: [
      { href: '/qb/expenses/vendors', label: 'Vendor Analysis' },
      { href: '/qb/expenses/bills', label: 'Bills' },
    ],
  },
  {
    key: 'journal',
    label: 'Journal',
    basePath: '/journal',
    defaultRoute: '/qb/journal',
    subRoutes: [],
  },
  // Common routes
  {
    key: 'memories',
    label: 'AI Memories',
    basePath: '/memories',
    defaultRoute: '/memories',
    subRoutes: [],
  },
  {
    key: 'learn',
    label: 'Learn',
    basePath: '/learn',
    defaultRoute: '/learn',
    subRoutes: [],
  },
  {
    key: 'support',
    label: 'Support',
    basePath: '/support',
    defaultRoute: '/support',
    subRoutes: [],
  },
  {
    key: 'settings',
    label: 'Settings',
    basePath: '/settings',
    defaultRoute: '/settings',
    subRoutes: [],
  },
]

// Helper to find current section and sub-route from pathname
const findCurrentNavigation = (pathname: string | null) => {
  if (!pathname) return { section: null, subRoute: null }

  const section = navigationSections.find(
    (s) => pathname === s.basePath || pathname.startsWith(s.basePath + '/')
  )
  if (!section) return { section: null, subRoute: null }

  const subRoute = section.subRoutes.find((r) => r.href === pathname)
  return { section, subRoute }
}

interface TopBarProps {
  providerEntities?: Record<string, string>
  onChatToggle: () => void
  isChatOpen: boolean
  onSidebarToggle?: () => void
  isMobile?: boolean
  onSignOut?: () => void
}

export default function TopBar({
  providerEntities = {},
  onChatToggle,
  isChatOpen,
  onSidebarToggle,
  isMobile,
  onSignOut,
}: TopBarProps) {
  const { currency, hasFetchedCurrency } = useCurrency()
  const { data: companyData } = useCompanyMetadata()
  const pathname = usePathname()
  const router = useRouter()
  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false)
  const [sectionSwitcherOpen, setSectionSwitcherOpen] = useState(false)
  const [subRouteSwitcherOpen, setSubRouteSwitcherOpen] = useState(false)
  const companySwitcherRef = useRef<HTMLDivElement>(null)
  const sectionSwitcherRef = useRef<HTMLDivElement>(null)
  const subRouteSwitcherRef = useRef<HTMLDivElement>(null)

  const searchParams = useSearchParams()
  const currentRealmId = searchParams.get('realmId')

  // Find current section and sub-route
  const { section: currentSection, subRoute: currentSubRoute } = findCurrentNavigation(pathname)

  // Parse all connected entities for the company switcher
  const allCompanies = useMemo(() => {
    const companies: Array<{
      provider: 'quickbooks' | 'dynamics' | 'shopify'
      id: string // realmId for QB, connectionId/schemaName for BC, shop domain for Shopify
      companyName: string
      defaultRoute: string
      connected: boolean
      connectionType?: 'oauth' | 'warehouse' // BC only
    }> = []

    // Parse QB entities — supports both old (realmId→name) and new (realmId→{name,connected}) formats
    const qbEntities = providerEntities['quickbooks']
    if (qbEntities) {
      try {
        const nameMap = JSON.parse(qbEntities) as Record<
          string,
          string | { name: string; connected: boolean }
        >
        for (const [realmId, value] of Object.entries(nameMap)) {
          const isObject = typeof value === 'object' && value !== null
          companies.push({
            provider: 'quickbooks',
            id: realmId,
            companyName: isObject ? value.name : value,
            defaultRoute: `/qb/reports?realmId=${realmId}`,
            connected: isObject ? value.connected : true,
          })
        }
      } catch {
        // Not JSON — legacy single-entity format
        companies.push({
          provider: 'quickbooks',
          id: 'default',
          companyName: qbEntities,
          defaultRoute: '/qb/reports',
          connected: true,
        })
      }
    }

    // Parse BC entities — now includes both OAuth and warehouse with { name, type }
    const bcEntities = providerEntities['dynamics']
    if (bcEntities) {
      try {
        const bcMap = JSON.parse(bcEntities) as Record<
          string,
          string | { name: string; type: 'oauth' | 'warehouse' }
        >
        for (const [bcId, value] of Object.entries(bcMap)) {
          const isNewFormat = typeof value === 'object' && value !== null && 'type' in value
          const companyName = isNewFormat ? value.name : (value as string)
          const connectionType = isNewFormat ? value.type : 'warehouse'
          // Use correct route based on connection type:
          // - Warehouse: /bc-warehouse/reports?schema=
          // - OAuth: /bc/reports?connectionId=
          let defaultRoute: string
          if (connectionType === 'warehouse') {
            defaultRoute =
              bcId === 'default' ? '/bc-warehouse/reports' : `/bc-warehouse/reports?schema=${bcId}`
          } else {
            defaultRoute = bcId === 'default' ? '/bc/reports' : `/bc/reports?connectionId=${bcId}`
          }
          companies.push({
            provider: 'dynamics',
            id: bcId,
            companyName,
            defaultRoute,
            connected: true,
            connectionType,
          })
        }
      } catch {
        // Not JSON — legacy format (assume warehouse)
        companies.push({
          provider: 'dynamics',
          id: 'default',
          companyName: bcEntities,
          defaultRoute: '/bc-warehouse/reports',
          connected: true,
          connectionType: 'warehouse',
        })
      }
    }

    // Parse Shopify stores — keyed by shop domain
    const shopifyEntities = providerEntities['shopify']
    if (shopifyEntities) {
      try {
        const storeMap = JSON.parse(shopifyEntities) as Record<
          string,
          string | { name: string; connected: boolean }
        >
        for (const [domain, value] of Object.entries(storeMap)) {
          const isObject = typeof value === 'object' && value !== null
          companies.push({
            provider: 'shopify',
            id: domain,
            companyName: isObject ? value.name : value,
            defaultRoute: `/shopify/reports?shop=${encodeURIComponent(domain)}`,
            connected: isObject ? value.connected : true,
          })
        }
      } catch {
        // Not JSON — legacy single-store format
        companies.push({
          provider: 'shopify',
          id: 'default',
          companyName: shopifyEntities,
          defaultRoute: '/shopify/reports',
          connected: true,
        })
      }
    }

    return companies
  }, [providerEntities])

  // Filter by provider for convenience
  const qbCompanies = allCompanies.filter((c) => c.provider === 'quickbooks')
  const bcCompanies = allCompanies.filter((c) => c.provider === 'dynamics')
  const shopifyCompanies = allCompanies.filter((c) => c.provider === 'shopify')

  // Get current BC connection from URL - supports ?connectionId=, ?schema=, and legacy ?bc= params
  const currentBCId =
    searchParams.get('connectionId') || searchParams.get('schema') || searchParams.get('bc')

  // Get current Shopify store from URL - supports ?shop=domain
  const currentShop = searchParams.get('shop')

  // Helper to append/replace entity ID (realmId for QB, schema/connectionId for BC, shop for Shopify) in routes
  const appendEntityParam = (href: string) => {
    // Handle QB routes
    if (href.startsWith('/qb') && currentRealmId) {
      const [path, queryString] = href.split('?')
      const params = new URLSearchParams(queryString || '')
      params.set('realmId', currentRealmId)
      return `${path}?${params.toString()}`
    }

    // Handle BC warehouse routes - use ?schema= parameter
    if (href.startsWith('/bc-warehouse') && currentBCId) {
      const [path, queryString] = href.split('?')
      const params = new URLSearchParams(queryString || '')
      params.set('schema', currentBCId)
      return `${path}?${params.toString()}`
    }

    // Handle BC OAuth routes - use ?connectionId= parameter
    // Explicitly check for /bc/ (not /bc-warehouse) to avoid false matches
    if (href.startsWith('/bc/') && currentBCId) {
      const [path, queryString] = href.split('?')
      const params = new URLSearchParams(queryString || '')
      params.set('connectionId', currentBCId)
      return `${path}?${params.toString()}`
    }

    // Handle Shopify routes - use ?shop= parameter
    if (href.startsWith('/shopify') && currentShop) {
      const [path, queryString] = href.split('?')
      const params = new URLSearchParams(queryString || '')
      params.set('shop', currentShop)
      return `${path}?${params.toString()}`
    }

    return href
  }

  // Legacy helper for QB-specific realmId (used by company switcher)
  const appendRealmId = (href: string, realmId?: string | null) => {
    const rid = realmId ?? currentRealmId
    if (!rid || !href.startsWith('/qb')) return href

    const [path, queryString] = href.split('?')
    const params = new URLSearchParams(queryString || '')
    params.set('realmId', rid)

    return `${path}?${params.toString()}`
  }

  // Derive the entity name from the active provider based on current route
  const entityName = (() => {
    if (pathname?.startsWith('/qb')) {
      if (qbCompanies.length > 0) {
        const match = qbCompanies.find((c) => c.id === currentRealmId)
        if (match) return match.companyName
        // Fallback to first entity name if no realmId in URL
        return qbCompanies[0]?.companyName ?? null
      }
      return companyData?.identity?.name || null
    }
    // Handle both /bc-warehouse/ and /bc/ routes
    if (pathname?.startsWith('/bc-warehouse') || pathname?.startsWith('/bc')) {
      if (bcCompanies.length > 0) {
        // Match by param (supports both OAuth connectionId and warehouse schemaName)
        const match = bcCompanies.find((c) => c.id === currentBCId || c.id === 'default')
        if (match) return match.companyName
        return bcCompanies[0]?.companyName ?? null
      }
      return null
    }
    // Handle Shopify routes
    if (pathname?.startsWith('/shopify')) {
      if (shopifyCompanies.length > 0) {
        const match = shopifyCompanies.find((c) => c.id === currentShop || c.id === 'default')
        if (match) return match.companyName
        return shopifyCompanies[0]?.companyName ?? null
      }
      return null
    }
    return null
  })()

  // Get the effective entity ID for current provider
  const effectiveRealmId = currentRealmId || qbCompanies[0]?.id || null
  const effectiveBCId = currentBCId || bcCompanies[0]?.id || null

  // Determine current provider from pathname (bc-warehouse and bc are both dynamics)
  const currentProvider = pathname?.startsWith('/qb')
    ? 'quickbooks'
    : pathname?.startsWith('/bc-warehouse') || pathname?.startsWith('/bc')
      ? 'dynamics'
      : pathname?.startsWith('/shopify')
        ? 'shopify'
        : null

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        companySwitcherRef.current &&
        !companySwitcherRef.current.contains(event.target as Node)
      ) {
        setCompanySwitcherOpen(false)
      }
      if (
        sectionSwitcherRef.current &&
        !sectionSwitcherRef.current.contains(event.target as Node)
      ) {
        setSectionSwitcherOpen(false)
      }
      if (
        subRouteSwitcherRef.current &&
        !subRouteSwitcherRef.current.contains(event.target as Node)
      ) {
        setSubRouteSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get QB company name from metadata - always prefer QB name when available
  const companyName = companyData?.identity?.name || null

  return (
    <header className="dashboard-topbar fixed top-0 left-0 right-0 h-14 z-50 border-b border-amber-500/10">
      <div className="flex items-center h-full px-4">
        {/* Left Section - Mobile Menu + Logo + Company/Org Info */}
        <div className="flex items-center gap-3">
          {/* Tablet Hamburger Menu - only visible on tablet (768px-1024px), hidden on mobile and desktop */}
          {onSidebarToggle && (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="p-2 theme-text-secondary hover:text-amber-500 hover:bg-amber-500/10 rounded-md transition-colors hidden md:block lg:hidden"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/images/hero/logo_type_gold_new.svg"
              alt="Midas"
              width={140}
              height={36}
              className="object-contain hidden sm:block"
              priority
            />
            {/* Smaller logo for mobile */}
            <Image
              src="/images/hero/logo_gold_new.svg"
              alt="Midas"
              width={32}
              height={32}
              className="object-contain sm:hidden"
              priority
            />
          </Link>

          {/* Breadcrumb Navigation - Hidden on mobile */}
          <div
            className="hidden md:flex items-center gap-2 text-sm pl-3 border-l border-amber-500/20"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            {/* Navigation switcher - always show */}
            {currentSection && (
              <>
                <div className="relative" ref={companySwitcherRef}>
                  <button
                    type="button"
                    onClick={() => setCompanySwitcherOpen(!companySwitcherOpen)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:font-bold"
                  >
                    <PIIText className="theme-text-primary font-medium">
                      {entityName || currentSection.label}
                    </PIIText>
                    <ChevronDown
                      className={`w-3.5 h-3.5 theme-text-secondary transition-transform duration-200 ${
                        companySwitcherOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Company Switcher Dropdown Menu */}
                  <div
                    className={`absolute top-full left-0 mt-1 w-72 py-2 rounded-lg border border-amber-500/20 shadow-xl z-50 transition-all duration-200 ease-out origin-top-left ${
                      companySwitcherOpen
                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                    }`}
                    style={{
                      background: 'var(--theme-bg)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    {/* Dashboard & Memories - top nav items */}
                    {[
                      { href: '/dashboard', label: 'Dashboard' },
                      { href: '/memories', label: 'AI Memories' },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setCompanySwitcherOpen(false)}
                        className={`block px-3 py-2 text-sm transition-colors ${
                          pathname === item.href || pathname?.startsWith(item.href + '/')
                            ? 'theme-text-primary bg-amber-500/10'
                            : 'theme-text-secondary hover:theme-text-primary hover:bg-amber-500/10'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}

                    {/* Connected companies - BC first, then QB, then Shopify (matching sidebar order) */}
                    <div className="my-2 border-t border-amber-500/10" />
                    {[...bcCompanies, ...qbCompanies, ...shopifyCompanies].map((company) => {
                      // Determine if this company is currently active
                      const isActive =
                        (company.provider === 'quickbooks' &&
                          currentProvider === 'quickbooks' &&
                          company.id === effectiveRealmId) ||
                        (company.provider === 'dynamics' &&
                          currentProvider === 'dynamics' &&
                          company.id === effectiveBCId) ||
                        (company.provider === 'shopify' &&
                          currentProvider === 'shopify' &&
                          (company.id === currentShop ||
                            (!currentShop && company.id === shopifyCompanies[0]?.id)))
                      const providerLabel =
                        company.provider === 'quickbooks'
                          ? 'QB'
                          : company.provider === 'dynamics'
                            ? 'BC'
                            : 'SH'
                      const isDisconnected = company.connected === false
                      return (
                        <button
                          key={`${company.provider}-${company.id}`}
                          onClick={() => {
                            setCompanySwitcherOpen(false)
                            if (isDisconnected) {
                              router.push('/settings')
                            } else {
                              router.push(company.defaultRoute)
                            }
                          }}
                          className={`w-full px-3 py-2 text-left transition-colors flex items-center justify-between ${
                            isDisconnected
                              ? 'opacity-60 hover:bg-amber-500/5'
                              : isActive
                                ? 'bg-amber-500/10'
                                : 'hover:bg-amber-500/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                isDisconnected
                                  ? 'bg-red-500/15 text-red-400'
                                  : company.provider === 'quickbooks'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : company.provider === 'dynamics'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-[#7AB55C]/20 text-[#7AB55C]'
                              }`}
                            >
                              {providerLabel}
                            </span>
                            <PIIText
                              className={`text-sm truncate ${isDisconnected ? 'theme-text-secondary' : 'theme-text-primary'}`}
                            >
                              {company.companyName}
                            </PIIText>
                            {isDisconnected && (
                              <span className="flex items-center gap-1 text-[9px] font-medium text-amber-500/80 flex-shrink-0">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Disconnected
                              </span>
                            )}
                          </div>
                          {!isDisconnected && isActive && (
                            <Check className="w-4 h-4 text-amber-500 flex-shrink-0 ml-2" />
                          )}
                        </button>
                      )
                    })}
                    {/* Connect another company - within companies section */}
                    <Link
                      href="/dashboard?addCompany=true"
                      onClick={() => setCompanySwitcherOpen(false)}
                      className="block px-3 py-1.5 text-left hover:bg-amber-500/10 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs theme-text-secondary">
                        <Plus className="w-3 h-3" />
                        Connect another company
                      </div>
                    </Link>

                    {/* Learn, Support, Settings - bottom nav items */}
                    <div className="my-2 border-t border-amber-500/10" />
                    {[
                      { href: '/learn', label: 'Learn' },
                      { href: '/support', label: 'Support' },
                      { href: '/settings', label: 'Settings' },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setCompanySwitcherOpen(false)}
                        className={`block px-3 py-2 text-sm transition-colors ${
                          pathname === item.href || pathname?.startsWith(item.href + '/')
                            ? 'theme-text-primary bg-amber-500/10'
                            : 'theme-text-secondary hover:theme-text-primary hover:bg-amber-500/10'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Section Navigation - only for provider pages (QB/BC/BC-Warehouse/Shopify) */}
            {currentSection &&
              (pathname?.startsWith('/qb') ||
                pathname?.startsWith('/bc-warehouse') ||
                pathname?.startsWith('/bc') ||
                pathname?.startsWith('/shopify')) && (
                <>
                  <span className="theme-text-secondary opacity-40">|</span>
                  <div className="relative" ref={sectionSwitcherRef}>
                    <button
                      type="button"
                      onClick={() => setSectionSwitcherOpen(!sectionSwitcherOpen)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:font-bold"
                    >
                      <span className="theme-text-primary">{currentSection.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 theme-text-secondary transition-transform duration-200 ${
                          sectionSwitcherOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Section Dropdown Menu */}
                    <div
                      className={`absolute top-full left-0 mt-1 w-48 py-1 rounded-lg border border-amber-500/20 shadow-xl z-50 transition-all duration-200 ease-out origin-top-left ${
                        sectionSwitcherOpen
                          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                          : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                      }`}
                      style={{
                        background: 'var(--theme-bg)',
                        backdropFilter: 'blur(12px)',
                      }}
                    >
                      {navigationSections
                        .filter((section) => {
                          // Show sections matching the current provider prefix, or common routes
                          // bc-warehouse must be checked before bc to avoid false matches
                          const currentPrefix = currentSection.basePath.startsWith('/qb')
                            ? '/qb'
                            : currentSection.basePath.startsWith('/bc-warehouse')
                              ? '/bc-warehouse'
                              : currentSection.basePath.startsWith('/bc')
                                ? '/bc'
                                : currentSection.basePath.startsWith('/shopify')
                                  ? '/shopify'
                                  : null
                          if (currentPrefix) {
                            // For /bc, exclude /bc-warehouse routes (both start with /bc)
                            if (currentPrefix === '/bc') {
                              return (
                                section.basePath.startsWith('/bc') &&
                                !section.basePath.startsWith('/bc-warehouse')
                              )
                            }
                            // For /shopify, hide sub-page entries that share a parent group
                            // (Draft Orders, Abandoned Carts, Collections, Inventory) — they appear
                            // in the sub-route dropdown instead.
                            if (currentPrefix === '/shopify') {
                              const hiddenChildren = new Set([
                                'shopify-draft-orders',
                                'shopify-abandoned-checkouts',
                                'shopify-collections',
                                'shopify-inventory',
                              ])
                              return (
                                section.basePath.startsWith('/shopify') &&
                                !hiddenChildren.has(section.key)
                              )
                            }
                            return section.basePath.startsWith(currentPrefix)
                          }
                          // For non-provider pages, show non-provider sections
                          return (
                            !section.basePath.startsWith('/qb') &&
                            !section.basePath.startsWith('/bc-warehouse') &&
                            !section.basePath.startsWith('/bc') &&
                            !section.basePath.startsWith('/shopify')
                          )
                        })
                        .map((section) => (
                          <Link
                            key={section.key}
                            href={appendEntityParam(section.defaultRoute)}
                            onClick={() => setSectionSwitcherOpen(false)}
                            className={`block px-3 py-2 text-sm transition-colors ${
                              currentSection.key === section.key
                                ? 'theme-text-primary bg-amber-500/10'
                                : 'theme-text-secondary hover:theme-text-primary hover:bg-amber-500/10'
                            }`}
                          >
                            {section.label}
                          </Link>
                        ))}
                    </div>
                  </div>

                  {/* Sub-route Navigation - only if section has sub-routes */}
                  {currentSection.subRoutes.length > 0 && (
                    <>
                      <span className="theme-text-secondary opacity-40">|</span>
                      <div className="relative" ref={subRouteSwitcherRef}>
                        <button
                          type="button"
                          onClick={() => setSubRouteSwitcherOpen(!subRouteSwitcherOpen)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:font-bold"
                        >
                          <span className="theme-text-primary">
                            {currentSubRoute?.label || currentSection.subRoutes[0]?.label}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 theme-text-secondary transition-transform duration-200 ${
                              subRouteSwitcherOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Sub-route Dropdown Menu */}
                        <div
                          className={`absolute top-full left-0 mt-1 w-48 py-1 rounded-lg border border-amber-500/20 shadow-xl z-50 transition-all duration-200 ease-out origin-top-left ${
                            subRouteSwitcherOpen
                              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                              : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                          }`}
                          style={{
                            background: 'var(--theme-bg)',
                            backdropFilter: 'blur(12px)',
                          }}
                        >
                          {currentSection.subRoutes.map((route) => {
                            const routeHref = appendEntityParam(route.href)
                            // Check if current path matches (ignoring query params)
                            const isActive =
                              pathname === route.href ||
                              (pathname?.startsWith(route.href) &&
                                route.href !== currentSection.basePath)
                            return (
                              <Link
                                key={route.href}
                                href={routeHref}
                                onClick={() => setSubRouteSwitcherOpen(false)}
                                className={`block px-3 py-2 text-sm transition-colors ${
                                  isActive
                                    ? 'theme-text-primary bg-amber-500/10'
                                    : 'theme-text-secondary hover:theme-text-primary hover:bg-amber-500/10'
                                }`}
                              >
                                {route.label}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
          </div>

          {/* Mobile: Just show current section/sub-route */}
          {currentSection && (
            <span
              className="md:hidden text-sm theme-text-primary truncate max-w-[160px]"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              {currentSubRoute?.label || currentSection.label}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right Section - Icons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Icons Area */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Currency indicator */}
            {currentProvider && (
              <>
                {hasFetchedCurrency && currency ? (
                  <span className="hidden md:inline text-sm theme-text-secondary">
                    {currency.toUpperCase()} ({getCurrencyInfo(currency).symbol})
                  </span>
                ) : !hasFetchedCurrency ? (
                  <span className="hidden md:inline h-3 w-14 bg-black/[0.04] dark:bg-white/[0.04] animate-[topbar-shimmer_3s_ease-in-out_infinite]" />
                ) : null}
                {(hasFetchedCurrency && currency) || !hasFetchedCurrency ? (
                  <span className="hidden md:inline theme-text-secondary opacity-40 ml-1">|</span>
                ) : null}
              </>
            )}

            {/* Theme Switcher */}
            <CSSThemeToggleCompact />

            {/* Notifications - Hidden on mobile */}
            <div className="hidden sm:block">
              <NotificationDropdown />
            </div>

            {/* Chat Toggle Button */}
            <button
              type="button"
              onClick={onChatToggle}
              className={`p-2 rounded-md transition-colors ${
                isChatOpen
                  ? 'text-amber-500 bg-amber-500/20 hover:bg-amber-500/30'
                  : 'theme-text-secondary hover:text-amber-500 hover:bg-amber-500/10'
              }`}
              aria-label="Toggle Chat"
              aria-expanded={isChatOpen}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>

          {/* Sign Out Button - Expanding on hover */}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="group flex items-center gap-0 p-2 rounded-md theme-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 overflow-hidden"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[80px] group-hover:ml-2 transition-all duration-200 text-sm font-medium">
                Sign Out
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
