'use client'

import { useState, useMemo } from 'react'
import { Search, Filter, Check, Clock, ArrowUpRight, ArrowRight } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { DM_Sans, STIX_Two_Text, EB_Garamond } from 'next/font/google'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-stix-two-text',
})

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

interface Integration {
  name: string
  description: string
  category: string
  logoSlug: string
}

// Logo data with brand colors for fallbacks
const logoData: Record<string, { color: string; letter: string }> = {
  quickbooks: { color: '#2CA01C', letter: 'Q' },
  intuit: { color: '#2CA01C', letter: 'Q' },
  xero: { color: '#13B5EA', letter: 'X' },
  stripe: { color: '#635BFF', letter: 'S' },
  shopify: { color: '#7AB55C', letter: 'S' },
  salesforce: { color: '#00A1E0', letter: 'S' },
  hubspot: { color: '#FF7A59', letter: 'H' },
  paypal: { color: '#003087', letter: 'P' },
  square: { color: '#3E4348', letter: 'S' },
  mailchimp: { color: '#FFE01B', letter: 'M' },
  zoho: { color: '#E42527', letter: 'Z' },
  sap: { color: '#0FAAFF', letter: 'S' },
  oracle: { color: '#F80000', letter: 'O' },
  amazon: { color: '#FF9900', letter: 'A' },
  meta: { color: '#0081FB', letter: 'M' },
  linkedin: { color: '#0A66C2', letter: 'L' },
  woocommerce: { color: '#96588A', letter: 'W' },
  slack: { color: '#4A154B', letter: 'S' },
  google: { color: '#4285F4', letter: 'G' },
  googleads: { color: '#4285F4', letter: 'G' },
  sage: { color: '#00D639', letter: 'S' },
  freshbooks: { color: '#0075DD', letter: 'F' },
  wave: { color: '#003087', letter: 'W' },
  netsuite: { color: '#1F1F1F', letter: 'N' },
  cin7: { color: '#FF6B35', letter: 'C' },
  plaid: { color: '#111111', letter: 'P' },
  mercury: { color: '#5851DB', letter: 'M' },
  brex: { color: '#FF5722', letter: 'B' },
  microsoft: { color: '#00A4EF', letter: 'M' },
  pipedrive: { color: '#1A1A1A', letter: 'P' },
  klaviyo: { color: '#000000', letter: 'K' },
  tradegecko: { color: '#00B388', letter: 'T' },
}

// All logos for the marquee
const allLogos = [
  { slug: 'quickbooks', name: 'QuickBooks' },
  { slug: 'xero', name: 'Xero' },
  { slug: 'stripe', name: 'Stripe' },
  { slug: 'shopify', name: 'Shopify' },
  { slug: 'salesforce', name: 'Salesforce' },
  { slug: 'hubspot', name: 'HubSpot' },
  { slug: 'paypal', name: 'PayPal' },
  { slug: 'square', name: 'Square' },
  { slug: 'amazon', name: 'Amazon' },
  { slug: 'mailchimp', name: 'Mailchimp' },
  { slug: 'sap', name: 'SAP' },
  { slug: 'oracle', name: 'Oracle' },
  { slug: 'zoho', name: 'Zoho' },
  { slug: 'meta', name: 'Meta' },
  { slug: 'linkedin', name: 'LinkedIn' },
  { slug: 'woocommerce', name: 'WooCommerce' },
]

function LogoIcon({ slug, name, size = 32 }: { slug: string; name: string; size?: number }) {
  const data = logoData[slug]

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt={name}
        width={size}
        height={size}
        className="opacity-100"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          const fallback = e.currentTarget.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div
        className="absolute inset-0 items-center justify-center text-white font-bold rounded-md hidden"
        style={{
          backgroundColor: data?.color || '#f59e0b',
          fontSize: size * 0.45,
        }}
      >
        {data?.letter || name.charAt(0)}
      </div>
    </div>
  )
}

