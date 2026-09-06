// src/app/(shell)/sign-in/[[...sign_in]]/page.tsx

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  signIn,
  signInWithRedirect,
  resetPassword,
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  resendSignUpCode,
} from 'aws-amplify/auth'
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react'
import { clientLogger } from '@/lib/client-logger'
import { EB_Garamond, DM_Sans } from 'next/font/google'
import { useTheme } from '@/hooks/useTheme'

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

export default function SignInPage() {
  const [step, setStep] = useState<
    'signIn' | 'forgotPassword' | 'resetPassword' | 'newPasswordRequired' | 'confirmSignUp'
  >('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()
  const { theme } = useTheme()

  // Check if user is already authenticated
  // NOTE: We no longer auto-redirect authenticated users on page load.
  // This prevents redirect loops when provider-based routes (like /bc/reports)
  // fail with 403 due to missing warehouse access, causing users to bounce
  // back to sign-in in an infinite loop.
  // Redirects now only happen AFTER explicit sign-in actions (handleSignIn, etc.)
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Import fetchAuthSession for proper token validation
        const { fetchAuthSession } = await import('aws-amplify/auth')
        const session = await fetchAuthSession()

        // Just check if authenticated - don't auto-redirect
        // If user is authenticated and on sign-in page, show them options:
        // - They can navigate manually to their desired destination
        // - They can sign out and sign in as someone else
        if (session.tokens?.accessToken && session.tokens?.idToken) {
          // User is authenticated - show sign-in page anyway (no auto-redirect)
          // This breaks potential redirect loops and gives user control
          clientLogger.pageView('Sign-in page (authenticated user)')
          setIsCheckingAuth(false)
        } else {
          // No valid tokens, show sign-in form
          clientLogger.pageView('Sign-in page')
          setIsCheckingAuth(false)
        }
      } catch (error) {
        // User is not authenticated, can proceed with sign-in
        clientLogger.pageView('Sign-in page')
        setIsCheckingAuth(false)
      }
    }

    checkAuthStatus()
  }, [])

  // Reset Google loading state on unmount or route change
  useEffect(() => {
    return () => {
      setIsGoogleLoading(false)
    }
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    clientLogger.formSubmit('Sign-in form', { method: 'email' })

    try {
      const { isSignedIn, nextStep } = await signIn({
        username: email, // In Cognito, 'username' is typically the email
        password,
      })

      if (isSignedIn) {
        // Set auth cookies using the unified auth helper
        const { AuthCookies } = await import('@/lib/auth')
        await AuthCookies.set()

        // Small delay to ensure cookies are set and auth state is updated
        await new Promise((resolve) => setTimeout(resolve, 500))

        console.log('Sign-in successful, redirecting...')
        // Redirect based on connected provider
        const redirectUrl = '/dashboard'
        router.push(redirectUrl)
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        // User has a temporary password and needs to set a new one
        console.log('New password required for user')
        setStep('newPasswordRequired')
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        // User account exists but needs confirmation
        console.log('User needs to confirm sign-up')

        // For migrated users who shouldn't need confirmation, try auto-confirming
        // This handles the case where users were migrated but left in unconfirmed state
        console.log(
          '[Migration] Detected unconfirmed migrated user, attempting auto-confirmation...'
        )

        try {
          // Try to confirm with a dummy code first (some setups allow this for pre-verified emails)
          await confirmSignUp({
            username: email,
            confirmationCode: '000000', // Try dummy code for pre-verified accounts
          })

          // If that worked, retry sign-in
          const retryResult = await signIn({
            username: email,
            password,
          })

          if (retryResult.isSignedIn) {
            const { AuthCookies } = await import('@/lib/auth')
            await AuthCookies.set()
            await new Promise((resolve) => setTimeout(resolve, 500))
            console.log('[Migration] Auto-confirmation successful, redirecting...')
            const redirectUrl = '/dashboard'
            router.push(redirectUrl)
            return
          }
        } catch (autoConfirmError: any) {
          // Auto-confirm failed, show confirmation UI
          console.log('[Migration] Auto-confirmation failed, showing confirmation UI')
          setStep('confirmSignUp')
        }
      } else {
        // Handle other cases like MFA if you enable it later
        console.log('Next step:', nextStep)
        setError('Multi-factor authentication might be required.')
      }
    } catch (err: any) {
      console.error('Sign-in error:', err)

      // Check if this is a "user not found" or "incorrect password" error
      // This could mean the user exists in the old pool but not the new one
      if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
        console.log('[Migration] Attempting to migrate user from old pool...')

        // Try to migrate the user from old pool
        const migrated = await attemptUserMigration(email, password)

        if (migrated) {
          // Migration successful - retry sign-in with delay and retries
          console.log('[Migration] ✓ Migration successful, retrying sign-in...')

          // Wait a bit for Cognito to propagate the new user
          await new Promise((resolve) => setTimeout(resolve, 1000))

          // Retry sign-in with multiple attempts
          let signInSuccess = false
          let lastSignInError = null

          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              console.log(`[Migration] Sign-in attempt ${attempt} of 3...`)

              const { isSignedIn } = await signIn({
                username: email,
                password,
              })

              if (isSignedIn) {
                const { AuthCookies } = await import('@/lib/auth')
                await AuthCookies.set()
                await new Promise((resolve) => setTimeout(resolve, 500))

                console.log('[Migration] ✓ Sign-in successful after migration')
                const redirectUrl = '/dashboard'
                router.push(redirectUrl)
                signInSuccess = true
                return // Exit early on success
              }
            } catch (retryErr: any) {
              lastSignInError = retryErr
              console.log(`[Migration] Sign-in attempt ${attempt} failed:`, retryErr.message)

              // Wait before retrying (exponential backoff)
              if (attempt < 3) {
                const delay = attempt * 1000 // 1s, 2s
                console.log(`[Migration] Waiting ${delay}ms before retry...`)
                await new Promise((resolve) => setTimeout(resolve, delay))
              }
            }
          }

          // If all retries failed
          if (!signInSuccess) {
            console.error(
              '[Migration] All sign-in attempts failed after migration:',
              lastSignInError
            )
            setError('Migration successful! Please try signing in again.')
            setIsLoading(false)
            return
          }
        } else {
          // Migration failed - show original error
          setError('Incorrect username or password.')
        }
      } else {
        // Other error - show error message
        setError(err.message || 'An unexpected error occurred during sign-in.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Attempt to migrate user from old Cognito pool to new pool
   */
  const attemptUserMigration = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/migrate-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.migrated) {
        console.log('[Migration] ✓ User migrated successfully')
        return true
      } else if (response.status === 409 && data.alreadyExists) {
        // User already exists in new pool (was manually migrated)
        console.log('[Migration] ℹ User already migrated, needs password reset')
        setError(
          'Your password has expired due to a recent security update. Please click "Forgot password?" below to reset it.'
        )
        return false
      } else {
        console.log('[Migration] ✗ Migration failed:', data.error)
        return false
      }
    } catch (error) {
      console.error('[Migration] Migration request failed:', error)
      return false
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setError(null)

    clientLogger.buttonClick('Continue with Google', { provider: 'Google' })

    try {
      await signInWithRedirect({ provider: 'Google' })
    } catch (err: any) {
      clientLogger.error('Google sign-in failed', { error: err.message })
      console.error('Google sign-in error:', err)
      setError(err.message || 'An unexpected error occurred with Google sign-in.')
      setIsGoogleLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await resetPassword({ username: email })
      setStep('resetPassword')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode,
        newPassword,
      })
      setStep('signIn')
      setNewPassword('')
      setConfirmationCode('')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate password match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please try again.')
      setIsLoading(false)
      return
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      setIsLoading(false)
      return
    }

    try {
      const { isSignedIn } = await confirmSignIn({
        challengeResponse: newPassword,
      })

      if (isSignedIn) {
        // Set auth cookies using the unified auth helper
        const { AuthCookies } = await import('@/lib/auth')
        await AuthCookies.set()

        // Small delay to ensure cookies are set and auth state is updated
        await new Promise((resolve) => setTimeout(resolve, 500))

        console.log('Password updated successfully, redirecting...')
        const redirectUrl = '/dashboard'
        router.push(redirectUrl)
      } else {
        setError('Failed to complete sign-in. Please try again.')
      }
    } catch (err: any) {
      console.error('Password confirmation error:', err)
      setError(err.message || 'Failed to set new password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: email,
        confirmationCode,
      })

      if (isSignUpComplete) {
        // Automatically sign in after confirmation
        const signInResult = await signIn({
          username: email,
          password,
        })

        if (signInResult.isSignedIn) {
          const { AuthCookies } = await import('@/lib/auth')
          await AuthCookies.set()
          await new Promise((resolve) => setTimeout(resolve, 500))

          console.log('Account confirmed and signed in, redirecting...')
          const redirectUrl = '/dashboard'
          router.push(redirectUrl)
        } else {
          // Confirmation successful but sign-in failed - user can try to sign in again
          setStep('signIn')
          setError('Account confirmed! Please sign in.')
        }
      }
    } catch (err: any) {
      console.error('Confirmation error:', err)

      if (err.name === 'CodeMismatchException') {
        setError('Invalid confirmation code. Please check and try again.')
      } else if (err.name === 'ExpiredCodeException') {
        setError('Confirmation code has expired. Please request a new one.')
      } else {
        setError(err.message || 'Failed to confirm account. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await resendSignUpCode({ username: email })
      setError('Verification code sent! Check your email.')
    } catch (err: any) {
      console.error('Resend code error:', err)
      setError(err.message || 'Failed to resend code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading while checking authentication status
  if (isCheckingAuth) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-5 pt-10 md:pt-0 pb-10 relative z-20">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </main>
    )
  }

  return (
    <main
      className={`flex-1 flex flex-col items-center justify-start md:justify-center px-5 pt-10 md:pt-0 pb-10 relative z-20 ${ebGaramond.variable} ${dmSans.variable}`}
      style={{ fontFamily: 'var(--font-dm-sans)' }}
    >
      <div className="w-full max-w-md mx-auto">
        <header className="text-center mb-7 luxury-fade-in">
          <h1
            className="text-4xl md:text-5xl theme-text-primary mb-2.5 leading-tight font-light"
            style={{ fontFamily: 'var(--font-eb-garamond)' }}
          >
            {step === 'signIn' ? (
              <>
                Sign in to <span className="midas-text-gradient italic px-[0.15em]">Midas</span>
              </>
            ) : step === 'forgotPassword' ? (
              'Reset Password'
            ) : step === 'newPasswordRequired' ? (
              'Set Your Password'
            ) : step === 'confirmSignUp' ? (
              'Verify Your Account'
            ) : (
              'Set New Password'
            )}
          </h1>
          <p className="text-base theme-text-secondary leading-relaxed">
            {step === 'signIn'
              ? 'Continue your financial intelligence journey'
              : step === 'forgotPassword'
                ? 'Enter your email to receive a reset code'
                : step === 'newPasswordRequired'
                  ? 'For security reasons, please create a new password'
                  : step === 'confirmSignUp'
                    ? 'Complete your account verification'
                    : 'Enter the code sent to your email'}
          </p>
        </header>

        <div className="zenith-form p-7 luxury-fade-in" style={{ animationDelay: '0.2s' }}>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30 flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
          {step === 'signIn' && (
            <div className="space-y-5">
              <div className="max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  className="btn-google-signin w-full flex items-center justify-center px-5 py-2.5 rounded-lg group"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin text-amber-500" />
                      <span className="text-sm font-medium theme-text-primary">Signing in...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span className="text-sm font-medium theme-text-primary">
                        Continue with Google
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center mt-10 mb-8 max-w-xs mx-auto">
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: 'var(--theme-input-border)' }}
                ></div>
                <span className="px-4 text-sm theme-text-secondary">Or sign in with email</span>
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: 'var(--theme-input-border)' }}
                ></div>
              </div>

              <form onSubmit={handleSignIn} className="space-y-5 max-w-xs mx-auto">
                <div className="zenith-form-group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 theme-text-secondary" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="zenith-input-auth w-full pl-9 pr-3.5 py-2.5"
                      placeholder="Email"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="zenith-form-group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 theme-text-secondary" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="zenith-input-auth w-full pl-9 pr-12 py-2.5"
                      placeholder="Password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 theme-text-secondary hover:theme-text-primary transition-colors"
                      aria-label="Toggle password visibility"
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => setStep('forgotPassword')}
                      className="text-sm transition-colors hover:opacity-80"
                      style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-get-started w-full px-5 py-2.5 text-white font-bold rounded-lg relative overflow-hidden group hover-scale text-sm"
                  >
                    <div className="btn-overlay absolute inset-0 rounded-lg" />
                    <span className="relative z-10 flex items-center justify-center">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
                      {!isLoading && (
                        <ArrowRight className="ml-1.5 w-4 h-4 group-hover-translate" />
                      )}
                    </span>
                  </button>

                  <p className="theme-text-secondary text-sm text-center mt-3">
                    Don&apos;t have an account?{' '}
                    <Link
                      href="/sign-up"
                      className="font-semibold transition-colors duration-200 hover:opacity-80"
                      style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                    >
                      Get Started
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          )}

          {step === 'forgotPassword' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="zenith-form-group">
                <label htmlFor="resetEmail" className="zenith-label required">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                  <input
                    id="resetEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="zenith-input-auth w-full pl-10 pr-3.5 py-2.5"
                    placeholder="Email"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-get-started w-full px-5 py-2.5 text-white font-bold rounded-lg group text-sm"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Code'}
                    {!isLoading && <ArrowRight className="ml-1.5 w-4 h-4 group-hover-translate" />}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('signIn')}
                  className="w-full text-sm theme-text-secondary hover:theme-text-primary transition-colors mt-5"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {step === 'resetPassword' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="zenith-form-group">
                <label htmlFor="code" className="zenith-label required">
                  Confirmation Code
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                  <input
                    id="code"
                    type="text"
                    required
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    className="zenith-input-auth w-full pl-10 pr-3.5 py-2.5"
                    placeholder="Enter code"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="zenith-form-group">
                <label htmlFor="newPassword" className="zenith-label required">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="zenith-input-auth w-full pl-10 pr-12 py-2.5"
                    placeholder="Password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 theme-text-secondary hover:theme-text-primary transition-colors"
                    aria-label="Toggle password visibility"
                    disabled={isLoading}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-get-started w-full px-5 py-2.5 text-white font-bold rounded-lg group text-sm"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}
                    {!isLoading && <ArrowRight className="ml-1.5 w-4 h-4 group-hover-translate" />}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('signIn')}
                  className="w-full text-sm theme-text-secondary hover:theme-text-primary transition-colors mt-3"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {step === 'newPasswordRequired' && (
            <form onSubmit={handleConfirmNewPassword} className="space-y-5">
              {/* Security Notice */}
              <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-400 mb-1">
                      Security Update Required
                    </p>
                    <p className="text-xs theme-text-secondary leading-relaxed">
                      Due to recent security improvements, you need to set a new password for your
                      account. This is a one-time requirement to ensure your data remains secure.
                    </p>
                  </div>
                </div>
              </div>

              <div className="zenith-form-group">
                <label htmlFor="newPasswordFirst" className="zenith-label required">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                  <input
                    id="newPasswordFirst"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="zenith-input-auth w-full pl-10 pr-12 py-2.5"
                    placeholder="Password"
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 theme-text-secondary hover:theme-text-primary transition-colors"
                    aria-label="Toggle password visibility"
                    disabled={isLoading}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="zenith-form-group">
                <label htmlFor="confirmPasswordField" className="zenith-label required">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                  <input
                    id="confirmPasswordField"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="zenith-input-auth w-full pl-10 pr-12 py-2.5"
                    placeholder="Password"
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 theme-text-secondary hover:theme-text-primary transition-colors"
                    aria-label="Toggle password visibility"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="bg-white/5 border border-gray-300/20 rounded-lg p-3">
                <p className="text-xs font-semibold theme-text-primary mb-2">
                  Password Requirements:
                </p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2 text-xs theme-text-secondary">
                    <CheckCircle2
                      className={`w-3 h-3 ${newPassword.length >= 8 ? 'text-green-400' : 'text-gray-500'}`}
                    />
                    At least 8 characters
                  </li>
                  <li className="flex items-center gap-2 text-xs theme-text-secondary">
                    <CheckCircle2
                      className={`w-3 h-3 ${/[A-Z]/.test(newPassword) ? 'text-green-400' : 'text-gray-500'}`}
                    />
                    One uppercase letter
                  </li>
                  <li className="flex items-center gap-2 text-xs theme-text-secondary">
                    <CheckCircle2
                      className={`w-3 h-3 ${/[a-z]/.test(newPassword) ? 'text-green-400' : 'text-gray-500'}`}
                    />
                    One lowercase letter
                  </li>
                  <li className="flex items-center gap-2 text-xs theme-text-secondary">
                    <CheckCircle2
                      className={`w-3 h-3 ${/[0-9]/.test(newPassword) ? 'text-green-400' : 'text-gray-500'}`}
                    />
                    One number
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-get-started w-full px-5 py-2.5 text-white font-bold rounded-lg group text-sm"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set New Password'}
                  {!isLoading && <ArrowRight className="ml-1.5 w-4 h-4 group-hover-translate" />}
                </span>
              </button>
            </form>
          )}

          {step === 'confirmSignUp' && (
            <form onSubmit={handleConfirmSignUp} className="space-y-5">
              {/* Notice for migrated users */}
              <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-400 mb-1">
                      Account Verification Required
                    </p>
                    <p className="text-xs theme-text-secondary leading-relaxed">
                      Your account needs to be verified. If you're an existing user who was recently
                      migrated, you may not have received a code. Click "Resend Code" below to
                      receive a new one.
                    </p>
                  </div>
                </div>
              </div>

              <div className="zenith-form-group">
                <label htmlFor="confirmCode" className="zenith-label required">
                  Confirmation Code
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                  <input
                    id="confirmCode"
                    type="text"
                    required
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    className="zenith-input-auth w-full pl-10 pr-3.5 py-2.5"
                    placeholder="Enter 6-digit code"
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs theme-text-secondary mt-1">
                  Check your email for the verification code
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-get-started flex-1 px-5 py-2.5 text-white font-bold rounded-lg group text-sm"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Account'}
                    {!isLoading && <ArrowRight className="ml-1.5 w-4 h-4 group-hover-translate" />}
                  </span>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isLoading}
                  className="text-sm transition-colors hover:opacity-80"
                  style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                >
                  Resend verification code
                </button>
                <button
                  type="button"
                  onClick={() => setStep('signIn')}
                  className="text-sm theme-text-secondary hover:theme-text-primary transition-colors"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>

        {step === 'signIn' && (
          <footer className="text-center mt-3">
            <div className="luxury-fade-in" style={{ animationDelay: '0.4s' }}>
              <Link
                href="/"
                className="text-sm theme-text-secondary hover:theme-text-primary transition-colors"
              >
                ← Back to home
              </Link>
            </div>
          </footer>
        )}
      </div>
    </main>
  )
}
