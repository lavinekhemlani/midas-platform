// src/components/ui/CustomUserDropdown.tsx
'use client'

import CSSThemeToggleCompact from '@/components/ui/CSSThemeToggleCompact'
import UserAvatar from '@/components/ui/UserAvatar'
import { useSession } from '@/hooks/useSession'
import { Bell, LayoutDashboard, LogOut, Settings, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function CustomUserDropdown() {
  const { user: sessionUser, signOut, status } = useSession()
  const completedSteps = sessionUser?.onboarding_audit?.completed_steps || []

  const [isMenuVisible, setIsMenuVisible] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const userProfile = sessionUser

  // Mock unread notifications state - in real app this would come from API
  const [unreadNotifications, setUnreadNotifications] = useState({
    comingSoon: true,
    welcome: true,
  })

  // Check if any notifications are still unread
  const hasUnreadNotifications = unreadNotifications.comingSoon || unreadNotifications.welcome
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const isLandingPage = pathname === '/'

  // Check if onboarding is complete (2 steps: setup and connect)
  const totalSteps = ['setup', 'connect']
  const isOnboardingComplete = totalSteps.every((step) => completedSteps.includes(step))

  useEffect(() => {
    if (isLandingPage) {
      setIsMenuVisible(true)
      const hideTimeout = setTimeout(() => setIsMenuVisible(false), 3000)
      return () => clearTimeout(hideTimeout)
    }
  }, [isLandingPage])

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.notifications-dropdown')) {
        setIsNotificationsOpen(false)
      }
    }

    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isNotificationsOpen])

  // Show loading skeleton while session is initializing
  if (!sessionUser || status === 'loading') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        role="status"
        aria-live="polite"
        aria-label="Loading user profile"
      >
        <Loader2 className="w-4 h-4 animate-spin text-amber-500" aria-hidden="true" />
        <div
          className="w-9 h-9 rounded-full bg-amber-500/20 animate-pulse"
          aria-hidden="true"
        ></div>
      </div>
    )
  }

  // Get user details from session
  const firstName = userProfile?.first_name
  const email = userProfile?.email
  const imageUrl = userProfile?.picture

  const userInitial = firstName ? firstName.charAt(0) : email ? email.charAt(0) : 'U'

  const handleSignOut = async () => {
    try {
      console.log('[CustomUserDropdown] Sign-out button clicked')
      // Navigate to sign-out page which will handle the actual sign-out process
      router.push('/sign-out')
      // Note: The /sign-out page will call the session.signOut() method
    } catch (error) {
      console.error('[CustomUserDropdown] Error navigating to sign-out:', error)
      // Fallback: try to sign out directly
      try {
        await signOut()
        router.push('/')
      } catch (signOutError) {
        console.error('[CustomUserDropdown] Sign-out fallback failed:', signOutError)
        // Last resort: force navigation to landing page
        window.location.href = '/'
      }
    }
  }

  const menuItems = [
    {
      type: 'button' as const,
      id: 'signout',
      label: 'Sign Out',
      action: handleSignOut,
      icon: LogOut,
      showLabel: true,
    },
    {
      type: 'component' as const,
      id: 'themeToggle',
      label: 'Theme',
      component: CSSThemeToggleCompact,
    },
    {
      type: 'link' as const,
      id: 'reports',
      label: 'Reports',
      href: '/reports',
      icon: LayoutDashboard,
      showLabel: false,
    },
    {
      type: 'notifications' as const,
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      showLabel: false,
    },
    {
      type: 'link' as const,
      id: 'settings',
      label: 'Settings',
      href: '/settings',
      icon: Settings,
      showLabel: false,
    },
  ]

  const handleMouseEnter = () => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current)
      menuTimeoutRef.current = null
    }
    setIsMenuVisible(true)
  }

  const handleMouseLeave = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setIsMenuVisible(false)
    }, 250)
  }

  return (
    <div
      className="relative flex items-center justify-end p-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="menubar"
    >
      {/* Expanded Horizontal Menu Bubbles */}
      <div
        className={`
          flex items-center transition-all duration-500 ease-out
          ${isMenuVisible ? 'max-w-xl opacity-100 mr-2 space-x-1.5 sm:space-x-2' : 'max-w-0 opacity-0 mr-0 space-x-0'}
        `}
        aria-hidden={!isMenuVisible}
        style={{ overflow: isMenuVisible ? 'visible' : 'hidden' }}
      >
        {menuItems.map((item, index) => {
          const isSignOut = item.id === 'signout'
          const isOnboarding = 'isOnboarding' in item && item.isOnboarding

          const bubbleWrapperStyle = `
            flex items-center justify-center h-10 
            transition-all duration-150 ease-out
            ${isOnboarding ? 'animate-pulse' : ''}
          `

          const bubbleAnimationStyle = {
            transitionProperty: 'opacity, transform',
            transitionDuration: '500ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            transitionDelay: isMenuVisible
              ? `${(menuItems.length - 1 - index) * 80}ms`
              : `${(menuItems.length - 1 - index) * 50}ms`,
            opacity: isMenuVisible ? 1 : 0,
            transform: isMenuVisible ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.9)',
          }

          if (item.type === 'component') {
            const Component = item.component
            return (
              <div
                key={item.id}
                className={bubbleWrapperStyle}
                style={bubbleAnimationStyle}
                title={item.label}
              >
                <Component />
              </div>
            )
          }

          const IconComponent = item.icon
          const bubbleClickableBaseStyle = `
            flex items-center justify-center h-10 px-3 sm:px-4 py-2 glass-luxury rounded-xl shadow-lg 
            hover:scale-105 active:scale-95 whitespace-nowrap
            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--theme-bg)]
            theme-text-primary transition-all duration-150 ease-out
          `
          const hoverStyle = isSignOut
            ? 'hover:bg-red-500/15 hover:text-red-400 focus-visible:ring-red-500'
            : isOnboarding
              ? 'hover:bg-orange-500/15 hover:text-orange-400 focus-visible:ring-orange-500 bg-orange-500/10 text-orange-400 shadow-orange-500/20'
              : 'hover:bg-amber-500/15 hover:text-amber-400 focus-visible:ring-amber-500'

          if (item.type === 'notifications') {
            const IconComponent = item.icon
            return (
              <div
                key={item.id}
                className={`${bubbleWrapperStyle} notifications-dropdown`}
                style={bubbleAnimationStyle}
              >
                <div className="relative">
                  <button
                    className={`${bubbleClickableBaseStyle} hover:bg-amber-500/15 hover:text-amber-400 focus-visible:ring-amber-500 ${isNotificationsOpen ? 'bg-amber-500/15 text-amber-400' : ''}`}
                    role="menuitem"
                    aria-label={item.label}
                    onClick={() => {
                      setIsNotificationsOpen(!isNotificationsOpen)
                    }}
                  >
                    <div className="relative">
                      <IconComponent className="w-4 h-4 flex-shrink-0" />
                      {/* Red pulsating notification indicator */}
                      {hasUnreadNotifications && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </button>
                  {/* Dropdown Popup */}
                  <div
                    className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 glass-luxury-card border border-amber-500/20 rounded-lg shadow-lg transition-all duration-200 z-50 ${
                      isNotificationsOpen
                        ? 'opacity-100 pointer-events-auto transform translate-y-0'
                        : 'opacity-0 pointer-events-none transform -translate-y-2'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center space-x-3 mb-4">
                        <Bell className="w-5 h-5 text-amber-500" />
                        <div>
                          <h3 className="text-sm font-semibold theme-text-primary">
                            Notifications
                          </h3>
                          <p className="text-xs theme-text-secondary">Stay updated</p>
                        </div>
                      </div>

                      {/* Notification Messages */}
                      <div className="space-y-0">
                        {/* Coming Soon Message */}
                        <div
                          className="py-3 border-b border-amber-500/10 cursor-pointer hover:bg-amber-500/5 transition-colors duration-150"
                          onClick={() => {
                            setUnreadNotifications((prev) => ({
                              ...prev,
                              comingSoon: false,
                            }))
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-medium theme-text-primary mb-1">
                                Coming Soon
                              </p>
                              <p className="text-xs theme-text-secondary">
                                We&apos;re working on bringing you real-time notifications
                              </p>
                            </div>
                            {unreadNotifications.comingSoon && (
                              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse ml-2 flex-shrink-0"></div>
                            )}
                          </div>
                        </div>

                        {/* Welcome Message */}
                        <div
                          className="py-3 cursor-pointer hover:bg-amber-500/5 transition-colors duration-150"
                          onClick={() => {
                            setUnreadNotifications((prev) => ({
                              ...prev,
                              welcome: false,
                            }))
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-medium theme-text-primary mb-1">
                                Welcome to Midas
                              </p>
                              <p className="text-xs theme-text-secondary">
                                Your AI-enhanced financial command center
                              </p>
                            </div>
                            {unreadNotifications.welcome && (
                              <div className="w-2 h-2 bg-amber-500 rounded-full ml-2 flex-shrink-0"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-amber-500/20"></div>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div key={item.id} className={bubbleWrapperStyle} style={bubbleAnimationStyle}>
              {item.type === 'link' ? (
                <Link
                  href={item.href}
                  onClick={() => setIsNotificationsOpen(false)}
                  className={`${bubbleClickableBaseStyle} ${hoverStyle}`}
                  title={item.label}
                  role="menuitem"
                  aria-label={item.label}
                >
                  <IconComponent
                    className={`w-4 h-4 ${'showLabel' in item && !item.showLabel ? '' : 'mr-1.5 sm:mr-2'} flex-shrink-0 ${isOnboarding ? 'animate-pulse' : ''}`}
                  />
                  {(!('showLabel' in item) || item.showLabel) && (
                    <span className="text-xs font-medium">{item.label}</span>
                  )}
                </Link>
              ) : (
                // type === 'button'
                <button
                  onClick={() => {
                    item.action?.()
                    // Don't close the menu, only close notifications if open
                    setIsNotificationsOpen(false)
                  }}
                  className={`${bubbleClickableBaseStyle} ${hoverStyle}`}
                  title={item.label}
                  role="menuitem"
                  aria-label={item.label}
                >
                  <IconComponent
                    className={`w-4 h-4 ${'showLabel' in item && !item.showLabel ? '' : 'mr-1.5 sm:mr-2'} flex-shrink-0 ${isOnboarding ? 'animate-pulse' : ''}`}
                  />
                  {(!('showLabel' in item) || item.showLabel) && (
                    <span className="text-xs font-medium">{item.label}</span>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Trigger: User Avatar */}
      <button
        className="flex-shrink-0 flex items-center gap-1 p-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)] transition-transform duration-150 ease-in-out hover:scale-110 active:scale-100"
        aria-expanded={isMenuVisible}
        aria-haspopup="true"
        aria-label="Toggle user menu"
      >
        <div className="mr-3 ml-3 flex flex-col items-center justify-center h-6 theme-text-secondary">
          <div className="w-1 h-1 rounded-full bg-current mb-0.5"></div>
          <div className="w-1 h-1 rounded-full bg-current mb-0.5"></div>
          <div className="w-1 h-1 rounded-full bg-current"></div>
        </div>
        <UserAvatar
          imageUrl={imageUrl}
          firstName={firstName}
          email={email}
          size="md"
          showNotificationIndicator={true}
          hasUnreadNotifications={hasUnreadNotifications}
        />
      </button>
    </div>
  )
}