function IntegrationLogo({ slug, name, size = 28 }: { slug: string; name: string; size?: number }) {
  const data = logoData[slug]

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt={name}
        width={size}
        height={size}
        className="opacity-90"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          const fallback = e.currentTarget.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div
        className="absolute inset-0 items-center justify-center text-white font-semibold rounded hidden"
        style={{
          backgroundColor: data?.color || '#f59e0b',
          fontSize: size * 0.5,
        }}
      >
        {data?.letter || name.charAt(0)}
      </div>
    </div>
  )
}

// Flattened list of all integrations
const allIntegrations: Integration[] = [
  // Featured integrations at top
  {
    name: 'QuickBooks Online',
    description: 'Full integration with Intuit QuickBooks for comprehensive accounting sync',
    category: 'Accounting',
    logoSlug: 'quickbooks',
  },
  {
    name: 'Xero',
    description: 'Beautiful cloud accounting software for small businesses',
    category: 'Accounting',
    logoSlug: 'xero',
  },
  {
    name: 'Shopify',
    description: 'Connect your Shopify store for unified commerce insights',
    category: 'E-commerce',
    logoSlug: 'shopify',
  },
  {
    name: 'Microsoft Dynamics 365',
    description: 'Enterprise-grade business applications suite',
    category: 'ERP',
    logoSlug: 'microsoft',
  },

  // Accounting & Financial
  {
    name: 'Zoho Books',
    description: 'Comprehensive accounting solution with automation',
    category: 'Accounting',
    logoSlug: 'zoho',
  },
  {
    name: 'FreshBooks',
    description: 'Invoicing and accounting built for service-based businesses',
    category: 'Accounting',
    logoSlug: 'freshbooks',
  },
  {
    name: 'Wave',
    description: 'Free accounting software for small businesses',
    category: 'Accounting',
    logoSlug: 'wave',
  },

  // ERP
  {
    name: 'Oracle NetSuite',
    description: 'Leading cloud ERP for growing and mid-size businesses',
    category: 'ERP',
    logoSlug: 'oracle',
  },
  {
    name: 'SAP Business One',
    description: 'Enterprise resource planning for small and midsize businesses',
    category: 'ERP',
    logoSlug: 'sap',
  },
  {
    name: 'Sage Intacct',
    description: 'Cloud financial management for growing businesses',
    category: 'ERP',
    logoSlug: 'sage',
  },

  // Banking & Payments
  {
    name: 'Plaid',
    description: 'Secure bank connections with 12,000+ financial institutions',
    category: 'Banking',
    logoSlug: 'plaid',
  },
  {
    name: 'Stripe',
    description: 'Payment processing and revenue analytics',
    category: 'Banking',
    logoSlug: 'stripe',
  },
  {
    name: 'Square',
    description: 'Point of sale and commerce platform integration',
    category: 'Banking',
    logoSlug: 'square',
  },
  {
    name: 'PayPal',
    description: 'Connect PayPal business accounts for payment tracking',
    category: 'Banking',
    logoSlug: 'paypal',
  },
  {
    name: 'Mercury',
    description: 'Banking built for startups',
    category: 'Banking',
    logoSlug: 'mercury',
  },
  {
    name: 'Brex',
    description: 'Corporate cards and spend management',
    category: 'Banking',
    logoSlug: 'brex',
  },

  // CRM
  {
    name: 'Salesforce',
    description: 'Enterprise CRM and sales platform',
    category: 'CRM',
    logoSlug: 'salesforce',
  },
  {
    name: 'HubSpot CRM',
    description: 'All-in-one CRM platform for growing teams',
    category: 'CRM',
    logoSlug: 'hubspot',
  },
  {
    name: 'Zoho CRM',
    description: 'Customer relationship management with AI',
    category: 'CRM',
    logoSlug: 'zoho',
  },
  {
    name: 'Pipedrive',
    description: 'Sales CRM designed by salespeople',
    category: 'CRM',
    logoSlug: 'pipedrive',
  },

  // Marketing
  {
    name: 'Google Ads',
    description: 'Connect your Google Ads spend data',
    category: 'Marketing',
    logoSlug: 'googleads',
  },
  {
    name: 'Meta Ads',
    description: 'Facebook and Instagram advertising data',
    category: 'Marketing',
    logoSlug: 'meta',
  },
  {
    name: 'LinkedIn Ads',
    description: 'B2B advertising and lead generation',
    category: 'Marketing',
    logoSlug: 'linkedin',
  },
  {
    name: 'Mailchimp',
    description: 'Email marketing and automation',
    category: 'Marketing',
    logoSlug: 'mailchimp',
  },
  {
    name: 'Klaviyo',
    description: 'Marketing automation for e-commerce',
    category: 'Marketing',
    logoSlug: 'klaviyo',
  },

  // Inventory & E-commerce
  {
    name: 'Amazon Seller',
    description: 'Sync your Amazon marketplace data',
    category: 'E-commerce',
    logoSlug: 'amazon',
  },
  {
    name: 'WooCommerce',
    description: 'WordPress eCommerce integration',
    category: 'E-commerce',
    logoSlug: 'woocommerce',
  },
  {
    name: 'Cin7',
    description: 'Connected inventory management across sales channels',
    category: 'E-commerce',
    logoSlug: 'cin7',
  },
  {
    name: 'TradeGecko',
    description: 'Inventory and order management platform',
    category: 'E-commerce',
    logoSlug: 'tradegecko',
  },
]

