// src/ai/agent.ts
// LangGraph-based agent with explicit state management
// Following KISS principle: Simple graph with clear flow

import { logger } from '@/lib/logger'
import { MODEL_CONFIG } from '@/lib/llm'
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import { ChatGroq } from '@langchain/groq'
import { END, START, StateGraph } from '@langchain/langgraph'
import { checkpointer } from './checkpointer'
import {
  estimateTokenCount,
  trimMessagesToFitContext,
  calculateAvailableTokens,
  getContextInfo,
} from './context-manager'
import { AgentState, type AgentStateType, type ToolResult } from './state'
import { buildDynamicContext, buildFullPrompt, buildProviderContext } from './prompts'
import { formatPrefetchedData, getClarificationHint } from './router/contextPreparer'
import type { RouteResult } from './router/types'
import { allTools } from './tools'
import type { AgentContext } from './types'
import { classifyError } from '@/lib/errors/classifier'
import { parseToolResponse } from './tools/utils/response'
import {
  CIRCUIT_BREAKER_CONFIG,
  getCircuitStatus,
  isCircuitOpen,
  recordToolFailure,
  recordToolSuccess,
  type CircuitWarmState,
} from './circuit-breaker'

// =============================================================================
// Input Validation & Security
// =============================================================================

const MAX_MESSAGE_LENGTH = 50000 // 50KB limit
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?prior/i,
  /system\s*:\s*/i,
  /\[\[SYSTEM\]\]/i,
  /<\|im_start\|>/i,
  /<<SYS>>/i,
]

/**
 * Sanitizes context values to prevent prompt injection attacks
 */
function sanitizeContextValue(value: string | undefined, maxLength = 100): string {
  if (!value) return ''

  let sanitized = value.slice(0, maxLength)

  // Remove newlines and control characters that could break prompt structure
  sanitized = sanitized.replace(/[\n\r\t]/g, ' ')

  // Remove common injection patterns
  sanitized = sanitized.replace(/system\s*:/gi, '')
  sanitized = sanitized.replace(/assistant\s*:/gi, '')
  sanitized = sanitized.replace(/user\s*:/gi, '')
  sanitized = sanitized.replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[REDACTED]')
  sanitized = sanitized.replace(/disregard\s+(all\s+)?prior/gi, '[REDACTED]')
  sanitized = sanitized.replace(/\[\[SYSTEM\]\]/gi, '')
  sanitized = sanitized.replace(/<\|im_start\|>/gi, '')
  sanitized = sanitized.replace(/<<SYS>>/gi, '')

  return sanitized.trim()
}

/**
 * Sanitizes currency to ensure it's a valid currency code
 */
function sanitizeCurrency(currency?: string): string {
  const ALLOWED_CURRENCIES = [
    // Major currencies
    'USD',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'JPY',
    'CHF',
    'CNY',
    'INR',
    'MXN',
    'BRL',
    'KRW',
    'SGD',
    'HKD',
    'NZD',
    // African currencies
    'NGN',
    'KES',
    'GHS',
    'ZAR',
    'TZS',
    'UGX',
    'EGP',
    // Asian currencies
    'MYR',
    'PHP',
    'IDR',
    'THB',
    'TWD',
    // European currencies
    'SEK',
    'NOK',
    'DKK',
    'PLN',
    // Middle Eastern currencies
    'AED',
    'SAR',
  ]
  if (!currency) return 'USD'
  const upper = currency.toUpperCase().trim()
  return ALLOWED_CURRENCIES.includes(upper) ? upper : 'USD'
}

/**
 * Sanitizes prepared memories to prevent injection
 */
function sanitizeMemories(memories?: string): string {
  if (!memories) return ''

  let sanitized = memories
  // Strip out any attempt to add new system instructions
  sanitized = sanitized.replace(
    /##\s*(SYSTEM|CRITICAL|IMPORTANT|NEW INSTRUCTIONS)/gi,
    '## [Memory]'
  )
  sanitized = sanitized.replace(/\n\n(You are |Ignore |Forget |Disregard )/gi, '\n\n[Memory]: ')
  sanitized = sanitized.replace(/<\|im_start\|>/gi, '')
  sanitized = sanitized.replace(/<<SYS>>/gi, '')

  return sanitized
}

export interface ValidatedMessage {
  content: string
  sanitizedContent: string
  isValid: boolean
  warnings: string[]
}

