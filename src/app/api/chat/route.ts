// src/app/api/chat/route.ts
// Chat API with LangGraph streaming and improved error handling

import { createAgent, type AgentStateType } from '@/ai/agent'
import { clearThreadState } from '@/ai/checkpointer'
import { prepareContext, routeQuery } from '@/ai/router'
import { resetVisualizationIndex, resetWidgetIndex } from '@/ai/tools'
import type { WidgetBlock } from '@/ai/widgets/types'
import { fetchLastN, saveMessage } from '@/lib/chatHistory'
import { aiDebug } from '@/lib/debug'
import { classifyError, getUserMessage, getHttpStatus } from '@/lib/errors/classifier'
import { estimateTokens, generateCorrelationId, logger } from '@/lib/logger'
import { getRetryDelay, RETRY_CONFIG } from '@/lib/utils/retry'
import { parseChatRequest } from '@/lib/schemas/chat'
import type { ProviderID } from '@/lib/providers/database'
import { getProviderCompanyMetadata, getProviderCredentialsFromDB } from '@/lib/providers/database'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { NextResponse } from 'next/server'

// =============================================================================
// Configuration
// =============================================================================

const RATE_LIMIT = 15
const RATE_WINDOW = 60 * 1000
const RECURSION_LIMIT = 50
const MAX_RETRIES = RETRY_CONFIG.maxRetries // Default: 3 retries with exponential backoff
const STREAM_TIMEOUT_MS = 60000 // 60 seconds - patient timeout for long responses

// Rate limiting store
const userRequestBuckets = new Map<string, { count: number; resetAt: number }>()
const BUCKET_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
let lastBucketCleanup = Date.now()

/**
 * Clean up expired rate limit buckets to prevent memory leak
 * Runs lazily during rate limit checks
 */
