'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Notification,
  NotificationStats,
  NotificationFilter,
  NotificationPreferences,
} from '@/lib/types/notification'
import { logger } from '@/lib/logger'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  stats: NotificationStats | null
  preferences: NotificationPreferences | null
  loading: boolean
  error: string | null

  fetchNotifications: (filter?: NotificationFilter) => Promise<void>
  fetchStats: () => Promise<void>
  fetchPreferences: () => Promise<void>

  markAsRead: (notificationIds: string[]) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  archiveNotification: (notificationId: string) => Promise<void>

  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>

  showToast: (notification: Notification) => void
  refresh: () => void
}

export const NotificationContext = createContext<NotificationContextType | null>(null)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)

  const fetchNotifications = useCallback(async (filter?: NotificationFilter) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filter?.type) params.append('type', filter.type.join(','))
      if (filter?.priority) params.append('priority', filter.priority.join(','))
      if (filter?.status) params.append('status', filter.status.join(','))
      if (filter?.limit) params.append('limit', filter.limit.toString())
      if (filter?.date_from) params.append('date_from', filter.date_from.toString())
      if (filter?.date_to) params.append('date_to', filter.date_to.toString())

      const response = await fetch(`/api/notifications?${params}`)
      if (!response.ok) throw new Error('Failed to fetch notifications')

      const data = await response.json()
      setNotifications(data.notifications || [])
      setLastFetch(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      logger.error('Error fetching notifications', { error: err, component: 'NotificationContext' })
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/stats')
      if (!response.ok) throw new Error('Failed to fetch notification stats')

      const data = await response.json()
      setStats(data)
    } catch (err) {
      logger.error('Error fetching notification stats', {
        error: err,
        component: 'NotificationContext',
      })
    }
  }, [])

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/preferences')
      if (!response.ok) throw new Error('Failed to fetch notification preferences')

      const data = await response.json()
      setPreferences(data)
    } catch (err) {
      logger.error('Error fetching notification preferences', {
        error: err,
        component: 'NotificationContext',
      })
    }
  }, [])

  const markAsRead = useCallback(
    async (notificationIds: string[]) => {
      try {
        const response = await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_ids: notificationIds }),
        })

        if (!response.ok) throw new Error('Failed to mark notifications as read')

        setNotifications((prev) =>
          prev.map((n) =>
            notificationIds.includes(n.notification_id)
              ? { ...n, status: 'read' as const, read_at: Date.now() }
              : n
          )
        )

        await fetchStats()
      } catch (err) {
        logger.error('Error marking notifications as read', {
          error: err,
          component: 'NotificationContext',
        })
        toast.error('Failed to mark notifications as read')
      }
    },
    [fetchStats]
  )

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      })

      if (!response.ok) throw new Error('Failed to mark all notifications as read')

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'read' as const, read_at: Date.now() }))
      )

      await fetchStats()
      toast.success('All notifications marked as read')
    } catch (err) {
      logger.error('Error marking all notifications as read', {
        error: err,
        component: 'NotificationContext',
      })
      toast.error('Failed to mark all notifications as read')
    }
  }, [fetchStats])

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: 'DELETE',
        })

        if (!response.ok) throw new Error('Failed to delete notification')

        setNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId))
        await fetchStats()
        toast.success('Notification deleted')
      } catch (err) {
        logger.error('Error deleting notification', {
          error: err,
          component: 'NotificationContext',
        })
        toast.error('Failed to delete notification')
      }
    },
    [fetchStats]
  )

  const archiveNotification = useCallback(
    async (notificationId: string) => {
      try {
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'archived' }),
        })

        if (!response.ok) throw new Error('Failed to archive notification')

        setNotifications((prev) =>
          prev.map((n) =>
            n.notification_id === notificationId ? { ...n, status: 'archived' as const } : n
          )
        )

        await fetchStats()
        toast.success('Notification archived')
      } catch (err) {
        logger.error('Error archiving notification', {
          error: err,
          component: 'NotificationContext',
        })
        toast.error('Failed to archive notification')
      }
    },
    [fetchStats]
  )

  const updatePreferences = useCallback(
    async (newPreferences: Partial<NotificationPreferences>) => {
      try {
        const response = await fetch('/api/notifications/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPreferences),
        })

        if (!response.ok) throw new Error('Failed to update notification preferences')

        const data = await response.json()
        setPreferences(data)
        toast.success('Notification preferences updated')
      } catch (err) {
        logger.error('Error updating notification preferences', {
          error: err,
          component: 'NotificationContext',
        })
        toast.error('Failed to update notification preferences')
      }
    },
    []
  )

  const showToast = useCallback((notification: Notification) => {
    const toastFn =
      notification.priority === 'critical'
        ? toast.error
        : notification.priority === 'high'
          ? toast.warning
          : toast.info

    toastFn(notification.title, {
      description: notification.message,
      duration: notification.priority === 'critical' ? 10000 : 5000,
      action: notification.actions?.[0]
        ? {
            label: notification.actions[0].label,
            onClick: () => {
              if (notification.actions?.[0]?.url) {
                window.location.href = notification.actions[0].url
              }
            },
          }
        : undefined,
    })
  }, [])

  const refresh = useCallback(() => {
    fetchNotifications()
    fetchStats()
  }, [fetchNotifications, fetchStats])

  useEffect(() => {
    fetchNotifications({ status: ['unread', 'read'], limit: 20 })
    fetchStats()
    fetchPreferences()
  }, [fetchNotifications, fetchStats, fetchPreferences])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      if (now - lastFetch > 30000) {
        refresh()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [lastFetch, refresh])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refresh])

  const unreadCount = notifications.filter((n) => n.status === 'unread').length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        stats,
        preferences,
        loading,
        error,
        fetchNotifications,
        fetchStats,
        fetchPreferences,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        archiveNotification,
        updatePreferences,
        showToast,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