/**
 * Validates and sanitizes user messages before processing
 * Protects against prompt injection and oversized inputs
 */
export function validateUserMessage(message: string): ValidatedMessage {
  const warnings: string[] = []
  let content = message
  let sanitizedContent = message

  // Check length
  if (content.length > MAX_MESSAGE_LENGTH) {
    content = content.slice(0, MAX_MESSAGE_LENGTH)
    sanitizedContent = content
    warnings.push('Message truncated to maximum length')
    logger.warn('[Agent] Message truncated', {
      originalLength: message.length,
      maxLength: MAX_MESSAGE_LENGTH,
    })
  }

  // Check for suspicious patterns and sanitize them
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(sanitizedContent)) {
      warnings.push(`Suspicious pattern detected and sanitized: ${pattern.source}`)
      logger.warn('[Agent] Suspicious pattern detected in user message', {
        pattern: pattern.source,
        messagePreview: sanitizedContent.slice(0, 100),
      })
      // Sanitize the detected pattern
      sanitizedContent = sanitizedContent.replace(pattern, '[FILTERED]')
    }
  }

  return {
    content: content.trim(),
    sanitizedContent: sanitizedContent.trim(),
    isValid: warnings.length === 0,
    warnings,
  }
}

// =============================================================================
// LLM Configuration - Uses centralized MODEL_CONFIG from lib/llm.ts
// =============================================================================

const DEFAULT_TEMPERATURE = 0.3

interface LLMConfig {
  model?: string
  temperature?: number
  maxTokens?: number
}

function createLLM(config: LLMConfig = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set')
  }

  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: config.model || MODEL_CONFIG.name,
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: config.maxTokens || MODEL_CONFIG.maxCompletionTokens,
  })
}

function getDefaultLLM() {
  return createLLM()
}

// =============================================================================
// Extended Context Interface (includes router-prepared data)
// =============================================================================

interface ExtendedAgentContext extends Partial<AgentContext> {
  queryRoute?: RouteResult
  prefetchedData?: Record<string, unknown>
  preparedMemories?: string
  connectedProviders?: string[]
  disconnectedProviders?: string[]
  qbCompanies?: Array<{ realmId: string; name: string; connected?: boolean }>
  activeQbRealmId?: string
  bcSchemas?: string[]
  bcDefaultSchema?: string
  bcSchemaToCompany?: Record<string, string>
}

// =============================================================================
// System Prompt Builder - Uses Modular Templates
// =============================================================================

function buildSystemPrompt(context: ExtendedAgentContext): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  // Build dynamic context with sanitized values
  const dynamicContext = buildDynamicContext({
    companyName: sanitizeContextValue(context.companyName, 50),
    currency: sanitizeCurrency(context.currency),
    userRole: sanitizeContextValue(context.userRole, 30),
    currentDate: dateStr,
    currentTime: timeStr,
    strategicFocus: context.strategicFocus as 'growth' | 'profitability' | 'runway' | 'balanced',
  })

  // Format prefetched data if available
  let formattedData: string | undefined
  if (context.prefetchedData && Object.keys(context.prefetchedData).length > 0) {
    formattedData = formatPrefetchedData(context.prefetchedData)
  }

  // Sanitize memories before including them
  const sanitizedMemories = context.preparedMemories
    ? sanitizeMemories(context.preparedMemories)
    : undefined

  // Build provider context section
  const hasProviderInfo =
    (context.connectedProviders && context.connectedProviders.length > 0) ||
    (context.disconnectedProviders && context.disconnectedProviders.length > 0)
  const providerContext = hasProviderInfo
    ? buildProviderContext(context.connectedProviders || [], {
        qbCompanies: context.qbCompanies,
        activeQbRealmId: context.activeQbRealmId,
        bcSchemas: context.bcSchemas,
        bcDefaultSchema: context.bcDefaultSchema,
        bcSchemaToCompany: context.bcSchemaToCompany,
        disconnectedProviders: context.disconnectedProviders,
      })
    : undefined

  // Build full prompt with all sections
  let fullPrompt = buildFullPrompt(
    dynamicContext,
    formattedData,
    sanitizedMemories,
    providerContext,
    { currentTheme: (context as any).currentTheme }
  )

  // Add clarification hint if query contains ambiguous terms
  if (context.queryRoute) {
    const clarificationHint = getClarificationHint(context.queryRoute)
    if (clarificationHint) {
      fullPrompt += clarificationHint
    }
  }

  return fullPrompt
}

