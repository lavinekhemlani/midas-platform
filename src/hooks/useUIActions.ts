// src/hooks/useUIActions.ts
// Hook for executing UI actions triggered from chat

'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useTheme } from './useTheme'
import { useViewTransitionRouter } from './useViewTransitionRouter'
import { useSidebar } from '@/contexts/SidebarContext'
import type {
  UIAction,
  ThemePayload,
  NavigatePayload,
  SidebarPayload,
  ChatPanelPayload,
  SettingsPayload,
  DownloadChatPayload,
} from '@/ai/types/ui-action'

// =============================================================================
// Chat Panel Event Helpers
// =============================================================================

export type ChatPanelEvent = CustomEvent<{
  action: 'open' | 'close' | 'toggle' | 'dock' | 'fullscreen'
}>

export type SettingsActionEvent = CustomEvent<{
  setting: SettingsPayload['setting']
  value: SettingsPayload['value']
}>

function dispatchChatPanelAction(action: ChatPanelPayload['action']) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ui-action:chat-panel', {
        detail: { action },
      })
    )
  }
}

function dispatchSettingsAction(payload: SettingsPayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ui-action:settings', {
        detail: { setting: payload.setting, value: payload.value },
      })
    )
  }
}

function dispatchDownloadChatAction(payload: DownloadChatPayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ui-action:download-chat', {
        detail: { count: payload.count },
      })
    )
  }
}

// =============================================================================
// Main Hook
// =============================================================================

export function useUIActions() {
  const { setTheme } = useTheme()
  const { navigate } = useViewTransitionRouter()
  const { toggle: toggleSidebar, setExpanded: setSidebarExpanded } = useSidebar()

  const executeAction = useCallback(
    (action: UIAction) => {
      switch (action.actionType) {
        case 'theme': {
          const payload = action.payload as ThemePayload
          setTheme(payload.theme)
          break
        }
        case 'navigate': {
          const payload = action.payload as NavigatePayload
          navigate(payload.path, {
            type: payload.transitionType || 'top-down-sweep',
          })
          break
        }
        case 'sidebar': {
          const payload = action.payload as SidebarPayload
          if (payload.action === 'toggle') {
            toggleSidebar()
          } else {
            setSidebarExpanded(payload.action === 'expand')
          }
          break
        }
        case 'chat_panel': {
          const payload = action.payload as ChatPanelPayload
          dispatchChatPanelAction(payload.action)
          break
        }
        case 'settings': {
          const payload = action.payload as SettingsPayload
          dispatchSettingsAction(payload)
          break
        }
        case 'download_chat': {
          const payload = action.payload as DownloadChatPayload
          console.log('[useUIActions] download_chat action received, count:', payload.count)
          dispatchDownloadChatAction(payload)
          break
        }
      }
    },
    [setTheme, navigate, toggleSidebar, setSidebarExpanded]
  )

  // Listen for ui-action-execute events dispatched by useChat
  useEffect(() => {
    const handleUIActionExecute = (event: Event) => {
      const customEvent = event as CustomEvent<{ proposalId: string; actions: UIAction[] }>
      const { actions } = customEvent.detail
      if (actions && actions.length > 0) {
        for (const action of actions) {
          executeAction(action)
        }
      }
    }

    window.addEventListener('ui-action-execute', handleUIActionExecute)
    return () => {
      window.removeEventListener('ui-action-execute', handleUIActionExecute)
    }
  }, [executeAction])
}

// =============================================================================
// Hook for Layout to Listen to Chat Panel Events
// =============================================================================

export function useChatPanelActions(handlers: {
  onOpen?: () => void
  onClose?: () => void
  onToggle?: () => void
  onDock?: () => void
  onFullscreen?: () => void
}) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const handleChatPanelEvent = (event: Event) => {
      const { action } = (event as ChatPanelEvent).detail
      switch (action) {
        case 'open':
          handlersRef.current.onOpen?.()
          break
        case 'close':
          handlersRef.current.onClose?.()
          break
        case 'toggle':
          handlersRef.current.onToggle?.()
          break
        case 'dock':
          handlersRef.current.onDock?.()
          break
        case 'fullscreen':
          handlersRef.current.onFullscreen?.()
          break
      }
    }

    window.addEventListener('ui-action:chat-panel', handleChatPanelEvent)
    return () => {
      window.removeEventListener('ui-action:chat-panel', handleChatPanelEvent)
    }
  }, [])
}
