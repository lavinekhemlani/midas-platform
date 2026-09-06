'use client'

import React, { useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useNotifications } from '@/contexts/NotificationContext'
import { logger } from '@/lib/logger'

export default function TestNotificationButton() {
  const [loading, setLoading] = useState(false)
  const { refresh } = useNotifications()

  const createTestNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to create test notifications')
      }

      const data = await response.json()

      toast.success(`Created ${data.count} test notifications!`, {
        description: 'Check your notification bell icon to see them',
      })

      // Refresh notifications to show the new ones
      setTimeout(() => {
        refresh()
      }, 500)
    } catch (error) {
      logger.error('Error creating test notifications:', {
        error,
        component: 'TestNotificationButton',
      })
      toast.error('Failed to create test notifications', {
        description: 'Please check the console for details',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={createTestNotifications}
      disabled={loading}
      className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
      <span className="text-sm font-medium">
        {loading ? 'Creating...' : 'Create Test Notifications'}
      </span>
    </button>
  )
}