// =============================================================================
// Agent Graph Definition
// =============================================================================

interface GraphState {
  messages: BaseMessage[]
}

// Create the agent node that calls the LLM
function createAgentNode(model: ChatGroq) {
  const modelWithTools = model.bindTools(allTools)

  return async (state: AgentStateType, config?: Record<string, any>) => {
    // Build system message with context from state + configurable
    // State contains persisted data, configurable has runtime overrides
    const configContext = (config?.configurable || {}) as ExtendedAgentContext

    // Merge state context with configurable (configurable takes precedence)
    const context: ExtendedAgentContext = {
      ...state.contextMeta,
      prefetchedData: { ...state.prefetchedData, ...configContext.prefetchedData },
      preparedMemories: state.memories || configContext.preparedMemories,
      ...configContext,
    }

    // ==========================================================================
    // P0 TOKEN LOGGING - Visibility into context accumulation
    // ==========================================================================
    const tokenAnalysis = {
      messageCount: state.messages.length,
      toolResultsCount: state.toolResults?.length || 0,
      prefetchedDataKeys: Object.keys(state.prefetchedData || {}).length,
      messageBreakdown: {} as Record<string, { count: number; tokens: number; chars: number }>,
      largestMessages: [] as Array<{
        type: string
        index: number
        tokens: number
        preview: string
      }>,
      toolResultsTokens: 0,
      prefetchedDataTokens: 0,
      estimatedTotalTokens: 0,
    }

    // Analyze each message - using 2.5 chars/token for JSON (more accurate than 4)
    state.messages.forEach((msg, index) => {
      const type = msg.getType() // 'human', 'ai', 'tool', 'system'
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      const chars = content.length
      const tokens = Math.ceil(chars / 2.5) // Better estimate for JSON-heavy content

      // Initialize type bucket
      if (!tokenAnalysis.messageBreakdown[type]) {
        tokenAnalysis.messageBreakdown[type] = { count: 0, tokens: 0, chars: 0 }
      }

      tokenAnalysis.messageBreakdown[type].count++
      tokenAnalysis.messageBreakdown[type].tokens += tokens
      tokenAnalysis.messageBreakdown[type].chars += chars

      // Track largest messages (potential bloat sources)
      if (tokens > 1000) {
        tokenAnalysis.largestMessages.push({
          type,
          index,
          tokens,
          preview: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        })
      }
    })

    // Sort largest messages by token count
    tokenAnalysis.largestMessages.sort((a, b) => b.tokens - a.tokens)
    tokenAnalysis.largestMessages = tokenAnalysis.largestMessages.slice(0, 5) // Top 5 only

    // Estimate toolResults tokens (these accumulate!)
    if (state.toolResults?.length) {
      const toolResultsJson = JSON.stringify(state.toolResults)
      tokenAnalysis.toolResultsTokens = Math.ceil(toolResultsJson.length / 2.5)
    }

    // Estimate prefetchedData tokens (injected into system prompt)
    if (state.prefetchedData && Object.keys(state.prefetchedData).length > 0) {
      const prefetchJson = JSON.stringify(state.prefetchedData)
      tokenAnalysis.prefetchedDataTokens = Math.ceil(prefetchJson.length / 2.5)
    }

    // Calculate total
    tokenAnalysis.estimatedTotalTokens = Object.values(tokenAnalysis.messageBreakdown).reduce(
      (sum, bucket) => sum + bucket.tokens,
      0
    )

    // Log the analysis
    logger.info('[Agent] 🔍 TOKEN ANALYSIS', {
      total: tokenAnalysis.estimatedTotalTokens,
      messageCount: tokenAnalysis.messageCount,
      breakdown: tokenAnalysis.messageBreakdown,
      toolResultsCount: tokenAnalysis.toolResultsCount,
      toolResultsTokens: tokenAnalysis.toolResultsTokens,
      prefetchedDataKeys: tokenAnalysis.prefetchedDataKeys,
      prefetchedDataTokens: tokenAnalysis.prefetchedDataTokens,
    })

    // Warn if large messages detected
    if (tokenAnalysis.largestMessages.length > 0) {
      logger.warn('[Agent] ⚠️ LARGE MESSAGES DETECTED', {
        count: tokenAnalysis.largestMessages.length,
        messages: tokenAnalysis.largestMessages.map((m) => ({
          type: m.type,
          index: m.index,
          tokens: m.tokens,
          preview: m.preview,
        })),
      })
    }

    // Critical warning thresholds
    if (tokenAnalysis.estimatedTotalTokens > 50000) {
      logger.error('[Agent] 🚨 CRITICAL: Context exceeds 50K tokens!', {
        total: tokenAnalysis.estimatedTotalTokens,
        toolMessages: tokenAnalysis.messageBreakdown['tool']?.tokens || 0,
      })
    } else if (tokenAnalysis.estimatedTotalTokens > 30000) {
      logger.warn('[Agent] ⚠️ WARNING: Context exceeds 30K tokens', {
        total: tokenAnalysis.estimatedTotalTokens,
      })
    }

    // ==========================================================================
    // END TOKEN LOGGING
    // ==========================================================================

    // Build system prompt first to estimate its token usage
    const systemPrompt = buildSystemPrompt(context)
    const systemMessage = new SystemMessage(systemPrompt)
    const systemPromptTokens = estimateTokenCount(systemPrompt)

    // Get context info for logging
    const contextInfo = getContextInfo(state.messages, systemPromptTokens)

    logger.info('[Agent] Node invoked', {
      messageCount: state.messages.length,
      hasContext: !!config?.configurable,
      hasPrefetchedData: !!(
        context.prefetchedData && Object.keys(context.prefetchedData).length > 0
      ),
      contextInfo: {
        estimatedTokens: contextInfo.estimatedTokens,
        availableTokens: contextInfo.availableTokens,
        willTrim: contextInfo.willTrim,
      },
    })

    // Trim messages to fit within context window
    // This prevents context_length_exceeded errors from Groq
    const availableTokens = calculateAvailableTokens(systemPromptTokens)
    const trimmedMessages = trimMessagesToFitContext(state.messages, availableTokens)

    // Log if trimming occurred
    if (trimmedMessages.length < state.messages.length) {
      logger.warn('[Agent] Messages trimmed to fit context window', {
        originalCount: state.messages.length,
        trimmedCount: trimmedMessages.length,
        systemPromptTokens,
        availableTokens,
      })
    }

    // Combine system message with trimmed conversation history
    const messages = [systemMessage, ...trimmedMessages]

    // Call the model with configurable passed through to tools
    const response = await modelWithTools.invoke(messages)

    const responseLength =
      typeof response.content === 'string'
        ? response.content.length
        : JSON.stringify(response.content).length
    const toolCalls = (response as AIMessage).tool_calls || []

    logger.debug('[Agent] LLM response received', {
      responseLength,
      toolCallsCount: toolCalls.length,
    })

    // Commented out — styled AGENT PLAN box in route.ts on_chat_model_end already shows this
    // if (toolCalls.length > 0) {
    //   logger.info('[Agent] Tool calls detected', {
    //     tools: toolCalls.map((t) => t.name),
    //   })
    // }

    return { messages: [response] }
  }
}

