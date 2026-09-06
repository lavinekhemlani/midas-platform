'use client'

import Image from 'next/image'
import { EB_Garamond } from 'next/font/google'
import { cn } from '@/lib/utils'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

interface UserAvatarProps {
  imageUrl?: string | null
  firstName?: string | null
  email?: string | null
  size?: 'sm' | 'md' | 'lg'
  showNotificationIndicator?: boolean
  hasUnreadNotifications?: boolean
  className?: string
  ringClassName?: string
  useThemeColors?: boolean // Use amber/gold theme colors instead of violet/indigo
}

export default function UserAvatar({
  imageUrl,
  firstName,
  email,
  size = 'md',
  showNotificationIndicator = false,
  hasUnreadNotifications = false,
  className,
  ringClassName,
  useThemeColors = false,
}: UserAvatarProps) {
  const userInitial = firstName ? firstName.charAt(0) : email ? email.charAt(0) : 'U'

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  const imageSizes = {
    sm: 28,
    md: 36,
    lg: 48,
  }

  const notificationSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  return (
    <div className={cn('flex items-center relative', className)}>
      {imageUrl ? (
        <div className="relative">
          <Image
            src={imageUrl}
            alt={`${firstName || 'User'}'s avatar`}
            width={imageSizes[size]}
            height={imageSizes[size]}
            className={cn(
              'rounded-full relative z-10 ring-2 ring-amber-500/30',
              sizeClasses[size],
              ringClassName
            )}
          />
          {showNotificationIndicator && hasUnreadNotifications && (
            <div
              className={cn(
                'absolute -top-1 -right-1 bg-red-500 rounded-full animate-pulse z-20',
                notificationSizes[size]
              )}
            />
          )}
        </div>
      ) : (
        <div className="relative">
          <div
            className={cn(
              'rounded-full flex items-center justify-center font-semibold shadow-md relative z-10 ring-2',
              useThemeColors
                ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white ring-amber-500/30'
                : 'bg-gradient-to-br from-violet-700 to-indigo-900 text-white ring-indigo-500/30',
              sizeClasses[size],
              ebGaramond.className,
              ringClassName
            )}
          >
            {userInitial.toUpperCase()}
          </div>
          {showNotificationIndicator && hasUnreadNotifications && (
            <div
              className={cn(
                'absolute -top-1 -right-1 bg-red-500 rounded-full animate-pulse z-20',
                notificationSizes[size]
              )}
            />
          )}
        </div>
      )}
    </div>
  )
}
