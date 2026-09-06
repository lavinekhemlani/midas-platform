/**
 * Chat API and SSE Event Validation Schemas
 * Provides runtime type safety for chat requests and streaming events
 */

import { z } from 'zod'

// ============================================================================
// API Request Schemas
// ============================================================================

/**
 * Chat API request body schema
 * Validates input message and optional message ID
 */
export const ChatRequestSchema = z.object({
  input: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(50000, 'Message exceeds maximum length of 50,000 characters'),
  userMessageId: z.string().uuid().optional(),
  assistantMessageId: z.string().uuid().optional(),
  currentTheme: z.enum(['light', 'dark']).optional(),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

// ============================================================================
// SSE Event Schemas
// ============================================================================

/**
 * Base event with type discriminator
 */
const BaseEventSchema = z.object({
  type: z.string(),
})

/**
 * Start event - indicates stream has begun
 */
export const StartEventSchema = z.object({
  type: z.literal('start'),
  messageId: z.string(),
})

/**
 * Status event - progress status updates
 */
export const StatusEventSchema = z.object({
  type: z.literal('status'),
  message: z.string(),
  retryAttempt: z.number().optional(),
  maxRetries: z.number().optional(),
  retryDelayMs: z.number().optional(),
})

/**
 * Token event - individual content tokens
 */
export const TokenEventSchema = z.object({
  type: z.literal('token'),
  content: z.string(),
})

/**
 * Chunk event - content chunks (alternative to token)
 */
export const ChunkEventSchema = z.object({
  type: z.literal('chunk'),
  content: z.string(),
})

/**
 * Progress event - step-by-step progress
 */
export const ProgressEventSchema = z.object({
  type: z.literal('progress'),
  steps: z.array(z.string()),
})

/**
 * Usage event - token usage statistics
 */
export const UsageEventSchema = z.object({
  type: z.literal('usage'),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  estimatedCost: z.number().optional(),
})

/**
 * Components event - visualization components
 */
export const ComponentsEventSchema = z.object({
  type: z.literal('components'),
  data: z.array(z.any()),
})

/**
 * Visualization event - chart/graph data
 */
export const VisualizationEventSchema = z.object({
  type: z.literal('visualization'),
  data: z.any(),
})

/**
 * Invoice actions widget schema
 */
export const InvoiceActionsWidgetSchema = z.object({
  type: z.literal('invoice:actions'),
  widgetIndex: z.number(),
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  customerName: z.string(),
  amount: z.number(),
  currency: z.string(),
  date: z.string(),
  dueDate: z.string(),
  status: z.enum(['open', 'paid', 'overdue']),
})

/**
 * Widget event - memory widgets and invoice actions
 */
export const WidgetEventSchema = z.object({
  type: z.literal('widget'),
  data: z.any(), // Accepts MemoryWidget or InvoiceActionsWidget
  index: z.number().optional(),
})

/**
 * Memory created event
 */
export const MemoryCreatedEventSchema = z.object({
  type: z.literal('memory_created'),
  memoryId: z.string().optional(),
  memoryType: z.string().optional(),
  content: z.string().optional(),
})

/**
 * Save confirmed event
 * Server sends: messageId, role, success, error (on failure)
 */
export const SaveConfirmedEventSchema = z.object({
  type: z.literal('save_confirmed'),
  messageId: z.string().optional(),
  role: z.enum(['user', 'assistant']).optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
  // Legacy fields (keep for backwards compatibility)
  userMessageId: z.string().optional(),
  assistantMessageId: z.string().optional(),
})

/**
 * Response event - final response content
 */
export const ResponseEventSchema = z.object({
  type: z.literal('response'),
  content: z.string().optional(),
  messageId: z.string().optional(),
  components: z.array(z.any()).optional(),
  widgets: z.array(z.any()).optional(),
  memories: z.array(z.any()).optional(),
  updatedMemories: z.array(z.any()).optional(),
  deletedMemories: z.array(z.any()).optional(),
  learnTerms: z.array(z.any()).optional(),
})

/**
 * Error event
 */
export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
  retryable: z.boolean().optional(),
  retryAfter: z.number().optional(),
  retryAttempt: z.number().optional(),
  maxRetries: z.number().optional(),
  retriesExhausted: z.boolean().optional(),
})