// Determine next step based on model response
function shouldContinue(state: AgentStateType): 'tools' | typeof END {
  // Edge case: Empty messages array
  if (!state.messages || state.messages.length === 0) {
    logger.warn('[Agent] shouldContinue called with empty messages array')
    return END
  }

  const lastMessage = state.messages[state.messages.length - 1]

  // Edge case: Null/undefined last message
  if (!lastMessage) {
    logger.warn('[Agent] shouldContinue: last message is null/undefined')
    return END
  }

  // Only AIMessage should have tool_calls - ignore other message types
  if (!('tool_calls' in lastMessage)) {
    return END
  }

  const toolCalls = (lastMessage as AIMessage).tool_calls

  // Edge case: tool_calls exists but is null, undefined, or not an array
  if (!toolCalls || !Array.isArray(toolCalls)) {
    return END
  }

  // Edge case: Empty tool_calls array
  if (toolCalls.length === 0) {
    return END
  }

  // Validate tool call structure - filter out malformed calls
  const validCalls = toolCalls.filter((call) => {
    if (!call || typeof call !== 'object') return false
    if (!call.name || typeof call.name !== 'string') {
      logger.warn('[Agent] Malformed tool call: missing or invalid name', { call })
      return false
    }
    if (!call.id || typeof call.id !== 'string') {
      logger.warn('[Agent] Malformed tool call: missing or invalid id', { name: call.name })
      return false
    }
    return true
  })

  if (validCalls.length === 0) {
    logger.warn('[Agent] All tool calls were malformed, ending')
    return END
  }

  return 'tools'
}

