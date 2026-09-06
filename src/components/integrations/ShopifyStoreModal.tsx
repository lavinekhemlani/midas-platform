// src/components/integrations/ShopifyStoreModal.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Loader2,
  Store,
  Eye,
  EyeOff,
  AlertTriangle,
  HelpCircle,
  User,
  Lock,
  Settings,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

type AuthMode = 'faux' | 'manual'

interface ShopifyStoreModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called on successful faux login — triggers session refresh */
  onFauxSuccess: (shopDomain: string, displayName: string) => void
  /** Called when manual mode submits — triggers OAuth flow with provided credentials */
  onManualConnect: (shopDomain: string, clientId: string, clientSecret: string) => void
}

export default function ShopifyStoreModal({
  isOpen,
  onClose,
  onFauxSuccess,
  onManualConnect,
}: ShopifyStoreModalProps) {
  const { mounted } = useTheme()
  const [mode, setMode] = useState<AuthMode>('faux')

  // Faux login state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  // Manual mode state
  const [shopDomain, setShopDomain] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  // Shared state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Focus first input when modal opens or mode changes
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100)
    }
  }, [isOpen, mode])

  // Clear form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMode('faux')
      setUsername('')
      setPassword('')
      setShowPassword(false)
      setShopDomain('')
      setClientId('')
      setClientSecret('')
      setShowSecret(false)
      setError(null)
      setRetryAfter(null)
      setIsLoading(false)
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

  const normalizeDomain = (input: string): string => {
    let domain = input.trim().toLowerCase()
    domain = domain.replace(/^https?:\/\//, '')
    domain = domain.split('/')[0]
    if (!domain.endsWith('.myshopify.com')) {
      domain = domain.replace(/\.myshopify$/, '.myshopify.com')
      if (!domain.includes('.myshopify.com')) {
        domain = `${domain}.myshopify.com`
      }
    }
    return domain
  }

  // --- Faux login submit ---
  const handleFauxSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }

    setIsLoading(true)

    try {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

      const response = await fetch('/api/providers/shopify/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          redirect_uri: currentPath,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success && data.loginUrl) {
        // Redirect to Shopify OAuth (using stored credentials from DynamoDB)
        window.location.href = data.loginUrl
      } else if (response.status === 429) {
        setRetryAfter(data.retry_after_minutes || 30)
        setError(data.error || 'Account temporarily locked. Please try again later.')
      } else {
        setError(data.error || 'Invalid username or password')
      }
    } catch {
      setError('Connection failed. Please check your internet and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // --- Manual mode submit ---
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!shopDomain.trim()) {
      setError('Please enter your store name')
      return
    }
    if (!clientId.trim()) {
      setError('Please enter your Client ID')
      return
    }
    if (!clientSecret.trim()) {
      setError('Please enter your Client Secret')
      return
    }

    const normalized = normalizeDomain(shopDomain)
    const storeSlug = normalized.replace('.myshopify.com', '')
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(storeSlug) && storeSlug.length > 1) {
      setError('Store name can only contain lowercase letters, numbers, and hyphens')
      return
    }
    if (storeSlug.length < 2) {
      setError('Store name is too short')
      return
    }

    setIsLoading(true)
    onManualConnect(normalized, clientId.trim(), clientSecret.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const switchMode = () => {
    setError(null)
    setRetryAfter(null)
    setMode(mode === 'faux' ? 'manual' : 'faux')
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
      aria-labelledby="shopify-modal-title"
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
            <Store className="w-6 h-6" style={{ color: '#95BF47' }} />
            <div>
              <h2
                id="shopify-modal-title"
                className="text-xl font-light italic theme-text-primary"
                style={{ fontFamily: 'var(--font-eb-garamond)' }}
              >
                Connect Shopify
              </h2>
              <p className="text-xs theme-text-secondary">
                {mode === 'faux'
                  ? 'Enter your credentials'
                  : 'Enter your store and app credentials'}
              </p>
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

        {/* ─── Faux Login Mode ─── */}
        {mode === 'faux' && (
          <form onSubmit={handleFauxSubmit} className="px-7 pb-7 space-y-6">
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

            {/* Username */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary" />
              <input
                ref={firstInputRef}
                id="shopify-faux-username"
                name="shopify_faux_username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError(null)
                }}
                placeholder="Username"
                disabled={isLoading || !!retryAfter}
                autoComplete="one-time-code"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className="zenith-input-auth w-full pl-9 pr-3.5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary" />
              <input
                id="shopify-faux-password"
                name="shopify_faux_password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                placeholder="Password"
                disabled={isLoading || !!retryAfter}
                autoComplete="one-time-code"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className="zenith-input-auth w-full pl-9 pr-12 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-secondary hover:theme-text-primary transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Help Text + Tooltip */}
            <div className="flex items-start gap-1.5 text-xs theme-text-secondary">
              <p>Credentials are provided by your administrator.</p>
              <div className="group relative">
                <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 cursor-help" />
                <div
                  className="hidden group-hover:block absolute bottom-full right-0 mb-2 w-64 p-2.5 rounded-lg text-[11px] theme-text-secondary border shadow-lg z-10"
                  style={{
                    background: 'rgb(var(--theme-card-bg-rgb))',
                    borderColor: 'var(--theme-card-border)',
                  }}
                >
                  You will be prompted to sign in to your Shopify store and install the app. Contact
                  the Midas team if you need assistance.
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim() || !!retryAfter}
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#95BF47' }}
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
        )}

        {/* ─── Manual Mode ─── */}
        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="px-7 pb-7 space-y-5">
            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/30">
                <p>{error}</p>
              </div>
            )}

            {/* Store name input */}
            <div>
              <label
                htmlFor="shopify-manual-domain"
                className="block text-sm font-medium theme-text-secondary mb-1.5"
              >
                Store name
              </label>
              <div className="flex items-stretch">
                <div className="relative flex-1">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                  <input
                    ref={mode === 'manual' ? firstInputRef : undefined}
                    id="shopify-manual-domain"
                    name="shopify_store_domain"
                    type="text"
                    value={shopDomain}
                    onChange={(e) => {
                      setShopDomain(e.target.value)
                      setError(null)
                    }}
                    placeholder="my-store"
                    disabled={isLoading}
                    autoComplete="one-time-code"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                    className="zenith-input-auth w-full pl-9 pr-3.5 py-2.5 rounded-r-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <span
                  className="inline-flex items-center px-3 py-2.5 text-sm theme-text-secondary whitespace-nowrap rounded-r-lg border border-l-0"
                  style={{
                    borderColor: 'var(--theme-card-border)',
                    background: 'rgba(var(--theme-card-bg-rgb), 0.5)',
                  }}
                >
                  .myshopify.com
                </span>
              </div>
            </div>

            {/* Client ID */}
            <div>
              <label
                htmlFor="shopify-manual-client-id"
                className="block text-sm font-medium theme-text-secondary mb-1.5"
              >
                Client ID
              </label>
              <input
                id="shopify-manual-client-id"
                name="shopify_app_client_id"
                type="text"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value)
                  setError(null)
                }}
                placeholder="Your app's Client ID"
                disabled={isLoading}
                autoComplete="one-time-code"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className="zenith-input-auth w-full px-3.5 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              />
            </div>

            {/* Client Secret */}
            <div>
              <label
                htmlFor="shopify-manual-client-secret"
                className="block text-sm font-medium theme-text-secondary mb-1.5"
              >
                Client Secret
              </label>
              <div className="relative">
                <input
                  id="shopify-manual-client-secret"
                  name="shopify_app_client_secret"
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => {
                    setClientSecret(e.target.value)
                    setError(null)
                  }}
                  placeholder="Your app's Client Secret"
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  className="zenith-input-auth w-full pl-3.5 pr-10 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 theme-text-secondary hover:theme-text-primary transition-colors"
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !shopDomain.trim() || !clientId.trim() || !clientSecret.trim()}
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#95BF47' }}
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
        )}

        {/* Footer — mode switcher */}
        <div className="px-7 py-4 border-t" style={{ borderColor: 'var(--theme-card-border)' }}>
          <div className="group relative flex flex-col items-center">
            <button
              type="button"
              onClick={switchMode}
              className="flex items-center justify-center gap-1.5 text-xs theme-text-secondary hover:theme-text-primary transition-colors"
            >
              <Settings className="w-3 h-3" />
              {mode === 'faux'
                ? 'Connect with your own app credentials'
                : 'Use provided credentials'}
            </button>
            {mode === 'faux' && (
              <div
                className="hidden group-hover:block absolute bottom-full mb-2 w-64 p-2.5 rounded-lg text-[11px] theme-text-secondary border shadow-lg z-10"
                style={{
                  background: 'rgb(var(--theme-card-bg-rgb))',
                  borderColor: 'var(--theme-card-border)',
                }}
              >
                You will need to create a custom app in your Shopify Partners Dashboard for this
                method. Contact the Midas team for assistance.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
