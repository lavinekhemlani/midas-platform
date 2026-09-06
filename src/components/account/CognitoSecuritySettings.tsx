'use client'

import React, { useState } from 'react'
import { updatePassword } from 'aws-amplify/auth'
import {
  Loader2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  LockKeyholeOpen,
  LockKeyhole,
  Lock,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { logger } from '@/lib/logger'

interface CognitoSecuritySettingsProps {
  showPasswordChange?: boolean
  showMfa?: boolean
  minPasswordLength?: number
  requireUppercase?: boolean
  requireLowercase?: boolean
  requireNumber?: boolean
  onPasswordChangeSuccess?: () => void
  onPasswordChangeError?: (error: Error) => void
  passwordChangeOptions?: {
    title?: string
    description?: string
    currentPasswordLabel?: string
    newPasswordLabel?: string
    confirmPasswordLabel?: string
    buttonText?: string
  }
  mfaOptions?: {
    title?: string
    description?: string
  }
  isOAuthUser?: boolean
  oauthProvider?: string
}

export default function CognitoSecuritySettings({
  showPasswordChange = true,
  showMfa = true,
  minPasswordLength = 8,
  requireUppercase = true,
  requireLowercase = true,
  requireNumber = true,
  onPasswordChangeSuccess,
  onPasswordChangeError,
  passwordChangeOptions = {},
  mfaOptions = {},
  isOAuthUser = false,
  oauthProvider,
}: CognitoSecuritySettingsProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Helper function to get provider display name
  const getProviderDisplayName = () => {
    if (!oauthProvider) return 'social login provider'
    const providerName = oauthProvider.toLowerCase()
    if (providerName.includes('google')) return 'Google'
    return oauthProvider
  }

  const validatePasswordComplexity = (password: string) => {
    const errors = []
    if (requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('one uppercase letter')
    }
    if (requireLowercase && !/[a-z]/.test(password)) {
      errors.push('one lowercase letter')
    }
    if (requireNumber && !/[0-9]/.test(password)) {
      errors.push('one number')
    }
    return errors
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword.length < minPasswordLength) {
      setError(`Password must be at least ${minPasswordLength} characters long.`)
      return
    }

    const complexityErrors = validatePasswordComplexity(newPassword)
    if (complexityErrors.length > 0) {
      setError(`Password must contain at least ${complexityErrors.join(', ')}.`)
      return
    }

    setIsLoading(true)
    try {
      await updatePassword({ oldPassword, newPassword })
      setSuccessMessage('Password updated successfully!')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      if (onPasswordChangeSuccess) {
        onPasswordChangeSuccess()
      }
    } catch (err) {
      logger.error('Error updating password:', { error: err, component: 'CognitoSecuritySettings' })
      const error = err instanceof Error ? err : new Error('An unknown error occurred.')
      if (error.name === 'NotAuthorizedException') {
        setError('Incorrect current password. Please try again.')
      } else {
        setError(error.message)
      }
      if (onPasswordChangeError) {
        onPasswordChangeError(error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="">
      {showPasswordChange && (
        <div className="space-y-6">
          {/* Show OAuth info message if user signed in with OAuth */}
          {isOAuthUser ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/30">
                <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Password Management Not Available</p>
                  <p className="text-sm opacity-90">
                    You signed in using {getProviderDisplayName()}. Your password is managed by{' '}
                    {getProviderDisplayName()} and cannot be changed here.
                  </p>
                  {oauthProvider?.toLowerCase().includes('google') && (
                    <p className="text-sm opacity-90 mt-2">
                      To manage your account security, visit your{' '}
                      <a
                        href="https://myaccount.google.com/security"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-300 transition-colors"
                      >
                        Google Account Security settings
                      </a>
                      .
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {successMessage && (
                <div className="mb-4 p-3 bg-emerald-500/10 text-emerald-400 rounded-md text-sm border border-emerald-500/30">
                  {successMessage}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30">
                  {error}
                </div>
              )}
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1 relative">
                  <Label htmlFor="oldPassword">
                    {passwordChangeOptions.currentPasswordLabel || 'Current Password'}
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-500">
                      <LockKeyholeOpen className="h-4 w-4" />
                    </div>
                    <Input
                      id="oldPassword"
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                      className="zenith-input pl-10 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="password-eye text-slate-500 my-auto absolute right-0 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                    >
                      {showOldPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 relative">
                  <Label htmlFor="newPassword">
                    {passwordChangeOptions.newPasswordLabel || 'New Password'}
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-500">
                      <LockKeyhole className="h-4 w-4" />
                    </div>
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="zenith-input pl-10 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="password-eye text-slate-500 my-auto absolute right-0 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 relative">
                  <Label htmlFor="confirmPassword">
                    {passwordChangeOptions.confirmPasswordLabel || 'Confirm New Password'}
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="zenith-input pl-10 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="password-eye text-slate-500 my-auto absolute right-0 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isLoading} className="btn-get-started">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {passwordChangeOptions.buttonText || 'Update Password'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
      {/* {showMfa && (
        <Card className="border-none shadow-none bg-transparent opacity-60">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              {mfaOptions.title || 'Multi-Factor Authentication (MFA)'}
            </CardTitle>
            <CardDescription>
              {mfaOptions.description || '(UI Coming Soon)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-sm theme-text-secondary">
              Functionality to set up an authenticator app or other MFA methods will be available here in a future update.
            </p>
          </CardContent>
        </Card>
      )} */}
    </div>
  )
}