// =============================================================================
// Custom Tool Handler with Error Context
// =============================================================================

/**
 * Generate recovery suggestions based on error type
 * Provides actionable guidance for the LLM to adjust its approach
 */
function generateRecoverySuggestion(toolName: string, errorType: string): string {
  const suggestions: Record<string, Record<string, string>> = {
    quickbooks_data: {
      TIMEOUT: 'Try a smaller date range or simpler query',
      TOOL_TIMEOUT: 'Try a smaller date range or simpler query',
      RATE_LIMIT: 'Wait a moment and try again with fewer data points',
      AUTH: 'QuickBooks connection may have expired. Ask user to reconnect.',
      DEFAULT: 'Try simplifying the query or using different parameters',
    },
    web_search: {
      TIMEOUT: 'Try a more specific, shorter search query',
      TOOL_TIMEOUT: 'Try a more specific, shorter search query',
      RATE_LIMIT: 'Wait before searching again',
      CONFIG: 'Web search is not configured. Use your existing knowledge to answer.',
      DEFAULT: 'Try rephrasing the search query',
    },
    stock_price: {
      TIMEOUT: 'Try fewer stock symbols at once',
      TOOL_TIMEOUT: 'Try fewer stock symbols at once',
      VALIDATION: 'Verify the stock symbol format is correct',
      NOT_FOUND: 'Verify the stock symbol is correct',
      DEFAULT: 'Check if the stock symbol exists',
    },
    memory: {
      TIMEOUT: 'Try storing a smaller piece of information',
      TOOL_TIMEOUT: 'Try storing a smaller piece of information',
      NOT_FOUND: 'The requested memory does not exist. Try listing available memories first.',
      VALIDATION: 'Check the memory format and try again',
      TOOL_VALIDATION: 'Check the memory format and try again',
      DEFAULT: 'Try a simpler memory operation',
    },
    financial_calculator: {
      VALIDATION: 'Check the input numbers and try again',
      TOOL_VALIDATION: 'Check the input numbers and try again',
      TOOL_EXECUTION: 'Verify all required financial data is available',
      DEFAULT: 'Try with simpler calculation parameters',
    },
    create_visualization: {
      VALIDATION: 'Check the data format matches the chart type requirements',
      TOOL_VALIDATION: 'Check the data format matches the chart type requirements',
      TOOL_EXECUTION: 'Try a different chart type or simpler data',
      DEFAULT: 'Simplify the visualization or try a different chart type',
    },
    date_calculator: {
      VALIDATION: 'Check the date format (use YYYY-MM-DD)',
      TOOL_VALIDATION: 'Check the date format (use YYYY-MM-DD)',
      DEFAULT: 'Verify the date range is valid',
    },
    DEFAULT: {
      TIMEOUT: 'Try with simpler parameters',
      TOOL_TIMEOUT: 'Try with simpler parameters',
      RATE_LIMIT: 'Wait and retry',
      VALIDATION: 'Check the input format and try again',
      TOOL_VALIDATION: 'Check the input format and try again',
      DEFAULT: 'Try a different approach',
    },
  }

  const toolSuggestions = suggestions[toolName] || suggestions.DEFAULT
  return toolSuggestions[errorType] || toolSuggestions.DEFAULT
}

/**
 * Sanitize tool args for safe logging (remove sensitive data)
 */
function sanitizeArgsForLogging(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...args }
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential']

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * Custom tool handler that provides error context back to the LLM
 *
 * Unlike the prebuilt ToolNode, this adds structured error info to ToolMessages
 * so the LLM knows WHY a tool failed and can adjust its approach on retry.
 *
 * Includes circuit breaker pattern to prevent repeated calls to failing tools.
 * Circuit breakers are isolated per-user to prevent one user's failures from affecting others.
 *
 * Now also tracks tool results in state for agent self-awareness.
 */
