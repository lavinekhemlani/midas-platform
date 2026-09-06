// src/app/(main)/components/ChatPanel.tsx
'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useChatContext } from '@/contexts/ChatContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useSession } from '@/contexts/SessionContext'
import { useFinancialData } from '@/contexts/FinancialDataContext'
import { useSheetState } from '@/contexts/SheetStateContext'
import { useChat } from '@/hooks/useChat'
import { useCompanyMetadata } from '@/hooks/useCompanyMetadata'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { deduplicateMessages } from '@/lib/chat/deduplication'
import { logger } from '@/lib/logger'
// Lazy-loaded at export time to keep @react-pdf out of the client bundle
const getChatPdfExporter = () => import('@/lib/pdf/chatPdfExporter').then((m) => m.ChatPdfExporter)
import { cn } from '@/lib/utils'
import { GripVertical, Loader2, Maximize2, Minimize2, Trash2, X } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { ChatHistorySkeleton } from './MessageSkeleton'
import { ChatErrorBoundary } from '@/components/error'
import { getStarterSuggestions } from './starterSuggestions'
import { PromptBubbles, type Suggestion } from './PromptBubbles'

interface ChatPanelProps {
  isOpen: boolean
  onToggle: () => void
  onWidthChange: (width: number) => void
  sidebarWidth: number
  isFullscreen?: boolean
  onFullscreenChange?: (isFullscreen: boolean) => void
  onResizingChange?: (isResizing: boolean) => void
}

// Memoized messages list component to prevent re-renders from input changes
const MessagesList = memo(function MessagesList({
  messages,
  status,
  progress,
  onComponentClick,
  renderedComponents,
  enhanceContentWithMemoryCitations,
  onRetry,
  onRetrySave,
  onRetryFromError,
  onSuggestionSelect,
  organizationName,
  currency,
}: {
  messages: any[]
  status: string | null
  progress: { steps: string[] } | null
  onComponentClick: (component: any) => void
  renderedComponents: Record<string, any[]>
  enhanceContentWithMemoryCitations: (content: string, memories?: any[]) => string
  onRetry: () => void
  onRetrySave: (messageId: string) => void
  onRetryFromError: (messageId: string) => void
  onSuggestionSelect: (prompt: string, label: string) => void
  organizationName?: string
  currency?: string
}) {
  return (
    <>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          status={status}
          progress={progress}
          onComponentClick={onComponentClick}
          renderedComponents={renderedComponents}
          enhanceContentWithMemoryCitations={enhanceContentWithMemoryCitations}
          onRetry={onRetry}
          onRetrySave={onRetrySave}
          onRetryFromError={onRetryFromError}
          onSuggestionSelect={onSuggestionSelect}
          organizationName={organizationName}
          currency={currency}
        />
      ))}
    </>
  )
})