/**
 * Memories event - memory references
 */
export const MemoriesEventSchema = z.object({
  type: z.literal('memories'),
  data: z.array(z.any()),
})

/**
 * Updated memories event
 */
export const UpdatedMemoriesEventSchema = z.object({
  type: z.literal('updatedMemories'),
  data: z.array(z.any()),
})

/**
 * Deleted memories event
 */
export const DeletedMemoriesEventSchema = z.object({
  type: z.literal('deletedMemories'),
  data: z.array(z.any()),
})

/**
 * Learn terms event
 */
export const LearnTermsEventSchema = z.object({
  type: z.literal('learnTerms'),
  data: z.array(z.any()),
})

/**
 * Suggestions event - follow-up suggestions from suggest_actions tool
 */
export const SuggestionsEventSchema = z.object({
  type: z.literal('suggestions'),
  data: z.array(
    z.object({
      label: z.string(),
      prompt: z.string(),
      type: z.enum(['follow_up', 'drill_down', 'compare', 'clarify']).optional(),
    })
  ),
})

/**
 * UI Action Proposal event - from ui_action tool
 */
export const UIActionProposalEventSchema = z.object({
  type: z.literal('ui_action_proposal'),
  data: z.object({
    proposalId: z.string(),
    actions: z.array(
      z.object({
        actionType: z.string(),
        payload: z.record(z.any()),
        description: z.string().optional(),
      })
    ),
    confirmationMessage: z.string().optional(),
  }),
})

/**
 * Sources event - data source tagging for messages
 */
export const SourcesEventSchema = z.object({
  type: z.literal('sources'),
  data: z.array(
    z.object({
      provider: z.string(),
      tool: z.string(),
      report: z.string().optional(),
      entityName: z.string().optional(),
    })
  ),
})

/**
 * Union of all SSE event types
 */
export const SSEEventSchema = z.discriminatedUnion('type', [
  StartEventSchema,
  StatusEventSchema,
  TokenEventSchema,
  ChunkEventSchema,
  ProgressEventSchema,
  UsageEventSchema,
  ComponentsEventSchema,
  VisualizationEventSchema,
  WidgetEventSchema,
  MemoryCreatedEventSchema,
  SaveConfirmedEventSchema,
  ResponseEventSchema,
  ErrorEventSchema,
  MemoriesEventSchema,
  UpdatedMemoriesEventSchema,
  DeletedMemoriesEventSchema,
  LearnTermsEventSchema,
  SuggestionsEventSchema,
  SourcesEventSchema,
  UIActionProposalEventSchema,
])

export type SSEEvent = z.infer<typeof SSEEventSchema>

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Safely parse chat request with detailed error information
 */
export function parseChatRequest(data: unknown):
  | {
      success: true
      data: ChatRequest
    }
  | {
      success: false
      error: string
      details?: ReturnType<z.ZodError['flatten']>
    } {
  const result = ChatRequestSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: 'Invalid request format',
    details: result.error.flatten(),
  }
}

/**
 * Safely parse SSE event with fallback
 * Returns null for invalid events (caller should handle gracefully)
 */
export function parseSSEEvent(data: string): SSEEvent | null {
  try {
    const parsed = JSON.parse(data)

    // Handle legacy token format (just has 'token' field)
    if ('token' in parsed && !('type' in parsed)) {
      return { type: 'token', content: parsed.token }
    }

    const result = SSEEventSchema.safeParse(parsed)
    if (result.success) {
      return result.data
    }

    // Log validation failure for debugging but don't crash
    if (typeof window === 'undefined') {
      // Server-side logging
      console.warn('[SSE] Invalid event structure:', {
        receivedType: parsed?.type,
        errors: result.error.flatten().fieldErrors,
      })
    }

    return null
  } catch {
    // Not JSON - treat as raw token content
    return { type: 'token', content: data }
  }
}

/**
 * Type guard for specific SSE event types
 */
export function isEventType<T extends SSEEvent['type']>(
  event: SSEEvent | null,
  type: T
): event is Extract<SSEEvent, { type: T }> {
  return event?.type === type
}