function cleanupExpiredBuckets(): void {
  const now = Date.now()
  // Only run cleanup every 5 minutes
  if (now - lastBucketCleanup < BUCKET_CLEANUP_INTERVAL) return
  lastBucketCleanup = now

  let cleaned = 0
  for (const [userId, bucket] of userRequestBuckets.entries()) {
    if (bucket.resetAt < now) {
      userRequestBuckets.delete(userId)
      cleaned++
    }
  }
  if (cleaned > 0) {
    logger.debug('[Chat API] Cleaned expired rate limit buckets', {
      cleaned,
      remaining: userRequestBuckets.size,
    })
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Safely send an SSE event to the stream controller.
 * Returns false if the controller is closed.
 */
function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: Record<string, unknown>
): boolean {
  try {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    return true
  } catch (error) {
    // Controller may be closed - this is expected during timeouts or client disconnects
    if ((error as Error).message?.includes('Controller is already closed')) {
      logger.debug('[Chat:API] Controller closed, skipping event', { eventType: data.type })
    } else {
      aiDebug.api.error(error, 'Failed to send event')
    }
    return false
  }
}

/**
 * Safely send the [DONE] marker to close the SSE stream.
 */
function sendDone(controller: ReadableStreamDefaultController, encoder: TextEncoder): boolean {
  try {
    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    return true
  } catch (error) {
    // Controller may be closed
    if (!(error as Error).message?.includes('Controller is already closed')) {
      aiDebug.api.error(error, 'Failed to send DONE')
    }
    return false
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wraps an async generator with a timeout that tracks inactivity.
 * Calls onTimeout when no events have been received for timeoutMs.
 */
async function* withStreamTimeout<T>(
  stream: AsyncIterable<T>,
  timeoutMs: number,
  onTimeout: () => void
): AsyncGenerator<T> {
  let lastActivity = Date.now()
  let timedOut = false

  // Check for timeout periodically
  const checkInterval = setInterval(() => {
    if (!timedOut && Date.now() - lastActivity > timeoutMs) {
      timedOut = true
      onTimeout()
    }
  }, 1000) // Check every second

  try {
    for await (const item of stream) {
      if (timedOut) break
      lastActivity = Date.now()
      yield item
    }
  } finally {
    clearInterval(checkInterval)
  }
}

// =============================================================================
// Stream Handler with Retry Logic
// =============================================================================

interface StreamContext {
  agent: ReturnType<typeof createAgent>
  initialState: Partial<AgentStateType>
  configurable: Record<string, unknown>
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
}

async function* streamWithRetry(
  context: StreamContext,
  attempt: number = 0
): AsyncGenerator<{ type: string; data: any }> {
  const { agent, initialState, configurable, controller, encoder } = context

  try {
    // Pass full initial state including prefetchedData, memories, contextMeta
    // The checkpointer will persist this state across requests for the same thread_id
    const eventStream = agent.streamEvents(initialState, {
      configurable,
      version: 'v2',
      recursionLimit: RECURSION_LIMIT,
    } as any)

    for await (const event of eventStream) {
      yield { type: event.event, data: event }
    }
  } catch (error) {
    const errorClass = classifyError(error)

    logger.error('[Chat:API] Stream error', {
      attempt: attempt + 1,
      maxRetries: MAX_RETRIES,
      errorType: errorClass.type,
      retryable: errorClass.retryable,
      error: error instanceof Error ? error.message : String(error),
    })

    if (errorClass.retryable && attempt < MAX_RETRIES) {
      const delay = getRetryDelay(attempt)
      sendEvent(controller, encoder, {
        type: 'status',
        message: errorClass.userMessage,
        retryAttempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        retryDelayMs: delay,
      })

      await sleep(delay)

      // Recursive retry with exponential backoff
      yield* streamWithRetry(context, attempt + 1)
    } else {
      // All retries exhausted or non-retryable error
      sendEvent(controller, encoder, {
        type: 'error',
        error: errorClass.userMessage,
        code: errorClass.type,
        retryable: errorClass.retryable,
        retriesExhausted: attempt >= MAX_RETRIES,
        retryAttempt: attempt + 1,
        maxRetries: MAX_RETRIES,
      })
      throw error
    }
  }
}

// =============================================================================
// Main Handler
// =============================================================================

export const POST = withActiveProvider(
  async (request, { provider, apiClient, organizationId, userId, providerId, realmId }) => {
    try {
      // 1. Rate limiting (with lazy cleanup of expired buckets)
      cleanupExpiredBuckets()
      const now = Date.now()
      const bucket = userRequestBuckets.get(userId) || { count: 0, resetAt: now + RATE_WINDOW }

      if (now > bucket.resetAt) {
        bucket.count = 0
        bucket.resetAt = now + RATE_WINDOW
      }

      if (bucket.count >= RATE_LIMIT) {
        return NextResponse.json(
          {
            error: `Rate limit exceeded. Please wait ${Math.ceil((bucket.resetAt - now) / 1000)} seconds.`,
          },
          { status: 429 }
        )
      }

      bucket.count++
      userRequestBuckets.set(userId, bucket)

      // 2. Parse and validate request with Zod schema
      let requestBody: unknown
      try {
        requestBody = await request.json()
      } catch {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
      }

      const parseResult = parseChatRequest(requestBody)
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: parseResult.error,
            details: parseResult.details,
          },
          { status: 400 }
        )
      }

      const {
        input,
        userMessageId: frontendUserMessageId,
        assistantMessageId: frontendAssistantMessageId,
        currentTheme,
      } = parseResult.data

      // Generate correlation ID and track request start time
      const correlationId = generateCorrelationId()
      const startTime = Date.now()
      const userMessageId = frontendUserMessageId || crypto.randomUUID()

      // Log user question with beautiful formatting
      logger.question(input, {
        correlationId,
        userId,
        conversationId: `${userId}_${organizationId}`,
        messageId: userMessageId,
      })

      // 3. Get organization metadata
      const storedMetadata = await getProviderCompanyMetadata(
        organizationId,
        providerId as ProviderID
      )
      let currency = storedMetadata.homeCurrency || 'USD'
      const companyName = storedMetadata.companyName || 'Your Organization'

      // 4. Route the query and prepare context
      const route = routeQuery(input)
      logger.routing({
        intent: route.intent,
        confidence: route.confidence,
        tier: route.matchedTier,
        reports: route.reports,
      })

      // Prepare context (pre-fetch if high confidence, always fetch aligned memories)
      // Handle errors gracefully for new users who may not have any data yet
      let preparedContext: {
        route: typeof route
        prefetchedData: Record<string, unknown>
        memories: string
        fetchDuration: number
      }
      try {
        preparedContext = await prepareContext({
          route,
          organizationId,
          userId,
          realmId, // Active QB company ID — used for tool context and memory scoping
          provider,
          apiClient,
          currency,
        })

        logger.debug('[Router] Context prepared', {
          prefetchedReports: Object.keys(preparedContext.prefetchedData),
          hasMemories: preparedContext.memories.length > 0,
          duration: preparedContext.fetchDuration,
        })
      } catch (contextError) {
        // For new users or if context prep fails, use minimal context
        logger.warn('[Chat:API] Context preparation failed, using minimal context', {
          error: contextError instanceof Error ? contextError.message : String(contextError),
          userId,
          correlationId,
        })
        preparedContext = {
          route,
          prefetchedData: {},
          memories: '',
          fetchDuration: 0,
        }
      }

      // 5. Create streaming response
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          // Use frontend-provided assistant message ID if available for consistent deduplication
          const messageId = frontendAssistantMessageId || crypto.randomUUID()
          // Unified thread across all QB entities — agent gets active realmId from configurable
          const threadId = `${userId}_${organizationId}`

          // Reset visualization and widget indices for this request
          resetVisualizationIndex()
          resetWidgetIndex()

          // Track state during streaming
          let fullResponse = ''
          const visualizations: any[] = []
          const widgets: WidgetBlock[] = []
          const toolCallsInfo: Array<{ name: string; hasData: boolean }> = []

          // Track memory operations for the response
          const createdMemories: Array<{ id: string; type: string; content: string }> = []
          const updatedMemories: Array<{ id: string; type: string; content: string }> = []
          const deletedMemories: Array<{ id: string; type?: string; content?: string }> = []

          // Track timing for TTFT
          let timeToFirstToken: number | undefined

          // Track per-tool duration for structured logging
          const toolStartTimes = new Map<string, number>()

          // Step counter for sequential flow logging
          let stepCounter = 0

          try {
            // Send start event
            sendEvent(controller, encoder, {
              type: 'start',
              messageId,
              remainingTokens: RATE_LIMIT - bucket.count,
            })

            // Save user message and wait for confirmation before streaming
            // This ensures the user message is persisted before we start generating the response
            // Use frontend-provided ID if available for save confirmation tracking
            const userMessageId = frontendUserMessageId || crypto.randomUUID()
            try {
              await saveMessage(userId, {
                id: userMessageId,
                role: 'user',
                content: input,
                ts: Date.now(),
              })
              // Emit save confirmation for user message
              sendEvent(controller, encoder, {
                type: 'save_confirmed',
                messageId: userMessageId,
                role: 'user',
                success: true,
              })
            } catch (saveError) {
              // Log but don't fail the request - user can still chat even if history save fails
              logger.warn('[Chat:API] Failed to save user message', {
                error: saveError instanceof Error ? saveError.message : String(saveError),
                userId,
                correlationId,
              })
              // Emit save failure for user message
              sendEvent(controller, encoder, {
                type: 'save_confirmed',
                messageId: userMessageId,
                role: 'user',
                success: false,
                error: saveError instanceof Error ? saveError.message : 'Failed to save message',
              })
            }

            // Create initial assistant message record immediately with empty content
            // This prevents data loss if user refreshes during streaming
            // IMPORTANT: Use a fixed timestamp so the final save overwrites this record
            // (same PK + SK = same DynamoDB item, prevents duplicate records issue)
            const assistantMessageTimestamp = Date.now()
            try {
              await saveMessage(userId, {
                id: messageId,
                role: 'assistant',
                content: '',
                ts: assistantMessageTimestamp,
                status: 'streaming',
              })
            } catch (saveError) {
              logger.warn('[Chat:API] Failed to create initial assistant message', {
                error: saveError instanceof Error ? saveError.message : String(saveError),
                userId,
                messageId,
                correlationId,
              })
            }

            // Send status
            sendEvent(controller, encoder, {
              type: 'status',
              message: 'Analyzing your request...',
            })

            // Get chat history (handle empty/new users gracefully)
            // Unified across all QB entities — no realmId filtering
            let chatHistory: (HumanMessage | AIMessage)[] = []
            try {
              const recentMessages = await fetchLastN(userId, 15)
              // Deduplicate messages to prevent AI from seeing duplicates
              // 1. Filter by message ID (guards against DB edge cases)
              // 2. Filter consecutive identical user messages (guards against double-sends)
              const seenIds = new Set<string>()
              let lastUserContent = ''
              const uniqueMessages = recentMessages.filter((msg) => {
                // Skip duplicate IDs
                if (seenIds.has(msg.id)) {
                  logger.warn('[Chat:API] Duplicate message ID filtered from AI context', {
                    messageId: msg.id,
                    userId,
                    correlationId,
                  })
                  return false
                }
                seenIds.add(msg.id)

                // Skip consecutive duplicate user messages (same content)
                if (msg.role === 'user') {
                  if (msg.content === lastUserContent) {
                    logger.warn('[Chat:API] Duplicate user content filtered from AI context', {
                      messageId: msg.id,
                      contentPreview: msg.content.slice(0, 50),
                      userId,
                      correlationId,
                    })
                    return false
                  }
                  lastUserContent = msg.content
                }
                return true
              })
              chatHistory = uniqueMessages.map((m) =>
                m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
              )
            } catch (historyError) {
              // Log but continue with empty history for new users
              logger.warn(
                '[Chat:API] Failed to fetch chat history, continuing with empty history',
                {
                  error:
                    historyError instanceof Error ? historyError.message : String(historyError),
                  userId,
                  correlationId,
                }
              )
            }

            // Reset checkpointer thread to prevent cross-request message accumulation.
            // Chat history is loaded fresh from DynamoDB each request — the checkpointer
            // is only needed for within-request state (agent→tools→agent loops).
            await clearThreadState(threadId)

            // Create agent with stateful checkpointer
            const agent = createAgent()

            // Determine connected providers and BC schema info for multi-provider context
            const connectedProviders: string[] = []
            const providerEntityNames: Record<string, string> = {}
            let bcSchemas: string[] = []
            let bcDefaultSchema = ''

            // Check for QuickBooks connections independently (not tied to active provider)
            // This ensures QB is listed in connectedProviders even when BC is the active provider
            let qbCompanies: Array<{ realmId: string; name: string; connected: boolean }> = []
            const disconnectedProviders: string[] = []
            try {
              const { listQBConnections } = await import('@/lib/providers/database')
              const result = await listQBConnections(organizationId)
              const connectedQBCompanies = result.connections.filter((c) => c.connected)
              if (connectedQBCompanies.length > 0) {
                connectedProviders.push('quickbooks')
                qbCompanies = result.connections.map((c) => ({
                  realmId: c.realmId,
                  name: c.companyName || `QB Company ${c.realmId.slice(-4)}`,
                  connected: c.connected,
                }))
                providerEntityNames['quickbooks'] = qbCompanies.map((c) => c.name).join(', ')
              } else if (result.connections.length > 0) {
                // QB companies exist but ALL are disconnected
                disconnectedProviders.push('quickbooks')
              }
            } catch {
              // Fallback: check if the active provider is QB (from withActiveProvider)
              if (providerId === 'quickbooks' && provider && apiClient) {
                connectedProviders.push('quickbooks')
                if (realmId && companyName) {
                  qbCompanies = [{ realmId, name: companyName, connected: true }]
                  providerEntityNames['quickbooks'] = companyName
                }
              }
            }

            // Check for BC/Dynamics warehouse connection
            try {
              const { getOrganizationWarehouseConfig } = await import(
                '@/lib/redshift/warehouse-access'
              )
              const { config: warehouseConfig } =
                await getOrganizationWarehouseConfig(organizationId)
              if (warehouseConfig?.enabled && warehouseConfig.schemas?.length > 0) {
                connectedProviders.push('dynamics')
                bcSchemas = warehouseConfig.schemas.map((s) => s.schema_name)
                bcDefaultSchema = warehouseConfig.default_schema || bcSchemas[0] || ''
              }
            } catch {
              // Warehouse not configured - that's OK
            }

            // Check for BC OAuth direct API connection
            let bcOAuthConnection:
              | {
                  connectionId: string
                  tenantId: string
                  environmentName: string
                  companyId: string
                }
              | undefined
            try {
              const { getActiveBCConnectionId, getBCConnectionCredentials } = await import(
                '@/lib/providers/database'
              )
              const activeConnId = await getActiveBCConnectionId(organizationId)
              if (activeConnId) {
                const creds = await getBCConnectionCredentials(organizationId, activeConnId)
                if (creds && (creds as any).connected && (creds as any).tenant_id) {
                  bcOAuthConnection = {
                    connectionId: activeConnId,
                    tenantId: (creds as any).tenant_id,
                    environmentName: (creds as any).environment_name,
                    companyId: (creds as any).company_id,
                  }
                  // Add dynamics to connected providers if not already there (from warehouse)
                  if (!connectedProviders.includes('dynamics')) {
                    connectedProviders.push('dynamics')
                  }
                  // Set company name and currency from OAuth connection
                  if ((creds as any).company_name) {
                    providerEntityNames['dynamics'] = (creds as any).company_name
                  }
                  if (currency === 'USD' && (creds as any).home_currency) {
                    currency = (creds as any).home_currency
                  }
                } else {
                  console.warn('[BC OAuth] Credentials check failed for connection', activeConnId, {
                    hasCreds: !!creds,
                    connected: creds ? (creds as any).connected : null,
                    hasTenantId: creds ? !!(creds as any).tenant_id : false,
                  })
                }
              } else {
                console.warn('[BC OAuth] No active BC connection ID found for org', organizationId)
              }
            } catch (bcOAuthErr) {
              console.warn('[BC OAuth] Failed to load BC OAuth connection', bcOAuthErr)
            }

            // Resolve entity names from provider credentials (same pattern as dashboard)
            // QB: company_name directly on credentials
            // BC: company_name nested inside credentials.schemas[]
            if (!providerEntityNames['quickbooks'] && connectedProviders.includes('quickbooks')) {
              try {
                const qbMeta = await getProviderCompanyMetadata(organizationId, 'quickbooks')
                if (qbMeta.companyName) {
                  providerEntityNames['quickbooks'] = qbMeta.companyName
                }
              } catch {
                // OK - fallback to generic name
              }
            }
            let bcSchemaToCompany: Record<string, string> = {}
            if (connectedProviders.includes('dynamics')) {
              try {
                const bcCreds = await getProviderCredentialsFromDB(organizationId, 'dynamics')
                if (bcCreds) {
                  const schemas = (bcCreds as any).schemas as any[] | undefined
                  if (schemas?.length) {
                    // Build schema_name → company_name lookup map
                    for (const s of schemas) {
                      if (s.schema_name && s.company_name) {
                        bcSchemaToCompany[s.schema_name] = s.company_name
                      }
                    }
                    const bcEntityName = schemas
                      .map((s: any) => s.company_name)
                      .filter(Boolean)
                      .join(', ')
                    if (bcEntityName) {
                      providerEntityNames['dynamics'] = bcEntityName
                    }
                  } else if (bcCreds.company_name) {
                    providerEntityNames['dynamics'] = bcCreds.company_name
                  }
                  // Override currency from BC credentials if the org-level default is still USD.
                  // BC stores home_currency in credentials when available.
                  if (currency === 'USD' && (bcCreds as any).home_currency) {
                    currency = (bcCreds as any).home_currency
                  }
                }
              } catch {
                // OK - fallback to generic name
              }
            }

            logger.providers({
              connected: connectedProviders,
              entities: providerEntityNames,
              activeRealmId: realmId,
              bcSchemas: bcSchemas.length > 0 ? bcSchemas : undefined,
              bcDefaultSchema: bcDefaultSchema || undefined,
            })

            // Build configurable context for tools (runtime config)
            // thread_id is REQUIRED by MemorySaver checkpointer for state persistence
            // sessionId is REQUIRED by visualization tool to track vizIndex per session
            const configurable = {
              thread_id: threadId, // Required for checkpointer
              sessionId: threadId, // Required for visualization tool vizIndex tracking
              organizationId,
              userId,
              realmId, // Active QB company ID — used by tools to know which entity to query
              provider,
              apiClient,
              currency,
              companyName,
              threadId,
              correlationId,
              // Router-provided context (also in state but needed for tool execution)
              queryRoute: preparedContext.route,
              // Multi-provider context
              connectedProviders,
              disconnectedProviders,
              qbCompanies,
              activeQbRealmId: realmId,
              bcSchemas,
              bcDefaultSchema,
              bcSchemaToCompany,
              bcCompanyName: bcDefaultSchema
                ? bcSchemaToCompany[bcDefaultSchema] || providerEntityNames['dynamics']
                : providerEntityNames['dynamics'] || undefined,
              bcOAuthConnection,
              // UI state
              currentTheme,
            }

            // Build initial state with all stateful data
            // This gets persisted by the checkpointer for self-awareness
            const initialState: Partial<AgentStateType> = {
              messages: [...chatHistory, new HumanMessage(input)],
              prefetchedData: preparedContext.prefetchedData,
              memories: preparedContext.memories,
              contextMeta: {
                companyName,
                currency,
                userId,
                organizationId,
                currentTheme,
              },
              toolResults: [],
            }

            // Stream with retry support
            const streamContext: StreamContext = {
              agent,
              initialState,
              configurable,
              controller,
              encoder,
            }

            let tokenCount = 0
            let lastSaveTime = Date.now()
            const SAVE_INTERVAL = 3000 // Update every 3 seconds during streaming

            // Helper function to update assistant message during streaming
            // Uses same timestamp as initial save to update the same DynamoDB record
            const updateStreamingMessage = async () => {
              try {
                await saveMessage(userId, {
                  id: messageId,
                  role: 'assistant',
                  content: fullResponse,
                  ts: assistantMessageTimestamp,
                  status: 'streaming',
                  ...(visualizations.length > 0 && { components: visualizations }),
                  ...(widgets.length > 0 && { widgets: widgets }),
                })
              } catch (saveError) {
                // Log but don't interrupt streaming
                logger.warn('[Chat:API] Failed to update streaming message', {
                  error: saveError instanceof Error ? saveError.message : String(saveError),
                  userId,
                  messageId,
                  correlationId,
                })
              }
            }

            // Track if stream timed out
            let streamTimedOut = false

            // Wrap stream with timeout - close stream and send error on timeout
            const timeoutHandler = () => {
              streamTimedOut = true
              logger.warn('[Chat:API] Stream timeout', {
                correlationId,
                userId,
                timeoutMs: STREAM_TIMEOUT_MS,
                tokensGenerated: tokenCount,
              })
              sendEvent(controller, encoder, {
                type: 'error',
                error: 'Request timed out. The response took too long.',
                code: 'STREAM_TIMEOUT',
                retryable: true,
              })
            }

            const timedStream = withStreamTimeout(
              streamWithRetry(streamContext),
              STREAM_TIMEOUT_MS,
              timeoutHandler
            )

            for await (const { type: eventType, data: event } of timedStream) {
              // Exit early if stream timed out
              if (streamTimedOut) break

              // Token streaming from the LLM
              if (eventType === 'on_chat_model_stream') {
                const chunk = event.data?.chunk
                if (chunk?.content && typeof chunk.content === 'string') {
                  fullResponse += chunk.content
                  tokenCount++

                  // Capture time to first token
                  if (timeToFirstToken === undefined) {
                    timeToFirstToken = Date.now() - startTime
                  }

                  sendEvent(controller, encoder, {
                    type: 'token',
                    content: chunk.content,
                  })

                  // Periodically save progress to prevent data loss on refresh
                  const now = Date.now()
                  if (now - lastSaveTime >= SAVE_INTERVAL) {
                    lastSaveTime = now
                    // Non-blocking update
                    updateStreamingMessage().catch(() => {
                      // Already logged in updateStreamingMessage
                    })
                  }
                }
              }

              // Agent planning — LLM finished generating, capture tool call decisions
              if (eventType === 'on_chat_model_end') {
                const output = event.data?.output
                if (output?.tool_calls && output.tool_calls.length > 0) {
                  stepCounter++
                  logger.planning({
                    step: stepCounter,
                    toolCalls: output.tool_calls.map((tc: any) => ({
                      name: tc.name,
                      args: tc.args || {},
                    })),
                    hasTextContent: !!(
                      output.content &&
                      typeof output.content === 'string' &&
                      output.content.trim()
                    ),
                    textPreview:
                      output.content && typeof output.content === 'string'
                        ? output.content.slice(0, 150)
                        : undefined,
                  })
                } else if (!output?.tool_calls || output.tool_calls.length === 0) {
                  // Agent decided to respond directly (no tool calls)
                  stepCounter++
                  logger.step(stepCounter, 'Agent generating final response')
                }
              }

              // Tool execution started
              if (eventType === 'on_tool_start') {
                const toolName = event.name || 'tool'
                const toolInput = event.data?.input

                // Track tool start time for duration calculation
                toolStartTimes.set(toolName, Date.now())

                // Beautiful tool logging with clean JSON input
                logger.toolStart(toolName, toolInput)
                if (toolInput && typeof toolInput === 'object') {
                  logger.toolInput(toolName, toolInput as Record<string, unknown>)
                }

                // Generate user-friendly status message (abstracted - no internal tool names exposed)
                let statusMessage = 'Processing...'
                if (toolName === 'quickbooks_data') {
                  const report = toolInput?.query || 'data'
                  // Map report types to user-friendly labels
                  const reportLabels: Record<string, string> = {
                    profit_loss: 'profit and loss',
                    balance_sheet: 'balance sheet',
                    cash_flow: 'cash flow statement',
                    executive_summary: 'executive summary',
                    sales_by_customer: 'sales data',
                    vendor_expenses: 'vendor expenses',
                    ar_aging: 'accounts receivable',
                    ap_aging: 'accounts payable',
                    financial_health: 'financial health metrics',
                    profit_loss_comparison: 'comparative analysis',
                    trial_balance: 'trial balance',
                  }
                  const friendlyReport = reportLabels[report] || report.replace(/_/g, ' ')
                  statusMessage = `Retrieving ${friendlyReport}...`
                } else if (toolName === 'business_central_data') {
                  const bcReportType =
                    toolInput?.reportType ||
                    toolInput?.entityType ||
                    toolInput?.metricName ||
                    'data'
                  const bcLabels: Record<string, string> = {
                    trial_balance: 'trial balance',
                    profit_loss: 'profit and loss',
                    balance_sheet: 'balance sheet',
                    cash_flow: 'cash flow statement',
                    aged_receivables: 'accounts receivable aging',
                    aged_payables: 'accounts payable aging',
                    sales_by_customer: 'sales by customer',
                    purchases_by_vendor: 'vendor purchases',
                    inventory_valuation: 'inventory valuation',
                    monthly_pnl_trend: 'monthly P&L trend',
                    customer: 'customer data',
                    vendor: 'vendor data',
                    item: 'item data',
                    account: 'chart of accounts',
                  }
                  const friendlyBC = bcLabels[bcReportType] || bcReportType.replace(/_/g, ' ')
                  statusMessage = `Retrieving BC ${friendlyBC}...`
                } else if (toolName === 'financial_calculator') {
                  const calcLabels: Record<string, string> = {
                    burn_rate: 'burn rate',
                    runway: 'cash runway',
                    break_even: 'break-even analysis',
                    what_if: 'scenario analysis',
                  }
                  const calc = toolInput?.calculation || 'metrics'
                  statusMessage = `Calculating ${calcLabels[calc] || calc.replace(/_/g, ' ')}...`
                } else if (toolName === 'create_visualization') {
                  statusMessage = 'Preparing visualization...'
                } else if (toolName === 'memory') {
                  const action = toolInput?.action || 'accessing'
                  const actionLabels: Record<string, string> = {
                    remember: 'Saving to memory...',
                    search: 'Searching saved items...',
                    list: 'Loading saved items...',
                    update: 'Updating saved item...',
                    forget: 'Removing from memory...',
                  }
                  statusMessage = actionLabels[action] || 'Accessing saved items...'
                } else if (toolName === 'web_search') {
                  statusMessage = 'Searching the web...'
                } else if (toolName === 'stock_price') {
                  statusMessage = 'Fetching market data...'
                } else if (toolName === 'ui_action') {
                  statusMessage = 'Updating interface...'
                }

                sendEvent(controller, encoder, {
                  type: 'status',
                  message: statusMessage,
                })
              }

              // Tool execution completed
              if (eventType === 'on_tool_end') {
                const toolName = event.name || 'tool'
                const output = event.data?.output

                // Extract content from ToolMessage object or use raw output
                let outputContent: string | undefined
                if (output && typeof output === 'object') {
                  outputContent = output.content || output.text || JSON.stringify(output)
                } else {
                  outputContent = output
                }

                // Track tool call info
                let hasData = false
                let parsedOutput: any = null

                try {
                  parsedOutput =
                    typeof outputContent === 'string' ? JSON.parse(outputContent) : outputContent
                  hasData = !!parsedOutput?.data || !!parsedOutput?.success
                } catch {
                  // Output wasn't JSON
                }

                const hasVisualization = !!(
                  toolName === 'create_visualization' && parsedOutput?.visualization
                )

                // Calculate per-tool duration
                const toolDuration = toolStartTimes.has(toolName)
                  ? Date.now() - toolStartTimes.get(toolName)!
                  : undefined
                toolStartTimes.delete(toolName)

                // Determine provider source for data attribution
                const toolProvider =
                  toolName === 'quickbooks_data'
                    ? 'quickbooks'
                    : toolName === 'business_central_data'
                      ? 'dynamics'
                      : undefined

                // Beautiful tool completion logging
                logger.toolEnd(toolName, outputContent, {
                  hasVisualization,
                  hasData,
                  duration: toolDuration,
                  provider: toolProvider,
                })

                // Clean readable output logging (parsed JSON fields)
                if (parsedOutput && typeof parsedOutput === 'object') {
                  logger.toolOutput(toolName, parsedOutput)
                }

                toolCallsInfo.push({ name: toolName, hasData })

                // Handle visualization tool - send as separate event with index
                if (hasVisualization) {
                  const vizIndex = parsedOutput.vizIndex || visualizations.length + 1
                  const vizData = {
                    ...parsedOutput.visualization,
                    vizIndex,
                  }
                  aiDebug.api.visualizationSent({
                    type: vizData.type,
                    title: vizData.title,
                  })
                  visualizations.push(vizData)
                  sendEvent(controller, encoder, {
                    type: 'visualization',
                    data: vizData,
                    index: vizIndex,
                  })
                }

                // Handle ui_action tool - send proposal event for client-side execution
                if (
                  toolName === 'ui_action' &&
                  parsedOutput?.success &&
                  parsedOutput?.uiActionProposal
                ) {
                  sendEvent(controller, encoder, {
                    type: 'ui_action_proposal',
                    data: parsedOutput.uiActionProposal,
                  })
                }

                // Handle memory tool - extract widget and memory data
                if (toolName === 'memory' && parsedOutput?.success) {
                  const action = parsedOutput.action

                  // Send widget if present
                  if (parsedOutput.widget) {
                    const widgetIndex = parsedOutput.widgetIndex || widgets.length + 1
                    const widgetData: WidgetBlock = {
                      ...parsedOutput.widget,
                      widgetIndex,
                    }
                    console.log('[AI:API] Widget sent', {
                      type: widgetData.type,
                      widgetIndex,
                    })
                    widgets.push(widgetData)
                    sendEvent(controller, encoder, {
                      type: 'widget',
                      data: widgetData,
                      index: widgetIndex,
                    })
                  }

                  // Extract memory data based on action
                  if (action === 'remember' && parsedOutput.widget?.memory) {
                    const mem = parsedOutput.widget.memory
                    createdMemories.push({
                      id: mem.id,
                      type: mem.type,
                      content: mem.content,
                    })
                    // Send immediate memory_created event for real-time UI updates
                    sendEvent(controller, encoder, {
                      type: 'memory_created',
                      memoryId: mem.id,
                      memoryType: mem.type,
                      content: mem.content,
                    })
                  } else if (action === 'update' && parsedOutput.widget?.memory) {
                    const mem = parsedOutput.widget.memory
                    updatedMemories.push({
                      id: mem.id,
                      type: mem.type,
                      content: mem.content,
                    })
                  } else if (action === 'forget' && parsedOutput.widget) {
                    deletedMemories.push({
                      id: parsedOutput.widget.memoryId || 'unknown',
                      type: parsedOutput.widget.memoryType,
                      content: parsedOutput.widget.memoryContent,
                    })
                  }
                }

                // Track provider source for data attribution badges
                // Store entity query metadata to detect fallback patterns later
                if (toolName === 'business_central_data' && parsedOutput?.success) {
                  const isEntityQuery =
                    parsedOutput?.queryType === 'entity' || parsedOutput?.queryType === 'search'
                  // Resolve actual company name from the schemaName that served the data
                  const toolSchemaName = parsedOutput?.schemaName
                  const actualEntityName = toolSchemaName
                    ? bcSchemaToCompany[toolSchemaName]
                    : undefined
                  toolCallsInfo[toolCallsInfo.length - 1] = {
                    ...toolCallsInfo[toolCallsInfo.length - 1],
                    provider: 'dynamics' as any,
                    reportType: parsedOutput?.queryType || undefined,
                    isEntityQuery,
                    wasTruncated: !!parsedOutput?._truncated,
                    resolvedEntityName:
                      actualEntityName || providerEntityNames['dynamics'] || undefined,
                  } as any
                }

                if (toolName === 'quickbooks_data' && parsedOutput?.success) {
                  const isEntityQuery =
                    parsedOutput?.queryType === 'entity' || parsedOutput?.queryType === 'search'
                  // Resolve actual company name from the realmId that served the data
                  const toolRealmId = parsedOutput?.realmId
                  const actualEntityName = toolRealmId
                    ? qbCompanies.find((c) => c.realmId === toolRealmId)?.name
                    : undefined
                  toolCallsInfo[toolCallsInfo.length - 1] = {
                    ...toolCallsInfo[toolCallsInfo.length - 1],
                    provider: 'quickbooks' as any,
                    reportType: parsedOutput?.queryType || undefined,
                    isEntityQuery,
                    wasTruncated: !!parsedOutput?._truncated,
                    resolvedEntityName: actualEntityName || undefined,
                  } as any
                }

                // Handle quickbooks_data tool - extract invoice widgets
                // Invoice widgets use indices 100+ to avoid collision with memory widgets (1-99)
                if (
                  toolName === 'quickbooks_data' &&
                  parsedOutput?.success &&
                  parsedOutput?.widgets
                ) {
                  const invoiceWidgets = parsedOutput.widgets as WidgetBlock[]
                  for (const widget of invoiceWidgets) {
                    // Use the widget index as-is (should be 100+ from handler)
                    const widgetData: WidgetBlock = { ...widget }
                    console.log('[AI:API] Invoice widget sent', {
                      type: widgetData.type,
                      widgetIndex: widgetData.widgetIndex,
                      invoiceNumber: (widget as any).invoiceNumber,
                    })
                    widgets.push(widgetData)
                    sendEvent(controller, encoder, {
                      type: 'widget',
                      data: widgetData,
                      index: widgetData.widgetIndex,
                    })
                  }

                  // Log instruction and markers for debugging
                  if (parsedOutput.instruction) {
                    console.log('[AI:API] Invoice widget instruction:', parsedOutput.instruction)
                  }
                  if (parsedOutput.markers) {
                    console.log('[AI:API] Invoice widget markers:', parsedOutput.markers)
                  }
                }
              }
            }

            aiDebug.api.tokenStream({ tokenCount })

            aiDebug.api.responseComplete({
              responseLength: fullResponse.length,
              visualizationCount: visualizations.length,
              toolCallCount: toolCallsInfo.length,
            })

            logger.info('[Chat:API] Response complete', {
              correlationId,
              duration: Date.now() - startTime,
              responseLength: fullResponse.length,
              operationCount: toolCallsInfo.length,
              visualizationCount: visualizations.length,
              widgetCount: widgets.length,
              streamTimedOut,
              memoryOperations: {
                created: createdMemories.length,
                updated: updatedMemories.length,
                deleted: deletedMemories.length,
              },
            })

            // Last-resort fallback: if the LLM produced no output at all, send a
            // minimal message so the user never sees a blank screen
            if (fullResponse.length === 0) {
              logger.warn('[Chat:API] Empty LLM response — applying fallback', {
                correlationId,
                toolCount: toolCallsInfo.length,
              })
              fullResponse =
                "I wasn't able to put together a response for this one. " +
                'Could you try rephrasing or adjusting the time period?'
            }

            // Skip sending final events if stream timed out (error already sent)
            if (streamTimedOut) {
              logger.debug('[Chat:API] Skipping final events due to stream timeout', {
                correlationId,
              })
              return
            }

            // Build system prompt estimate for token calculation
            const systemPromptEstimate = `You are a financial AI assistant for ${companyName}. Currency: ${currency}. Context: ${preparedContext.memories.slice(0, 500)}`
            const inputTokens = estimateTokens(systemPromptEstimate + input)
            const outputTokens = estimateTokens(fullResponse)

            // Beautiful response logging
            logger.response(fullResponse, {
              correlationId,
              model: 'openai/gpt-oss-120b',
              tokens: {
                input: inputTokens,
                output: outputTokens,
                total: inputTokens + outputTokens,
              },
              duration: Date.now() - startTime,
              ttft: timeToFirstToken,
              toolsUsed: toolCallsInfo.map((t) => t.name),
              entities:
                Object.keys(providerEntityNames).length > 0 ? providerEntityNames : undefined,
            })

            // Parse [SUGGESTIONS] block FIRST — needed to detect clarification responses
            // Tolerant regex: accepts [SUGGESTIONS], [/SUGGESTIONS], or [[SUGGESTIONS]] as opening tag
            const suggestionsMatch = fullResponse.match(
              /\[\/?\s*SUGGESTIONS\s*\]([\s\S]*?)\[\/\s*SUGGESTIONS\s*\]/
            )
            // Clarification = suggestions with " – " separator (Label – Description pattern)
            const isClarification =
              suggestionsMatch &&
              suggestionsMatch[1].split('|').some((s: string) => s.includes(' – '))

            // Emit sources event for data source tagging on messages
            // Skip source badges for clarification responses — no data was actually presented
            // Entity fallback detection: when one provider returned a broad truncated
            // dump (entity not found) and another returned targeted results, only badge
            // the provider whose data was actually displayed
            const allToolInfo = toolCallsInfo as any[]
            const entityCalls = allToolInfo.filter((t: any) => t.provider && t.isEntityQuery)
            const hasFallbackPattern =
              entityCalls.length > 1 &&
              entityCalls.some((t: any) => t.wasTruncated) &&
              entityCalls.some((t: any) => !t.wasTruncated)

            const sourcesData = isClarification
              ? []
              : allToolInfo
                  .filter((t: any) => {
                    if (!t.provider || !t.hasData) return false
                    // Skip truncated entity results when another provider had targeted results
                    if (hasFallbackPattern && t.isEntityQuery && t.wasTruncated) return false
                    return true
                  })
                  .map((t: any) => ({
                    provider: t.provider,
                    tool: t.name,
                    report: t.reportType,
                    entityName:
                      t.resolvedEntityName || providerEntityNames[t.provider] || undefined,
                  }))
            if (sourcesData.length > 0) {
              sendEvent(controller, encoder, {
                type: 'sources',
                data: sourcesData,
              })
            }
            const suggestions: Array<{ label: string; prompt: string; type?: string }> =
              suggestionsMatch
                ? suggestionsMatch[1]
                    .split('|')
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((s: string) => {
                      // Detect clarification mode: "Label – Description"
                      const dashIdx = s.indexOf(' – ')
                      if (dashIdx > 0) {
                        return {
                          label: s.substring(0, dashIdx).trim(),
                          prompt: s,
                          type: 'clarify' as const,
                        }
                      }
                      return { label: s, prompt: s }
                    })
                : []

            // Strip the [SUGGESTIONS] block from visible content
            // Tolerant: handles [SUGGESTIONS], [/SUGGESTIONS], or [[SUGGESTIONS]] as opening tag
            const finalContent = fullResponse
              .replace(/\s*\[\/?\s*SUGGESTIONS\s*\][\s\S]*?\[\/\s*SUGGESTIONS\s*\]\s*/, '')
              .trim()

            // Emit suggestions as separate SSE event for client handling
            if (suggestions.length > 0) {
              sendEvent(controller, encoder, {
                type: 'suggestions',
                data: suggestions,
              })
            }

            // Send final response with all metadata
            // Note: toolCalls excluded from client response to avoid exposing internal implementation details
            sendEvent(controller, encoder, {
              type: 'response',
              content: finalContent,
              components: visualizations,
              widgets: widgets,
              memories: createdMemories,
              updatedMemories: updatedMemories,
              deletedMemories: deletedMemories,
              // Provide abstracted operation count instead of internal tool names
              operationCount: toolCallsInfo.length,
            })

            // Final save of complete assistant message with all metadata
            // Mark status as 'complete' to indicate streaming finished successfully
            // IMPORTANT: Use same timestamp as initial save to overwrite the record
            // (same PK + SK = same DynamoDB item, prevents duplicate records issue)
            try {
              await saveMessage(userId, {
                id: messageId,
                role: 'assistant',
                content: finalContent,
                ts: assistantMessageTimestamp,
                status: 'complete',
                ...(createdMemories.length > 0 && { memories: createdMemories }),
                ...(updatedMemories.length > 0 && {
                  updatedMemories: updatedMemories.map((m) => ({
                    id: m.id,
                    type: m.type || '',
                    content: m.content || '',
                  })),
                }),
                ...(deletedMemories.length > 0 && {
                  deletedMemories: deletedMemories.map((m) => ({
                    id: m.id,
                    type: m.type || '',
                    content: m.content || '',
                  })),
                }),
                ...(visualizations.length > 0 && { components: visualizations }),
                ...(widgets.length > 0 && { widgets: widgets }),
              })
              logger.info('[Chat:API] Final assistant message saved successfully', {
                messageId,
                userId,
                correlationId,
              })
              // Emit save confirmation for assistant message
              sendEvent(controller, encoder, {
                type: 'save_confirmed',
                messageId: messageId,
                role: 'assistant',
                success: true,
              })
            } catch (saveError) {
              logger.error('[Chat:API] CRITICAL - Failed to save final assistant message', {
                error: saveError instanceof Error ? saveError.message : String(saveError),
                userId,
                messageId,
                correlationId,
                responseLength: fullResponse.length,
              })
              // Emit save failure for assistant message
              sendEvent(controller, encoder, {
                type: 'save_confirmed',
                messageId: messageId,
                role: 'assistant',
                success: false,
                error: saveError instanceof Error ? saveError.message : 'Failed to save response',
              })
            }

            // Send done marker (safe - handles closed controller)
            sendDone(controller, encoder)
          } catch (error) {
            // Log full error details for debugging
            const errorDetails = {
              message: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.name : 'Unknown',
              stack:
                error instanceof Error
                  ? error.stack?.split('\n').slice(0, 5).join('\n')
                  : undefined,
              correlationId,
              userId,
            }

            logger.error('[Chat:API] Stream processing error', errorDetails)
            aiDebug.api.error(error, 'Stream processing error')

            // Log LLM interaction error
            logger.logLLMInteraction({
              type: 'error',
              correlationId,
              userId,
              conversationId: `${userId}_${organizationId}`,
              messageId,
              error: error instanceof Error ? error.message : String(error),
              duration: Date.now() - startTime,
            })

            // Determine error type and send appropriate message
            const errorClass = classifyError(error)
            const errorMessage = errorClass.userMessage
            const errorCode = errorClass.type

            // Special logging for DynamoDB errors
            if (error instanceof Error) {
              const msg = error.message.toLowerCase()
              if (
                msg.includes('dynamodb') ||
                msg.includes('resourcenotfoundexception') ||
                msg.includes('table') ||
                msg.includes('accessdenied')
              ) {
                logger.error('[Chat:API] DynamoDB error detected', {
                  errorMessage: error.message,
                  correlationId,
                })
              }
            }

            sendEvent(controller, encoder, {
              type: 'error',
              error: errorMessage,
              code: errorCode,
            })
          } finally {
            controller.close()
          }
        },
      })

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    } catch (error) {
      console.error('[Chat API] Fatal error:', error)
      return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 })
    }
  }
)
