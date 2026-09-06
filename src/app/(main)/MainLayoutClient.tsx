// src/app/(main)/MainLayoutClient.tsx
'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import Background from '@/components/layout/Background'
import AnimatedShellMain from './components/layout/AnimatedShellMain'
// import AppHeader from '@/components/layout/AppHeader' // Disabled - TopBar now handles header functionality
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import BottomNavBar from './components/layout/BottomNavBar'
import ChatPanel from './components/chat/ChatPanel'
import { ChatProvider } from '@/contexts/ChatContext'
import { SheetStateProvider } from '@/contexts/SheetStateContext'
import { FinancialDataProvider } from '@/contexts/FinancialDataContext'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { LLMProviderProvider } from '@/contexts/LLMProviderContext'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { AlertsProvider } from '@/contexts/AlertsContext'

import AuthRedirectHandler from '@/components/layout/AuthRedirectHandler'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
// ConnectionPrompt removed — provider-required routes now redirect to /dashboard
import { WelcomeOverlay } from './components/WelcomeOverlay'
import { WelcomeProvider, useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useUIActions, useChatPanelActions } from '@/hooks/useUIActions'
import { useSettingsActions } from '@/hooks/useSettingsActions'
function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { requiresProviderConnection, status, onboardingRequired, user, organization, signOut } =
    useSession()
  const welcomeContext = useWelcomeContextOptional()
  const {
    expanded: sidebarExpanded,
    isPinned: sidebarPinned,
    toggle: toggleSidebar,
    togglePin,
    setExpanded: setSidebarExpanded,
  } = useSidebar()
  const [chatPanelOpen, setChatPanelOpen] = useState(false) // Start closed for welcome sequence
  const [chatPanelWidth, setChatPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth / 3) : 620
  )
  const [chatFullscreen, setChatFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [chatTransitioning, setChatTransitioning] = useState(false)
  const [chatResizing, setChatResizing] = useState(false)

  // Welcome overlay state
  const [showWelcome, setShowWelcome] = useState(true)

  // Ref to track timeout for cleanup
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle SSR safety
  useEffect(() => {
    setMounted(true)
    return () => {
      if (chatTimeoutRef.current) {
        clearTimeout(chatTimeoutRef.current)
      }
    }
  }, [])

  // Welcome overlay callbacks
  const handleOpenChat = useCallback(() => {
    // Don't auto-open chat on mobile/tablet - it takes over the entire screen
    if (isMobile || window.innerWidth < 1024) return

    setChatTransitioning(true)
    setChatPanelOpen(true)
    // Reset transitioning state after animation
    setTimeout(() => setChatTransitioning(false), 350)
  }, [isMobile])

  const handleWelcomeComplete = useCallback(() => {
    // Mark welcome as complete in context so child components can react
    welcomeContext?.markWelcomeComplete()
    // Delay hiding welcome state until after the fade-out animation completes (0.8s)
    // This prevents layout shifts during the exit animation
    setTimeout(() => {
      setShowWelcome(false)
    }, 800)
  }, [welcomeContext])

  // Handle mobile detection + auto-collapse sidebar when mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setSidebarExpanded(false)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [setSidebarExpanded])

  // Exit fullscreen chat when navigating to a different page
  useEffect(() => {
    if (mounted) {
      setChatFullscreen(false)
    }
  }, [pathname, mounted])

  // Enhanced sidebar toggle with transition state
  const handleSidebarToggle = () => {
    toggleSidebar()
  }

  // Enhanced chat panel toggle with transition state
  const handleChatToggle = () => {
    // Clear any existing timeout
    if (chatTimeoutRef.current) {
      clearTimeout(chatTimeoutRef.current)
    }

    setChatTransitioning(true)
    setChatPanelOpen(!chatPanelOpen)

    // Reset transitioning state after animation
    chatTimeoutRef.current = setTimeout(() => {
      setChatTransitioning(false)
    }, 350)
  }

  // UI action hooks — enables chat-driven theme, navigation, sidebar, chat panel, and settings control
  useUIActions()
  useSettingsActions()
  const chatPanelHandlers = useMemo(
    () => ({
      onOpen: () => {
        setChatTransitioning(true)
        setChatPanelOpen(true)
        setTimeout(() => setChatTransitioning(false), 350)
      },
      onClose: () => {
        setChatTransitioning(true)
        setChatPanelOpen(false)
        setTimeout(() => setChatTransitioning(false), 350)
      },
      onToggle: handleChatToggle,
      onDock: () => setChatFullscreen(false),
      onFullscreen: () => setChatFullscreen(true),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatPanelOpen]
  )
  useChatPanelActions(chatPanelHandlers)

  // Check if we're in loading/initialization state
  const isInitializing =
    !mounted || status === 'loading' || (status === 'authenticated' && onboardingRequired)

  if (isInitializing) {
    if (!mounted) {
      console.log('[MainLayout] Not mounted yet, showing loading state')
    } else if (status === 'loading') {
      console.log('[MainLayout] Session loading, showing loading state')
    } else if (status === 'authenticated' && onboardingRequired) {
      console.log('[MainLayout] Onboarding required, showing loading state (redirect pending)')
    }
  } else if (process.env.NODE_ENV === 'development') {
    // Only log in development mode
    console.log(`[MainLayout] Rendering main layout with sidebar for ${pathname}`)
  }

  // Fixed sidebar widths that match the actual sidebar component
  // Mobile: no sidebar (uses bottom nav)
  // Tablet & Desktop: when unpinned (floating), sidebar doesn't push content
  const sidebarWidth = isMobile ? 0 : sidebarPinned ? (sidebarExpanded ? 240 : 64) : 64
  const finalChatPanelWidth = chatPanelOpen ? chatPanelWidth : 0

  // Define routes that require provider connection
  // Note: /dashboard is intentionally NOT here — it's the connection management hub
  const providerRequiredRoutes = [
    // QuickBooks routes
    '/qb',
    // Business Central routes
    '/bc',
    // Legacy routes (will redirect)
    '/reports',
    '/analytics',
    '/customers',
    '/sales',
    '/receivables',
    '/payables',
    '/expenses',
    '/banking',
    '/cash',
    '/projects',
    '/classes',
    '/budgets',
    '/invoicing',
    '/journal',
    '/forecasting',
  ]
  const requiresProvider = providerRequiredRoutes.some((route) => pathname?.startsWith(route))
  const isSettingsPage = pathname?.startsWith('/settings')

  // Use different transition timings for sidebar and main content
  const isReportsPage = pathname?.startsWith('/reports') || pathname?.startsWith('/qb/reports')
  const isWelcomeEnabledPage =
    pathname === '/dashboard' ||
    isReportsPage ||
    pathname?.startsWith('/qb/sales') ||
    pathname?.startsWith('/qb/expenses') ||
    pathname?.startsWith('/qb/journal') ||
    pathname?.startsWith('/qb/forecasting') ||
    pathname?.startsWith('/bc/') ||
    pathname?.startsWith('/shopify/') ||
    // Legacy routes
    pathname?.startsWith('/sales') ||
    pathname?.startsWith('/expenses') ||
    pathname?.startsWith('/journal') ||
    pathname?.startsWith('/forecasting')
  const showingConnectionPrompt =
    requiresProvider && requiresProviderConnection && status === 'authenticated'

  // Redirect to dashboard when visiting a provider-required route without a connection
  useEffect(() => {
    if (showingConnectionPrompt) {
      router.replace('/dashboard')
    }
  }, [showingConnectionPrompt, router])

  const mainContentStyle = {
    marginLeft: showingConnectionPrompt ? 0 : sidebarWidth,
    marginRight:
      showingConnectionPrompt || isSettingsPage || isMobile || chatFullscreen
        ? 0
        : finalChatPanelWidth, // Docked panel - no buffer needed
    paddingLeft: showingConnectionPrompt ? '0' : '1.5rem',
    paddingRight: showingConnectionPrompt ? '0' : '1.5rem',
    paddingTop: '56px', // Clear TopBar height (h-14)
    // Smooth transitions - disabled for margin-right during resize for instant response
    transition: chatResizing
      ? 'margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      : `margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1),
         margin-right 400ms cubic-bezier(0.4, 0, 0.2, 1)`,
    // Note: ChatPanel is now outside <main> so no visibility hiding needed
  }

  // Derive provider display name from the current route
  const welcomeProvider = pathname?.startsWith('/bc/')
    ? 'Business Central'
    : pathname?.startsWith('/shopify/')
      ? 'Shopify'
      : pathname?.startsWith('/qb/') ||
          pathname?.startsWith('/reports') ||
          pathname?.startsWith('/sales') ||
          pathname?.startsWith('/expenses') ||
          pathname?.startsWith('/journal') ||
          pathname?.startsWith('/forecasting')
        ? 'QuickBooks'
        : undefined

  // Show welcome overlay on reports, sales, expenses, journal, and chat pages
  // Don't show when connection prompt is displayed (user not connected to provider)
  const shouldShowWelcome =
    isWelcomeEnabledPage &&
    showWelcome &&
    !isInitializing &&
    status === 'authenticated' &&
    !showingConnectionPrompt

  // Extract providerEntities computation to useMemo for reuse
  // For BC: includes BOTH OAuth connections AND warehouse schemas with connectionType
  const providerEntities = useMemo(() => {
    const entities: Record<string, string> = {}
    const providers = (organization as any)?.providers
    if (providers) {
      for (const [id, info] of Object.entries(providers)) {
        // QB multi-entity: store all connection names as JSON for TopBar to resolve
        if (id === 'quickbooks' && (info as any)?.connections) {
          const connections = (info as any).connections as Record<string, any>
          const nameMap: Record<string, string> = {}
          for (const [realmId, conn] of Object.entries(connections)) {
            if (conn?.credentials?.connected && conn.credentials.company_name) {
              nameMap[realmId] = conn.credentials.company_name
            }
          }
          if (Object.keys(nameMap).length > 0) {
            // Encode as JSON so TopBar can resolve by realmId
            entities[id] = JSON.stringify(nameMap)
          }
          continue
        }
        // BC: Include BOTH OAuth connections AND warehouse schemas
        // Each entry has: { name, type: 'oauth' | 'warehouse' }
        if (id === 'dynamics') {
          const pInfo = info as any
          const bcMap: Record<string, { name: string; type: 'oauth' | 'warehouse' }> = {}

          // 1. Collect OAuth connections (direct BC API)
          const oauthConns = pInfo?.oauthConnections as Record<string, any> | undefined
          if (oauthConns) {
            for (const [connId, conn] of Object.entries(oauthConns)) {
              if (connId === '_pending_oauth') continue
              if (conn?.credentials?.connected) {
                bcMap[connId] = {
                  name: conn.credentials.company_name || 'Business Central (OAuth)',
                  type: 'oauth',
                }
              }
            }
          }

          // 2. Collect warehouse schemas (Fivetran/Redshift)
          const creds = pInfo?.credentials
          if (creds?.connected) {
            const schemas = creds.schemas as any[] | undefined
            if (schemas && schemas.length > 0) {
              for (const schema of schemas) {
                const schemaName = schema.schema_name || 'default'
                // Avoid overwriting if same name exists as OAuth (unlikely but safe)
                if (!bcMap[schemaName]) {
                  bcMap[schemaName] = {
                    name:
                      schema.company_name || schema.schema_name || 'Business Central (Warehouse)',
                    type: 'warehouse',
                  }
                }
              }
            }
          }

          if (Object.keys(bcMap).length > 0) {
            entities[id] = JSON.stringify(bcMap)
          }
          continue
        }
        // Shopify multi-store: encode all connected stores keyed by domain
        if (id === 'shopify' && (info as any)?.connections) {
          const connections = (info as any).connections as Record<string, any>
          const storeMap: Record<string, { name: string; connected: boolean }> = {}
          for (const [domain, conn] of Object.entries(connections)) {
            const isConnected = !!conn?.credentials?.connected
            const name =
              conn?.credentials?.company_name || domain.replace('.myshopify.com', '') || domain
            storeMap[domain] = { name, connected: isConnected }
          }
          if (Object.keys(storeMap).length > 0) {
            entities[id] = JSON.stringify(storeMap)
          }
          continue
        }
        // Other providers: simple string
        const creds = (info as any)?.credentials
        if (creds?.connected) {
          const name = creds.company_name || null
          if (name) entities[id] = name
        }
      }
    }
    return entities
  }, [organization])

  return (
    <AlertsProvider providerEntities={providerEntities}>
      <div className="min-h-screen relative overflow-x-hidden">
        <Background />

        {/* AppHeader disabled - TopBar now handles header functionality */}
        {/* <AppHeader sidebarExpanded={sidebarExpanded} /> */}

        {/* TopBar - always visible */}
        <TopBar
          onChatToggle={handleChatToggle}
          isChatOpen={chatPanelOpen}
          providerEntities={providerEntities}
          onSidebarToggle={handleSidebarToggle}
          isMobile={isMobile}
          onSignOut={signOut}
        />

        {isInitializing ? (
          // Loading state: Show minimal UI without sidebar/chat
          <>
            <AnimatedShellMain intensity="normal" />
            <main className="relative z-10 pt-20 md:pt-20">
              <div className="">
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm theme-text-secondary">Checking authentication...</p>
                </div>
              </div>
            </main>
          </>
        ) : (
          // Normal state: Show full layout with sidebar and content
          <>
            {/* Sidebar - hidden on mobile via CSS, same as desktop on tablet */}
            <Sidebar
              expanded={sidebarExpanded}
              onToggle={handleSidebarToggle}
              isMobile={isMobile}
              isPinned={sidebarPinned}
              onPinToggle={togglePin}
              userName={
                user?.first_name
                  ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
                  : undefined
              }
              userEmail={user?.email}
              userAvatar={user?.picture}
              onSignOut={signOut}
            />

            <main
              className="dashboard-container relative z-10 min-h-screen"
              style={mainContentStyle}
            >
              {/* Welcome Overlay - positioned relative to main, outside the content flow */}
              {shouldShowWelcome && (
                <WelcomeOverlay
                  firstName={user?.first_name}
                  provider={welcomeProvider}
                  onOpenChat={handleOpenChat}
                  onComplete={handleWelcomeComplete}
                  isLoading={welcomeContext?.isDataLoading ?? true}
                  leftOffset={sidebarWidth}
                  rightOffset={finalChatPanelWidth + (finalChatPanelWidth > 0 ? 24 : 0)}
                  isTransitioning={chatTransitioning}
                  isMobile={isMobile}
                />
              )}

              <div className="py-6 relative min-h-[calc(100vh-3rem)] w-full max-w-[1400px] mx-auto @container">
                {/* Redirect to dashboard if provider required but not connected */}
                {showingConnectionPrompt ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm theme-text-secondary">Redirecting to dashboard...</p>
                  </div>
                ) : (
                  <>
                    {/* Main content - hidden when chat is fullscreen or during welcome overlay */}
                    <div
                      className={
                        shouldShowWelcome || (chatFullscreen && chatPanelOpen)
                          ? 'invisible'
                          : 'visible'
                      }
                    >
                      {children}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <footer className="w-full max-w-[1400px] mx-auto px-6 py-12 border-t border-stone-200 dark:border-white/[0.08]"></footer>
            </main>

            {/* ChatPanel is outside main to avoid visibility/margin issues in fullscreen */}
            {!isSettingsPage && !requiresProviderConnection && (
              <ChatPanel
                isOpen={chatPanelOpen}
                onToggle={handleChatToggle}
                onWidthChange={setChatPanelWidth}
                sidebarWidth={sidebarWidth}
                isFullscreen={chatFullscreen}
                onFullscreenChange={setChatFullscreen}
                onResizingChange={setChatResizing}
              />
            )}

            {/* Bottom Navigation Bar - only visible on mobile via CSS */}
            {!showingConnectionPrompt && (
              <BottomNavBar onOpenChat={handleChatToggle} isChatOpen={chatPanelOpen} />
            )}
          </>
        )}
      </div>
    </AlertsProvider>
  )
}

// Loading fallback for the main layout
function MainLayoutFallback() {
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <Background />
      <main className="relative z-10 pt-20 md:pt-20">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm theme-text-secondary">Loading...</p>
        </div>
      </main>
    </div>
  )
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthRedirectHandler>
      <SheetStateProvider>
        <LLMProviderProvider>
          <SidebarProvider>
            <ChatProvider>
              <FinancialDataProvider>
                <CurrencyProvider>
                  <WelcomeProvider>
                    <Suspense fallback={<MainLayoutFallback />}>
                      <MainLayoutContent>{children}</MainLayoutContent>
                    </Suspense>
                  </WelcomeProvider>
                </CurrencyProvider>
              </FinancialDataProvider>
            </ChatProvider>
          </SidebarProvider>
        </LLMProviderProvider>
      </SheetStateProvider>
    </AuthRedirectHandler>
  )
}
