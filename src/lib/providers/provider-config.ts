// src/lib/providers/provider-config.ts
// Central configuration for multi-provider navigation and routing

import { ProviderID } from './database'

export interface NavItemChild {
  id: string
  label: string
  href: string
  icon?: string
  badge?: string
  isNew?: boolean
  comingSoon?: boolean
}

export interface NavItem {
  id: string
  label: string
  href: string
  icon: string
  badge?: string
  isNew?: boolean
  comingSoon?: boolean
  description?: string
  children?: NavItemChild[]
}

export type ProviderCategory = 'accounting' | 'commerce'

export interface ProviderConfig {
  id: ProviderID
  name: string
  shortName: string
  color: string
  basePath: string
  icon: string
  authType: 'oauth' | 'custom_credentials' | 'dual'
  category: ProviderCategory
  navItems: NavItem[]
}

// QuickBooks provider configuration
const quickbooksConfig: ProviderConfig = {
  id: 'quickbooks',
  name: 'QuickBooks',
  shortName: 'QB',
  color: '#2CA01C', // QuickBooks Green
  basePath: '/qb',
  icon: 'Banknote',
  authType: 'oauth',
  category: 'accounting',
  navItems: [
    {
      id: 'qb-summary',
      label: 'Summary',
      href: '/qb/reports',
      icon: 'LayoutDashboard',
      description: 'Executive Summary',
    },
    {
      id: 'qb-pnl',
      label: 'Profit & Loss',
      href: '/qb/reports/pnl',
      icon: 'FileBarChart',
      description: 'Profit & Loss Statement',
    },
    {
      id: 'qb-balance-sheet',
      label: 'Balance Sheet',
      href: '/qb/reports/balance-sheet',
      icon: 'Building2',
      description: 'Balance Sheet',
    },
    {
      id: 'qb-cash-flow',
      label: 'Cash Flow',
      href: '/qb/reports/cash-flow',
      icon: 'Wallet',
      description: 'Cash Flow Statement',
    },
    {
      id: 'qb-forecasting',
      label: 'Forecasting',
      href: '/qb/forecasting',
      icon: 'LineChart',
      isNew: true,
      description: 'Financial Forecasting',
    },
    {
      id: 'qb-sales',
      label: 'Sales',
      href: '/qb/sales',
      icon: 'TrendingUp',
      description: 'Sales Analytics',
    },
    {
      id: 'qb-expenses',
      label: 'Expenses',
      href: '/qb/expenses/vendors',
      icon: 'TrendingDown',
      description: 'Expense Management',
      children: [
        {
          id: 'qb-expenses-vendors',
          label: 'Vendors',
          href: '/qb/expenses/vendors',
          icon: 'Store',
        },
        {
          id: 'qb-expenses-bills',
          label: 'Bills',
          href: '/qb/expenses/bills',
          icon: 'CreditCard',
        },
      ],
    },
    {
      id: 'qb-journal',
      label: 'Journal',
      href: '/qb/journal',
      icon: 'FileText',
      description: 'Journal Entries',
    },
  ],
}

// Dynamics Business Central OAuth provider configuration
const dynamicsOAuthConfig: ProviderConfig = {
  id: 'dynamics',
  name: 'Business Central',
  shortName: 'BC',
  color: '#00A4EF', // Microsoft Blue
  basePath: '/bc',
  icon: 'Database',
  authType: 'oauth',
  category: 'accounting',
  navItems: [
    {
      id: 'bc-summary',
      label: 'Summary',
      href: '/bc/reports',
      icon: 'LayoutDashboard',
      description: 'Executive Summary',
    },
    {
      id: 'bc-pnl',
      label: 'Profit & Loss',
      href: '/bc/pnl',
      icon: 'FileBarChart',
      description: 'Profit & Loss Statement',
    },
    {
      id: 'bc-balance-sheet',
      label: 'Balance Sheet',
      href: '/bc/balance-sheet',
      icon: 'Building2',
      description: 'Balance Sheet',
    },
    {
      id: 'bc-cash-flow',
      label: 'Cash Flow',
      href: '/bc/cash-flow',
      icon: 'Banknote',
      description: 'Cash Flow Statement',
    },
    {
      id: 'bc-customers',
      label: 'Customers',
      href: '/bc/customers',
      icon: 'Users',
      description: 'Customer Analytics',
    },
    {
      id: 'bc-vendors',
      label: 'Vendors',
      href: '/bc/vendors',
      icon: 'Building2',
      description: 'Vendor Management',
    },
    {
      id: 'bc-inventory',
      label: 'Inventory',
      href: '/bc/inventory',
      icon: 'Package',
      description: 'Inventory Tracking',
      children: [
        {
          id: 'bc-inv-overview',
          label: 'Overview',
          href: '/bc/inventory',
          icon: 'LayoutDashboard',
        },
        { id: 'bc-inv-items', label: 'Items', href: '/bc/inventory/items', icon: 'List' },
        {
          id: 'bc-inv-stock',
          label: 'Stock Analysis',
          href: '/bc/inventory/stock-analysis',
          icon: 'Activity',
        },
        {
          id: 'bc-inv-locations',
          label: 'Locations',
          href: '/bc/inventory/locations',
          icon: 'MapPin',
        },
      ],
    },
  ],
}

