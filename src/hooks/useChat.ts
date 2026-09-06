// src/hooks/useChat.ts

import { apiClient } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useChatContext } from '@/contexts/ChatContext'
import { mergeUniqueMessages } from '@/lib/chat/deduplication'
import { useSession } from '@/hooks/useSession'
import { transformStructuredVisualization } from '@/lib/chat/visualizationBlocks'
import { aiDebug } from '@/lib/debug'
import { parseSSEEvent, isEventType, type SSEEvent } from '@/lib/schemas/chat'
import { LocalStorageManager } from '@/lib/storage/LocalStorageManager'

// LocalStorage manager for client-side persistence fallback
const chatStorage = new LocalStorageManager('midas_chat_messages', {
  maxItems: 50,
  component: 'useChat.localStorage',
})

// Helper to transform stored components (raw format) to renderer format
// Stored format: { type: "chart:donut", data: [...], vizIndex: 1 }
// Renderer format: { type: "chart", chartType: "donut", data: [...], vizIndex: 1 }
function transformStoredComponents(components: any[]): any[] {
  if (!components || !Array.isArray(components)) return []
  return components
    .map((comp) => {
      // Check if already transformed (has chartType for charts)
      if (comp.type === 'chart' && comp.chartType) {
        return comp // Already in correct format
      }
      // Transform raw visualization data
      const transformed = transformStructuredVisualization(comp)
      if (transformed) {
        // Preserve vizIndex for marker matching
        if (comp.vizIndex != null) {
          ;(transformed as any).vizIndex = comp.vizIndex
        }
        return transformed
      }
      return comp // Return original if transformation fails
    })
    .filter(Boolean)
}

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'retrying'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'assistant-temp'
  content: string
  displayContent?: string // Optional user-facing version (shown in UI instead of full content)
  timestamp?: Date
  saveStatus?: MessageStatus // Track message save status (renamed from status to match UI)
  saveError?: string // Error message if save failed
  components?: any[]
  widgets?: any[] // Memory widgets for [[WIDGET:N]] markers
  memories?: Array<{
    id: string
    type: string
    content: string
  }>
  updatedMemories?: Array<{
    id: string
    type: string
    content: string
  }>
  deletedMemories?: Array<{
    id: string
    type?: string
    content?: string
  }>
  learnTerms?: Array<{
    termId: string
    matchedPhrase: string
    confidence: number
    reason: string
  }>
  tokenUsage?: {
    tokens: number
    inputTokens?: number
    outputTokens?: number
    model?: string
    provider?: string
    estimated?: boolean
  }
  // Suggestions from suggest_actions tool (follow-ups + clarifications)
  suggestions?: Array<{ label: string; prompt: string; type?: string }>
  // Data source badges (which tools/providers were used)
  sources?: Array<{ provider: string; tool: string; report?: string; entityName?: string }>
  // Error message fields (for inline error display with retry)
  isError?: boolean
  retryData?: {
    input: string // Original user input to retry
    errorCode?: string // e.g., TOOL_VALIDATION, STREAM_TIMEOUT
  }
  [key: string]: unknown // Index signature for compatibility with LocalStorageManager
}

interface ChatError {
  message: string
  code?: string // Error type code (e.g., STREAM_TIMEOUT, TOOL_TIMEOUT)
  retryable?: boolean // Whether the error can be retried
  retryAfter?: number // Seconds to wait before retry
  retry?: () => void
  // Retry tracking fields
  retryAttempt?: number // Current retry attempt (1-based)
  maxRetries?: number // Maximum retry attempts
  retriesExhausted?: boolean // True when all retries have been exhausted
}

// Export for use in components
export type { ChatError }

interface UseChatOptions {
  onError?: (error: ChatError) => void
  onFinish?: (message: Message) => void
}

interface TokenUsage {
  tokens: number // Current request tokens
  inputTokens?: number // Input/prompt tokens
  outputTokens?: number // Generated tokens
  monthlyUsage: number
  monthlyLimit: number
  remainingTokens?: number
  model?: string
  provider?: string
  estimated?: boolean // Whether tokens were estimated vs actual
}