const categories = ['All', 'Accounting', 'ERP', 'Banking', 'CRM', 'Marketing', 'E-commerce']

export default function IntegrationCategories() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [showAllMobile, setShowAllMobile] = useState(false)
  const { theme } = useTheme()

  const filteredIntegrations = useMemo(() => {
    setShowAllMobile(false)
    return allIntegrations.filter((integration) => {
      const matchesSearch =
        integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        integration.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = activeFilter === 'All' || integration.category === activeFilter
      return matchesSearch && matchesFilter
    })
  }, [searchQuery, activeFilter])

  const isQuickBooks = (name: string) => name.toLowerCase().includes('quickbooks')

  return (
    <section
      id="integration-categories"
      className={`py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 overflow-hidden ${dmSans.variable} ${stixTwoText.variable} ${ebGaramond.variable}`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
            <span
              className="text-xs font-semibold tracking-[0.2em] uppercase"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: theme === 'light' ? '#CF6900' : '#f59e0b',
              }}
            >
              Integration Library
            </span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>

          {/* Main heading */}
          <h2
            className="text-5xl sm:text-5xl lg:text-6xl theme-text-primary mb-6 leading-[1.15] tracking-tight"
            style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
          >
            One Platform,
            <span
              className="italic text-transparent bg-clip-text pl-[0.18em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #fbbf24, #f59e0b, #d97706)',
              }}
            >
              All Your Data
            </span>
          </h2>

          {/* Subheading */}
          <p
            className="text-lg sm:text-xl theme-text-secondary max-w-2xl mx-auto mb-4 leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 400 }}
          >
            Choose from our comprehensive library of 700+ integrations across accounting, inventory,
            banking, and marketing platforms.
          </p>

          {/* Logo Marquee */}
          <div
            className="relative w-full overflow-hidden py-6 mb-8"
            style={{
              maskImage:
                'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            }}
          >
            <div className="flex animate-marquee">
              {[...allLogos, ...allLogos, ...allLogos].map((logo, i) => (
                <div key={`${logo.slug}-${i}`} className="flex-shrink-0 mx-8 sm:mx-10">
                  <LogoIcon slug={logo.slug} name={logo.name} size={36} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-12">
          {/* Search Bar */}
          <div className="max-w-xl mx-auto mb-8">
            <div
              className={cn(
                'relative flex items-center gap-3 px-5 py-3.5 rounded-2xl',
                'border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)]/50',
                'focus-within:border-amber-500/50 focus-within:bg-[var(--theme-card-bg)] transition-all duration-300'
              )}
            >
              <Search
                className="w-5 h-5 flex-shrink-0"
                style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
              />
              <input
                type="text"
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm theme-text-primary placeholder:theme-text-secondary"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs theme-text-secondary hover:theme-text-primary transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap justify-center gap-2.5">
            {categories.map((category) => {
              const isActive = activeFilter === category
              const count =
                category === 'All'
                  ? allIntegrations.length
                  : allIntegrations.filter((i) => i.category === category).length
              return (
                <button
                  key={category}
                  onClick={() => setActiveFilter(category)}
                  className={cn(
                    'group flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all duration-300',
                    isActive
                      ? 'font-semibold shadow-md'
                      : 'theme-text-secondary hover:theme-text-primary border border-[var(--theme-card-border)] hover:border-amber-500/30 bg-[var(--theme-card-bg)]/50'
                  )}
                  style={{
                    fontFamily: 'var(--font-dm-sans)',
                    backgroundColor: isActive
                      ? theme === 'light'
                        ? '#CF6900'
                        : '#f59e0b'
                      : undefined,
                    color: isActive ? (theme === 'light' ? '#ffffff' : '#0f172a') : undefined,
                  }}
                >
                  {category === 'All' && <Filter className="w-3.5 h-3.5" strokeWidth={2} />}
                  {category}
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-medium',
                      !isActive && 'bg-amber-500/10'
                    )}
                    style={
                      isActive
                        ? {
                            backgroundColor:
                              theme === 'light' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)',
                            color: theme === 'light' ? '#ffffff' : '#0f172a',
                          }
                        : { color: theme === 'light' ? '#CF6900' : '#f59e0b' }
                    }
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Results count */}
        <p
          className="text-center text-sm theme-text-secondary mb-8"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Showing {filteredIntegrations.length} integration
          {filteredIntegrations.length !== 1 ? 's' : ''}
          {searchQuery && ` for "${searchQuery}"`}
        </p>

        {/* Integration Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          {filteredIntegrations.map((integration, index) => {
            const isAvailable = isQuickBooks(integration.name)
            const isMobileHidden = !showAllMobile && index >= 5
            return (
              <div
                key={integration.name}
                className={cn(
                  'group relative flex flex-col p-4 sm:p-5 rounded-2xl transition-all duration-300',
                  'border bg-[var(--theme-card-bg)]/40',
                  isAvailable
                    ? 'border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                    : 'border-[var(--theme-card-border)] hover:border-amber-500/40 hover:bg-amber-500/5',
                  isMobileHidden && 'hidden sm:flex'
                )}
              >
                {/* Mobile List Layout */}
                <div className="sm:hidden">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center border overflow-hidden shrink-0 transition-colors',
                        isAvailable
                          ? 'bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/40'
                          : 'bg-[var(--theme-card-bg)] border-[var(--theme-card-border)] group-hover:border-amber-500/30'
                      )}
                    >
                      <IntegrationLogo
                        slug={integration.logoSlug}
                        name={integration.name}
                        size={24}
                      />
                    </div>
                    <div className="flex flex-col justify-center min-h-[3rem]">
                      <h4
                        className="text-sm font-semibold theme-text-primary leading-tight"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        {integration.name}
                      </h4>
                      <p
                        className="text-xs theme-text-secondary leading-snug line-clamp-2 mt-0.5"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--theme-card-border)]">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full border border-[var(--theme-card-border)] theme-text-secondary bg-[var(--theme-card-bg)]/50"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    >
                      {integration.category}
                    </span>
                    {isAvailable ? (
                      <button
                        className="flex items-center gap-1 text-xs font-medium transition-colors text-emerald-500 hover:text-emerald-400"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        Connect
                        <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    ) : (
                      <Link
                        href="/schedule-demo"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 transition-colors hover:bg-amber-500/20"
                        style={{
                          fontFamily: 'var(--font-dm-sans)',
                          color: theme === 'light' ? '#CF6900' : '#f59e0b',
                        }}
                      >
                        <Clock className="w-3 h-3" strokeWidth={2} />
                        Request
                        <ArrowUpRight className="w-3 h-3" strokeWidth={2} />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Desktop Card Layout */}
                <div className="hidden sm:flex sm:flex-col sm:flex-1">
                  {/* Top Row: Logo + Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center border overflow-hidden transition-colors',
                        isAvailable
                          ? 'bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/40'
                          : 'bg-[var(--theme-card-bg)] border-[var(--theme-card-border)] group-hover:border-amber-500/30'
                      )}
                    >
                      <IntegrationLogo
                        slug={integration.logoSlug}
                        name={integration.name}
                        size={28}
                      />
                    </div>

                    {/* Status Badge - Only show for available integrations */}
                    {isAvailable && (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-500"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        <Check className="w-3 h-3" strokeWidth={2.5} />
                        Available
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <h4
                    className="text-base font-semibold theme-text-primary mb-2"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {integration.name}
                  </h4>

                  {/* Description */}
                  <p
                    className="text-sm theme-text-secondary leading-relaxed flex-1 mb-4"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {integration.description}
                  </p>

                  {/* Category Tag + Action */}
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--theme-card-border)]">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full border border-[var(--theme-card-border)] theme-text-secondary bg-[var(--theme-card-bg)]/50"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    >
                      {integration.category}
                    </span>

                    {isAvailable ? (
                      <button
                        className="flex items-center gap-1 text-xs font-medium transition-colors text-emerald-500 hover:text-emerald-400"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        Connect
                        <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    ) : (
                      <Link
                        href="/schedule-demo"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 transition-colors hover:bg-amber-500/20"
                        style={{
                          fontFamily: 'var(--font-dm-sans)',
                          color: theme === 'light' ? '#CF6900' : '#f59e0b',
                        }}
                      >
                        <Clock className="w-3 h-3" strokeWidth={2} />
                        Request
                        <ArrowUpRight className="w-3 h-3" strokeWidth={2} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* View All / View Less Button - Mobile only */}
        {filteredIntegrations.length > 5 && (
          <button
            onClick={() => setShowAllMobile(!showAllMobile)}
            className="sm:hidden w-full mt-3 py-3 rounded-2xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)]/40 text-sm font-medium theme-text-secondary hover:theme-text-primary hover:border-amber-500/40 transition-all duration-300"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            {showAllMobile ? 'View less' : `View all ${filteredIntegrations.length} integrations`}
          </button>
        )}

        {/* Empty State */}
        {filteredIntegrations.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)]/50">
              <Search className="w-7 h-7 theme-text-secondary" />
            </div>
            <h3
              className="text-lg font-semibold theme-text-primary mb-2"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              No integrations found
            </h3>
            <p
              className="text-sm theme-text-secondary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setActiveFilter('All')
              }}
              className="text-sm font-medium transition-colors"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: theme === 'light' ? '#CF6900' : '#f59e0b',
              }}
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Bottom Note */}
        <div className="text-center mt-16">
          <p
            className="text-sm theme-text-secondary mb-4"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Don't see what you need? We support 700+ integrations and custom connections.
          </p>
          <Link
            href="/schedule-demo"
            className="group inline-flex items-center gap-2 transition-colors hover:opacity-80"
            style={{
              fontFamily: 'var(--font-dm-sans)',
              color: theme === 'light' ? '#CF6900' : '#fbbf24',
            }}
          >
            <span className="text-sm font-medium">Request a custom integration</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Marquee Animation Styles */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  )
}
