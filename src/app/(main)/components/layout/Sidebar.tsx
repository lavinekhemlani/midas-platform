// src/app/(main)/components/layout/Sidebar.tsx
'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BarChart3,
  GraduationCap,
  ChevronLeft,
  Settings,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CreditCard,
  Building2,
  Wallet,
  FileBarChart,
  Brain,
  HelpCircle,
  Store,
  LineChart,
  Banknote,
  Package,
  Database,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import UserAvatar from '@/components/ui/UserAvatar'
import { useSearchParams } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import {
  PROVIDER_CONFIGS,
  COMMON_NAV_ITEMS,
  BOTTOM_NAV_ITEMS,
  DYNAMICS_OAUTH_CONFIG,
  DYNAMICS_WAREHOUSE_CONFIG,
  type NavItem as ProviderNavItem,
  type ProviderConfig,
} from '@/lib/providers/provider-config'
import { ProviderID } from '@/lib/providers/database'

interface SidebarProps {
  expanded: boolean
  onToggle: () => void
  isMobile: boolean
  isPinned: boolean
  onPinToggle: () => void
  userName?: string
  userEmail?: string
  userAvatar?: string
  onSignOut?: () => void
}

interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  isNew?: boolean
  comingSoon?: boolean
  color?: string
  children?: {
    id: string
    label: string
    href: string
    icon: LucideIcon
    badge?: string
    isNew?: boolean
    comingSoon?: boolean
  }[]
}

// Icon mapping from string names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  BarChart3,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CreditCard,
  Building2,
  Wallet,
  FileBarChart,
  Brain,
  HelpCircle,
  Store,
  LineChart,
  Banknote,
  Package,
  Database,
}

// Convert provider nav items to sidebar nav items
function convertProviderNavItems(
  items: ProviderNavItem[],
  providerColor: string,
  realmId?: string,
  schema?: string
): NavItem[] {
  // Append ?realmId=xxx or ?schema=xxx to hrefs for multi-entity sections
  const entitySuffix = realmId || schema
  const appendEntityParam = (href: string) => {
    const params: string[] = []
    if (realmId) params.push(`realmId=${realmId}`)
    if (schema) params.push(`schema=${schema}`)
    if (params.length === 0) return href
    const sep = href.includes('?') ? '&' : '?'
    return `${href}${sep}${params.join('&')}`
  }

  return items.map((item) => ({
    id: entitySuffix ? `${item.id}-${entitySuffix}` : item.id,
    label: item.label,
    href: appendEntityParam(item.href),
    icon: iconMap[item.icon] || LayoutDashboard,
    badge: item.badge,
    isNew: item.isNew,
    comingSoon: item.comingSoon,
    color: providerColor,
    children: item.children?.map((child) => ({
      id: entitySuffix ? `${child.id}-${entitySuffix}` : child.id,
      label: child.label,
      href: appendEntityParam(child.href),
      icon: iconMap[child.icon || 'FileText'] || FileText,
      badge: child.badge,
      isNew: child.isNew,
      comingSoon: child.comingSoon,
    })),
  }))
}

// Common navigation items (always shown)
const commonNavItems: NavItem[] = COMMON_NAV_ITEMS.map((item) => ({
  id: item.id,
  label: item.label,
  href: item.href,
  icon: iconMap[item.icon] || LayoutDashboard,
  badge: item.badge,
  isNew: item.isNew,
  comingSoon: item.comingSoon,
}))

// Bottom navigation items (always pinned to bottom)
const bottomNavItems: NavItem[] = BOTTOM_NAV_ITEMS.map((item) => ({
  id: item.id,
  label: item.label,
  href: item.href,
  icon: iconMap[item.icon] || HelpCircle,
  badge: item.badge,
  isNew: item.isNew,
  comingSoon: item.comingSoon,
}))

interface NavigationSection {
  id: string
  label: string
  color: string
  icon: LucideIcon
  items: NavItem[]
  disconnected?: boolean
}

