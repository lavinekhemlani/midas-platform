'use client'

import { useSession } from '@/hooks/useSession'
import OnboardingNav from './components/OnboardingNav'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { error } = useSession()
  // Note: Onboarding redirect logic is handled by AuthRedirectHandler in root layout

  if (error) {
    const isAuthError = error.includes('Authentication') || error.includes('Unauthorized')
    return (
      <UnsavedChangesProvider>
        <div className="min-h-screen relative overflow-hidden">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-500 text-2xl">⚠</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                {isAuthError ? 'Authentication Required' : 'Something went wrong'}
              </h2>
              <p className="text-gray-400 mb-4">
                {isAuthError
                  ? 'Please sign in again to continue with onboarding.'
                  : "We couldn't load your onboarding data. Please try refreshing the page."}
              </p>
              <div className="space-x-2">
                {isAuthError ? (
                  <button
                    onClick={() => (window.location.href = '/')}
                    className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors"
                  >
                    Sign In
                  </button>
                ) : (
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors"
                  >
                    Refresh Page
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </UnsavedChangesProvider>
    )
  }

  return (
    <UnsavedChangesProvider>
      <div className="min-h-screen relative overflow-hidden">
        <OnboardingNav />
        <main className="relative z-10 ml-0 md:ml-24 min-h-screen pt-36 md:pt-0">
          <div className="w-full px-4 md:px-8">{children}</div>
        </main>
      </div>
    </UnsavedChangesProvider>
  )
}
