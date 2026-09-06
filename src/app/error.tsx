'use client'

import Background from '@/components/layout/Background'
import AnimatedShell from '@/components/layout/AnimatedShell'
import AppHeader from '@/components/layout/AppHeader'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('Application error:', error)

  return (
    <div className="min-h-screen relative">
      <Background />
      <AnimatedShell intensity="normal" />
      <AppHeader />
      
      <div className="relative z-10 pt-20 md:pt-24">
        <div className="flex items-center justify-center px-5">
          <div className="glass-luxury-card p-8 rounded-xl max-w-md mx-auto text-center">
            <h2 className="text-xl font-bold theme-text-primary mb-4">
              Something went wrong!
            </h2>
            <pre className="text-xs theme-text-secondary bg-red-500/10 p-4 rounded mb-4 text-left overflow-auto">
              {error.message}
              {error.stack && (
                <>
                  <br /><br />
                  {error.stack}
                </>
              )}
            </pre>
            <button
              onClick={reset}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}