export default function Sidebar({
  expanded,
  onToggle,
  isMobile,
  isPinned,
  onPinToggle,
  userName,
  userEmail,
  userAvatar,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname()
  const { connectedProviders, organization } = useSession()
  const searchParams = useSearchParams()
  const currentRealmId = searchParams.get('realmId') || undefined
  const currentSchema = searchParams.get('schema') || undefined
  const currentConnectionId = searchParams.get('connectionId') || undefined
  const currentShop = searchParams.get('shop') || undefined
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [collapsedSections, setCollapsedSections] = useState<string[]>([])
  const [showContent, setShowContent] = useState(expanded)
  const [fullyExpanded, setFullyExpanded] = useState(expanded)
  const [scrollbarVisible, setScrollbarVisible] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const autoCloseTimer = useRef<NodeJS.Timeout | null>(null)
  const expandTimer = useRef<NodeJS.Timeout | null>(null)
  const scrollbarTimer = useRef<NodeJS.Timeout | null>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const [isHovering, setIsHovering] = useState(false)

  // Build navigation sections based on connected providers
  // QB multi-entity: one section per entity with company name
  const navigationSections = useMemo((): NavigationSection[] => {
    const sections: NavigationSection[] = []

    for (const providerId of connectedProviders) {
      const config = PROVIDER_CONFIGS[providerId]
      if (!config) continue

      // QB multi-entity: expand into per-entity sections
      if (providerId === 'quickbooks') {
        const qbInfo = organization?.providers?.quickbooks as any
        if (qbInfo?.connections) {
          let addedEntities = false
          for (const [realmId, conn] of Object.entries(qbInfo.connections) as [string, any][]) {
            const isConnected = !!conn?.credentials?.connected
            const companyName = conn?.credentials?.company_name || `QB ${realmId.slice(-4)}`
            // Abbreviate long names for sidebar
            const shortLabel =
              companyName.length > 20 ? companyName.slice(0, 18) + '...' : companyName
            sections.push({
              id: `quickbooks-${realmId}`,
              label: shortLabel,
              color: config.color,
              icon: iconMap[config.icon] || Banknote,
              items: convertProviderNavItems(config.navItems, config.color, realmId),
              disconnected: !isConnected,
            })
            addedEntities = true
          }
          if (addedEntities) continue
        }

        // Fallback: org data not yet loaded but URL has realmId — create a
        // temporary section so the sidebar can highlight the active page
        // immediately on refresh. It will be replaced once org data arrives.
        if (currentRealmId && pathname?.startsWith('/qb')) {
          sections.push({
            id: `quickbooks-${currentRealmId}`,
            label: config.shortName,
            color: config.color,
            icon: iconMap[config.icon] || Banknote,
            items: convertProviderNavItems(config.navItems, config.color, currentRealmId),
          })
          continue
        }
      }

      // BC multi-entity: OAuth connections first, then warehouse schemas (matches dashboard card order)
      if (providerId === 'dynamics') {
        const bcInfo = organization?.providers?.dynamics as any
        const schemas = bcInfo?.credentials?.schemas as any[] | undefined
        let addedEntities = false

        // BC OAuth connections first: one section per connected company with ?connectionId=xxx
        const oauthConns = bcInfo?.oauthConnections as Record<string, any> | undefined
        if (oauthConns) {
          for (const [connId, conn] of Object.entries(oauthConns)) {
            if (connId === '_pending_oauth' || !conn?.credentials?.connected) continue
            const companyName = conn.credentials?.company_name || 'BC OAuth'
            const shortLabel =
              companyName.length > 20 ? companyName.slice(0, 18) + '...' : companyName
            // Use OAuth config with /bc/ base path and ?connectionId=xxx
            const oauthItems = convertProviderNavItems(
              DYNAMICS_OAUTH_CONFIG.navItems,
              DYNAMICS_OAUTH_CONFIG.color
            ).map((item) => ({
              ...item,
              id: `${item.id}-oauth-${connId}`,
              href: item.href.split('?')[0] + `?connectionId=${connId}`,
              children: item.children?.map((c) => ({
                ...c,
                id: `${c.id}-oauth-${connId}`,
                href: c.href.split('?')[0] + `?connectionId=${connId}`,
              })),
            }))
            sections.push({
              id: `dynamics-oauth-${connId}`,
              label: shortLabel,
              color: DYNAMICS_OAUTH_CONFIG.color,
              icon: iconMap[DYNAMICS_OAUTH_CONFIG.icon] || Database,
              items: oauthItems,
            })
            addedEntities = true
          }
        }

        // BC warehouse schemas second: use DYNAMICS_WAREHOUSE_CONFIG for /bc-warehouse/ paths
        if (schemas && schemas.length > 0) {
          for (const schema of schemas) {
            const companyName = schema.company_name || schema.schema_name || 'Business Central'
            const shortLabel =
              companyName.length > 20 ? companyName.slice(0, 18) + '...' : companyName
            sections.push({
              id: `dynamics-warehouse-${schema.schema_name}`,
              label: shortLabel,
              color: DYNAMICS_WAREHOUSE_CONFIG.color,
              icon: iconMap[DYNAMICS_WAREHOUSE_CONFIG.icon] || Database,
              items: convertProviderNavItems(
                DYNAMICS_WAREHOUSE_CONFIG.navItems,
                DYNAMICS_WAREHOUSE_CONFIG.color,
                undefined,
                schema.schema_name
              ),
            })
            addedEntities = true
          }
        }

        if (addedEntities) continue

        // Fallback: org data not yet loaded but URL has schema — create temp warehouse section
        if (currentSchema && pathname?.startsWith('/bc-warehouse')) {
          sections.push({
            id: `dynamics-warehouse-${currentSchema}`,
            label: DYNAMICS_WAREHOUSE_CONFIG.shortName,
            color: DYNAMICS_WAREHOUSE_CONFIG.color,
            icon: iconMap[DYNAMICS_WAREHOUSE_CONFIG.icon] || Database,
            items: convertProviderNavItems(
              DYNAMICS_WAREHOUSE_CONFIG.navItems,
              DYNAMICS_WAREHOUSE_CONFIG.color,
              undefined,
              currentSchema
            ),
          })
          continue
        }
        // Fallback: org data not yet loaded but URL has connectionId — create temp OAuth section
        if (currentConnectionId && pathname?.startsWith('/bc')) {
          const tempItems = convertProviderNavItems(
            DYNAMICS_OAUTH_CONFIG.navItems,
            DYNAMICS_OAUTH_CONFIG.color
          ).map((item) => ({
            ...item,
            id: `${item.id}-oauth-${currentConnectionId}`,
            href: item.href.split('?')[0] + `?connectionId=${currentConnectionId}`,
            children: item.children?.map((c) => ({
              ...c,
              id: `${c.id}-oauth-${currentConnectionId}`,
              href: c.href.split('?')[0] + `?connectionId=${currentConnectionId}`,
            })),
          }))
          sections.push({
            id: `dynamics-oauth-${currentConnectionId}`,
            label: DYNAMICS_OAUTH_CONFIG.shortName,
            color: DYNAMICS_OAUTH_CONFIG.color,
            icon: iconMap[DYNAMICS_OAUTH_CONFIG.icon] || Database,
            items: tempItems,
          })
          continue
        }
      }

      // Shopify multi-store: one section per connected store with ?shop=domain
      if (providerId === 'shopify') {
        const shopifyInfo = organization?.providers?.shopify as any
        if (shopifyInfo?.connections) {
          let addedStores = false
          for (const [domain, conn] of Object.entries(shopifyInfo.connections) as [string, any][]) {
            const isConnected = !!conn?.credentials?.connected
            const storeName =
              conn?.credentials?.company_name || domain.replace('.myshopify.com', '')
            const shortLabel = storeName.length > 20 ? storeName.slice(0, 18) + '...' : storeName
            // Append ?shop=domain to each nav item href
            const storeItems = convertProviderNavItems(config.navItems, config.color).map(
              (item) => ({
                ...item,
                id: `${item.id}-${domain}`,
                href: `${item.href}?shop=${encodeURIComponent(domain)}`,
                children: item.children?.map((c) => ({
                  ...c,
                  id: `${c.id}-${domain}`,
                  href: `${c.href}?shop=${encodeURIComponent(domain)}`,
                })),
              })
            )
            sections.push({
              id: `shopify-${domain}`,
              label: shortLabel,
              color: config.color,
              icon: iconMap[config.icon] || Store,
              items: storeItems,
              disconnected: !isConnected,
            })
            addedStores = true
          }
          if (addedStores) continue
        }
      }

      // Non-QB, non-BC, non-Shopify providers, or providers without multi-entity data
      sections.push({
        id: providerId,
        label: config.shortName,
        color: config.color,
        icon: iconMap[config.icon] || Banknote,
        items: convertProviderNavItems(config.navItems, config.color),
      })
    }

    return sections
  }, [
    connectedProviders,
    organization,
    currentRealmId,
    currentSchema,
    currentConnectionId,
    pathname,
  ])

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      if (!prev.includes(itemId)) {
        return [itemId]
      }
      return []
    })
  }

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const isCurrentlyCollapsed = prev.includes(sectionId)
      if (isCurrentlyCollapsed) {
        // Opening this section → collapse all others (accordion)
        return navigationSections.map((s) => s.id).filter((id) => id !== sectionId)
      } else {
        // Closing this section
        return [...prev, sectionId]
      }
    })
  }

  const handleItemClick = (item: NavItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (item.children) {
      toggleExpanded(item.id)
    }
  }

  useEffect(() => {
    setShowContent(expanded)
    if (expanded) {
      // Wait for the 300ms sidebar width transition to finish before showing scrollbar
      expandTimer.current = setTimeout(() => setFullyExpanded(true), 300)
    } else {
      // Immediately hide scrollbar when collapsing
      if (expandTimer.current) clearTimeout(expandTimer.current)
      setFullyExpanded(false)
    }
    return () => {
      if (expandTimer.current) clearTimeout(expandTimer.current)
    }
  }, [expanded])

  const isActive = (href: string) => {
    // Parse the href to separate path and query params
    const [hrefPath, hrefQuery] = href.split('?')
    const hrefParams = new URLSearchParams(hrefQuery || '')
    const hrefRealmId = hrefParams.get('realmId')
    const hrefSchema = hrefParams.get('schema')
    const hrefConnectionId = hrefParams.get('connectionId')

    // For QB multi-entity: match both path AND realmId
    if (hrefRealmId) {
      if (currentRealmId !== hrefRealmId) return false
    } else if (currentRealmId && hrefPath?.startsWith('/qb')) {
      return false
    }

    // For BC warehouse multi-schema: match both path AND schema
    if (hrefSchema) {
      if (currentSchema !== hrefSchema) return false
    } else if (
      currentSchema &&
      (hrefPath?.startsWith('/bc-warehouse') || hrefPath?.startsWith('/bc/'))
    ) {
      return false
    }

    // For BC OAuth: match both path AND connectionId
    if (hrefConnectionId) {
      if (currentConnectionId !== hrefConnectionId) return false
    } else if (currentConnectionId && hrefPath?.startsWith('/bc/')) {
      return false
    }

    // For Shopify multi-store: match both path AND shop domain
    const hrefShop = hrefParams.get('shop')
    if (hrefShop) {
      if (currentShop !== hrefShop) return false
    } else if (currentShop && hrefPath?.startsWith('/shopify')) {
      return false
    }

    // Handle QuickBooks routes
    if (hrefPath === '/qb/reports') {
      return pathname === '/qb/reports'
    }
    if (hrefPath?.startsWith('/qb/reports/')) {
      return pathname === hrefPath
    }
    // For expenses child routes, require exact match to avoid both items being highlighted
    if (hrefPath === '/qb/expenses/vendors') {
      return pathname === '/qb/expenses/vendors'
    }
    if (hrefPath === '/qb/expenses/bills') {
      return pathname === '/qb/expenses/bills'
    }

    // Handle Business Central OAuth routes
    if (hrefPath?.startsWith('/bc/')) {
      // For BC inventory child routes, require exact match to avoid parent overview
      // matching all child paths (e.g. /bc/inventory matching /bc/inventory/items)
      if (hrefPath === '/bc/inventory') {
        return pathname === '/bc/inventory'
      }
      return pathname === hrefPath || pathname?.startsWith(hrefPath + '/')
    }

    // Handle Business Central Warehouse routes
    if (hrefPath?.startsWith('/bc-warehouse/')) {
      // For BC warehouse inventory child routes, require exact match to avoid parent overview
      // matching all child paths (e.g. /bc-warehouse/inventory matching /bc-warehouse/inventory/items)
      if (hrefPath === '/bc-warehouse/inventory') {
        return pathname === '/bc-warehouse/inventory'
      }
      return pathname === hrefPath || pathname?.startsWith(hrefPath + '/')
    }

    // For common routes
    if (pathname === hrefPath) return true
    if (pathname?.startsWith(hrefPath + '/')) return true

    return false
  }

  // Auto-expand sections and items based on current path + realmId
  useEffect(() => {
    const allItems = [
      ...navigationSections.flatMap((s) => s.items),
      ...commonNavItems,
      ...bottomNavItems,
    ]
    const currentSection = allItems.find((item) => {
      if (item.children) {
        return item.children.some((child) => isActive(child.href))
      }
      return false
    })

    if (currentSection) {
      setExpandedItems([currentSection.id])
    }

    // Auto-expand provider section containing active route (accordion — only one open)
    const activeSectionId = navigationSections.find((section) =>
      section.items.some(
        (item) => isActive(item.href) || item.children?.some((child) => isActive(child.href))
      )
    )?.id

    if (activeSectionId) {
      setCollapsedSections(
        navigationSections.map((s) => s.id).filter((id) => id !== activeSectionId)
      )
    } else {
      // No active provider route (e.g. dashboard) → collapse all sections
      setCollapsedSections(navigationSections.map((s) => s.id))
    }
  }, [
    pathname,
    navigationSections,
    currentRealmId,
    currentSchema,
    currentConnectionId,
    currentShop,
  ])

  useEffect(() => {
    if (expanded && !isMobile && !isHovering && !isPinned) {
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current)
      }

      autoCloseTimer.current = setTimeout(() => {
        onToggle()
      }, 15000)
    } else {
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current)
      }
    }

    return () => {
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current)
      }
    }
  }, [expanded, isMobile, onToggle, isHovering, isPinned])

  const handleMouseEnter = () => {
    setIsHovering(true)
    if (!expanded && !isMobile) {
      onToggle()
    }
    // Delay scrollbar appearance to avoid flash on quick mouse pass-through
    if (scrollbarTimer.current) clearTimeout(scrollbarTimer.current)
    scrollbarTimer.current = setTimeout(() => setScrollbarVisible(true), 400)
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    // Immediately hide scrollbar on mouse leave
    if (scrollbarTimer.current) clearTimeout(scrollbarTimer.current)
    setScrollbarVisible(false)
    if (expanded && !isPinned && !isMobile) {
      onToggle()
    }
  }

  const sidebarClasses = `
    dashboard-sidebar fixed top-14 left-0 h-[calc(100vh-56px)]
    ${expanded ? 'w-[240px]' : 'w-[64px]'}
    ${isMobile && expanded ? 'open' : ''}
    transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
    flex flex-col
    overflow-hidden
    z-50
  `

  const textSlideInStyle = {
    opacity: showContent && expanded ? 1 : 0,
    transform: showContent && expanded ? 'translateX(0)' : 'translateX(-20px)',
    transition: 'opacity 200ms ease-out, transform 200ms ease-out',
    overflow: 'hidden',
    whiteSpace: 'nowrap' as const,
  }

  // Get color styles for provider-specific items
  const getColorStyles = (color?: string) => {
    if (!color) return {}
    return {
      '--provider-color': color,
      '--provider-color-rgb': hexToRgb(color),
    } as React.CSSProperties
  }

  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '245, 158, 11'
  }

  const renderNavItem = (item: NavItem, isProviderItem: boolean = false) => {
    const ItemIcon = item.icon
    const itemColor = item.color || (isProviderItem ? undefined : undefined)

    return (
      <div key={item.id}>
        <div
          className="relative"
          onMouseEnter={() => !expanded && !item.comingSoon && setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {item.children ? (
            <button
              onClick={(e) => handleItemClick(item, e)}
              className={`
                dashboard-sidebar-item w-full flex items-center text-left relative
                h-[36px] pl-2 pr-0
                ${item.children.some((child) => isActive(child.href)) ? 'active' : ''}
              `}
              style={getColorStyles(itemColor)}
              title={!expanded ? item.label : undefined}
            >
              <div className="w-[36px] flex-shrink-0 flex justify-center">
                <ItemIcon
                  className="w-4 h-4"
                  style={
                    item.children.some((child) => isActive(child.href)) && itemColor
                      ? { color: itemColor }
                      : undefined
                  }
                />
              </div>
              {expanded && (
                <>
                  <span className="ml-1.5 font-soft flex-1" style={textSlideInStyle}>
                    {item.label}
                  </span>
                  <div className="flex items-center space-x-2 mr-3">
                    {item.isNew && showContent && (
                      <Badge
                        className="text-xs"
                        style={{
                          ...textSlideInStyle,
                          backgroundColor: itemColor ? `${itemColor}20` : 'rgba(245, 158, 11, 0.2)',
                          color: itemColor || 'rgb(251, 191, 36)',
                          borderColor: itemColor ? `${itemColor}30` : 'rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        New
                      </Badge>
                    )}
                    <ChevronLeft
                      className={`w-4 h-4 transition-transform duration-200 theme-text-secondary ${
                        expandedItems.includes(item.id) ? 'rotate-90' : '-rotate-90'
                      }`}
                      style={textSlideInStyle}
                    />
                  </div>
                </>
              )}
            </button>
          ) : item.comingSoon ? (
            <div
              className="dashboard-sidebar-item flex items-center relative h-[36px] pl-2 pr-0 pointer-events-none"
              style={{ cursor: 'default' }}
            >
              <div className="w-[36px] flex-shrink-0 flex justify-center">
                <ItemIcon className="w-4 h-4" />
              </div>
              {expanded && (
                <>
                  <span className="ml-1.5 font-soft" style={textSlideInStyle}>
                    {item.label}
                  </span>
                  <div className="ml-auto flex items-center space-x-2">
                    <Badge
                      className="text-xs bg-slate-700/50 text-slate-400 border-slate-600/50"
                      style={textSlideInStyle}
                    >
                      Soon
                    </Badge>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href={item.href}>
              <div
                className={`
                  dashboard-sidebar-item flex items-center relative
                  h-[36px] pl-2 pr-0
                  ${isActive(item.href) ? 'active' : ''}
                `}
                style={getColorStyles(itemColor)}
                title={!expanded ? item.label : undefined}
              >
                <div className="w-[36px] flex-shrink-0 flex justify-center">
                  <ItemIcon
                    className="w-4 h-4"
                    style={isActive(item.href) && itemColor ? { color: itemColor } : undefined}
                  />
                </div>
                {expanded && (
                  <>
                    <span className="ml-1.5 font-soft" style={textSlideInStyle}>
                      {item.label}
                    </span>
                    <div className="ml-auto flex items-center space-x-2 mr-3">
                      {item.isNew && showContent && (
                        <Badge
                          className="text-xs"
                          style={{
                            ...textSlideInStyle,
                            backgroundColor: itemColor
                              ? `${itemColor}20`
                              : 'rgba(245, 158, 11, 0.2)',
                            color: itemColor || 'rgb(251, 191, 36)',
                            borderColor: itemColor ? `${itemColor}30` : 'rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          New
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Link>
          )}

          {/* Tooltip for collapsed state */}
          {!expanded && hoveredItem === item.id && (
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 animate-tooltipFadeIn">
              <div
                className="px-3 py-2 rounded-full shadow-lg whitespace-nowrap"
                style={{
                  background: itemColor
                    ? `rgba(${hexToRgb(itemColor)}, 0.95)`
                    : 'rgba(245, 158, 11, 0.95)',
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${itemColor ? `${itemColor}30` : 'rgba(245, 158, 11, 0.3)'}`,
                }}
              >
                <p className="text-sm font-medium text-white">{item.label}</p>
              </div>
              <div
                className="absolute top-1/2 -left-1 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent"
                style={{
                  borderRightColor: itemColor || 'rgb(245, 158, 11)',
                }}
              ></div>
            </div>
          )}
        </div>

        {/* Sub-navigation */}
        {item.children && expanded && showContent && expandedItems.includes(item.id) && (
          <div className="mt-0.5 space-y-0.5">
            {item.children.map((child) => {
              const ChildIcon = child.icon
              return (
                <Link key={child.id} href={child.href}>
                  <div
                    className={`
                      dashboard-sidebar-item dashboard-sidebar-child flex items-center text-sm relative
                      h-[32px] px-2
                      ${isActive(child.href) ? 'active' : ''}
                    `}
                    style={getColorStyles(item.color)}
                  >
                    {ChildIcon && (
                      <div style={{ marginLeft: '18px' }}>
                        <ChildIcon className="w-4 h-4 flex-shrink-0" />
                      </div>
                    )}
                    <span className="ml-1.5 flex-1" style={textSlideInStyle}>
                      {child.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Collapsed state sub-navigation */}
        {item.children && !expanded && expandedItems.includes(item.id) && (
          <div className="-mt-0.5 -mb-0.5 space-y-0.5 overflow-hidden">
            {item.children.map((child) => {
              const ChildIcon = child.icon
              return (
                <Link key={child.id} href={child.href}>
                  <div
                    className={`
                      dashboard-sidebar-item dashboard-sidebar-child flex items-center relative
                      h-[32px] px-2
                      ${isActive(child.href) ? 'active' : ''}
                    `}
                    onMouseEnter={() => setHoveredItem(`${item.id}-${child.id}`)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {ChildIcon && (
                      <div style={{ marginLeft: '18px' }}>
                        <ChildIcon
                          className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${
                            isActive(child.href) ? '' : 'theme-text-secondary opacity-70'
                          }`}
                          style={
                            isActive(child.href) && item.color ? { color: item.color } : undefined
                          }
                        />
                      </div>
                    )}

                    {hoveredItem === `${item.id}-${child.id}` && (
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 animate-tooltipFadeIn">
                        <div
                          className="px-3 py-2 rounded-full shadow-lg whitespace-nowrap"
                          style={{
                            background: item.color
                              ? `rgba(${hexToRgb(item.color)}, 0.95)`
                              : 'rgba(245, 158, 11, 0.95)',
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${item.color ? `${item.color}30` : 'rgba(245, 158, 11, 0.3)'}`,
                          }}
                        >
                          <p className="text-sm font-medium text-white">{child.label}</p>
                        </div>
                        <div
                          className="absolute top-1/2 -left-1 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent"
                          style={{
                            borderRightColor: item.color || 'rgb(245, 158, 11)',
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      ref={sidebarRef}
      className={sidebarClasses}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Scrollable nav items */}
      <nav
        className={`flex-1 min-h-0 overflow-x-hidden sidebar-scrollbar ${fullyExpanded ? 'overflow-y-auto' : 'overflow-y-hidden'} ${scrollbarVisible ? 'scrollbar-visible' : ''}`}
      >
        <div className="py-2 space-y-0.5">
          {/* Dashboard - Always visible at top */}
          {renderNavItem(
            {
              id: 'dashboard',
              label: 'Dashboard',
              href: '/dashboard',
              icon: LayoutDashboard,
            },
            false
          )}

          {/* Common Items (AI Memory) — alongside Dashboard */}
          {commonNavItems.map((item) => renderNavItem(item, false))}

          {/* Separator after Dashboard section if providers exist */}
          {navigationSections.length > 0 && <div className="mx-4 my-2 h-px bg-amber-500/20" />}

          {/* Provider Sections */}
          {navigationSections.map((section) => {
            const isSectionCollapsed = collapsedSections.includes(section.id)

            return (
              <div key={section.id} className={section.disconnected ? 'opacity-50' : ''}>
                {/* Clickable Provider Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center w-full pt-3 pb-1.5 pl-2 pr-0 hover:bg-white/5 rounded transition-colors"
                >
                  <div className="w-[36px] flex-shrink-0 flex justify-center">
                    <section.icon className="w-4 h-4" style={{ color: section.color }} />
                  </div>
                  {expanded && (
                    <>
                      <span
                        className="ml-1.5 text-[13px] font-semibold uppercase tracking-wider flex-1 text-left"
                        style={{ color: section.color, ...textSlideInStyle }}
                      >
                        {section.label}
                      </span>
                      {section.disconnected && (
                        <span
                          className="text-[9px] font-medium uppercase tracking-wider text-amber-500/70 mr-1"
                          style={textSlideInStyle}
                        >
                          Disconnected
                        </span>
                      )}
                      <ChevronLeft
                        className={`w-4 h-4 transition-transform duration-200 mr-3 ${
                          isSectionCollapsed ? '-rotate-90' : 'rotate-90'
                        }`}
                        style={{
                          ...textSlideInStyle,
                          color: section.disconnected ? undefined : section.color,
                          opacity: 0.6,
                        }}
                      />
                    </>
                  )}
                </button>

                {/* Provider Navigation Items — collapsible with slide animation */}
                <div
                  className="overflow-hidden transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    display: 'grid',
                    gridTemplateRows: isSectionCollapsed ? '0fr' : '1fr',
                  }}
                >
                  <div
                    className="min-h-0 transition-opacity duration-200"
                    style={{ opacity: isSectionCollapsed ? 0 : 1 }}
                  >
                    {section.items.map((item) => renderNavItem(item, true))}
                  </div>
                </div>

                {/* Separator after provider section */}
                <div className="mx-4 my-3 h-px bg-amber-500/20" />
              </div>
            )
          })}
          {/* Learn & Support */}
          {bottomNavItems.map((item) => (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => !expanded && setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <Link href={item.href}>
                <div
                  className={`
                    dashboard-sidebar-item flex items-center relative
                    h-[36px] pl-2 pr-0
                    ${isActive(item.href) ? 'active' : ''}
                  `}
                  title={!expanded ? item.label : undefined}
                >
                  <div className="w-[36px] flex-shrink-0 flex justify-center">
                    <item.icon className="w-4 h-4" />
                  </div>
                  {expanded && (
                    <span className="ml-1.5 font-soft" style={textSlideInStyle}>
                      {item.label}
                    </span>
                  )}
                </div>
              </Link>

              {!expanded && hoveredItem === item.id && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 animate-tooltipFadeIn">
                  <div
                    className="px-3 py-2 rounded-full shadow-lg whitespace-nowrap"
                    style={{
                      background: 'rgba(245, 158, 11, 0.95)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    <p className="text-sm font-medium text-white">{item.label}</p>
                  </div>
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-amber-500"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* User Profile — sticky to bottom */}
      <div className="flex-shrink-0 py-2">
        <div className="border-t border-amber-500/10 pt-2">
          <div
            className="relative"
            onMouseEnter={() => !expanded && setHoveredItem('profile')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <Link href="/settings">
              <div
                className={`
                  dashboard-sidebar-item flex items-center relative cursor-pointer
                  h-[36px] pl-2 pr-2
                  ${pathname?.startsWith('/settings') ? 'active' : ''}
                `}
                title={!expanded ? 'Settings' : undefined}
              >
                <div className="w-[36px] flex-shrink-0 flex justify-center">
                  <UserAvatar
                    imageUrl={userAvatar}
                    firstName={userName?.split(' ')[0]}
                    email={userEmail}
                    size="sm"
                    useThemeColors
                  />
                </div>

                {expanded && (
                  <>
                    <span
                      className="ml-2 font-soft text-sm theme-text-primary truncate flex-1"
                      style={textSlideInStyle}
                    >
                      {userName || userEmail || 'User'}
                    </span>
                    <div style={textSlideInStyle}>
                      <Settings className="w-4 h-4" />
                    </div>
                  </>
                )}
              </div>
            </Link>

            {!expanded && hoveredItem === 'profile' && (
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 animate-tooltipFadeIn">
                <div
                  className="px-3 py-2 rounded-full shadow-lg whitespace-nowrap"
                  style={{
                    background: 'rgba(245, 158, 11, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <p className="text-sm font-medium text-white">
                    {userName || userEmail || 'Settings'}
                  </p>
                </div>
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-amber-500"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