async function customToolNode(
  state: AgentStateType,
  config?: Record<string, any>
): Promise<Partial<AgentStateType>> {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage
  const toolCalls = lastMessage.tool_calls || []
  const toolMessages: ToolMessage[] = []
  const toolResults: ToolResult[] = []

  // Extract userId from config or state for per-user circuit isolation
  const userId = (config?.configurable?.userId as string | undefined) || state.contextMeta?.userId

  for (const call of toolCalls) {
    const tool = allTools.find((t) => t.name === call.name)

    // Ensure call.id exists for ToolMessage (required field)
    const toolCallId = call.id || `${call.name}-${Date.now()}`

    if (!tool) {
      logger.warn('[Tools] Unknown tool requested', { toolName: call.name, userId })
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          content: JSON.stringify({
            success: false,
            error: `Unknown tool: ${call.name}`,
            errorType: 'TOOL_NOT_FOUND',
            retryable: false,
            suggestion: 'Use one of the available tools',
          }),
          name: call.name,
        })
      )
      continue
    }

    // Check circuit breaker before executing (per-user isolation)
    if (isCircuitOpen(call.name, userId)) {
      const circuitStatus = getCircuitStatus(call.name, userId)
      logger.info('[CircuitBreaker] Blocking call to tool with open circuit', {
        tool: call.name,
        userId,
        retryAfterMs: circuitStatus.retryAfterMs,
      })

      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          content: JSON.stringify({
            success: false,
            error: `Tool "${call.name}" is temporarily unavailable due to repeated failures`,
            errorType: 'CIRCUIT_OPEN',
            retryable: true,
            retryAfterMs: circuitStatus.retryAfterMs,
            suggestion: `This tool has failed multiple times. Wait ${Math.ceil((circuitStatus.retryAfterMs || 60000) / 1000)} seconds or try a different approach.`,
          }),
          name: call.name,
        })
      )
      continue
    }

    const startTime = Date.now()

    try {
      // Execute tool with configurable context passed through
      // Type assertion needed because allTools contains tools with different input schemas
      // and TypeScript can't unify the invoke signatures in the union type
      const result = await (
        tool.invoke as (input: Record<string, unknown>, config?: unknown) => Promise<string>
      )(call.args as Record<string, unknown>, config)
      const duration = Date.now() - startTime

      // Parse result to check for returned failures (tools return {success: false} instead of throwing)
      const parsedResult = parseToolResponse(
        typeof result === 'string' ? result : JSON.stringify(result)
      )

      if (!parsedResult.success) {
        // Tool returned a failure response - apply same error handling as catch block
        const errorMessage = parsedResult.error || 'Tool returned failure'
        const errorCode = parsedResult.code

        // Classify error for permanence determination
        const errorInfo = classifyError(new Error(errorMessage))
        const isPermanentError = errorInfo.permanence === 'PERMANENT'

        // Record failure - may open circuit breaker (per-user)
        recordToolFailure(call.name, userId, isPermanentError)

        // Get circuit status for response
        const circuitStatus = getCircuitStatus(call.name, userId)

        // Enhance error response with recovery context
        const enhancedResponse = {
          ...parsedResult,
          errorType: errorCode || errorInfo.type,
          retryable: (parsedResult.retryable ?? errorInfo.retryable) && !circuitStatus.isOpen,
          suggestion: circuitStatus.isOpen
            ? `Tool has failed ${CIRCUIT_BREAKER_CONFIG.failureThreshold} times. Try a different approach.`
            : parsedResult.hint ||
              generateRecoverySuggestion(call.name, errorCode || errorInfo.type),
          attemptedWith: sanitizeArgsForLogging(call.args as Record<string, unknown>),
          duration,
          ...(circuitStatus.isOpen && {
            circuitOpen: true,
            retryAfterMs: circuitStatus.retryAfterMs,
          }),
        }

        logger.warn('[Tools] Tool returned failure response', {
          tool: call.name,
          userId,
          duration,
          errorType: enhancedResponse.errorType,
          isPermanentError,
        })

        toolMessages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            content: JSON.stringify(enhancedResponse),
            name: call.name,
          })
        )

        // Track failed tool result for state
        toolResults.push({
          toolName: call.name,
          toolCallId,
          success: false,
          error: errorMessage,
          duration,
        })
      } else {
        // Tool succeeded - record success and pass through result
        recordToolSuccess(call.name, userId)

        // Calculate token cost of this tool response
        const responseContent = typeof result === 'string' ? result : JSON.stringify(result)
        const responseTokens = Math.ceil(responseContent.length / 2.5)

        logger.info('[Tools] ✅ Tool executed successfully', {
          tool: call.name,
          userId,
          duration,
          responseChars: responseContent.length,
          responseTokens,
          tokenWarning: responseTokens > 5000 ? '⚠️ LARGE RESPONSE' : undefined,
        })

        // Truncate massive tool responses to prevent LLM from choking
        // Keep summary intact but trim entity/data arrays
        const MAX_TOOL_RESPONSE_TOKENS = 8000
        let finalResponseContent = responseContent
        if (responseTokens > MAX_TOOL_RESPONSE_TOKENS && parsedResult) {
          try {
            // Cast to any — tool responses have varied shapes (QB entities, BC rows, reports, etc.)
            const truncated: Record<string, any> = { ...(parsedResult as any) }
            // Trim entity arrays (QB returns data.entities[], BC returns data as array)
            if (truncated.data?.entities && Array.isArray(truncated.data.entities)) {
              const originalCount = truncated.data.entities.length
              truncated.data = { ...truncated.data, entities: truncated.data.entities.slice(0, 25) }
              truncated._truncated = { originalCount, shown: truncated.data.entities.length }
            } else if (Array.isArray(truncated.data)) {
              const originalCount = truncated.data.length
              truncated.data = truncated.data.slice(0, 25)
              truncated._truncated = { originalCount, shown: truncated.data.length }
            } else if (
              truncated.data &&
              typeof truncated.data === 'object' &&
              !Array.isArray(truncated.data)
            ) {
              // Nested arrays in data objects (e.g. customer_detail: { customer, invoices: [...], shipments: [...], summary })
              // Trim each array field while preserving non-array fields (summary, customer, agedReceivable, etc.)
              const NESTED_LIMIT = 25
              const trimmedFields: Record<string, { original: number; shown: number }> = {}
              const trimmedData = { ...truncated.data }
              for (const key of Object.keys(trimmedData)) {
                if (Array.isArray(trimmedData[key]) && trimmedData[key].length > NESTED_LIMIT) {
                  trimmedFields[key] = { original: trimmedData[key].length, shown: NESTED_LIMIT }
                  trimmedData[key] = trimmedData[key].slice(0, NESTED_LIMIT)
                }
              }
              if (Object.keys(trimmedFields).length > 0) {
                truncated.data = trimmedData
                truncated._truncated = trimmedFields
              }
            }
            const truncatedContent = JSON.stringify(truncated)
            const truncatedTokens = Math.ceil(truncatedContent.length / 2.5)
            if (truncatedTokens < responseTokens) {
              finalResponseContent = truncatedContent
              logger.warn('[Tools] ✂️ Large tool response truncated', {
                tool: call.name,
                originalTokens: responseTokens,
                truncatedTokens,
                originalChars: responseContent.length,
                truncatedChars: truncatedContent.length,
              })
            }
          } catch {
            // If truncation fails, use original response
          }
        } else if (responseTokens > MAX_TOOL_RESPONSE_TOKENS) {
          // Non-JSON or unparseable — hard truncate the string
          const maxChars = MAX_TOOL_RESPONSE_TOKENS * 2.5
          finalResponseContent = responseContent.slice(0, maxChars) + '\n... (response truncated)'
          logger.warn('[Tools] ✂️ Large tool response hard-truncated', {
            tool: call.name,
            originalTokens: responseTokens,
            maxChars,
          })
        }

        toolMessages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            content: finalResponseContent,
            name: call.name,
          })
        )

        // Track successful tool result for state
        toolResults.push({
          toolName: call.name,
          toolCallId,
          success: true,
          data: parsedResult,
          duration,
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorInfo = classifyError(error)

      // Use permanence from classifier to determine if error should count toward circuit
      const isPermanentError = errorInfo.permanence === 'PERMANENT'

      // Record failure - may open circuit breaker (per-user, respects permanence)
      recordToolFailure(call.name, userId, isPermanentError)

      logger.warn('[Tools] Tool execution failed', {
        tool: call.name,
        userId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        errorType: errorInfo.type,
        retryable: errorInfo.retryable,
        isPermanentError,
      })

      // Create structured error response for LLM
      const circuitStatus = getCircuitStatus(call.name, userId)
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: errorInfo.type,
        retryable: errorInfo.retryable && !circuitStatus.isOpen,
        suggestion: circuitStatus.isOpen
          ? `Tool has failed ${CIRCUIT_BREAKER_CONFIG.failureThreshold} times. Try a different approach or wait.`
          : generateRecoverySuggestion(call.name, errorInfo.type),
        attemptedWith: sanitizeArgsForLogging(call.args as Record<string, unknown>),
        duration,
        ...(circuitStatus.isOpen && {
          circuitOpen: true,
          retryAfterMs: circuitStatus.retryAfterMs,
        }),
      }

      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          content: JSON.stringify(errorResponse),
          name: call.name,
        })
      )

      // Track exception tool result for state
      toolResults.push({
        toolName: call.name,
        toolCallId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      })
    }
  }

  // Log total tokens added by this tool batch
  const totalToolTokens = toolMessages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    return sum + Math.ceil(content.length / 2.5)
  }, 0)

  logger.info('[Tools] 📊 Tool batch complete', {
    toolCount: toolMessages.length,
    totalTokensAdded: totalToolTokens,
    tools: toolMessages.map((m) => m.name),
  })

  return { messages: toolMessages, toolResults }
}

