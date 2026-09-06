// src/app/(main)/settings/page.tsx
'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertTriangle, CheckCircle, Settings as SettingsIcon } from 'lucide-react'
import PreferencesSettings from '@/components/settings/PreferencesSettings'
import ProfileSettings from '@/components/settings/ProfileSettings'
import OrganizationSettings from '@/components/settings/OrganizationSettings'
import IntegrationsSection from '@/components/settings/IntegrationsSection'
import Link from 'next/link'

type SectionId = 'integrations' | 'preferences' | 'profile' | 'organization'

const navigationItems: { id: SectionId; label: string }[] = [
  { id: 'integrations', label: 'Integrations' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'profile', label: 'Profile' },
  { id: 'organization', label: 'Organization' },
]

export default function SettingsPage() {
  const { status, user, organization, refetchSession } = useSession()
  const searchParams = useSearchParams()
  const isAuthenticated = status === 'authenticated'
  const loadingData = status === 'loading'

  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId>('integrations')
  const [sidebarLeft, setSidebarLeft] = useState<number>(0)

  const sectionRefs = useRef<{ [key in SectionId]?: HTMLElement | null }>({})
  const contentRef = useRef<HTMLDivElement>(null)

  const handleUpdateSuccess = useCallback(
    async (message?: string) => {
      if (message) {
        setSuccessMessage(message)
        setTimeout(() => setSuccessMessage(null), 4000)
      }
      // Re-fetch session to get latest changes
      await refetchSession()
    },
    [refetchSession]
  )

  // Scroll to section handler
  const scrollToSection = useCallback((sectionId: SectionId) => {
    // Update active section immediately for responsive UI
    setActiveSection(sectionId)
    const element = sectionRefs.current[sectionId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Intersection Observer for scroll spy
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id as SectionId
          setActiveSection(sectionId)
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    // Observe all sections
    Object.values(sectionRefs.current).forEach((section) => {
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [user])

  // Auto-scroll to section based on URL parameter
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && tab === 'integrations') {
      // Small delay to ensure sections are rendered
      setTimeout(() => {
        scrollToSection('integrations')
      }, 100)
    }
  }, [searchParams, scrollToSection])

  if (loadingData) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center text-center p-8">
        <div className="glass-luxury-card p-8 rounded-xl max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="theme-text-primary text-xl font-semibold">Access Denied</p>
          <p className="theme-text-secondary mt-2">Please sign in to view your settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-6 relative">
      {/* Centered container for content */}
      <div className="max-w-4xl mx-auto px-6">
        {/* Settings Sidebar Navigation - Fixed to the left of content */}
        <aside className="hidden lg:block fixed top-1/2 -translate-y-1/2 w-56 -ml-64">
          {/* Navigation Links */}
          <nav className="space-y-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`
                  block w-full text-left py-1 transition-colors font-[family-name:var(--font-dm-sans)]
                  ${
                    activeSection === item.id
                      ? 'theme-text-primary underline decoration-amber-500 decoration-2 underline-offset-4'
                      : 'theme-text-secondary hover:theme-text-primary'
                  }
                `}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content Area - Centered */}
        <main className="space-y-8">
          {/* Header at Top of Content */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <SettingsIcon className="w-10 h-10 theme-text-primary" strokeWidth={1} />
              <h1 className="text-[42px] font-light theme-text-primary tracking-tight">Settings</h1>
            </div>
            <p className="text-sm theme-text-secondary">
              Manage your account, organization, and application preferences
            </p>
            <div className="flex-1 h-px my-4 bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent"></div>
          </div>
          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-md text-sm border border-emerald-500/30 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> {successMessage}
            </div>
          )}

          {/* Settings Sections */}
          {user && (
            <>
              {/* Integrations Section */}
              <section
                id="integrations"
                ref={(el) => {
                  sectionRefs.current.integrations = el
                }}
                className="scroll-mt-6 pb-16 border-b border-slate-700/30"
              >
                <h2 className="text-3xl font-bold theme-text-primary mb-6 font-[family-name:var(--font-dm-sans)]">
                  Integrations
                </h2>
                <IntegrationsSection />
              </section>

              {/* Preferences Section */}
              <section
                id="preferences"
                ref={(el) => {
                  sectionRefs.current.preferences = el
                }}
                className="scroll-mt-6 pb-16 border-b border-slate-700/30"
              >
                <h2 className="text-3xl font-bold theme-text-primary mb-6 font-[family-name:var(--font-dm-sans)]">
                  Preferences
                </h2>
                <PreferencesSettings />
              </section>

              {/* Profile Section */}
              <section
                id="profile"
                ref={(el) => {
                  sectionRefs.current.profile = el
                }}
                className="scroll-mt-6 pb-16 border-b border-slate-700/30"
              >
                <h2 className="text-3xl font-bold theme-text-primary mb-6 font-[family-name:var(--font-dm-sans)]">
                  Profile
                </h2>
                <ProfileSettings
                  initialData={{
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role_title: user.role_title,
                  }}
                  onUpdateSuccess={handleUpdateSuccess}
                />
              </section>

              {/* Organization Section */}
              <section
                id="organization"
                ref={(el) => {
                  sectionRefs.current.organization = el
                }}
                className="scroll-mt-6 pb-16"
              >
                <h2 className="text-3xl font-bold theme-text-primary mb-6 font-[family-name:var(--font-dm-sans)]">
                  Organization
                </h2>
                <OrganizationSettings
                  organization={organization}
                  onUpdateSuccess={handleUpdateSuccess}
                />
              </section>
            </>
          )}

          {/* Legal Links Footer */}
          <div className="pt-8 pb-4 border-t border-slate-700/30">
            <div className="flex items-center justify-center gap-6 text-sm">
              <Link
                href="/terms"
                className="theme-text-secondary hover:text-amber-500 transition-colors"
              >
                Terms & Conditions
              </Link>
              <span className="theme-text-secondary">•</span>
              <Link
                href="/privacy"
                className="theme-text-secondary hover:text-amber-500 transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
