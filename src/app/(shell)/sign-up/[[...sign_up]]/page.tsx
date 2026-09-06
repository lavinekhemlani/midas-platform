// src/app/(shell)/sign-up/[[...sign_up]]/page.tsx
'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  signUp,
  confirmSignUp,
  signIn,
  signInWithRedirect,
  getCurrentUser,
  signOut,
} from 'aws-amplify/auth'
import {
  User,
  Mail,
  Lock,
  Building,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Shield,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react'
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
import { trackSignupStarted, trackOTPValidated } from '@/lib/analytics/gtm'

export default function SignUpPage() {
  const [step, setStep] = useState<'signUp' | 'confirmSignUp'>('signUp')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { theme } = useTheme()

  // Form state for both steps
  const [formFields, setFormFields] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    confirmationCode: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Password validation
  const passwordValidation = useMemo(() => {
    const password = formFields.password
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      // special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
  }, [formFields.password])

  // Track which validated rules should be visible and their fade state
  const [visibleRules, setVisibleRules] = useState({
    length: { visible: false, fading: false },
    uppercase: { visible: false, fading: false },
    lowercase: { visible: false, fading: false },
    number: { visible: false, fading: false },
  })

  // Track previous validation state to detect changes
  const [prevValidation, setPrevValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  })

  const isPasswordValid = Object.values(passwordValidation).every(Boolean)

  // Effect to detect changes in validation state and show/hide rules
  useEffect(() => {
    Object.entries(passwordValidation).forEach(([rule, isValid]) => {
      const ruleKey = rule as keyof typeof passwordValidation
      const prevIsValid = prevValidation[ruleKey]

      // Show rule when its state changes (either becomes valid or invalid)
      if (isValid !== prevIsValid) {
        // Make the rule visible when its state changes
        setVisibleRules((prev) => ({
          ...prev,
          [rule]: { visible: true, fading: false },
        }))

        // If it's valid, set up the fade out
        if (isValid) {
          const fadeTimer = setTimeout(() => {
            setVisibleRules((prev) => ({
              ...prev,
              [rule]: { visible: true, fading: true },
            }))

            // Then hide after fade animation completes
            const hideTimer = setTimeout(() => {
              setVisibleRules((prev) => ({
                ...prev,
                [rule]: { visible: false, fading: false },
              }))
            }, 500) // Duration of fade-out animation

            return () => clearTimeout(hideTimer)
          }, 1000) // Start fading after 1 second

          return () => clearTimeout(fadeTimer)
        }
      }
    })

    // Update previous validation state
    setPrevValidation(passwordValidation)
  }, [passwordValidation, prevValidation])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormFields((prev) => ({ ...prev, [name]: value }))
  }

  // Handle blur event to show unvalidated rules
  const handlePasswordBlur = () => {
    // Show all unvalidated rules when user tabs out
    Object.entries(passwordValidation).forEach(([rule, isValid]) => {
      if (!isValid) {
        setVisibleRules((prev) => ({
          ...prev,
          [rule]: { visible: true, fading: false },
        }))
      }
    })
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (formFields.password !== formFields.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (!isPasswordValid) {
      setError('Password does not meet complexity requirements')
      setIsLoading(false)
      return
    }

    try {
      // Track signup initiation
      trackSignupStarted('email')

      const { nextStep } = await signUp({
        username: formFields.email,
        password: formFields.password,
        options: {
          userAttributes: {
            email: formFields.email,
            given_name: formFields.firstName,
            family_name: formFields.lastName,
          },
          autoSignIn: true,
        },
      })

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setStep('confirmSignUp')
      }
    } catch (err: any) {
      console.error('Sign-up error:', err)
      setError(err.message || 'An unexpected error occurred during sign-up.')
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
        username: formFields.email,
        confirmationCode: formFields.confirmationCode,
      })

      if (isSignUpComplete) {
        // Track OTP validation success
        trackOTPValidated(formFields.email)

        // Automatically sign in the user after confirmation
        const signInResult = await signIn({
          username: formFields.email,
          password: formFields.password,
        })

        // Set auth cookies using the unified auth helper
        const { AuthCookies } = await import('@/lib/auth')
        await AuthCookies.set()

        // Small delay to ensure cookies are set and auth state is updated
        await new Promise((resolve) => setTimeout(resolve, 500))

        console.log('Sign-up confirmed and user signed in, redirecting...')
        router.push('/onboarding/setup') // Start the onboarding flow
      }
    } catch (err: any) {
      console.error('Confirmation error:', err)
      setError(err.message || 'An unexpected error occurred during confirmation.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      // Check if there's already a signed-in user and sign them out first
      try {
        const user = await getCurrentUser()
        if (user) {
          console.log('User already signed in, signing out first...')
          await signOut()
        }
      } catch (e) {
        // No user signed in, continue
      }

      // Track Google signup initiation
      trackSignupStarted('google')

      await signInWithRedirect({ provider: 'Google' })
    } catch (err: any) {
      console.error('Google sign-up error:', err)

      // Handle specific error for already signed in user
      if (err.name === 'UserAlreadyAuthenticatedException') {
        // Sign out the existing user and retry
        try {
          await signOut()
          await signInWithRedirect({ provider: 'Google' })
        } catch (retryErr: any) {
          setError(retryErr.message || 'An unexpected error occurred with Google sign-up.')
        }
      } else {
        setError(err.message || 'An unexpected error occurred with Google sign-up.')
      }
    }
  }

  return (
    <main
      className={`flex-1 flex flex-col items-center justify-start md:justify-center px-5 pt-10 md:pt-0 pb-10 relative z-20 ${ebGaramond.variable} ${dmSans.variable}`}
      style={{ fontFamily: 'var(--font-dm-sans)' }}
    >
      <div className="w-full max-w-lg mx-auto">
        {step === 'signUp' ? (
          <>
            <header className="text-center mb-10 luxury-fade-in">
              <h1
                className="text-4xl md:text-5xl theme-text-primary mb-3.5 leading-tight font-light"
                style={{ fontFamily: 'var(--font-eb-garamond)' }}
              >
                Join <span className="midas-text-gradient italic px-[0.15em]">Midas</span> Today
              </h1>
              <p className="text-base theme-text-secondary">
                Transform your financial operations with AI-driven insights
              </p>
            </header>

            <div className="zenith-form p-7 luxury-fade-in" style={{ animationDelay: '0.2s' }}>
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30 flex items-center gap-2">
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              <div className="max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={isLoading}
                  className="btn-google-signin w-full flex items-center justify-center px-5 py-2.5 rounded-lg group"
                >
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
                </button>
              </div>

              <div className="flex items-center mt-10 mb-8 max-w-xs mx-auto">
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: 'var(--theme-input-border)' }}
                ></div>
                <span className="px-4 text-sm theme-text-secondary">Or continue with email</span>
                <div
                  className="flex-1 h-px"
                  style={{ backgroundColor: 'var(--theme-input-border)' }}
                ></div>
              </div>

              <form onSubmit={handleSignUp} className="space-y-5 max-w-xs mx-auto">
                <div className="zenith-form-row two-columns">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={formFields.firstName}
                      onChange={handleInputChange}
                      className="zenith-input-auth w-full pl-10 pr-3.5 py-2.5"
                      placeholder="First Name"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={formFields.lastName}
                      onChange={handleInputChange}
                      className="zenith-input-auth w-full pl-10 pr-3.5 py-2.5"
                      placeholder="Last Name"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="zenith-form-group">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formFields.email}
                      onChange={handleInputChange}
                      className="zenith-input-auth w-full pl-10 pr-3.5 py-2.5"
                      placeholder="Email"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="zenith-form-group">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formFields.password}
                      onChange={handleInputChange}
                      onBlur={handlePasswordBlur}
                      className="zenith-input-auth w-full pl-10 pr-12 py-2.5"
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
                  {formFields.password && (
                    <div className="mt-2 space-y-1">
                      {visibleRules.length.visible && (
                        <div
                          className={`flex items-center gap-2 text-xs transition-opacity duration-500 ${visibleRules.length.fading ? 'opacity-0' : 'opacity-100'}`}
                        >
                          {passwordValidation.length ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <X className="w-3 h-3 text-red-400" />
                          )}
                          <span
                            className={
                              passwordValidation.length ? 'text-green-400' : 'theme-text-secondary'
                            }
                          >
                            At least 8 characters
                          </span>
                        </div>
                      )}
                      {visibleRules.uppercase.visible && (
                        <div
                          className={`flex items-center gap-2 text-xs transition-opacity duration-500 ${visibleRules.uppercase.fading ? 'opacity-0' : 'opacity-100'}`}
                        >
                          {passwordValidation.uppercase ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <X className="w-3 h-3 text-red-400" />
                          )}
                          <span
                            className={
                              passwordValidation.uppercase
                                ? 'text-green-400'
                                : 'theme-text-secondary'
                            }
                          >
                            One uppercase letter
                          </span>
                        </div>
                      )}
                      {visibleRules.lowercase.visible && (
                        <div
                          className={`flex items-center gap-2 text-xs transition-opacity duration-500 ${visibleRules.lowercase.fading ? 'opacity-0' : 'opacity-100'}`}
                        >
                          {passwordValidation.lowercase ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <X className="w-3 h-3 text-red-400" />
                          )}
                          <span
                            className={
                              passwordValidation.lowercase
                                ? 'text-green-400'
                                : 'theme-text-secondary'
                            }
                          >
                            One lowercase letter
                          </span>
                        </div>
                      )}
                      {visibleRules.number.visible && (
                        <div
                          className={`flex items-center gap-2 text-xs transition-opacity duration-500 ${visibleRules.number.fading ? 'opacity-0' : 'opacity-100'}`}
                        >
                          {passwordValidation.number ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <X className="w-3 h-3 text-red-400" />
                          )}
                          <span
                            className={
                              passwordValidation.number ? 'text-green-400' : 'theme-text-secondary'
                            }
                          >
                            One number
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="zenith-form-group">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formFields.confirmPassword}
                      onChange={handleInputChange}
                      className="zenith-input-auth w-full pl-10 pr-12 py-2.5"
                      placeholder="Confirm Password"
                      disabled={isLoading}
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
                  {formFields.confirmPassword &&
                    formFields.password !== formFields.confirmPassword && (
                      <p className="mt-1.5 text-xs text-red-400">Passwords do not match</p>
                    )}
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-get-started w-full px-5 py-2.5 text-white font-bold rounded-lg group text-sm"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
                      {!isLoading && (
                        <ArrowRight className="ml-1.5 w-4 h-4 group-hover-translate" />
                      )}
                    </span>
                  </button>

                  <p className="theme-text-secondary text-sm text-center mt-3">
                    Already have an account?{' '}
                    <Link
                      href="/sign-in"
                      className="font-semibold transition-colors hover:opacity-80"
                      style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="zenith-form p-7 luxury-fade-in">
            <header className="text-center mb-6">
              <h1 className="text-xl font-bold theme-text-primary">Check your email</h1>
              <p className="text-sm theme-text-secondary mt-2">
                We've sent a confirmation code to{' '}
                <span className="font-medium text-amber-400">{formFields.email}</span>. Please enter
                it below.
              </p>
            </header>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30 flex items-center gap-2">
                <AlertTriangle size={16} /> {error}
              </div>
            )}
            <form onSubmit={handleConfirmSignUp} className="space-y-5">
              <div className="zenith-form-group">
                <label htmlFor="confirmationCode" className="zenith-label required">
                  Confirmation Code
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                  <input
                    id="confirmationCode"
                    name="confirmationCode"
                    type="text"
                    required
                    value={formFields.confirmationCode}
                    onChange={handleInputChange}
                    className="zenith-input-auth w-full pl-10 pr-3.5 text-center tracking-[0.5em] font-mono text-lg py-2.5"
                    placeholder="••••••"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-get-started w-full px-5 py-2.5 text-white font-bold rounded-lg group text-sm"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm & Sign In'}
                  {!isLoading && <ArrowRight className="ml-1.5 w-4 h-4 group-hover-translate" />}
                </span>
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