// =============================================================================
// Create and Export Agent
// =============================================================================

// Checkpointer imported from ./checkpointer for resettable thread state

export function createAgent(customModel?: ChatGroq) {
  const model = customModel || getDefaultLLM()
  const agentNode = createAgentNode(model)

  // Build the graph with extended state for self-awareness
  // Uses AgentState instead of MessagesAnnotation to store:
  // - prefetchedData: cached financial data
  // - memories: user preferences/memories
  // - toolResults: accumulated tool execution results
  // - contextMeta: company/user context
  const graph = new StateGraph(AgentState)
    .addNode('agent', agentNode)
    .addNode('tools', customToolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent')

  // Compile with MemorySaver checkpointer for stateful persistence
  // State persists across requests within the same thread_id
  // Note: recursionLimit is set at runtime in the API route
  return graph.compile({ checkpointer })
}

// =============================================================================
// Convenience function for single invocation
// =============================================================================

export async function invokeAgent(
  message: string,
  context: AgentContext,
  chatHistory: BaseMessage[] = []
): Promise<{
  response: string
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }>
}> {
  const startTime = Date.now()
  const agent = createAgent()

  // Validate and sanitize user message before processing
  const validated = validateUserMessage(message)

  if (!validated.isValid) {
    logger.info('[Agent] Message validation warnings', {
      warnings: validated.warnings,
    })
  }

  // Build messages array with sanitized content
  const messages = [...chatHistory, new HumanMessage(validated.sanitizedContent)]

  // Build configurable context for tools
  const configurable = {
    ...context,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    headers: {
      'Content-Type': 'application/json',
      // Auth headers would be added here in the API route
    },
  }

  // Invoke the agent
  const result = await agent.invoke(
    { messages },
    {
      configurable,
    }
  )

  // Extract the final response
  const lastMessage = result.messages[result.messages.length - 1]
  const response = typeof lastMessage.content === 'string' ? lastMessage.content : ''

  // Extract tool calls from intermediate messages
  const toolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }> = []

  for (let i = 0; i < result.messages.length; i++) {
    const msg = result.messages[i]
    if (msg && 'tool_calls' in msg) {
      const aiMsg = msg as AIMessage
      if (aiMsg.tool_calls) {
        for (const call of aiMsg.tool_calls) {
          // Find the corresponding tool response
          const toolResponse = result.messages.find(
            (m, idx) =>
              idx > i &&
              'name' in m &&
              (m as any).name === call.name &&
              (m as any).tool_call_id === call.id
          )

          toolCalls.push({
            name: call.name,
            args: call.args as Record<string, unknown>,
            result:
              typeof toolResponse?.content === 'string'
                ? toolResponse.content
                : JSON.stringify(toolResponse?.content),
          })
        }
      }
    }
  }

  const duration = Date.now() - startTime
  logger.info('[Agent] Execution completed', {
    totalToolCalls: toolCalls.length,
    duration,
    toolTypes: [...new Set(toolCalls.map((t) => t.name))],
    messageCount: result.messages.length,
  })

  return { response, toolCalls }
}

// =============================================================================
// Export types and utilities
// =============================================================================

export { buildSystemPrompt, createLLM, getDefaultLLM }
export type { GraphState, LLMConfig }

// Re-export state types for use in route and other modules
export { AgentState, type AgentStateType, type ToolResult } from './state'

// Export internal functions for testing
export { generateRecoverySuggestion, sanitizeArgsForLogging }