export default function ChatPanel({
  isOpen,
  onToggle,
  onWidthChange,
  sidebarWidth,
  isFullscreen: controlledFullscreen,
  onFullscreenChange,
  onResizingChange,
}: ChatPanelProps) {
  const router = useRouter()
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth / 3) : 620
  )
  const [isResizing, setIsResizing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // Support both controlled and uncontrolled fullscreen mode
  const [internalFullscreen, setInternalFullscreen] = useState(false)
  const isFullscreen =
    controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen
  const setIsFullscreen = (value: boolean) => {
    if (onFullscreenChange) {
      onFullscreenChange(value)
    } else {
      setInternalFullscreen(value)
    }
  }
  const { isSheetOpen } = useSheetState()

  const isMobile = useMediaQuery('(max-width: 1024px)')
  const isSmallMobile = useMediaQuery('(max-width: 768px)') // For hiding FAB when MobileFAB is shown

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Debounce scroll to prevent jumpy behavior during streaming
  const scrollDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastMessageCountRef = useRef(0)
  const previousStatusRef = useRef<string | null>(null)

  const MIN_WIDTH = 320
  const MAX_WIDTH = 1000

  // Use chat context
  const { renderedComponents, setSelectedMessageId } = useChatContext()

  // Get connected providers + organization for starter suggestions with entity names
  const { connectedProviders, organization } = useSession()

  // Extract actual entity/company names from organization providers
  // QB multi-entity: one entry per connected QB company
  const providerNames = useMemo((): Record<string, string> => {
    const names: Record<string, string> = {}
    const providers = (organization as any)?.providers
    if (!providers) return names

    for (const [id, info] of Object.entries(providers)) {
      // QB multi-entity: extract individual company names from connections map
      if (id === 'quickbooks' && (info as any)?.connections) {
        const connections = (info as any).connections as Record<string, any>
        const companyNames: string[] = []
        for (const conn of Object.values(connections)) {
          if (conn?.credentials?.connected && conn.credentials.company_name) {
            companyNames.push(conn.credentials.company_name)
          }
        }
        if (companyNames.length > 0) {
          names[id] = companyNames.join(', ')
        }
        continue
      }
      const creds = (info as any)?.credentials
      if (creds?.connected) {
        const schemas = creds.schemas as any[] | undefined
        const name = schemas?.length
          ? schemas
              .map((s: any) => s.company_name)
              .filter(Boolean)
              .join(', ')
          : creds.company_name || null
        if (name) names[id] = name
      }
    }
    return names
  }, [organization])

  // Get organization and currency for PDF export
  const { currency } = useCurrency()
  const { financialData } = useFinancialData()
  const organizationName = financialData?.organizationName || ''

  // Chat history is unified across all QB entities (no realmId scoping)
  const { data: companyData, isLoading: isMetadataLoading } = useCompanyMetadata()
  // Wait for metadata to be ready before loading history
  const isMetadataReady = !isMetadataLoading

  // Use our real chat hook with pagination support
  const {
    messages: chatMessages,
    loading,
    error,
    progress,
    status,
    tokenUsage,
    memoryCreated,
    send,
    retryMessage,
    retryFromError,
    clearError,
    clearMessages,
    cancelRequest,
    loadHistory,
    historyLoaded,
    isInitialLoading,
    loadMoreHistory,
    isLoadingMore,
    hasMoreHistory,
    lastMessageSource,
    setLastMessageSource,
  } = useChat({
    onError: (error) => {
      logger.error('Chat error', { error, component: 'ChatPanel' })
    },
  })

  // Transform messages to match the UI format and add welcome message only if empty
  // Simplified to let React handle memoization through ChatMessage component
  const messages = useMemo(() => {
    // Use consistent deduplication utility
    const uniqueMessages = deduplicateMessages(chatMessages)

    // Return empty array while loading (shows skeleton):
    // - While metadata is loading
    // - While initial history is loading
    if (uniqueMessages.length === 0 && (isInitialLoading || isMetadataLoading)) {
      return []
    }

    // Only show welcome message when:
    // - No messages exist
    // - Metadata is loaded (not loading)
    // - History loading is complete (not loading)
    if (uniqueMessages.length === 0) {
      return [
        {
          id: 'welcome',
          role: 'assistant' as const,
          content:
            'Hello! Welcome to Midas, your AI CFO. I can help you understand your financial data, explain trends, and provide insights. What would you like to know?',
          timestamp: new Date(),
          confidence: 0.95,
          hasMemory: false,
          memories: [],
          learnTerms: [],
        },
      ]
    }

    // Transform messages directly without complex caching
    // React and ChatMessage's memoization will handle preventing unnecessary re-renders
    return uniqueMessages.map((msg) => {
      // Check for any memory operations (created, updated, or deleted)
      const hasMemory =
        (msg.memories && msg.memories.length > 0) ||
        (msg.updatedMemories && msg.updatedMemories.length > 0) ||
        (msg.deletedMemories && msg.deletedMemories.length > 0)
      return {
        ...msg,
        // Use the existing timestamp or convert it once
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp
            : msg.timestamp
              ? new Date(msg.timestamp)
              : new Date(),
        confidence: msg.role === 'assistant' ? 0.85 : undefined,
        hasMemory,
        memories: msg.memories || [],
        updatedMemories: msg.updatedMemories || [],
        deletedMemories: msg.deletedMemories || [],
        learnTerms: msg.learnTerms || [],
        widgets: msg.widgets || [], // Memory widgets for [[WIDGET:N]] markers
        tokenUsage: msg.tokenUsage,
      }
    })
    // NOTE: renderedComponents intentionally excluded from deps to prevent
    // recalculation on every streaming update. ChatMessage handles its own
    // memoization for visualization chips.
  }, [chatMessages, isInitialLoading, isMetadataLoading])

  // Listen for LLM-triggered PDF download events
  useEffect(() => {
    const handleDownloadChat = async (event: Event) => {
      const { count = 1 } = (event as CustomEvent<{ count: number }>).detail
      console.log('[ChatPanel] Download chat event received, count:', count)
      const assistantMessages = messages.filter(
        (msg) => msg.role === 'assistant' && !(msg as any).isError && msg.id !== 'welcome'
      )
      console.log('[ChatPanel] Found', assistantMessages.length, 'assistant messages')
      const toDownload = assistantMessages.slice(-count)
      console.log('[ChatPanel] Will download', toDownload.length, 'messages')

      for (let i = 0; i < toDownload.length; i++) {
        // Stagger downloads so browser doesn't block them
        if (i > 0) await new Promise((r) => setTimeout(r, 800))
        try {
          console.log('[ChatPanel] Exporting message', toDownload[i].id)
          const ChatPdfExporter = await getChatPdfExporter()
          await ChatPdfExporter.export(toDownload[i], {
            currency,
            organizationName,
            widgets: (toDownload[i] as any).widgets || [],
          })
          console.log('[ChatPanel] Export complete for', toDownload[i].id)
        } catch (err) {
          console.error('[ChatPanel] PDF download failed:', err)
          logger.error('PDF download failed', { error: err, messageId: toDownload[i].id })
        }
      }
    }

    window.addEventListener('ui-action:download-chat', handleDownloadChat)
    return () => window.removeEventListener('ui-action:download-chat', handleDownloadChat)
  }, [messages, currency, organizationName])

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<Element | null>(null)

  // Refs to hold current state values for the IntersectionObserver
  const hasMoreHistoryRef = useRef(hasMoreHistory)
  const isLoadingMoreRef = useRef(isLoadingMore)

  // Synchronous guard to prevent race conditions
  const isLoadingGuardRef = useRef(false)

  // Track last load timestamp to prevent rapid requests
  const lastLoadTimestampRef = useRef(0)

  // Debounce timer for IntersectionObserver
  const loadDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Simplified scroll state for history loading only
  const [scrollRestorationInfo, setScrollRestorationInfo] = useState<{
    height: number
    scrollTop: number
    timestamp: number
  } | null>(null)

  // Track user scroll position to prevent unwanted auto-scrolling
  const [isUserAtBottom, setIsUserAtBottom] = useState(true)
  const isUserAtBottomRef = useRef(true)

  // Keep refs updated with current values
  useEffect(() => {
    hasMoreHistoryRef.current = hasMoreHistory
  }, [hasMoreHistory])

  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore
  }, [isLoadingMore])

  const scrollToBottom = useCallback((smooth: boolean = true) => {
    // Clear any pending scroll
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current)
    }

    // Debounce scroll during streaming to prevent jumpiness
    scrollDebounceRef.current = setTimeout(() => {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (viewportRef.current) {
          const viewport = viewportRef.current
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: smooth ? 'smooth' : 'instant',
          })
        } else if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({
            behavior: smooth ? 'smooth' : 'instant',
            block: 'end',
          })
        }
      })
    }, 50) // 50ms debounce
  }, [])

  // Wrapper function for loadMoreHistory that handles scroll position
  const handleLoadMoreHistory = useCallback(async () => {
    if (!viewportRef.current) return

    // Synchronous guard - check and set immediately
    if (isLoadingGuardRef.current) {
      logger.debug('Load blocked by synchronous guard', { component: 'ChatPanel' })
      return { success: false }
    }

    // Check minimum time between requests (500ms)
    const now = Date.now()
    const timeSinceLastLoad = now - lastLoadTimestampRef.current
    if (timeSinceLastLoad < 500) {
      logger.debug('Load blocked by rate limit', {
        component: 'ChatPanel',
        timeSinceLastLoad,
      })
      return { success: false }
    }

    // Set the guard immediately
    isLoadingGuardRef.current = true
    lastLoadTimestampRef.current = now

    try {
      // Save scroll position and current scroll top BEFORE loading
      const scrollHeightBefore = viewportRef.current.scrollHeight
      const scrollTopBefore = viewportRef.current.scrollTop

      // Load more messages
      const result = await loadMoreHistory()

      if (result?.success) {
        // Set restoration info with both height and scrollTop
        setScrollRestorationInfo({
          height: scrollHeightBefore,
          scrollTop: scrollTopBefore,
          timestamp: Date.now(),
        })
      }

      return result
    } finally {
      // Always clear the guard, even on error
      isLoadingGuardRef.current = false
    }
  }, [loadMoreHistory])

  // Function to enhance content with memory citations
  const enhanceContentWithMemoryCitations = useCallback((content: string, memories?: any[]) => {
    if (!memories || memories.length === 0) return content

    // Keep memory references as-is for now, they'll be styled through markdown
    // Memory references like [Memory: MEM#123] will remain as plain text
    // but could be enhanced with custom rendering in the future
    return content
  }, [])

  // Handler for component clicks (reports, visualizations, etc.)
  const openReport = useCallback((component: any) => {
    logger.debug('Opening report/component', { component, location: 'ChatPanel' })
    // TODO: Implement actual navigation or modal opening logic here
    // For now, just log the component data
  }, [])

  // Setup viewport element and scroll tracking
  useEffect(() => {
    // Only set up when chat is open
    if (!isOpen || !scrollAreaRef.current) return

    // Find and cache the viewport element
    const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    // Set the ref
    viewportRef.current = viewport

    // Throttled scroll handler to reduce performance impact
    let scrollThrottleTimer: NodeJS.Timeout | null = null
    const handleScroll = () => {
      // Throttle scroll events to max once per 100ms
      if (scrollThrottleTimer) return

      scrollThrottleTimer = setTimeout(() => {
        scrollThrottleTimer = null
        if (!viewportRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = viewportRef.current as Element
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50 // 50px threshold
        // Only update state if value actually changed
        if (isUserAtBottomRef.current !== isAtBottom) {
          setIsUserAtBottom(isAtBottom)
        }
        isUserAtBottomRef.current = isAtBottom
      }, 100)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })

    // Scroll to bottom when viewport is set up
    setTimeout(() => {
      scrollToBottom(false)
    }, 100)

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      if (scrollThrottleTimer) clearTimeout(scrollThrottleTimer)
      viewportRef.current = null
    }
  }, [isOpen, scrollToBottom]) // Re-run when chat opens

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !viewportRef.current) return

    // Create observer immediately without delay
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries

        // Check conditions using refs to always have current values
        if (entry.isIntersecting && hasMoreHistoryRef.current && !isLoadingMoreRef.current) {
          // Clear any existing debounce timer
          if (loadDebounceTimerRef.current) {
            clearTimeout(loadDebounceTimerRef.current)
          }

          // Debounce the load request by 100ms
          loadDebounceTimerRef.current = setTimeout(async () => {
            // Double-check conditions after debounce delay
            if (
              hasMoreHistoryRef.current &&
              !isLoadingMoreRef.current &&
              !isLoadingGuardRef.current
            ) {
              logger.debug('Triggering load after debounce', { component: 'ChatPanel' })
              await handleLoadMoreHistory()
            }
            loadDebounceTimerRef.current = null
          }, 100)
        }
      },
      {
        // Use the actual scroll container as root
        root: viewportRef.current,
        rootMargin: '0px', // Changed from 100px to prevent premature loading
        threshold: 0.1,
      }
    )

    observer.observe(loadMoreTriggerRef.current)

    return () => {
      // Clean up debounce timer on unmount
      if (loadDebounceTimerRef.current) {
        clearTimeout(loadDebounceTimerRef.current)
      }
      observer.disconnect()
    }
  }, [handleLoadMoreHistory, historyLoaded]) // Also depend on historyLoaded to reinit when ready

  // Restore scroll position after history loads
  useEffect(() => {
    // Only restore if we have restoration info and loading is complete
    if (!scrollRestorationInfo || isLoadingMore || !viewportRef.current) return

    // Use double RAF to ensure DOM is fully settled
    // This is more reliable than a fixed timeout
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!viewportRef.current) return

        const scrollHeightAfter = viewportRef.current.scrollHeight
        const scrollDiff = scrollHeightAfter - scrollRestorationInfo.height

        // Only adjust if there's actually new content
        if (scrollDiff > 0) {
          // Calculate the exact position to restore
          // This maintains the exact visual position of content
          const newScrollTop = scrollRestorationInfo.scrollTop + scrollDiff

          // Set scroll position directly without animation
          viewportRef.current.scrollTop = newScrollTop
        }

        // Clear restoration info
        setScrollRestorationInfo(null)
      })
    })
  }, [scrollRestorationInfo, isLoadingMore])

  // Load history when chat opens AND metadata is ready
  useEffect(() => {
    if (isOpen && isMetadataReady) {
      // Only load history if we don't have messages yet
      if (chatMessages.length === 0 && !historyLoaded) {
        loadHistory()
      }
    }
  }, [isOpen, isMetadataReady, chatMessages.length, historyLoaded, loadHistory])

  // Auto-scroll to bottom after initial history load
  useEffect(() => {
    // When history is first loaded and we have messages, scroll to bottom
    if (historyLoaded && chatMessages.length > 0) {
      // Wait for DOM to settle, then scroll to bottom
      setTimeout(() => {
        scrollToBottom(false)
      }, 100)
    }
  }, [historyLoaded, scrollToBottom]) // Only trigger when historyLoaded changes

  // Auto-scroll during streaming if user is at bottom (following the conversation)
  // IMPORTANT: Only scroll when a NEW message is added, not on content updates
  useEffect(() => {
    const currentCount = chatMessages.length

    // Only scroll if:
    // 1. User was already at bottom
    // 2. A NEW message was added (count increased)
    if (isUserAtBottomRef.current && currentCount > lastMessageCountRef.current) {
      scrollToBottom(true)
    }

    // Update the ref for next comparison
    lastMessageCountRef.current = currentCount
  }, [chatMessages.length, scrollToBottom]) // Only depend on length, not full array

  // Scroll to bottom when agent finishes responding (status goes from something to null)
  useEffect(() => {
    // Check if status just changed from something to null (response complete)
    if (previousStatusRef.current !== null && status === null) {
      // Small delay to ensure final content is rendered
      setTimeout(() => {
        scrollToBottom(true)
      }, 100)
    }
    // Update the ref for next comparison
    previousStatusRef.current = status
  }, [status, scrollToBottom])

  useEffect(() => {
    if (isMobile) {
      onWidthChange(0)
    } else {
      onWidthChange(isFullscreen ? 0 : width)
    }
  }, [isMobile, width, isFullscreen, onWidthChange])

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  // Force layout recalculation when exiting fullscreen
  // This ensures content properly reflows to the new container width
  const previousFullscreenRef = useRef(isFullscreen)
  useEffect(() => {
    // Only trigger when going from fullscreen to normal (not the other way)
    if (previousFullscreenRef.current && !isFullscreen && panelRef.current) {
      // Force immediate reflow by reading a layout property
      // This is more reliable than waiting for the transition
      const forceReflow = () => {
        if (panelRef.current) {
          // Reading offsetHeight forces a synchronous reflow
          void panelRef.current.offsetHeight
          // Also dispatch resize event for any listeners
          window.dispatchEvent(new Event('resize'))
        }
      }

      // Trigger reflow at multiple points during the transition
      // to ensure content resizes smoothly
      forceReflow()
      const timer1 = setTimeout(forceReflow, 100)
      const timer2 = setTimeout(forceReflow, 200)
      const timer3 = setTimeout(forceReflow, 350)

      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }
    previousFullscreenRef.current = isFullscreen
  }, [isFullscreen])

  /* ───────────  Resize logic  ─────────── */
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      onResizingChange?.(true)
    },
    [onResizingChange]
  )

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = window.innerWidth - e.clientX
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
      setWidth(clampedWidth)
      onWidthChange(clampedWidth)
    },
    [isResizing, onWidthChange]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    onResizingChange?.(false)
  }, [onResizingChange])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  /* ───────────  Chat send  ─────────── */
  const sendMessage = useCallback(
    (userInput: string, displayContent?: string) => {
      if (!userInput.trim() || loading) return

      // Always use agent for potential visualizations
      send(userInput, { useAgent: true, displayContent })

      // Scroll to bottom - use interval to retry until viewport is ready (same as AI analysis handler)
      let attempts = 0
      const maxAttempts = 10
      const scrollInterval = setInterval(() => {
        attempts++
        if (viewportRef.current || attempts >= maxAttempts) {
          clearInterval(scrollInterval)
          scrollToBottom(true)
        }
      }, 50)
    },
    [loading, send, scrollToBottom]
  )

  // Handle suggestion bubble clicks — sends prompt but displays short label
  const handleSuggestionSelect = useCallback(
    (prompt: string, label: string) => {
      if (loading) return
      isUserAtBottomRef.current = true
      setIsUserAtBottom(true)
      send(prompt, { useAgent: true, displayContent: label })
      scrollToBottom(true)
    },
    [loading, send, scrollToBottom]
  )

  // Compute starter suggestions for empty chat (shown in messages area, not input bar)
  // Wait for history + metadata to fully load before showing starters
  const starterSuggestions = useMemo((): Suggestion[] => {
    if (loading || isInitialLoading || isMetadataLoading || !historyLoaded) return []

    const realMessages = messages.filter((m) => m.id !== 'welcome' && m.role !== 'assistant-temp')

    if (realMessages.length === 0) {
      const starters = getStarterSuggestions(connectedProviders || [], providerNames)
      return starters.map((s) => ({ label: s.label, prompt: s.prompt }))
    }

    return []
  }, [
    messages,
    loading,
    isInitialLoading,
    isMetadataLoading,
    historyLoaded,
    connectedProviders,
    providerNames,
  ])

  // Listen for custom chat-send-message events from other components (e.g., AIAnalysisCard)
  useEffect(() => {
    const handleChatSendMessage = (
      event: CustomEvent<{
        message: string
        displayContent?: string
        openChat?: boolean
      }>
    ) => {
      const { message, displayContent, openChat } = event.detail || {}
      if (message && !loading) {
        const chatWasClosed = !isOpen

        // Open chat panel if requested
        if (openChat && chatWasClosed) {
          onToggle()
        }

        // Set user at bottom to ensure auto-scroll works for this message
        isUserAtBottomRef.current = true
        setIsUserAtBottom(true)

        // Send the message with agent enabled (use the hook directly for displayContent support)
        send(message, { useAgent: true, displayContent })

        // Scroll to bottom with appropriate delay
        // If chat was just opened, wait longer for viewport to be set up
        const scrollDelay = chatWasClosed ? 500 : 100

        // Use interval to keep trying to scroll until it works
        let attempts = 0
        const maxAttempts = 10
        const scrollInterval = setInterval(() => {
          attempts++
          if (viewportRef.current || attempts >= maxAttempts) {
            clearInterval(scrollInterval)
            scrollToBottom(true)
          }
        }, scrollDelay / maxAttempts)
      }
    }

    // Add event listener
    window.addEventListener('chat-send-message', handleChatSendMessage as EventListener)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('chat-send-message', handleChatSendMessage as EventListener)
    }
  }, [send, loading, isOpen, onToggle, scrollToBottom])

  // Check if currently streaming - only true when we have a temp message AND no real content is streaming yet
  const isStreaming = messages.some((msg) => msg.role === 'assistant-temp')

  // Retry handler - finds the last user message and resends it
  const handleRetry = useCallback(() => {
    if (loading) return

    // Find the last user message (excluding temp messages)
    const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')
    if (lastUserMessage) {
      send(lastUserMessage.content, { useAgent: true })
      scrollToBottom(true)
    }
  }, [messages, loading, send, scrollToBottom])

  // Retry save handler - retries saving a specific failed message
  const handleRetrySave = useCallback(
    (messageId: string) => {
      if (loading) return
      retryMessage(messageId)
    },
    [loading, retryMessage]
  )

  /* ───────────  UI  ─────────── */
  return (
    <TooltipProvider>
      <div
        ref={panelRef}
        className={cn(
          'chat-panel fixed transition-all duration-100',
          // Closed state - slide off-screen and disable interaction
          !isOpen && (isMobile ? 'translate-y-full opacity-0' : 'translate-x-full opacity-0'),
          !isOpen && 'pointer-events-none',
          // Position based on mode
          isMobile
            ? 'z-40 inset-0' // Full screen overlay on mobile
            : isFullscreen
              ? 'z-30 top-14 bottom-0 rounded-none shadow-none bg-transparent chat-panel-fullscreen'
              : 'z-40 top-14 right-0 h-[calc(100vh-56px)] dashboard-chat' // Docked to right edge
        )}
        style={
          isMobile
            ? { top: '56px', left: `${sidebarWidth}px` } // Full screen below topbar, respecting sidebar
            : isFullscreen
              ? {
                  // In fullscreen, take over the main content area
                  left: `${sidebarWidth}px`,
                  right: '0px',
                }
              : { width }
        }
      >
        {/* Horizontal resize handle (desktop) - hide in fullscreen */}
        {!isMobile && !isFullscreen && (
          <div
            onMouseDown={handleResizeStart}
            className="
              absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2
              flex items-center justify-center
              w-4 h-9 rounded-sm
              bg-neutral-100 dark:bg-zinc-700 hover:bg-amber-400 dark:hover:bg-amber-500
              cursor-col-resize
              z-50 transition-colors
            "
            title="Drag to resize"
          >
            <GripVertical className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
          </div>
        )}

        {/* Panel content wrapper - using h-full and flex flex-col for proper layout */}
        <div className="h-full flex flex-col">
          {/* Header */}
          <div
            className={cn(
              'flex items-center justify-between p-4',
              isFullscreen ? 'absolute top-0 left-0 right-0 z-10 bg-transparent' : 'bg-inherit'
            )}
          >
            {/* Logo and title - hidden in fullscreen mode, empty div spacer keeps buttons right-aligned */}
            {isFullscreen ? (
              <div />
            ) : (
              <div className="flex items-center space-x-3">
                <Image
                  src="/images/hero/logo_gold_new.svg"
                  alt="Midas"
                  width={25}
                  height={25}
                  className="object-contain"
                />
                <div>
                  <h3 className="font-semibold theme-text-primary">MIDAS</h3>
                </div>
              </div>
            )}
            {/* Buttons - same position in both modes */}
            <div className="flex items-center gap-1">
              {/* Clear chat */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-9 w-9 hover:bg-amber-500/10 theme-text-secondary hover:text-amber-500 transition-colors [&_svg]:!size-5"
                title="Clear chat"
              >
                <Trash2 />
              </Button>
              {/* Fullscreen toggle - only show on desktop */}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="h-9 w-9 hover:bg-amber-500/10 theme-text-secondary hover:text-amber-500 transition-colors [&_svg]:!size-5"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 /> : <Maximize2 />}
                </Button>
              )}
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-9 w-9 hover:bg-red-500/10 theme-text-secondary hover:text-red-400 transition-colors [&_svg]:!size-5"
              >
                <X />
              </Button>
            </div>
          </div>

          {/* Messages - flex-1 to take remaining space */}
          <div className="flex-1 overflow-hidden relative">
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className={cn('p-4 space-y-16 pb-8', isFullscreen && 'max-w-4xl mx-auto pt-14')}>
                {/* Auto-load trigger - invisible element that triggers loading when scrolled into view */}
                {hasMoreHistory && historyLoaded && chatMessages.length > 0 && (
                  <div ref={loadMoreTriggerRef} className="h-1">
                    {/* Loading indicator with height 0 to prevent layout shifts */}
                    {isLoadingMore && (
                      <div className="h-0 overflow-visible">
                        <div className="flex items-center justify-center -mt-10">
                          <div className="flex items-center justify-center space-x-2 bg-inherit rounded-lg px-3 py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            <span className="text-xs theme-text-secondary">
                              Loading older messages...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No more messages indicator */}
                {!hasMoreHistory && chatMessages.length > 0 && (
                  <div className="text-center py-2 text-xs theme-text-secondary">
                    Beginning of conversation
                  </div>
                )}

                {/* Show skeleton loading when initially loading chat history or metadata */}
                {(isInitialLoading || isMetadataLoading) && messages.length === 0 && (
                  <ChatHistorySkeleton messageCount={4} />
                )}

                <ChatErrorBoundary messagesCount={messages.length}>
                  <MessagesList
                    messages={messages}
                    status={status}
                    progress={progress}
                    onComponentClick={openReport}
                    renderedComponents={renderedComponents}
                    enhanceContentWithMemoryCitations={enhanceContentWithMemoryCitations}
                    onRetry={handleRetry}
                    onRetrySave={handleRetrySave}
                    onRetryFromError={retryFromError}
                    onSuggestionSelect={handleSuggestionSelect}
                    organizationName={organizationName}
                    currency={currency}
                  />
                </ChatErrorBoundary>

                {/* Starter suggestion bubbles — shown in empty chat below the welcome message */}
                {starterSuggestions.length > 0 && (
                  <div className="!mt-4">
                    <PromptBubbles
                      suggestions={starterSuggestions}
                      onSelect={handleSuggestionSelect}
                      variant="input-bar"
                      disabled={loading}
                    />
                  </div>
                )}

                {/* Show loading state with status - only show if no content is streaming */}
                {loading && !messages.some((msg) => msg.role === 'assistant-temp') && (
                  <div className="flex justify-start">
                    <div className="glass-luxury-card p-3 mr-4">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        <span className="text-sm theme-text-secondary">
                          {status || 'Processing…'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} style={{ height: 1 }} />
              </div>
            </ScrollArea>
          </div>

          {/* LLM Provider Selector - Hidden for now */}
          {/* <LLMProviderSelector /> */}

          {/* Input - Modern floating design */}
          <div className={cn(isFullscreen && 'max-w-5xl mx-auto w-full px-6')}>
            <ChatInput onSend={sendMessage} onCancel={cancelRequest} loading={loading} />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="learn-modal-dialog p-6 max-w-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="theme-text-primary">Clear chat history?</DialogTitle>
            <DialogDescription className="theme-text-secondary">
              This will permanently delete all messages for your organization. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              className="theme-text-secondary hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearMessages()
                setShowDeleteConfirm(false)
              }}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300"
            >
              Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