// Dynamics Business Central Warehouse provider configuration
// Warehouse connections use Fivetran/Redshift data - simpler nav without OAuth-only features
const dynamicsWarehouseConfig: ProviderConfig = {
  id: 'dynamics',
  name: 'Business Central Warehouse',
  shortName: 'BC Warehouse',
  color: '#00A4EF', // Microsoft Blue
  basePath: '/bc-warehouse',
  icon: 'Database',
  authType: 'custom_credentials',
  category: 'accounting',
  navItems: [
    {
      id: 'bcw-summary',
      label: 'Summary',
      href: '/bc-warehouse/reports',
      icon: 'LayoutDashboard',
      description: 'Executive Summary',
    },
    {
      id: 'bcw-pnl',
      label: 'Profit & Loss',
      href: '/bc-warehouse/pnl',
      icon: 'FileBarChart',
      description: 'Profit & Loss Statement',
    },
    {
      id: 'bcw-balance-sheet',
      label: 'Balance Sheet',
      href: '/bc-warehouse/balance-sheet',
      icon: 'Building2',
      description: 'Balance Sheet',
    },
    {
      id: 'bcw-cash-flow',
      label: 'Cash Flow',
      href: '/bc-warehouse/cash-flow',
      icon: 'Banknote',
      description: 'Cash Flow Statement',
    },
    {
      id: 'bcw-customers',
      label: 'Customers',
      href: '/bc-warehouse/customers',
      icon: 'Users',
      description: 'Customer Analytics',
    },
    {
      id: 'bcw-vendors',
      label: 'Vendors',
      href: '/bc-warehouse/vendors',
      icon: 'Building2',
      description: 'Vendor Management',
    },
    {
      id: 'bcw-inventory',
      label: 'Inventory',
      href: '/bc-warehouse/inventory',
      icon: 'Package',
      description: 'Inventory Tracking',
      children: [
        {
          id: 'bcw-inv-overview',
          label: 'Overview',
          href: '/bc-warehouse/inventory',
          icon: 'LayoutDashboard',
        },
        {
          id: 'bcw-inv-items',
          label: 'Items',
          href: '/bc-warehouse/inventory/items',
          icon: 'List',
        },
      ],
    },
  ],
}

// Shopify provider configuration
const shopifyConfig: ProviderConfig = {
  id: 'shopify',
  name: 'Shopify',
  shortName: 'Shopify',
  color: '#7AB55C', // Shopify Green
  basePath: '/shopify',
  icon: 'Store',
  authType: 'oauth',
  category: 'commerce',
  navItems: [
    {
      id: 'shopify-summary',
      label: 'Summary',
      href: '/shopify/reports',
      icon: 'LayoutDashboard',
      description: 'Store Overview',
    },
    {
      id: 'shopify-orders',
      label: 'Orders',
      href: '/shopify/orders',
      icon: 'FileText',
      description: 'Orders, Drafts & Abandoned Carts',
      children: [
        {
          id: 'shopify-orders-all',
          label: 'All Orders',
          href: '/shopify/orders',
          icon: 'FileText',
        },
        {
          id: 'shopify-draft-orders',
          label: 'Draft Orders',
          href: '/shopify/draft-orders',
          icon: 'FileEdit',
        },
        {
          id: 'shopify-abandoned-checkouts',
          label: 'Abandoned Carts',
          href: '/shopify/abandoned-checkouts',
          icon: 'ShoppingCart',
        },
        {
          id: 'shopify-fulfillments',
          label: 'Fulfillments',
          href: '/shopify/fulfillments',
          icon: 'Truck',
          isNew: true,
        },
      ],
    },
    {
      id: 'shopify-products',
      label: 'Products',
      href: '/shopify/products',
      icon: 'Package',
      description: 'Products, Collections & Inventory',
      children: [
        {
          id: 'shopify-products-all',
          label: 'All Products',
          href: '/shopify/products',
          icon: 'Package',
        },
        {
          id: 'shopify-collections',
          label: 'Collections',
          href: '/shopify/collections',
          icon: 'FolderOpen',
        },
        {
          id: 'shopify-inventory',
          label: 'Inventory',
          href: '/shopify/inventory',
          icon: 'Warehouse',
        },
      ],
    },
    {
      id: 'shopify-customers',
      label: 'Customers',
      href: '/shopify/customers',
      icon: 'Users',
      description: 'Customer Analytics',
    },
    {
      id: 'shopify-tags',
      label: 'By Tag',
      href: '/shopify/tags',
      icon: 'Tag',
      isNew: true,
      description: 'Product Tag Performance',
    },
    {
      id: 'shopify-returns',
      label: 'Returns',
      href: '/shopify/returns',
      icon: 'Package',
      isNew: true,
      description: 'Return Workflow & RMA',
    },
    {
      id: 'shopify-refunds',
      label: 'Refunds',
      href: '/shopify/refunds',
      icon: 'RotateCcw',
      description: 'Refund Analysis',
    },
    {
      id: 'shopify-disputes',
      label: 'Disputes',
      href: '/shopify/disputes',
      icon: 'Shield',
      description: 'Chargebacks & Disputes',
    },
    {
      id: 'shopify-payouts',
      label: 'Payouts',
      href: '/shopify/payouts',
      icon: 'Banknote',
      description: 'Cash Flow & Payout Reconciliation',
    },
    {
      id: 'shopify-marketing',
      label: 'Marketing',
      href: '/shopify/marketing',
      icon: 'Megaphone',
      description: 'Campaigns & Performance',
    },
  ],
}

