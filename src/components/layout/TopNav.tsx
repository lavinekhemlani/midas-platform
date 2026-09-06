'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { DM_Sans } from 'next/font/google'
import {
  Menu,
  X,
  Loader2,
  LogOut,
  LayoutDashboard,
  Settings,
  Puzzle,
  CreditCard,
  Users,
  Shield,
  Building2,
  ChevronDown,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/useSession'
import { useTheme } from '@/hooks/useTheme'
import CSSThemeToggleCompact from '@/components/ui/CSSThemeToggleCompact'
import UserAvatar from '@/components/ui/UserAvatar'
import { logger } from '@/lib/logger'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

// Standalone nav links (shown at xl, hidden at lg where they become a dropdown)
const standaloneLinks = [
  { href: '/integrations', label: 'Integrations' },
  { href: '/security', label: 'Security' },
]

// Product category (consolidates integrations, security, pricing at intermediate widths)
const productLinks = {
  label: 'More',
  items: [
    {
      href: '/integrations',
      label: 'Integrations',
      description: 'Connect your existing tools and data sources',
      icon: Puzzle,
    },
    {
      href: '/security',
      label: 'Security',
      description: 'Enterprise-grade security and compliance',
      icon: Shield,
    },
  ],
}

// Navigation structure with categories
const navCategories = {
  platform: {
    label: 'Platform',
    mainLink: {
      href: '/platform',
      label: 'All Platform',
      description: 'Explore the complete Midas platform',
    },
    items: [
      {
        href: '/platform#financial-health',
        label: 'Financial Health & Planning',
        description: 'Real-time visibility and forecasting',
        icon: Building2,
      },
      {
        href: '/platform#banking',
        label: 'Banking & Payments',
        description: 'Cash flow and liquidity intelligence',
        icon: CreditCard,
      },
      {
        href: '/platform#gtm',
        label: 'Go-to-Market & Customer',
        description: 'Revenue and growth analytics',
        icon: Users,
      },
      {
        href: '/platform#operations',
        label: 'Operations & ERP',
        description: 'Inventory and supply chain insights',
        icon: Puzzle,
      },
      {
        href: '/platform#multi-entity',
        label: 'Multi-Entity Analysis',
        description: 'Consolidated portfolio intelligence',
        icon: Building2,
      },
    ],
  },
  industries: {
    label: 'Industries',
    mainLink: {
      href: '/industries',
      label: 'All Industries',
      description: 'Solutions tailored to your industry',
    },
    items: [
      {
        href: '/industries#ecommerce',
        label: 'E-Commerce',
        description: 'Unified commerce analytics',
        icon: CreditCard,
      },
      {
        href: '/industries#services',
        label: 'Professional Services',
        description: 'Client portfolio insights',
        icon: Users,
      },
      {
        href: '/industries#pe-multi-entity',
        label: 'PE & Multi-Entity',
        description: 'Portfolio consolidation',
        icon: Building2,
      },
      {
        href: '/industries#saas',
        label: 'SaaS',
        description: 'Subscription metrics',
        icon: Shield,
      },
      {
        href: '/industries#middle-market',
        label: 'Middle-Market',
        description: 'Enterprise intelligence, right-sized',
        icon: Building2,
      },
      {
        href: '/industries#sme',
        label: 'SME',
        description: 'Big insights for growing businesses',
        icon: Users,
      },
    ],
  },
}

// Flat list for mobile menu
const mobileNavLinks = [
  { href: '/platform', label: 'Platform' },
  { href: '/industries', label: 'Industries' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/security', label: 'Security' },
  { href: '/about', label: 'About Us' },
]

export default function TopNav() {
  const pathname = usePathname()
  const { theme } = useTheme()
  const { user, status, signOut } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isNavHidden, setIsNavHidden] = useState(false)
  const [isHoveringNav, setIsHoveringNav] = useState(false)
  const [expandedMobileSection, setExpandedMobileSection] = useState<string | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const navLinksRef = useRef<HTMLDivElement>(null)
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const navHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const themeChangingRef = useRef(false)

  // Reset expanded section when mobile menu closes
  useEffect(() => {
    if (!mobileMenuOpen) {
      setExpandedMobileSection(null)
    }
  }, [mobileMenuOpen])

  // Close user menu when tapping outside (needed for touch devices)
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  // Hide navigation links after scrolling past threshold
  useEffect(() => {
    const SCROLL_THRESHOLD = 100

    const handleScroll = () => {
      setIsNavHidden(window.scrollY > SCROLL_THRESHOLD)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (navHoverTimeoutRef.current) {
        clearTimeout(navHoverTimeoutRef.current)
      }
    }
  }, [])

  // Handlers for nav links hover
  const handleNavLinksMouseEnter = () => {
    if (navHoverTimeoutRef.current) {
      clearTimeout(navHoverTimeoutRef.current)
      navHoverTimeoutRef.current = null
    }
    setIsHoveringNav(true)
  }

  const handleNavLinksMouseLeave = () => {
    navHoverTimeoutRef.current = setTimeout(() => {
      setIsHoveringNav(false)
      navHoverTimeoutRef.current = null
    }, 300)
  }

  const isAuthenticated = status === 'authenticated'
  const isLoading = status === 'loading'
  const isOnboardingPage = pathname?.startsWith('/onboarding')

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      logger.error('Sign out error:', { error, component: 'TopNav' })
      window.location.href = '/'
    }
  }

  const handleMouseEnter = () => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current)
      menuTimeoutRef.current = null
    }
    setUserMenuOpen(true)
    setMobileMenuOpen(false)
  }

  const handleMouseLeave = () => {
    // Use longer timeout during theme transitions to let animation complete
    const delay = themeChangingRef.current ? 700 : 150
    menuTimeoutRef.current = setTimeout(() => {
      setUserMenuOpen(false)
    }, delay)
  }

  // Show content mask only when hovering on navbar after scroll
  const showContentMask = isHoveringNav && isNavHidden

  // Toggle body class for content masking
  useEffect(() => {
    if (showContentMask) {
      document.body.classList.add('nav-content-mask-active')
    } else {
      document.body.classList.remove('nav-content-mask-active')
    }
    return () => {
      document.body.classList.remove('nav-content-mask-active')
    }
  }, [showContentMask])

  return (
    <nav
      ref={navRef}
      onMouseEnter={handleNavLinksMouseEnter}
      onMouseLeave={handleNavLinksMouseLeave}
      className={cn(
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
        dmSans.className
      )}
    >
      {/* Backdrop gradient when nav is hovered after scrolling */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-24 pointer-events-none transition-opacity duration-300',
          showContentMask ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          background:
            'linear-gradient(to bottom, var(--theme-bg) 0%, var(--theme-bg) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />
      {/* Mobile menu header background overlay */}
      <div
        className={cn(
          'md:hidden absolute inset-x-0 top-0 h-16 bg-[var(--theme-bg)]/80 backdrop-blur-xl',
          'transition-opacity duration-200 ease-in-out',
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Left Section - Logo */}
        <div className="flex-1 flex justify-start">
          <Link href="/" className="relative group flex items-center flex-shrink-0">
            <div className="relative h-7 md:h-8">
              <Image
                src="/images/hero/logo_type_gold_new.svg"
                alt="Midas"
                width={140}
                height={36}
                className="object-contain h-full w-auto"
                priority
              />
            </div>
          </Link>
        </div>

        {/* Center Section - Navigation Links (Desktop) - Hidden on onboarding pages */}
        {!isOnboardingPage && (
          <div
            ref={navLinksRef}
            className="hidden lg:flex w-fit"
            onMouseEnter={handleNavLinksMouseEnter}
            onMouseLeave={handleNavLinksMouseLeave}
          >
            <NavigationMenu
              className={cn(
                'hidden lg:flex transition-opacity duration-300 ease-out',
                isNavHidden && !isHoveringNav ? 'opacity-0' : 'opacity-100'
              )}
            >
              <NavigationMenuList>
                {/* Home Link */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/"
                      className={cn(
                        'group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors',
                        'hover:bg-white/5',
                        'theme-text-primary'
                      )}
                    >
                      Home
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Platform Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-white/5 theme-text-primary data-[state=open]:bg-white/5">
                    {navCategories.platform.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="p-5 w-[540px]">
                      {/* All Platform Link */}
                      <div className="mb-3 pb-2 border-b border-gray-400 dark:border-white/30 mx-2">
                        <NavigationMenuLink asChild>
                          <Link
                            href="/platform"
                            className="text-sm font-medium transition-colors hover:opacity-80 p-2 block theme-text-primary"
                          >
                            All Platform <span className="ml-2">→</span>
                          </Link>
                        </NavigationMenuLink>
                      </div>
                      {/* Two column grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {navCategories.platform.items.map((item) => {
                          const Icon = item.icon
                          return (
                            <NavigationMenuLink key={item.href} asChild>
                              <Link
                                href={item.href}
                                className="flex items-center gap-2 select-none no-underline outline-none p-2 rounded-lg hover:bg-white/5 transition-colors"
                              >
                                <Icon className="w-4 h-4 theme-text-secondary flex-shrink-0" />
                                <div>
                                  <div className="text-sm font-normal leading-tight mb-0.5 theme-text-primary">
                                    {item.label}
                                  </div>
                                  <p className="text-xs font-normal leading-tight theme-text-secondary">
                                    {item.description}
                                  </p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                          )
                        })}
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Industries Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-white/5 theme-text-primary data-[state=open]:bg-white/5">
                    {navCategories.industries.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="p-5 w-[540px]">
                      {/* All Industries Link */}
                      <div className="mb-3 pb-2 border-b border-gray-400 dark:border-white/30 mx-2">
                        <NavigationMenuLink asChild>
                          <Link
                            href="/industries"
                            className="text-sm font-medium transition-colors hover:opacity-80 p-2 block theme-text-primary"
                          >
                            All Industries <span className="ml-2">→</span>
                          </Link>
                        </NavigationMenuLink>
                      </div>
                      {/* Two column grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {navCategories.industries.items.map((item) => {
                          const Icon = item.icon
                          return (
                            <NavigationMenuLink key={item.href} asChild>
                              <Link
                                href={item.href}
                                className="flex items-center gap-2 select-none no-underline outline-none p-2 rounded-lg hover:bg-white/5 transition-colors"
                              >
                                <Icon className="w-4 h-4 theme-text-secondary flex-shrink-0" />
                                <div>
                                  <div className="text-sm font-normal leading-tight mb-0.5 theme-text-primary">
                                    {item.label}
                                  </div>
                                  <p className="text-xs font-normal leading-tight theme-text-secondary">
                                    {item.description}
                                  </p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                          )
                        })}
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Standalone Links - visible at xl and up */}
                {standaloneLinks.map((link) => (
                  <NavigationMenuItem key={link.href} className="hidden xl:block">
                    <NavigationMenuLink asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          'group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors',
                          'hover:bg-white/5',
                          'theme-text-primary'
                        )}
                      >
                        {link.label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}

                {/* More Dropdown - visible at lg to xl (collapsed standalone links) */}
                <NavigationMenuItem className="xl:hidden">
                  <NavigationMenuTrigger className="bg-transparent hover:bg-white/5 theme-text-primary data-[state=open]:bg-white/5">
                    {productLinks.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="p-5 w-[540px]">
                      <div className="space-y-1">
                        {productLinks.items.map((item) => {
                          const Icon = item.icon
                          return (
                            <NavigationMenuLink key={item.href} asChild>
                              <Link
                                href={item.href}
                                className="flex items-center gap-3 select-none no-underline outline-none p-3 rounded-lg hover:bg-white/5 transition-colors"
                              >
                                <Icon className="w-5 h-5 theme-text-secondary flex-shrink-0" />
                                <div>
                                  <div className="text-sm font-normal leading-tight mb-1 theme-text-primary">
                                    {item.label}
                                  </div>
                                  <p className="text-xs font-normal leading-tight theme-text-secondary">
                                    {item.description}
                                  </p>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                          )
                        })}
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        )}

        {/* Right Section */}
        <div className="flex-1 flex items-center justify-end gap-3">
          {isAuthenticated ? (
            <div
              className="relative"
              ref={userMenuRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {/* User Avatar Trigger */}
              <button
                onClick={() => {
                  setUserMenuOpen((prev) => {
                    if (!prev) setMobileMenuOpen(false)
                    return !prev
                  })
                }}
                className="flex items-center gap-1.5 p-2 -m-2 focus:outline-none group"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="Toggle user menu"
              >
                {/* Three dots indicator */}
                <div className="flex flex-col items-center justify-center h-5 theme-text-secondary group-hover:theme-text-primary transition-colors">
                  <div className="w-1 h-1 rounded-full bg-current mb-0.5"></div>
                  <div className="w-1 h-1 rounded-full bg-current mb-0.5"></div>
                  <div className="w-1 h-1 rounded-full bg-current"></div>
                </div>
                <UserAvatar
                  imageUrl={user?.picture}
                  firstName={user?.first_name}
                  email={user?.email}
                  size="md"
                />
              </button>

              {/* Dropdown Menu */}
              <div
                className={cn(
                  'absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl overflow-hidden z-50',
                  'bg-[var(--theme-bg)]/80 backdrop-blur-xl border border-[var(--theme-card-border)]',
                  'transition-all duration-300 ease-out origin-top-right',
                  userMenuOpen
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                )}
              >
                {/* User info */}
                <div
                  className="px-4 py-3 mx-2 pb-2 mb-1 border-b border-[var(--theme-input-border)]"
                  style={{
                    transitionProperty: 'opacity, transform',
                    transitionDuration: '400ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    transitionDelay: userMenuOpen ? '50ms' : '0ms',
                    opacity: userMenuOpen ? 1 : 0,
                    transform: userMenuOpen ? 'translateY(0)' : 'translateY(-10px)',
                  }}
                >
                  <p className="text-sm font-medium theme-text-primary truncate">
                    {user?.first_name || user?.email || 'User'}
                  </p>
                  {user?.email && user?.first_name && (
                    <p className="text-xs theme-text-secondary truncate">{user.email}</p>
                  )}
                </div>

                {/* Dashboard */}
                <div
                  style={{
                    transitionProperty: 'opacity, transform',
                    transitionDuration: '400ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    transitionDelay: userMenuOpen ? '100ms' : '0ms',
                    opacity: userMenuOpen ? 1 : 0,
                    transform: userMenuOpen ? 'translateY(0)' : 'translateY(-10px)',
                  }}
                >
                  <Link
                    href="/dashboard"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center w-full px-4 py-3 text-sm font-normal theme-text-secondary hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Link>
                </div>

                {/* Settings */}
                <div
                  style={{
                    transitionProperty: 'opacity, transform',
                    transitionDuration: '400ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    transitionDelay: userMenuOpen ? '150ms' : '0ms',
                    opacity: userMenuOpen ? 1 : 0,
                    transform: userMenuOpen ? 'translateY(0)' : 'translateY(-10px)',
                  }}
                >
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center w-full px-4 py-3 text-sm font-normal theme-text-secondary hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </div>

                {/* Theme Toggle */}
                <div
                  style={{
                    transitionProperty: 'opacity, transform',
                    transitionDuration: '400ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    transitionDelay: userMenuOpen ? '200ms' : '0ms',
                    opacity: userMenuOpen ? 1 : 0,
                    transform: userMenuOpen ? 'translateY(0)' : 'translateY(-10px)',
                  }}
                >
                  <CSSThemeToggleCompact
                    variant="menu-item"
                    onBeforeChange={() => {
                      // Mark that theme is changing - extends the mouseLeave delay
                      themeChangingRef.current = true
                      // Clear any pending close timeout
                      if (menuTimeoutRef.current) {
                        clearTimeout(menuTimeoutRef.current)
                        menuTimeoutRef.current = null
                      }
                      // Reset flag after transition completes
                      setTimeout(() => {
                        themeChangingRef.current = false
                      }, 500)
                    }}
                  />
                </div>

                {/* Sign Out */}
                <div
                  style={{
                    transitionProperty: 'opacity, transform',
                    transitionDuration: '400ms',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    transitionDelay: userMenuOpen ? '250ms' : '0ms',
                    opacity: userMenuOpen ? 1 : 0,
                    transform: userMenuOpen ? 'translateY(0)' : 'translateY(-10px)',
                  }}
                >
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      handleSignOut()
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm font-normal theme-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div
              className="flex items-center space-x-2 px-3 py-1.5"
              role="status"
              aria-live="polite"
            >
              <span className="text-xs sm:text-sm font-medium theme-text-secondary">
                Loading...
              </span>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" aria-hidden="true" />
            </div>
          ) : (
            <>
              {/* Theme Toggle (Desktop only, unauthenticated) */}
              <div className="hidden lg:block">
                <CSSThemeToggleCompact />
              </div>
              {/* Sign In - visible on tablet and up */}
              <Link
                href="/sign-in"
                className="hidden sm:block px-4 py-2 text-sm font-medium theme-text-primary hover:text-amber-400 transition-colors"
              >
                Sign In
              </Link>
              {/* Book a Demo - desktop only */}
              <Link
                href="/schedule-demo"
                className={`hidden lg:block px-4 py-2 text-white text-sm font-semibold rounded-lg shadow transition-all bg-[#DE7E00] hover:bg-[#CF6900] dark:bg-[#DE7E00] dark:hover:bg-[#e57400] ${dmSans.className}`}
              >
                Book a Demo
              </Link>
            </>
          )}

          {/* Mobile Menu Button - Shows on tablet and below */}
          {!isOnboardingPage && (
            <button
              onClick={() => {
                const opening = !mobileMenuOpen
                setMobileMenuOpen(opening)
                if (opening) setUserMenuOpen(false)
              }}
              className="lg:hidden p-2 rounded-lg theme-text-secondary hover:bg-white/5 transition-colors -mr-2"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu - Slides down from top */}
      {!isOnboardingPage && (
        <>
          {/* Backdrop overlay - closes menu on tap */}
          <div
            className={cn(
              'lg:hidden fixed inset-0 top-16 z-20',
              'transition-opacity duration-200 ease-in-out',
              mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              'lg:hidden fixed inset-x-0 top-16 z-30 bg-[var(--theme-bg)]/80 backdrop-blur-xl shadow-xl',
              'transition-opacity duration-200 ease-in-out',
              mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
          >
            <div className="px-5 py-4 space-y-1 overflow-y-auto max-h-[calc(100vh-5rem)]">
              {/* Home Link */}
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  'theme-text-secondary hover:bg-white/5 hover:text-white'
                )}
              >
                Home
              </Link>

              {/* Platform Section - Collapsible */}
              <div>
                <button
                  onClick={() =>
                    setExpandedMobileSection(
                      expandedMobileSection === 'platform' ? null : 'platform'
                    )
                  }
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium theme-text-secondary hover:bg-white/5 hover:text-white transition-colors"
                >
                  <span>Platform</span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 theme-text-secondary transition-transform duration-200',
                      expandedMobileSection === 'platform' && 'rotate-180'
                    )}
                  />
                </button>
                <div
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-150 ease-in',
                    expandedMobileSection === 'platform'
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className="overflow-hidden pl-4 space-y-1">
                    <Link
                      href="/platform"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-500/10 transition-colors theme-text-primary"
                    >
                      All Platform <span className="ml-2">→</span>
                    </Link>
                    {navCategories.platform.items.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block px-4 py-2.5 rounded-lg text-sm font-medium theme-text-secondary hover:bg-white/5 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Industries Section - Collapsible */}
              <div>
                <button
                  onClick={() =>
                    setExpandedMobileSection(
                      expandedMobileSection === 'industries' ? null : 'industries'
                    )
                  }
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium theme-text-secondary hover:bg-white/5 hover:text-white transition-colors"
                >
                  <span>Industries</span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 theme-text-secondary transition-transform duration-200',
                      expandedMobileSection === 'industries' && 'rotate-180'
                    )}
                  />
                </button>
                <div
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-150 ease-in',
                    expandedMobileSection === 'industries'
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className="overflow-hidden pl-4 space-y-1">
                    <Link
                      href="/industries"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-500/10 transition-colors theme-text-primary"
                    >
                      All Industries <span className="ml-2">→</span>
                    </Link>
                    {navCategories.industries.items.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          'theme-text-secondary hover:bg-white/5 hover:text-white',
                          pathname === link.href && 'text-amber-400'
                        )}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Standalone Links */}
              {standaloneLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    'theme-text-secondary hover:bg-white/5 hover:text-white',
                    pathname === link.href && 'text-amber-400'
                  )}
                >
                  {link.label}
                </Link>
              ))}

              {/* Auth section for mobile (unauthenticated) */}
              {!isAuthenticated && !isLoading && (
                <div className="pt-3 mt-2 border-t border-white/10 space-y-1">
                  {/* Theme Toggle */}
                  <CSSThemeToggleCompact variant="menu-item" />
                  <Link
                    href="/sign-in"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 rounded-lg text-sm font-medium theme-text-secondary hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                  <div className="pt-2">
                    <Link
                      href="/schedule-demo"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-lg text-sm font-semibold text-center text-white shadow transition-all bg-[#DE7E00] hover:bg-[#CF6900]"
                    >
                      Book a Demo
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  )
}
