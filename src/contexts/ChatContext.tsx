// src/contexts/ChatContext.tsx
'use client'

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react'
import { useSession } from '@/hooks/useSession'
import { logger } from '@/lib/logger'

interface ChatComponent {
  id: string
  type: string
  props: any
  layout: {
    position: string
    size: string
  }
  metadata?: any
  timestamp: number
}

interface ReportData {
  title?: string
  type?: string
  narrative?: string
  keyInsights?: string[]
  metadata?: any
  timeframe?: string
  focusAreas?: string[]
  confidence?: number
  structure?: any
  chatResponse?: string
}

interface ChatContextType {
  // Message selection
  selectedMessageId: string | null
  setSelectedMessageId: (id: string | null) => void

  // Component storage
  renderedComponents: Record<string, ChatComponent[]>
  setRenderedComponents: React.Dispatch<React.SetStateAction<Record<string, ChatComponent[]>>>

  // Report data storage
  reportData: Record<string, ReportData>
  setReportData: React.Dispatch<React.SetStateAction<Record<string, ReportData>>>

  // Message content storage
  messageContent: Record<string, string>
  setMessageContent: React.Dispatch<React.SetStateAction<Record<string, string>>>

  // Loading state for new messages
  isProcessingNewMessage: boolean
  setIsProcessingNewMessage: (value: boolean) => void

  // AI processing status
  aiProcessingStatus: string | null
  setAiProcessingStatus: (status: string | null) => void

  // Add components to a message
  addComponentsToMessage: (messageId: string, components: ChatComponent[], content?: string) => void

  // Add report data for a message
  addReportDataToMessage: (messageId: string, reportData: ReportData) => void

  // Clear visualizations
  clearVisualizations: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isSigningOut } = useSession()
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [renderedComponents, setRenderedComponents] = useState<Record<string, ChatComponent[]>>({})
  const [reportData, setReportData] = useState<Record<string, ReportData>>({})
  const [messageContent, setMessageContent] = useState<Record<string, string>>({})
  const [isProcessingNewMessage, setIsProcessingNewMessage] = useState(false)
  const [aiProcessingStatus, setAiProcessingStatus] = useState<string | null>(null)

  const addComponentsToMessage = useCallback(
    (messageId: string, components: ChatComponent[], content?: string) => {
      logger.debug('Adding components to message', {
        messageId,
        componentsCount: components.length,
        hasContent: !!content,
        component: 'ChatContext',
      })

      // Use shallow copy with spread operator to maintain component identity
      const componentsCopy = components.map((c) => ({ ...c }))

      setRenderedComponents((prev) => {
        const updated = {
          ...prev,
          [messageId]: componentsCopy,
        }
        logger.debug('Updated renderedComponents', {
          keys: Object.keys(updated),
          component: 'ChatContext',
        })
        return updated
      })

      // Store message content if provided
      if (content) {
        setMessageContent((prev) => ({
          ...prev,
          [messageId]: content,
        }))
      }

      // Set this message as selected (single source of truth)
      setSelectedMessageId(messageId)

      // Clear processing state when components are received
      setIsProcessingNewMessage(false)
      setAiProcessingStatus(null)
    },
    []
  )

  const addReportDataToMessage = useCallback((messageId: string, data: ReportData) => {
    logger.debug('Adding report data to message', {
      messageId,
      hasNarrative: !!data.narrative,
      component: 'ChatContext',
    })

    setReportData((prev) => ({
      ...prev,
      [messageId]: data,
    }))
  }, [])

  const clearVisualizations = useCallback(() => {
    setSelectedMessageId(null)
    setIsProcessingNewMessage(true)
    setAiProcessingStatus('Midas is analyzing your data...')
  }, [])

  // Clear chat state when signing out
  useEffect(() => {
    if (isSigningOut) {
      logger.info('Sign-out detected, clearing chat state', { component: 'ChatContext' })
      setSelectedMessageId(null)
      setRenderedComponents({})
      setReportData({})
      setMessageContent({})
      setIsProcessingNewMessage(false)
      setAiProcessingStatus(null)
    }
  }, [isSigningOut])

  return (
    <ChatContext.Provider
      value={{
        selectedMessageId,
        setSelectedMessageId,
        renderedComponents,
        setRenderedComponents,
        reportData,
        setReportData,
        messageContent,
        setMessageContent,
        isProcessingNewMessage,
        setIsProcessingNewMessage,
        aiProcessingStatus,
        setAiProcessingStatus,
        addComponentsToMessage,
        addReportDataToMessage,
        clearVisualizations,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}
