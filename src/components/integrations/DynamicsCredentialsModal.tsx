// src/components/integrations/DynamicsCredentialsModal.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Eye, EyeOff, Loader2, AlertTriangle, HelpCircle, CheckCircle2, User, Lock } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface ConnectedSchema {
  schema_name: string
  company_name: string
}

interface DynamicsCredentialsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (schemaName: string, displayName: string) => void
  /** Already-connected BC schemas to display in the modal */
  connectedSchemas?: ConnectedSchema[]
}

export default function DynamicsCredentialsModal({
  isOpen,
  onClose,
  onSuccess,
  connectedSchemas,
}: DynamicsCredentialsModalProps) {
  const { mounted } = useTheme()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  const usernameInputRef = useRef<HTMLInputElement>(null)

  // Focus username input when modal opens
  useEffect(() => {
    if (isOpen && usernameInputRef.current) {
      setTimeout(() => usernameInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Clear form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUsername('')
      setPassword('')
      setError(null)
      setRetryAfter(null)
      setShowPassword(false)
    }
  }, [isOpen])

  // Countdown timer for locked accounts
  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      const timer = setInterval(() => {
        setRetryAfter((prev) => {
          if (prev && prev > 1) return prev - 1
          setError(null)
          return null
        })
      }, 60000)
      return () => clearInterval(timer)
    }
  }, [retryAfter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/providers/dynamics/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        onSuccess(data.schema_name, data.display_name)
        onClose()
      } else if (response.status === 429) {
        setRetryAfter(data.retry_after_minutes || 30)
        setError(data.error || 'Account temporarily locked. Please try again later.')
      } else {
        setError(data.error || 'Invalid username or password')
      }
    } catch (err) {
      setError('Connection failed. Please check your internet and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  if (!mounted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dynamics-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden border"
        style={{
          background: 'rgb(var(--theme-card-bg-rgb))',
          borderColor: 'var(--theme-card-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <svg
                className="w-6 h-6"
                viewBox="0 0 23 23"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0 0h11v11H0z" fill="#F25022" />
                <path d="M12 0h11v11H12z" fill="#7FBA00" />
                <path d="M0 12h11v11H0z" fill="#00A4EF" />
                <path d="M12 12h11v11H12z" fill="#FFB900" />
              </svg>
            </div>
            <div>
              <h2
                id="dynamics-modal-title"
                className="text-xl font-light italic theme-text-primary"
                style={{ fontFamily: 'var(--font-eb-garamond)' }}
              >
                Connect Dynamics 365
              </h2>
              <p className="text-xs theme-text-secondary">Business Central</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-6">
          {/* Already Connected Schemas */}
          {connectedSchemas && connectedSchemas.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs font-medium text-emerald-500 mb-2">
                Connected ({connectedSchemas.length})
              </p>
              <div className="space-y-1">
                {connectedSchemas.map((s) => (
                  <div
                    key={s.schema_name}
                    className="flex items-center gap-2 text-xs text-emerald-500"
                  >
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                    <span className="font-medium">{s.company_name}</span>
                    <span className="opacity-60">({s.schema_name})</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-2 theme-text-secondary">
                Enter credentials below to connect another data source.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/30">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
                {retryAfter && (
                  <p className="text-xs mt-1 opacity-80">
                    Try again in {retryAfter} minute{retryAfter !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Username Input */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary" />
            <input
              ref={usernameInputRef}
              id="bc-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              disabled={isLoading || !!retryAfter}
              className="zenith-input-auth w-full pl-9 pr-3.5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              autoComplete="username"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary" />
            <input
              id="bc-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={isLoading || !!retryAfter}
              className="zenith-input-auth w-full pl-9 pr-12 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-secondary hover:theme-text-primary transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Help Text */}
          <div className="flex items-start gap-2 text-xs theme-text-secondary">
            <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              Credentials are provided by your administrator. Contact your account manager if you
              need assistance.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim() || !!retryAfter}
            className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              backgroundColor: '#00A4EF',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-7 py-4 border-t" style={{ borderColor: 'var(--theme-card-border)' }}>
          <p className="text-xs text-center theme-text-secondary">
            Your data is synced securely via Fivetran to a dedicated Redshift schema.
          </p>
        </div>
      </div>
    </div>
  )
}
