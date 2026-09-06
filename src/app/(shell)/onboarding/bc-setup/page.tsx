'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useSession } from '@/hooks/useSession'
import BCEnvironmentPicker from '@/components/integrations/BCEnvironmentPicker'
import { CheckCircle2, Database, Loader2 } from 'lucide-react'

function BCSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refetchSession } = useSession()
  const oauthSuccess = searchParams.get('oauth_success') === 'true'

  async function handleComplete(
    connectionId: string,
    companyName: string,
    environmentName: string
  ) {
    // Refresh session so the dashboard sees the new connection
    await refetchSession()
    router.push(`/onboarding/connect?bc_connected=true&company=${encodeURIComponent(companyName)}`)
  }

  function handleCancel() {
    router.push('/onboarding/connect')
  }

  function handleAdminConsent() {
    // Redirect to admin consent flow
    window.location.href = '/api/providers/dynamics/admin-consent'
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="bc-setup-icon-container inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
            <Database className="w-8 h-8 bc-setup-icon" />
          </div>
          <h1 className="text-2xl font-semibold theme-text-primary mb-2">
            Set Up Business Central
          </h1>
          {oauthSuccess && (
            <div className="bc-setup-success-badge inline-flex items-center gap-2 px-4 py-2 rounded-full mt-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Microsoft authentication successful</span>
            </div>
          )}
          <p className="text-sm theme-text-secondary mt-3 max-w-sm mx-auto">
            Select your environment and company to complete the connection.
          </p>
        </div>

        {/* Main card */}
        <div className="bc-setup-card rounded-2xl p-6">
          <BCEnvironmentPicker
            onComplete={handleComplete}
            onCancel={handleCancel}
            onAdminConsentNeeded={handleAdminConsent}
          />
        </div>

        {/* Help text */}
        <p className="text-xs theme-text-secondary text-center mt-6 opacity-70">
          Need help?{' '}
          <a
            href="https://docs.microsoft.com/en-us/dynamics365/business-central/"
            target="_blank"
            rel="noopener noreferrer"
            className="bc-setup-link hover:underline"
          >
            View Business Central documentation
          </a>
        </p>
      </div>
    </div>
  )
}

export default function BCSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
          <div className="flex items-center gap-3 theme-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      }
    >
      <BCSetupContent />
    </Suspense>
  )
}
