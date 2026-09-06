// src/app/(shell)/sso-callback/page.tsx
'use client'

import { AuthCookies } from '@/lib/auth'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { clientLogger } from '@/lib/client-logger'
import { EB_Garamond, DM_Sans } from 'next/font/google'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

type CallbackState = 'processing' | 'success' | 'error'

export default function SSOCallbackPage() {
  const router = useRouter()
  const [state, setState] = useState<CallbackState>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout

    async function handleAuthCallback() {
      try {
        setState('processing')
        clientLogger.pageView('SSO callback')

        // Check for OAuth errors in URL first
        const urlParams = new URLSearchParams(window.location.search)
        const error = urlParams.get('error')
        if (error) {
          clientLogger.error('OAuth callback error', { error })
          throw new Error(`OAuth failed: ${error}`)
        }

        // Ensure auth cookies are set for Google sign-in
        await AuthCookies.set()

        // Add a delay to ensure cookies are properly set
        await new Promise((resolve) => setTimeout(resolve, 1000))

        if (!isMounted) return

        // Simple redirect - let AuthRedirectHandler determine onboarding status
        const redirectUrl = '/dashboard'

        console.log('[SSO] Authentication successful, redirecting to:', redirectUrl)
        setState('success')
        clientLogger.success('OAuth sign-in successful', { redirectUrl })

        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.log('[SSO] Executing redirect to:', redirectUrl)
            router.replace(redirectUrl)
          }
        }, 1500)
      } catch (error) {
        if (!isMounted) return

        const errorMessage = error instanceof Error ? error.message : String(error)
        clientLogger.error('Failed to process auth callback', { error: errorMessage })
        console.error('[SSO Callback] Auth callback failed:', error)
        setState('error')
        setError('Network error occurred')

        // Fallback to sign-in after error
        timeoutId = setTimeout(() => {
          if (isMounted) {
            router.replace('/sign-in')
          }
        }, 3000)
      }
    }

    handleAuthCallback()

    // Cleanup function
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [router])

  return (
    <main
      className={`min-h-screen flex-1 flex flex-col items-center justify-start md:justify-center px-5 pt-10 md:pt-0 pb-10 relative z-20 ${ebGaramond.variable} ${dmSans.variable}`}
      style={{ fontFamily: 'var(--font-dm-sans)' }}
    >
      <div className="w-full max-w-md mx-auto">
        <header className="text-center mb-7 luxury-fade-in">
          <h1
            className="text-4xl md:text-5xl theme-text-primary mb-2.5 leading-tight font-light"
            style={{ fontFamily: 'var(--font-eb-garamond)' }}
          >
            {state === 'processing' && 'Signing you in...'}
            {state === 'success' && (
              <>
                Welcome to <span className="midas-text-gradient italic pr-0.5">Midas</span>
              </>
            )}
            {state === 'error' && 'Something went wrong'}
          </h1>
          <p className="text-base theme-text-secondary leading-relaxed">
            {state === 'processing' && 'Setting up your account'}
            {state === 'success' && 'Redirecting to your dashboard'}
            {state === 'error' && 'We encountered an issue signing you in'}
          </p>
        </header>

        <div className="zenith-form p-7 luxury-fade-in" style={{ animationDelay: '0.2s' }}>
          {/* Loading state */}
          {state === 'processing' && (
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          )}

          {/* Success state */}
          {state === 'success' && (
            <div className="flex justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div className="space-y-5">
              {error && (
                <div className="p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30 flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <button
                onClick={() => router.replace('/sign-in')}
                className="btn-get-started w-full px-5 py-2.5 text-white font-bold rounded-lg text-sm"
              >
                Return to Sign In
              </button>
              <button
                onClick={() => router.replace('/dashboard')}
                className="w-full text-sm theme-text-secondary hover:theme-text-primary transition-colors"
              >
                Try Dashboard Instead
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
