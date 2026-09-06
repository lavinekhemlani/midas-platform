'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/useSession'

export default function SignOutPage() {
  const router = useRouter()
  const [signOutComplete, setSignOutComplete] = useState(false)
  const { signOut } = useSession()

  useEffect(() => {
    const handleSignOut = async () => {
      try {
        console.log('[SignOutPage] Starting sign-out process...')

        // Use the session's signOut method
        await signOut()

        setSignOutComplete(true)
        console.log('[SignOutPage] Sign-out complete, redirecting...')

        // Redirect after a brief delay to show success message
        setTimeout(() => {
          router.replace('/')
        }, 1000)
      } catch (error) {
        console.error('[SignOutPage] Sign out error:', error)

        // Even if sign-out fails, mark as complete and redirect
        setSignOutComplete(true)

        setTimeout(() => {
          router.replace('/')
        }, 1000)
      }
    }

    handleSignOut()
  }, [router, signOut])

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-5 pt-10 md:pt-0 pb-10 relative z-20">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold theme-text-primary mb-2">
          {signOutComplete ? 'Signed out successfully' : 'Signing out...'}
        </h2>
        <p className="theme-text-secondary">
          {signOutComplete
            ? 'Redirecting you to the home page...'
            : 'Please wait while we sign you out securely.'}
        </p>
      </div>
    </main>
  )
}