export function useChat(options?: UseChatOptions) {
  const {
    addComponentsToMessage,
    setAiProcessingStatus,
    setReportData,
    setRenderedComponents,
    setMessageContent,
    setSelectedMessageId,
  } = useChatContext()
  const { refetchSession } = useSession()

  // Track if provider error has been handled to prevent duplicate handling
  const providerErrorHandledRef = useRef(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ChatError | null>(null)
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  const [progress, setProgress] = useState<{ steps: string[] } | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [memoryCreated, setMemoryCreated] = useState<{
    memoryId: string
    memoryType: string
    content: string
  } | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)

  // Pagination state for infinite scrolling
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [oldestMessageTimestamp, setOldestMessageTimestamp] = useState<number | undefined>(
    undefined
  )

  // Track message source for proper scroll handling
  const [lastMessageSource, setLastMessageSource] = useState<'history' | 'new' | 'send'>('new')

  // Use refs for values needed in callbacks without triggering re-renders
  const hasMoreHistoryRef = useRef(true)
  const oldestMessageTimestampRef = useRef<number | undefined>(undefined)

  const abortControllerRef = useRef<AbortController | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const retryFunctionRef = useRef<(() => void) | null>(null)

  // Request deduplication tracking
  const activeRequestTimestampRef = useRef<number | null>(null)
  const lastRequestTimestampRef = useRef<number>(0)

  // Auto-save messages to localStorage whenever they change
  // Note: We intentionally only save when messages exist to avoid overwriting
  // with empty state during loading. The clear() function handles explicit deletion.
  // Never persist assistant-temp messages — they are ephemeral streaming placeholders.
  // If they leak into localStorage, a refresh mid-stream produces stuck spinners.
  useEffect(() => {
    if (messages.length > 0) {
      const persistable = messages.filter((msg) => msg.role !== 'assistant-temp')
      if (persistable.length > 0) {
        chatStorage.save(persistable)
      }
    }
  }, [messages])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const clearMessages = useCallback(async () => {
    logger.info('Clearing chat messages', { component: 'useChat' })

    // Clear local state immediately for responsive UI
    setMessages([])
    setError(null)
    setProgress(null)
    setStatus(null)

    // Clear ChatContext state
    setRenderedComponents({})
    setMessageContent({})
    setSelectedMessageId(null)
    setAiProcessingStatus(null)

    // Clear localStorage
    chatStorage.clear()

    // Clear persisted history from backend
    // IMPORTANT: We must await this BEFORE resetting historyLoaded to prevent
    // a race condition where loadHistory() refetches old messages from server
    try {
      await apiClient('/api/chatHistory', { method: 'DELETE' })
      logger.info('Chat history cleared from server', { component: 'useChat' })
    } catch (err) {
      logger.error('Failed to clear chat history from server', {
        error: err,
        component: 'useChat',
      })
    }

    // Reset pagination state AFTER server delete completes
    // This prevents loadHistory from being triggered while old data still exists
    setHistoryLoaded(true) // Mark as loaded (with empty state) to prevent auto-reload
    setHasMoreHistory(false) // No more history to load
    hasMoreHistoryRef.current = false
    setOldestMessageTimestamp(undefined)
    oldestMessageTimestampRef.current = undefined
  }, [setRenderedComponents, setMessageContent, setSelectedMessageId, setAiProcessingStatus])

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setLoading(false)
      setStatus(null)
      setProgress(null)
      setAiProcessingStatus(null)
      setMessages((prev) => prev.filter((msg) => msg.role !== 'assistant-temp'))
    }
  }, [setAiProcessingStatus])

  const loadHistory = useCallback(async () => {
    // Prevent loading history multiple times
    if (historyLoaded) {
      logger.debug('History already loaded, skipping', { component: 'useChat' })
      return
    }

    setIsInitialLoading(true)

    // STEP 1: Load from localStorage immediately for instant display
    // Filter out stale assistant-temp messages (from pre-fix localStorage) and
    // empty streaming zombies (interrupted streams with no content)
    const cachedMessages = chatStorage.load()
    const cleanedMessages = cachedMessages
      .filter((msg: any) => msg.role !== 'assistant-temp')
      .map((msg: any, index: number, arr: any[]) => {
        if (msg.role === 'assistant' && msg.status === 'streaming') {
          const prevMsg = index > 0 ? arr[index - 1] : null
          const userInput = prevMsg?.role === 'user' ? prevMsg.content : undefined
          return {
            ...msg,
            content: 'This response was interrupted. You can retry your question below.',
            isError: true,
            retryData: userInput ? { input: userInput } : undefined,
          }
        }
        return msg
      })
    if (cleanedMessages.length > 0) {
      logger.debug('Loaded messages from localStorage cache', {
        count: cleanedMessages.length,
        component: 'useChat',
      })

      // Transform components in cached messages
      const transformedMessages = cleanedMessages.map((msg: any) => ({
        ...msg,
        components: transformStoredComponents(msg.components || []),
      }))

      setMessages(transformedMessages)
      // Don't set historyLoaded yet - we still need to fetch from server
    }

    // STEP 2: Fetch from API to get authoritative data
    try {
      // Use new paginated endpoint for initial load (unified across all QB entities)
      const response = await apiClient('/api/chatHistory?paginated=true&limit=20')

      if (response.ok) {
        const data = await response.json()
        logger.debug('Loaded chat history from API', {
          messageCount: data.messages?.length || data.history?.length || 0,
          hasMore: data.hasMore,
          component: 'useChat',
        })

        // Handle paginated response
        if (data.messages) {
          // Deduplicate messages by ID
          const uniqueHistory = data.messages.reduce((acc: any[], msg: any) => {
            if (!acc.some((m) => m.id === msg.id)) {
              acc.push(msg)
            }
            return acc
          }, [])

          const serverMessages = uniqueHistory
            .map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.ts || Date.now()),
              memories: msg.memories || [],
              updatedMemories: msg.updatedMemories || [],
              deletedMemories: msg.deletedMemories || [],
              components: transformStoredComponents(msg.components || []),
              widgets: msg.widgets || [],
            }))
            // Transform zombie messages from interrupted streams into retry-able error messages
            .map((msg: any, index: number, arr: any[]) => {
              if (msg.role === 'assistant' && msg.status === 'streaming') {
                const prevMsg = index > 0 ? arr[index - 1] : null
                const userInput = prevMsg?.role === 'user' ? prevMsg.content : undefined
                return {
                  ...msg,
                  content: 'This response was interrupted. You can retry your question below.',
                  isError: true,
                  retryData: userInput ? { input: userInput } : undefined,
                }
              }
              return msg
            })

          // Merge with cached messages using deduplication
          setMessages((prev) => {
            if (prev.length === 0) {
              // No cache, use server data directly
              return serverMessages
            }
            // Merge server data with cache, preferring server data
            return mergeUniqueMessages(prev, serverMessages, false)
          })

          // Set pagination metadata
          setHasMoreHistory(data.hasMore || false)
          setOldestMessageTimestamp(data.oldestTimestamp)
          // Sync refs for use in callbacks
          hasMoreHistoryRef.current = data.hasMore || false
          oldestMessageTimestampRef.current = data.oldestTimestamp
        } else if (data.history) {
          // Fallback to legacy format
          const uniqueHistory = data.history.reduce((acc: any[], msg: any) => {
            if (!acc.some((m) => m.id === msg.id)) {
              acc.push(msg)
            }
            return acc
          }, [])

          const serverMessages = uniqueHistory
            .map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.ts || Date.now()),
              memories: msg.memories || [],
              updatedMemories: msg.updatedMemories || [],
              deletedMemories: msg.deletedMemories || [],
              components: transformStoredComponents(msg.components || []),
              widgets: msg.widgets || [],
            }))
            .map((msg: any, index: number, arr: any[]) => {
              if (msg.role === 'assistant' && msg.status === 'streaming') {
                const prevMsg = index > 0 ? arr[index - 1] : null
                const userInput = prevMsg?.role === 'user' ? prevMsg.content : undefined
                return {
                  ...msg,
                  content: 'This response was interrupted. You can retry your question below.',
                  isError: true,
                  retryData: userInput ? { input: userInput } : undefined,
                }
              }
              return msg
            })

          setMessages((prev) => {
            if (prev.length === 0) {
              return serverMessages
            }
            return mergeUniqueMessages(prev, serverMessages, false)
          })

          // For legacy format, assume there might be more
          setHasMoreHistory(true)
          if (uniqueHistory.length > 0) {
            const oldestTs = Math.min(...uniqueHistory.map((m: any) => m.ts))
            setOldestMessageTimestamp(oldestTs)
          }
        }

        setHistoryLoaded(true)
        setIsInitialLoading(false)
      }
    } catch (error) {
      logger.error('Failed to load chat history from API', {
        error,
        component: 'useChat',
      })
      // If API fails but we have cached messages, mark as loaded anyway
      if (cachedMessages.length > 0) {
        logger.info('Using cached messages after API failure', { component: 'useChat' })
        setHistoryLoaded(true)
      }
      setIsInitialLoading(false)
    }
  }, [historyLoaded])

  const loadMoreHistory = useCallback(async () => {
    // Check if already loading
    if (isLoadingMore) {
      logger.debug('Already loading more history', { component: 'useChat.loadMoreHistory' })
      return { success: false }
    }

    // Use refs for current values
    if (!hasMoreHistoryRef.current || !oldestMessageTimestampRef.current) {
      logger.debug('Cannot load more history', {
        hasMore: hasMoreHistoryRef.current,
        oldest: oldestMessageTimestampRef.current,
        component: 'useChat.loadMoreHistory',
      })
      return { success: false }
    }

    const currentOldest = oldestMessageTimestampRef.current

    // Check for duplicate request with same timestamp
    if (activeRequestTimestampRef.current === currentOldest) {
      logger.debug('Duplicate request already in progress', {
        timestamp: currentOldest,
        component: 'useChat.loadMoreHistory',
      })
      return { success: false }
    }

    // Check minimum time between requests (300ms)
    const now = Date.now()
    if (now - lastRequestTimestampRef.current < 300) {
      logger.debug('Request rate limited', {
        timeSinceLast: now - lastRequestTimestampRef.current,
        component: 'useChat.loadMoreHistory',
      })
      return { success: false }
    }

    // Set state and update ref immediately for synchronization
    setIsLoadingMore(true)
    activeRequestTimestampRef.current = currentOldest
    lastRequestTimestampRef.current = now

    // Abort any previous load request
    if (loadMoreAbortRef.current) {
      loadMoreAbortRef.current.abort()
    }

    loadMoreAbortRef.current = new AbortController()

    try {
      const response = await apiClient(
        `/api/chatHistory?paginated=true&limit=20&before=${currentOldest}`,
        { signal: loadMoreAbortRef.current.signal }
      )

      if (response.ok) {
        const data = await response.json()
        logger.debug('Loaded more history', {
          messageCount: data.messages?.length || 0,
          hasMore: data.hasMore,
          component: 'useChat.loadMoreHistory',
        })

        if (data.messages && data.messages.length > 0) {
          // Mark source as history
          setLastMessageSource('history')

          // Deduplicate and prepend older messages
          const newMessages = data.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.ts || Date.now()),
            memories: msg.memories || [],
            updatedMemories: msg.updatedMemories || [],
            deletedMemories: msg.deletedMemories || [],
            components: transformStoredComponents(msg.components || []),
            widgets: msg.widgets || [],
          }))

          setMessages((prev) => {
            // Use consistent deduplication utility to prepend older messages
            return mergeUniqueMessages(prev, newMessages, true)
          })

          // Update pagination metadata with immediate ref sync
          const hasMore = data.hasMore || false
          setHasMoreHistory(hasMore)
          hasMoreHistoryRef.current = hasMore // Sync immediately

          setOldestMessageTimestamp(data.oldestTimestamp)
          oldestMessageTimestampRef.current = data.oldestTimestamp // Sync immediately

          return { success: true }
        } else {
          // No more messages - sync immediately
          setHasMoreHistory(false)
          hasMoreHistoryRef.current = false // Sync immediately
          return { success: false }
        }
      }
      return { success: false }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        logger.error('Failed to load more history', { error, component: 'useChat.loadMoreHistory' })
      }
      return { success: false }
    } finally {
      setIsLoadingMore(false)
      activeRequestTimestampRef.current = null // Clear active request tracking
      loadMoreAbortRef.current = null
    }
  }, [isLoadingMore])

  /**
   * Parse SSE data with Zod schema validation
   * Validates event structure and logs warnings for malformed events
   */
  const parseSSEData = (data: string) => {
    // First, try schema-validated parsing
    const validatedEvent = parseSSEEvent(data)

    // If validation succeeded, map to internal format
    if (validatedEvent) {
      // Handle validated events with proper type narrowing
      if (isEventType(validatedEvent, 'start')) {
        return {
          type: 'start' as const,
          messageId: validatedEvent.messageId,
        }
      }

      if (isEventType(validatedEvent, 'status')) {
        return { type: 'status' as const, message: validatedEvent.message }
      }

      if (isEventType(validatedEvent, 'usage')) {
        return {
          type: 'usage' as const,
          inputTokens: validatedEvent.inputTokens,
          outputTokens: validatedEvent.outputTokens,
          totalTokens: validatedEvent.totalTokens,
          estimatedCost: validatedEvent.estimatedCost,
        }
      }

      if (isEventType(validatedEvent, 'progress')) {
        return { type: 'progress' as const, steps: validatedEvent.steps }
      }

      if (isEventType(validatedEvent, 'components')) {
        return { type: 'components' as const, data: validatedEvent.data }
      }

      if (isEventType(validatedEvent, 'visualization')) {
        return { type: 'visualization' as const, data: validatedEvent.data }
      }

      if (isEventType(validatedEvent, 'widget')) {
        return { type: 'widget' as const, data: validatedEvent.data, index: validatedEvent.index }
      }

      if (isEventType(validatedEvent, 'memory_created')) {
        return {
          type: 'memory_created' as const,
          memoryId: validatedEvent.memoryId,
          memoryType: validatedEvent.memoryType,
          content: validatedEvent.content,
        }
      }

      if (isEventType(validatedEvent, 'save_confirmed')) {
        return {
          type: 'save_confirmed' as const,
          messageId: validatedEvent.messageId,
          role: validatedEvent.role,
          success: validatedEvent.success,
          error: validatedEvent.error,
          // Legacy fields
          userMessageId: validatedEvent.userMessageId,
          assistantMessageId: validatedEvent.assistantMessageId,
        }
      }

      if (isEventType(validatedEvent, 'response')) {
        return {
          type: 'response' as const,
          content: validatedEvent.content,
          components: validatedEvent.components,
          widgets: validatedEvent.widgets,
          memories: validatedEvent.memories,
          updatedMemories: validatedEvent.updatedMemories,
          deletedMemories: validatedEvent.deletedMemories,
          learnTerms: validatedEvent.learnTerms,
        }
      }

      if (isEventType(validatedEvent, 'chunk')) {
        return { type: 'chunk' as const, content: validatedEvent.content }
      }

      if (isEventType(validatedEvent, 'token')) {
        return { type: 'token' as const, content: validatedEvent.content }
      }

      if (isEventType(validatedEvent, 'error')) {
        return {
          type: 'error' as const,
          error: validatedEvent.message,
          code: validatedEvent.code,
          retryable: validatedEvent.retryable,
          retryAfter: validatedEvent.retryAfter,
          retryAttempt: validatedEvent.retryAttempt,
          maxRetries: validatedEvent.maxRetries,
          retriesExhausted: validatedEvent.retriesExhausted,
        }
      }

      // Handle memory-related events
      if (isEventType(validatedEvent, 'memories')) {
        return { type: 'memories' as const, data: validatedEvent.data }
      }

      if (isEventType(validatedEvent, 'updatedMemories')) {
        return { type: 'updatedMemories' as const, data: validatedEvent.data }
      }

      if (isEventType(validatedEvent, 'deletedMemories')) {
        return { type: 'deletedMemories' as const, data: validatedEvent.data }
      }

      if (isEventType(validatedEvent, 'learnTerms')) {
        return { type: 'learnTerms' as const, data: validatedEvent.data }
      }

      if (isEventType(validatedEvent, 'suggestions')) {
        return { type: 'suggestions' as const, data: validatedEvent.data }
      }

      if (isEventType(validatedEvent, 'sources')) {
        return { type: 'sources' as const, data: validatedEvent.data }
      }

      if (isEventType(validatedEvent, 'ui_action_proposal')) {
        return { type: 'ui_action_proposal' as const, data: validatedEvent.data }
      }
    }

    // Fallback: try to parse as JSON and handle unvalidated events
    // This preserves backwards compatibility for events not yet in schema
    try {
      const parsed: any = JSON.parse(data)

      // Handle legacy token format
      if (parsed.token) {
        return { type: 'token' as const, content: parsed.token }
      }

      // Handle legacy error format (error field instead of message)
      if (parsed.error || parsed.type === 'error') {
        return {
          type: 'error' as const,
          error: parsed.error || parsed.message,
          code: parsed.code,
          retryable: parsed.retryable,
          retryAfter: parsed.retryAfter,
          retryAttempt: parsed.retryAttempt,
          maxRetries: parsed.maxRetries,
          retriesExhausted: parsed.retriesExhausted,
        }
      }

      // Log unknown event types for debugging
      if (parsed.type) {
        logger.debug('Unknown SSE event type received', {
          type: parsed.type,
          component: 'useChat.parseSSEData',
        })
      }

      return null
    } catch {
      // Not JSON - treat as raw token content
      return { type: 'token' as const, content: data }
    }
  }

  const send = useCallback(
    async (
      input: string,
      sendOptions?: {
        useAgent?: boolean
        displayContent?: string
      }
    ) => {
      if (!input.trim() || loading) return

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input,
        displayContent: sendOptions?.displayContent, // Use short version for UI if provided
        timestamp: new Date(),
        saveStatus: 'pending' as MessageStatus,
      }

      // Save user message to pending queue before sending
      chatStorage.savePending(userMessage)

      //setMessages((prev) => [...prev, userMessage])
      // Clear suggestions from previous assistant messages so they don't linger
      // when the user types a query instead of clicking a suggestion
      setMessages((prev) => [
        ...prev.map((msg) => (msg.suggestions ? { ...msg, suggestions: undefined } : msg)),
        userMessage,
      ])
      setLastMessageSource('send') // Mark as user sent message
      setProgress(null) // Reset progress tracker
      setLoading(true)
      setError(null)
      setStatus(null)

      // Set AI processing in chat context (don't clear visualizations to avoid flash)
      setAiProcessingStatus('Midas is analyzing your data...')

      const assistantMessage: Message = {
        id: crypto.randomUUID(), // Generate ID immediately
        role: 'assistant-temp',
        content: '',
        timestamp: new Date(),
        saveStatus: 'pending' as MessageStatus,
      }

      // Time-based batching for smoother streaming
      let lastUpdateTime = Date.now()
      const MIN_UPDATE_INTERVAL = 50 // Minimum 50ms between updates

      setMessages((prev) => [...prev, assistantMessage])

      // Save assistant message to pending queue
      chatStorage.savePending(assistantMessage)

      const retry = () => send(input, sendOptions)
      retryFunctionRef.current = retry

      try {
        abortControllerRef.current = new AbortController()

        const response = await apiClient('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            useAgent: sendOptions?.useAgent ?? true,
            userMessageId: userMessage.id, // Send frontend message ID for save confirmation tracking
            assistantMessageId: assistantMessage.id, // Send assistant message ID to ensure server uses same ID
            currentTheme: document.documentElement.classList.contains('theme-dark')
              ? 'dark'
              : 'light',
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch (parseError) {
            // JSON parse failed - likely received HTML error page
            const textResponse = await response.text()
            const isHtmlError =
              textResponse.trim().startsWith('<!DOCTYPE') || textResponse.trim().startsWith('<html')

            throw new Error(
              isHtmlError
                ? 'The AI service is temporarily unavailable. Please try again in a few moments.'
                : `Request failed: ${response.status}`
            )
          }

          // Handle no provider connected error - refresh session to redirect to dashboard
          if (
            response.status === 400 &&
            (errorData.code === 'NO_PROVIDER_CONNECTED' ||
              errorData.error === 'No financial provider connected')
          ) {
            // Prevent duplicate handling
            if (providerErrorHandledRef.current) {
              logger.debug('Provider error already handled, skipping', {
                component: 'useChat.send',
              })
              return
            }
            providerErrorHandledRef.current = true

            // Remove the temporary assistant message
            setMessages((prev) => prev.filter((msg) => msg.role !== 'assistant-temp'))
            setLoading(false)
            setStatus(null)
            setProgress(null)
            setAiProcessingStatus(null)

            logger.info('Provider not connected, refreshing session', { component: 'useChat.send' })

            // Refresh session to update requiresProviderConnection flag
            // The layout will redirect to /dashboard
            refetchSession().then(() => {
              logger.debug('Session refreshed after provider error', { component: 'useChat.send' })
              // Reset the flag after a delay
              setTimeout(() => {
                providerErrorHandledRef.current = false
              }, 5000)
            })

            return // Exit early without throwing error
          }

          if (response.status === 429) {
            // Rate limit error
            const resetTime = errorData.resetAt ? new Date(errorData.resetAt * 1000) : null
            const waitTime = resetTime ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : 60

            throw new Error(
              errorData.error ||
                `Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`
            )
          }

          throw new Error(errorData.error || `Request failed: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let components: any[] = []
        let widgets: any[] = [] // Memory widgets for [[WIDGET:N]] markers
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Add to buffer
          buffer += decoder.decode(value, { stream: true })

          // Process complete lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue
              if (!data) continue

              const parsed = parseSSEData(data)
              if (!parsed) continue

              switch (parsed.type) {
                case 'start':
                  // STABILITY FIX: Don't change message ID mid-stream
                  // This was causing React to unmount/remount the message component
                  // Instead, we keep using the client-generated ID for stability
                  // The server ID is stored but only used for persistence
                  aiDebug.hook.sseEvent({
                    type: 'start',
                    preview: `messageId: ${parsed.messageId}`,
                  })
                  if (parsed.remainingTokens !== undefined) {
                    setTokenUsage((prev) => ({
                      tokens: 0,
                      monthlyUsage: 0,
                      monthlyLimit: 0,
                      remainingTokens: parsed.remainingTokens,
                      ...prev,
                    }))
                  }
                  break

                case 'status':
                  aiDebug.hook.sseEvent({ type: 'status', preview: parsed.message })
                  setStatus(parsed.message)
                  // Update AI processing status in context
                  setAiProcessingStatus(parsed.message)
                  break

                case 'token':
                  assistantMessage.content += parsed.content

                  // Time-based batching for consistent streaming appearance
                  // Update at most once per MIN_UPDATE_INTERVAL to reduce re-renders
                  const now = Date.now()
                  const shouldUpdateNow =
                    assistantMessage.content.length < 30 || // First few chars immediately
                    now - lastUpdateTime >= MIN_UPDATE_INTERVAL // Then time-based

                  if (shouldUpdateNow) {
                    lastUpdateTime = now
                    setMessages((prev) => {
                      // Find existing message by ID (more efficient than filtering)
                      const existingIndex = prev.findIndex((msg) => msg.id === assistantMessage.id)

                      if (existingIndex >= 0) {
                        // Update in place without creating new array for unchanged items
                        const updated = [...prev]
                        updated[existingIndex] = {
                          ...prev[existingIndex],
                          content: assistantMessage.content,
                          role: 'assistant' as const,
                        }
                        return updated
                      }

                      // Message not found - add it (remove temp first)
                      const filtered = prev.filter((msg) => msg.role !== 'assistant-temp')
                      return [...filtered, { ...assistantMessage, role: 'assistant' as const }]
                    })
                  }
                  break

                case 'components':
                  aiDebug.hook.sseEvent({
                    type: 'components',
                    preview: `count: ${parsed.data?.length || 0}`,
                  })
                  components = parsed.data
                  assistantMessage.components = parsed.data

                  // Immediately add to context with current content
                  if (assistantMessage.id && parsed.data.length > 0) {
                    aiDebug.hook.componentsUpdated({
                      messageId: assistantMessage.id,
                      count: parsed.data.length,
                      types: parsed.data.map((c: any) => c.type || 'unknown'),
                    })
                    addComponentsToMessage(
                      assistantMessage.id,
                      parsed.data,
                      assistantMessage.content
                    )
                  }
                  break

                case 'ui_action_proposal':
                  // Handle UI action proposals from ui_action tool
                  if (parsed.data) {
                    window.dispatchEvent(
                      new CustomEvent('ui-action-execute', { detail: parsed.data })
                    )
                  }
                  break

                case 'visualization':
                  // Handle structured visualization from create_visualization tool
                  // Transform from tool format (chart:bar) to renderer format (type: chart, chartType: bar)
                  aiDebug.hook.visualizationReceived({ type: parsed.data?.type, raw: parsed.data })
                  const transformedViz = transformStructuredVisualization(parsed.data)
                  if (transformedViz) {
                    // Preserve vizIndex for inline marker matching [[VIZ:N]]
                    const vizIndex = parsed.data?.vizIndex ?? parsed.index
                    if (vizIndex != null) {
                      ;(transformedViz as any).vizIndex = vizIndex
                    }

                    aiDebug.hook.visualizationTransformed({
                      inputType: parsed.data?.type || 'unknown',
                      outputType: transformedViz.type,
                      success: true,
                    })
                    components.push(transformedViz)
                    assistantMessage.components = [
                      ...(assistantMessage.components || []),
                      transformedViz,
                    ]

                    // Update messages array with new components
                    // This ensures ChatMessage receives the updated components
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id
                          ? { ...msg, components: assistantMessage.components }
                          : msg
                      )
                    )

                    // Immediately register with context
                    // Cast to any[] since visualization blocks are compatible with the component system
                    if (assistantMessage.id) {
                      aiDebug.hook.componentsUpdated({
                        messageId: assistantMessage.id,
                        count: 1,
                        types: [transformedViz.type],
                      })
                      addComponentsToMessage(
                        assistantMessage.id,
                        [transformedViz] as any[],
                        assistantMessage.content
                      )
                    }
                  } else {
                    aiDebug.hook.visualizationTransformed({
                      inputType: parsed.data?.type || 'unknown',
                      outputType: 'null',
                      success: false,
                    })
                  }
                  break

                case 'widget':
                  // Handle memory widget from memory tool
                  // Widgets use [[WIDGET:N]] markers similar to [[VIZ:N]]
                  if (parsed.data) {
                    const widgetIndex = parsed.data?.widgetIndex || parsed.index
                    const widgetData = { ...parsed.data, widgetIndex }

                    logger.debug('Widget received', {
                      type: widgetData.type,
                      widgetIndex,
                      component: 'useChat.parseSSE',
                    })

                    widgets.push(widgetData)
                    assistantMessage.widgets = [...(assistantMessage.widgets || []), widgetData]

                    // Update messages array with new widgets
                    // This ensures ChatMessage receives the updated widgets
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id
                          ? { ...msg, widgets: assistantMessage.widgets }
                          : msg
                      )
                    )
                  }
                  break

                case 'suggestions':
                  // Handle follow-up suggestions parsed from [SUGGESTIONS] text block
                  if (parsed.data) {
                    assistantMessage.suggestions = parsed.data
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id ? { ...msg, suggestions: parsed.data } : msg
                      )
                    )
                  }
                  break

                case 'sources':
                  // Handle data source badges
                  if (parsed.data) {
                    assistantMessage.sources = parsed.data
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id ? { ...msg, sources: parsed.data } : msg
                      )
                    )
                  }
                  break

                case 'save_confirmed':
                  // Handle save confirmation from server
                  aiDebug.hook.sseEvent({
                    type: 'save_confirmed',
                    preview: `messageId: ${parsed.messageId}, success: ${parsed.success}`,
                  })
                  if (parsed.success) {
                    // Mark user message as successfully sent
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === userMessage.id
                          ? { ...msg, saveStatus: 'sent' as MessageStatus }
                          : msg
                      )
                    )
                  } else {
                    // Mark as failed with error
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === userMessage.id
                          ? {
                              ...msg,
                              saveStatus: 'failed' as MessageStatus,
                              saveError: parsed.error || 'Failed to save message',
                            }
                          : msg
                      )
                    )
                  }
                  break

                case 'usage':
                  // Store global token usage for monthly tracking
                  setTokenUsage({
                    tokens: parsed.tokens,
                    inputTokens: parsed.inputTokens,
                    outputTokens: parsed.outputTokens,
                    monthlyUsage: parsed.monthlyUsage,
                    monthlyLimit: parsed.monthlyLimit,
                    model: parsed.model,
                    provider: parsed.provider,
                    estimated: parsed.estimated,
                  })

                  // Also store token usage with the current assistant message
                  if (assistantMessage.id) {
                    assistantMessage.tokenUsage = {
                      tokens: parsed.tokens,
                      inputTokens: parsed.inputTokens,
                      outputTokens: parsed.outputTokens,
                      model: parsed.model,
                      provider: parsed.provider,
                      estimated: parsed.estimated,
                    }
                  }

                  aiDebug.hook.sseEvent({
                    type: 'usage',
                    preview: `tokens: ${parsed.tokens}, monthly: ${parsed.monthlyUsage}`,
                  })
                  break

                case 'progress':
                  setProgress({ steps: parsed.steps })
                  break

                case 'memory_created':
                  setMemoryCreated({
                    memoryId: parsed.memoryId,
                    memoryType: parsed.memoryType,
                    content: parsed.content,
                  })
                  // Trigger a custom event that components can listen to
                  window.dispatchEvent(
                    new CustomEvent('memory-created', {
                      detail: {
                        memoryId: parsed.memoryId,
                        memoryType: parsed.memoryType,
                        content: parsed.content,
                      },
                    })
                  )
                  break

                case 'response':
                  aiDebug.hook.sseEvent({
                    type: 'response',
                    preview: `contentLength: ${parsed.content?.length || 0}, components: ${parsed.components?.length || 0}`,
                  })
                  assistantMessage.content = parsed.content || ''
                  // NOTE: Don't overwrite components from response event - they were already
                  // received and properly transformed via 'visualization' events during streaming.
                  // The response.components contains raw tool output (type: "chart:pie") while
                  // our components array already has transformed data (type: "chart", chartType: "donut").
                  // Only add components if we somehow missed them during streaming.
                  if (
                    parsed.components &&
                    parsed.components.length > 0 &&
                    components.length === 0
                  ) {
                    // Transform any components that weren't received via visualization events
                    const transformedComponents = parsed.components
                      .map((c: any) => {
                        // Check if it needs transformation (has type like "chart:pie")
                        if (c.type && c.type.includes(':')) {
                          return transformStructuredVisualization(c)
                        }
                        return c
                      })
                      .filter(Boolean)

                    if (transformedComponents.length > 0) {
                      components = transformedComponents
                      assistantMessage.components = transformedComponents
                      if (assistantMessage.id) {
                        aiDebug.hook.componentsUpdated({
                          messageId: assistantMessage.id,
                          count: transformedComponents.length,
                          types: transformedComponents.map((c: any) => c.type || 'unknown'),
                        })
                        addComponentsToMessage(
                          assistantMessage.id,
                          transformedComponents,
                          assistantMessage.content || parsed.content
                        )
                      }
                    }
                  }
                  // Handle widgets from response (fallback if not received via widget events)
                  if (parsed.widgets && parsed.widgets.length > 0 && widgets.length === 0) {
                    widgets = parsed.widgets
                    assistantMessage.widgets = parsed.widgets
                    logger.debug('Widgets from response', {
                      widgetCount: parsed.widgets.length,
                      component: 'useChat.parseSSE',
                    })
                  }
                  if (parsed.reportData && assistantMessage.id) {
                    aiDebug.hook.sseEvent({ type: 'reportData', preview: 'Report data received' })
                    // Add chatResponse to the report data - use the full accumulated content
                    const reportDataWithResponse = {
                      ...parsed.reportData,
                      chatResponse: assistantMessage.content || parsed.content || '',
                    }
                    setReportData((prev) => ({
                      ...prev,
                      [assistantMessage.id]: reportDataWithResponse,
                    }))
                  }
                  if (parsed.memories && parsed.memories.length > 0) {
                    aiDebug.hook.sseEvent({
                      type: 'memories',
                      preview: `count: ${parsed.memories.length}`,
                    })
                    assistantMessage.memories = parsed.memories
                    // Emit event for memory creation
                    parsed.memories.forEach((memory: any) => {
                      window.dispatchEvent(
                        new CustomEvent('memory-created', {
                          detail: {
                            memoryId: memory.id,
                            memoryType: memory.type,
                            content: memory.content,
                          },
                        })
                      )
                    })
                  }
                  // Handle updated memories
                  if (parsed.updatedMemories && parsed.updatedMemories.length > 0) {
                    aiDebug.hook.sseEvent({
                      type: 'updatedMemories',
                      preview: `count: ${parsed.updatedMemories.length}`,
                    })
                    assistantMessage.updatedMemories = parsed.updatedMemories
                    parsed.updatedMemories.forEach((memory: any) => {
                      window.dispatchEvent(
                        new CustomEvent('memory-updated', {
                          detail: {
                            memoryId: memory.id,
                            memoryType: memory.type,
                            content: memory.content,
                          },
                        })
                      )
                    })
                  }
                  // Handle deleted memories
                  if (parsed.deletedMemories && parsed.deletedMemories.length > 0) {
                    aiDebug.hook.sseEvent({
                      type: 'deletedMemories',
                      preview: `count: ${parsed.deletedMemories.length}`,
                    })
                    assistantMessage.deletedMemories = parsed.deletedMemories
                    parsed.deletedMemories.forEach((memory: any) => {
                      window.dispatchEvent(
                        new CustomEvent('memory-deleted', {
                          detail: {
                            memoryId: memory.id,
                          },
                        })
                      )
                    })
                  }
                  if (parsed.learnTerms && parsed.learnTerms.length > 0) {
                    aiDebug.hook.sseEvent({
                      type: 'learnTerms',
                      preview: `count: ${parsed.learnTerms.length}`,
                    })
                    assistantMessage.learnTerms = parsed.learnTerms
                  }
                  // Include token usage if already set
                  if (!assistantMessage.tokenUsage && tokenUsage) {
                    assistantMessage.tokenUsage = {
                      tokens: tokenUsage.tokens,
                      inputTokens: tokenUsage.inputTokens,
                      outputTokens: tokenUsage.outputTokens,
                      model: tokenUsage.model,
                      provider: tokenUsage.provider,
                      estimated: tokenUsage.estimated,
                    }
                  }
                  setMessages((prev) => {
                    const filtered = prev.filter((msg) => msg.role !== 'assistant-temp')
                    const existingIndex = filtered.findIndex(
                      (msg) => msg.id === assistantMessage.id
                    )

                    if (existingIndex >= 0) {
                      const updated = [...filtered]
                      updated[existingIndex] = {
                        ...updated[existingIndex],
                        content: assistantMessage.content,
                        components: assistantMessage.components,
                        widgets: assistantMessage.widgets,
                        memories: assistantMessage.memories,
                        updatedMemories: assistantMessage.updatedMemories,
                        deletedMemories: assistantMessage.deletedMemories,
                        learnTerms: assistantMessage.learnTerms,
                      }
                      return updated
                    } else {
                      return [...filtered, { ...assistantMessage, role: 'assistant' as const }]
                    }
                  })
                  break

                case 'chunk':
                  assistantMessage.content += parsed.content
                  setMessages((prev) => {
                    const filtered = prev.filter((msg) => msg.role !== 'assistant-temp')
                    const existingIndex = filtered.findIndex(
                      (msg) => msg.id === assistantMessage.id
                    )

                    if (existingIndex >= 0) {
                      const updated = [...filtered]
                      updated[existingIndex] = {
                        ...updated[existingIndex],
                        content: assistantMessage.content,
                      }
                      return updated
                    } else {
                      return [...filtered, { ...assistantMessage, role: 'assistant' as const }]
                    }
                  })
                  break

                case 'error': {
                  // Create an error with additional properties including retry tracking
                  const error = new Error(parsed.error) as Error & {
                    code?: string
                    retryable?: boolean
                    retryAfter?: number
                    retryAttempt?: number
                    maxRetries?: number
                    retriesExhausted?: boolean
                  }
                  error.code = parsed.code
                  error.retryable = parsed.retryable
                  error.retryAfter = parsed.retryAfter
                  // Retry tracking fields
                  error.retryAttempt = parsed.retryAttempt
                  error.maxRetries = parsed.maxRetries
                  error.retriesExhausted = parsed.retriesExhausted
                  throw error
                }
              }
            }
          }
        }

        // Process any remaining buffer - attempt to parse incomplete data
        if (buffer.trim()) {
          const trimmedBuffer = buffer.trim()
          // Check if it's a complete SSE line that was just missing the final newline
          if (trimmedBuffer.startsWith('data: ')) {
            const data = trimmedBuffer.slice(6).trim()
            if (data && data !== '[DONE]') {
              try {
                const parsed = parseSSEData(data)
                if (parsed?.type === 'token' && parsed.content) {
                  // Append any remaining token content
                  assistantMessage.content += parsed.content
                } else if (parsed?.type === 'response') {
                  // Handle final response in buffer
                  assistantMessage.content = parsed.content || assistantMessage.content
                  if (parsed.components) {
                    assistantMessage.components = parsed.components
                  }
                }
              } catch (e) {
                // Log but don't fail - buffer may be truly incomplete
                logger.warn('Failed to parse remaining SSE buffer', {
                  buffer: trimmedBuffer.slice(0, 100),
                  component: 'useChat.send',
                })
              }
            }
          } else {
            // Not a standard SSE line, just log for debugging
            logger.warn('Incomplete SSE data in buffer', {
              buffer: trimmedBuffer.slice(0, 100),
              component: 'useChat.send',
            })
          }
        }

        // Update message to final state
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id || msg.role === 'assistant-temp'
              ? { ...assistantMessage, role: 'assistant' as const }
              : msg
          )
        )

        // Components already added in response handler
        if (components.length > 0 && assistantMessage.id) {
          aiDebug.hook.messageUpdated({
            messageId: assistantMessage.id,
            role: 'assistant',
            contentLength: assistantMessage.content.length,
            componentCount: components.length,
          })
        }

        options?.onFinish?.(assistantMessage)
      } catch (err) {
        // Handle abort specifically - don't show error message or log as error
        if (err instanceof Error && err.name === 'AbortError') {
          logger.debug('Request cancelled by user', { component: 'useChat.send' })
          setMessages((prev) => prev.filter((msg) => msg.role !== 'assistant-temp'))
          return
        }

        aiDebug.hook.error(err, 'Chat request failed')

        // Remove the temporary message
        setMessages((prev) => prev.filter((msg) => msg.role !== 'assistant-temp'))

        // Extract error information
        const errorWithProps = err as Error & {
          code?: string
          retryable?: boolean
          retryAfter?: number
          retryAttempt?: number
          maxRetries?: number
          retriesExhausted?: boolean
        }

        let errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'

        // Detect network disconnection
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
        const isNetworkError =
          isOffline ||
          (err instanceof TypeError && err.message.includes('Failed to fetch')) ||
          /fetch failed|networkerror|econnrefused|enotfound/i.test(errorMessage)

        // Make error message user-friendly
        if (isNetworkError) {
          errorMessage = 'Network connection lost. Please check your internet and try again.'
        } else if (errorMessage.includes('Request timed out')) {
          errorMessage =
            'The request took too long. Try asking a simpler question or breaking it into parts.'
        }

        // Create an error assistant message instead of using error banner
        const errorAssistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
          isError: true,
          retryData: {
            input: input,
            errorCode: isNetworkError ? 'NETWORK' : errorWithProps.code,
          },
        }

        // Add error message to chat
        setMessages((prev) => [...prev, errorAssistantMessage])

        // Still call onError callback for any external handling
        const chatError: ChatError = {
          message: errorMessage,
          code: errorWithProps.code,
          retryable: errorWithProps.retryable,
          retryAfter: errorWithProps.retryAfter,
          retry,
          retryAttempt: errorWithProps.retryAttempt,
          maxRetries: errorWithProps.maxRetries,
          retriesExhausted: errorWithProps.retriesExhausted,
        }
        options?.onError?.(chatError)
      } finally {
        setLoading(false)
        setStatus(null)
        setProgress(null)
        setAiProcessingStatus(null)
        abortControllerRef.current = null
        // Clear pending queue in ALL exit paths (success, error, abort)
        chatStorage.clearPending(userMessage.id)
        chatStorage.clearPending(assistantMessage.id)
      }
    },
    [loading, addComponentsToMessage, options, setAiProcessingStatus, refetchSession]
  )

  const retryMessage = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.role !== 'user' || message.saveStatus !== 'failed') {
        logger.warn('Cannot retry message', {
          messageId,
          found: !!message,
          role: message?.role,
          saveStatus: message?.saveStatus,
          component: 'useChat.retryMessage',
        })
        return
      }

      logger.info('Retrying failed message', { messageId, component: 'useChat.retryMessage' })

      // Mark as retrying
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, saveStatus: 'retrying' as MessageStatus, saveError: undefined }
            : m
        )
      )

      // Resend the message
      try {
        await send(message.content, { displayContent: message.displayContent })
        // On success, remove the failed message (the new attempt will create a new message)
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      } catch (error) {
        // If retry fails, mark as failed again
        logger.error('Retry failed', { messageId, error, component: 'useChat.retryMessage' })
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  saveStatus: 'failed' as MessageStatus,
                  saveError: error instanceof Error ? error.message : 'Retry failed',
                }
              : m
          )
        )
      }
    },
    [messages, send]
  )

  // Retry from an error message (assistant message with isError=true)
  const retryFromError = useCallback(
    async (errorMessageId: string) => {
      const errorMessage = messages.find((m) => m.id === errorMessageId)
      if (!errorMessage || !errorMessage.isError || !errorMessage.retryData?.input) {
        logger.warn('Cannot retry from error message', {
          messageId: errorMessageId,
          found: !!errorMessage,
          isError: errorMessage?.isError,
          hasRetryData: !!errorMessage?.retryData,
          component: 'useChat.retryFromError',
        })
        return
      }

      logger.info('Retrying from error message', {
        messageId: errorMessageId,
        component: 'useChat.retryFromError',
      })

      // Remove the error message before retrying
      setMessages((prev) => prev.filter((m) => m.id !== errorMessageId))

      // Clear any existing error state
      setError(null)

      // Resend the original input
      await send(errorMessage.retryData.input)
    },
    [messages, send]
  )

  // Cleanup on unmount - abort pending requests to prevent memory leaks
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (loadMoreAbortRef.current) {
        loadMoreAbortRef.current.abort()
        loadMoreAbortRef.current = null
      }
    }
  }, [])

  return {
    messages,
    loading,
    error,
    status,
    tokenUsage,
    progress,
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
    // Pagination functions and state
    loadMoreHistory,
    isLoadingMore,
    hasMoreHistory,
    lastMessageSource,
    setLastMessageSource,
  }
}
