'use client';

import React from 'react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import TestNotificationButton from '@/components/notifications/TestNotificationButton';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <Bell className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold theme-text-primary">Notifications</h1>
          </div>
          <TestNotificationButton />
        </div>
        <p className="theme-text-secondary">
          Stay updated with important alerts, financial events, and system notifications
        </p>
      </div>

      <NotificationCenter />

      <div className="mt-8 p-4 glass-luxury-card rounded-lg">
        <h2 className="text-lg font-semibold theme-text-primary mb-3">
          Notification Settings
        </h2>
        <p className="text-sm theme-text-secondary mb-4">
          Customize how and when you receive notifications
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg">
            <div>
              <p className="text-sm font-medium theme-text-primary">Email Notifications</p>
              <p className="text-xs theme-text-secondary">Receive important alerts via email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg">
            <div>
              <p className="text-sm font-medium theme-text-primary">Push Notifications</p>
              <p className="text-xs theme-text-secondary">Get real-time alerts on your device</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg">
            <div>
              <p className="text-sm font-medium theme-text-primary">Quiet Hours</p>
              <p className="text-xs theme-text-secondary">Pause non-critical notifications at night</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-amber-500/20">
          <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium">
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}