// Legacy config for backward compatibility - used when connection type is unknown
const dynamicsConfig = dynamicsOAuthConfig

// Common navigation items shown alongside Dashboard (always visible)
export const COMMON_NAV_ITEMS: NavItem[] = [
  {
    id: 'memories',
    label: 'AI Memory',
    href: '/memories',
    icon: 'Brain',
    description: 'AI Learning & Memory',
  },
]

// Bottom navigation items (always pinned to bottom)
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  {
    id: 'learn',
    label: 'Learn',
    href: '/learn',
    icon: 'GraduationCap',
    description: 'Financial Education',
  },
  {
    id: 'support',
    label: 'Support',
    href: '/support',
    icon: 'HelpCircle',
    description: 'Help & Support',
  },
]

// Provider configurations indexed by ID
export const PROVIDER_CONFIGS: Partial<Record<ProviderID, ProviderConfig>> = {
  quickbooks: quickbooksConfig,
  dynamics: dynamicsConfig,
  shopify: shopifyConfig,
}

// Export separate configs for explicit use
export const DYNAMICS_OAUTH_CONFIG = dynamicsOAuthConfig
export const DYNAMICS_WAREHOUSE_CONFIG = dynamicsWarehouseConfig

// Category display metadata
export const CATEGORY_META: Record<ProviderCategory, { label: string; description: string }> = {
  accounting: {
    label: 'Accounting & ERP',
    description: 'Financial statements, ledgers & reporting',
  },
  commerce: { label: 'Commerce & Retail', description: 'Sales channels, orders & inventory' },
}

// Get provider config by ID
export function getProviderConfig(providerId: ProviderID): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[providerId]
}

// Get category for a provider
export function getProviderCategory(providerId: ProviderID): ProviderCategory {
  return PROVIDER_CONFIGS[providerId]?.category ?? 'accounting'
}

// Get all provider configs for connected providers
export function getConnectedProviderConfigs(connectedProviders: ProviderID[]): ProviderConfig[] {
  return connectedProviders
    .map((id) => PROVIDER_CONFIGS[id])
    .filter((config): config is ProviderConfig => config !== undefined)
}

// Check if a path belongs to a specific provider
export function getProviderFromPath(pathname: string): ProviderID | null {
  if (pathname.startsWith('/qb')) return 'quickbooks'
  if (pathname.startsWith('/bc-warehouse') || pathname.startsWith('/bc')) return 'dynamics'
  if (pathname.startsWith('/shopify')) return 'shopify'
  return null
}

// Get all routes that require a specific provider
export function getProviderRoutes(providerId: ProviderID): string[] {
  const config = PROVIDER_CONFIGS[providerId]
  if (!config) return []

  const routes: string[] = []
  for (const item of config.navItems) {
    routes.push(item.href)
    if (item.children) {
      for (const child of item.children) {
        routes.push(child.href)
      }
    }
  }
  return routes
}

// Check if route requires any provider connection
export function routeRequiresProvider(pathname: string): boolean {
  // Provider-specific routes
  if (
    pathname.startsWith('/qb') ||
    pathname.startsWith('/bc-warehouse') ||
    pathname.startsWith('/bc') ||
    pathname.startsWith('/shopify')
  ) {
    return true
  }
  // Legacy routes (will redirect)
  if (
    pathname.startsWith('/reports') ||
    pathname.startsWith('/sales') ||
    pathname.startsWith('/expenses') ||
    pathname.startsWith('/journal') ||
    pathname.startsWith('/forecasting') ||
    pathname.startsWith('/aqua') // legacy — next.config.ts redirects to /bc
  ) {
    return true
  }
  return false
}
