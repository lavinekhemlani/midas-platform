'use client';

import React, { useState } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Bell,
  Check,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Archive,
  Trash2,
  Settings,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Link2,
  FileText,
  PiggyBank,
} from 'lucide-react';
import { Notification, NotificationType, NotificationPriority } from '@/lib/types/notification';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'transaction':
      return DollarSign;
    case 'alert':
      return AlertTriangle;
    case 'system':
      return AlertCircle;
    case 'integration':
      return Link2;
    case 'report':
      return FileText;
    case 'budget':
      return PiggyBank;
    default:
      return Info;
  }
};

const getPriorityColor = (priority: NotificationPriority) => {
  switch (priority) {
    case 'critical':
      return 'text-red-500 bg-red-500/10';
    case 'high':
      return 'text-orange-500 bg-orange-500/10';
    case 'medium':
      return 'text-amber-500 bg-amber-500/10';
    case 'low':
      return 'text-blue-500 bg-blue-500/10';
    default:
      return 'text-gray-500 bg-gray-500/10';
  }
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

function NotificationItem({ notification, onMarkAsRead, onDelete, onArchive }: NotificationItemProps) {
  const [showActions, setShowActions] = useState(false);
  const Icon = getNotificationIcon(notification.type);
  const priorityClass = getPriorityColor(notification.priority);
  const isUnread = notification.status === 'unread';

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      className={`relative p-4 border-b border-amber-500/10 transition-all duration-200 ${
        isUnread ? 'bg-amber-500/5' : ''
      } hover:bg-amber-500/10 cursor-pointer`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={isUnread ? onMarkAsRead : undefined}
    >
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-lg ${priorityClass}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold theme-text-primary truncate">
              {notification.title}
            </h4>
            <span className="text-xs theme-text-secondary ml-2">
              {timeAgo(notification.created_at)}
            </span>
          </div>

          <p className="text-xs theme-text-secondary mt-1 line-clamp-2">
            {notification.message}
          </p>

          {notification.actions && notification.actions.length > 0 && (
            <div className="flex items-center space-x-2 mt-2">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (action.url) {
                      window.location.href = action.url;
                    }
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isUnread && (
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse flex-shrink-0"></div>
        )}
      </div>

      {showActions && (
        <div className="absolute top-2 right-2 flex items-center space-x-1 bg-black/80 rounded-lg p-1">
          {isUnread && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
              className="p-1 hover:bg-amber-500/20 rounded transition-colors"
              title="Mark as read"
            >
              <Check className="w-3 h-3 text-amber-400" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            className="p-1 hover:bg-amber-500/20 rounded transition-colors"
            title="Archive"
          >
            <Archive className="w-3 h-3 text-amber-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    archiveNotification,
    refresh,
    fetchNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.status !== 'unread') return false;
    if (filter === 'archived' && n.status !== 'archived') return false;
    if (filter === 'all' && n.status === 'archived') return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="w-full max-w-md mx-auto glass-luxury-card rounded-lg overflow-hidden">
      <div className="p-4 border-b border-amber-500/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-semibold theme-text-primary">Notifications</h3>
              <p className="text-xs theme-text-secondary">
                {unreadCount} unread
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={refresh}
              className="p-1.5 hover:bg-amber-500/20 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="p-1.5 hover:bg-amber-500/20 rounded transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4 text-amber-400" />
              </button>
            )}

            <button
              className="p-1.5 hover:bg-amber-500/20 rounded transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              filter === 'all'
                ? 'bg-amber-500/20 text-amber-400'
                : 'theme-text-secondary hover:bg-amber-500/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              filter === 'unread'
                ? 'bg-amber-500/20 text-amber-400'
                : 'theme-text-secondary hover:bg-amber-500/10'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              filter === 'archived'
                ? 'bg-amber-500/20 text-amber-400'
                : 'theme-text-secondary hover:bg-amber-500/10'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {error && (
          <div className="p-4 text-center">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {loading && notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
            <p className="text-xs theme-text-secondary mt-2">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-amber-500/30 mx-auto mb-3" />
            <p className="text-sm theme-text-secondary">No notifications</p>
            <p className="text-xs theme-text-secondary mt-1">
              {filter === 'unread' ? "You're all caught up!" : 'Nothing to show here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-amber-500/10">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.notification_id}
                notification={notification}
                onMarkAsRead={() => markAsRead([notification.notification_id])}
                onDelete={() => deleteNotification(notification.notification_id)}
                onArchive={() => archiveNotification(notification.notification_id)}
              />
            ))}
          </div>
        )}
      </div>

      {filteredNotifications.length > 0 && (
        <div className="p-3 border-t border-amber-500/20 text-center">
          <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}