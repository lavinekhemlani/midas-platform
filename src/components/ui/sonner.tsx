'use client'

import { useTheme } from '@/hooks/useTheme'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  // Map your custom themes to sonner-compatible themes
  const getSonnerTheme = (): ToasterProps['theme'] => {
    switch (theme) {
      case 'light':
        return 'light'
      case 'dark':
      case 'dark':
        return 'dark'
      default:
        return 'dark'
    }
  }

  // Get theme-specific CSS variables
  const getThemeStyles = (): React.CSSProperties => {
    return {
      '--normal-bg': 'var(--theme-card-bg)',
      '--normal-border': 'var(--theme-card-border)',
      '--normal-text': 'var(--theme-text-primary)',
      '--success-bg': theme === 'light' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.15)',
      '--success-border': theme === 'light' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.4)',
      '--success-text': theme === 'light' ? '#15803d' : '#4ade80',
      '--error-bg': theme === 'light' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.15)',
      '--error-border': theme === 'light' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.4)',
      '--error-text': theme === 'light' ? '#dc2626' : '#f87171',
      '--warning-bg': theme === 'light' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.15)',
      '--warning-border': theme === 'light' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.4)',
      '--warning-text': theme === 'light' ? '#d97706' : '#fbbf24',
      '--info-bg': theme === 'light' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.15)',
      '--info-border': theme === 'light' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.4)',
      '--info-text': theme === 'light' ? '#2563eb' : '#60a5fa',
    } as React.CSSProperties
  }

  return (
    <Sonner
      theme={getSonnerTheme()}
      className="toaster group"
      style={getThemeStyles()}
      toastOptions={{
        style: {
          background: 'var(--normal-bg)',
          border: '1px solid var(--normal-border)',
          color: 'var(--normal-text)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '500',
        },
        className: 'toast-item',
      }}
      position="top-center"
      richColors
      closeButton
      {...props}
    />
  )
}

export { Toaster }
