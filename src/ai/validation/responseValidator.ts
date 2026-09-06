// src/lib/ai/validation/responseValidator.ts
// Simplified response validator stub for backward compatibility

import { logger } from '@/lib/logger'

// =============================================================================
// Security Constants
// =============================================================================

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024 // 10MB limit
const MAX_JSON_DEPTH = 20 // Maximum nesting depth

export interface ValidationResult {
  isValid: boolean
  parsed: any | null
  failedSections: string[]
  rawContent?: string
}

interface SafeParseResult {
  success: boolean
  data?: any
  error?: string
}

/**
 * Validates response size before parsing
 */
function validateResponseSize(content: string): { valid: boolean; error?: string } {
  if (!content) {
    return { valid: false, error: 'Empty content' }
  }

  if (content.length > MAX_RESPONSE_SIZE) {
    logger.error('[ResponseValidator] Response exceeds maximum size', {
      size: content.length,
      maxSize: MAX_RESPONSE_SIZE,
    })
    return { valid: false, error: `Response exceeds maximum size of ${MAX_RESPONSE_SIZE} bytes` }
  }

  return { valid: true }
}

/**
 * Calculates the nesting depth of an object to prevent stack overflow
 */
function getObjectDepth(obj: any, currentDepth = 0): number {
  if (currentDepth > MAX_JSON_DEPTH) return currentDepth // Early exit

  if (obj === null || typeof obj !== 'object') {
    return currentDepth
  }

  let maxDepth = currentDepth

  // Handle arrays
  if (Array.isArray(obj)) {
    for (const item of obj) {
      maxDepth = Math.max(maxDepth, getObjectDepth(item, currentDepth + 1))
      if (maxDepth > MAX_JSON_DEPTH) break // Early exit
    }
  } else {
    // Handle objects
    for (const value of Object.values(obj)) {
      maxDepth = Math.max(maxDepth, getObjectDepth(value, currentDepth + 1))
      if (maxDepth > MAX_JSON_DEPTH) break // Early exit
    }
  }

  return maxDepth
}

/**
 * Safely parses JSON with size and depth validation
 */
function parseJSONSafely(content: string): SafeParseResult {
  // Validate size first
  const sizeCheck = validateResponseSize(content)
  if (!sizeCheck.valid) {
    return { success: false, error: sizeCheck.error }
  }

  try {
    const parsed = JSON.parse(content)

    // Check depth to prevent stack overflow attacks
    const depth = getObjectDepth(parsed)
    if (depth > MAX_JSON_DEPTH) {
      logger.error('[ResponseValidator] JSON structure too deeply nested', {
        depth,
        maxDepth: MAX_JSON_DEPTH,
      })
      return { success: false, error: 'JSON structure too deeply nested' }
    }

    return { success: true, data: parsed }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Parse error'
    logger.debug('[ResponseValidator] JSON parse failed', {
      error: errorMessage,
      contentPreview: content.slice(0, 200),
    })
    return { success: false, error: errorMessage }
  }
}

/**
 * Validates and parses LLM response as JSON
 * Handles markdown code blocks and extracts JSON
 */
export function validateAndParseResponse(content: string): ValidationResult {
  const failedSections: string[] = []

  // Try to extract JSON from markdown code blocks
  let jsonContent = content

  // Remove markdown code blocks if present
  const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    jsonContent = jsonBlockMatch[1].trim()
  }

  // Try to parse as JSON with safety checks
  const parseResult = parseJSONSafely(jsonContent)

  if (!parseResult.success) {
    failedSections.push('json_parse')

    // Try to salvage partial JSON
    const partialMatch = content.match(/\{[\s\S]*\}/)
    if (partialMatch) {
      const partialResult = parseJSONSafely(partialMatch[0])
      if (partialResult.success) {
        return {
          isValid: false,
          parsed: partialResult.data,
          failedSections,
          rawContent: content,
        }
      }
    }

    return { isValid: false, parsed: null, failedSections, rawContent: content }
  }

  const parsed = parseResult.data

  // Validate expected structure
  if (typeof parsed !== 'object' || parsed === null) {
    failedSections.push('root_object')
    return { isValid: false, parsed: null, failedSections, rawContent: content }
  }

  // Check for required fields based on common patterns
  const hasInsights = 'insights' in parsed || 'analysis' in parsed || 'summary' in parsed
  const hasRecommendations =
    'recommendations' in parsed || 'actions' in parsed || 'suggestions' in parsed

  if (!hasInsights) {
    failedSections.push('insights')
  }

  // Allow partial success if we have some content
  if (failedSections.length === 0 || Object.keys(parsed).length > 0) {
    return {
      isValid: failedSections.length === 0,
      parsed,
      failedSections,
      rawContent: content,
    }
  }

  return { isValid: false, parsed: null, failedSections, rawContent: content }
}

/**
 * Logs validation failure for debugging
 */
export function logValidationFailure(
  attempt: number,
  organizationId: string,
  result: ValidationResult,
  rawContent: string
): void {
  logger.warn('[ResponseValidator] Validation failed', {
    attempt,
    organizationId,
    failedSections: result.failedSections,
    contentLength: rawContent.length,
    hasPartialParse: result.parsed !== null,
  })
}

/**
 * Logs final validation status
 */
export function logFinalValidationStatus(
  organizationId: string,
  totalAttempts: number,
  result: ValidationResult
): void {
  if (result.isValid) {
    logger.info('[ResponseValidator] Validation succeeded', {
      organizationId,
      totalAttempts,
    })
  } else {
    logger.warn('[ResponseValidator] Validation failed after all attempts', {
      organizationId,
      totalAttempts,
      failedSections: result.failedSections,
      hasPartialParse: result.parsed !== null,
    })
  }
}
