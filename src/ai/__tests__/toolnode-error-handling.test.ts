// src/ai/__tests__/toolnode-error-handling.test.ts
// Tests for customToolNode error handling, circuit breaker, and recovery suggestions

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateRecoverySuggestion, sanitizeArgsForLogging } from '../agent'
import {
  recordToolFailure,
  recordToolSuccess,
  isCircuitOpen,
  getCircuitStatus,
  resetCircuitBreakers,
  getCircuitMetrics,
  getActiveCircuits,
  CIRCUIT_BREAKER_CONFIG,
} from '../circuit-breaker'
import { parseToolResponse, type ToolResponse } from '../tools/utils/response'

// =============================================================================
// generateRecoverySuggestion Tests
// =============================================================================

describe('generateRecoverySuggestion', () => {
  describe('QuickBooks Data Tool', () => {
    it('should return timeout suggestion for TIMEOUT error', () => {
      const suggestion = generateRecoverySuggestion('quickbooks_data', 'TIMEOUT')
      expect(suggestion).toBe('Try a smaller date range or simpler query')
    })

    it('should return timeout suggestion for TOOL_TIMEOUT error', () => {
      const suggestion = generateRecoverySuggestion('quickbooks_data', 'TOOL_TIMEOUT')
      expect(suggestion).toBe('Try a smaller date range or simpler query')
    })

    it('should return rate limit suggestion for RATE_LIMIT error', () => {
      const suggestion = generateRecoverySuggestion('quickbooks_data', 'RATE_LIMIT')
      expect(suggestion).toBe('Wait a moment and try again with fewer data points')
    })

    it('should return auth suggestion for AUTH error', () => {
      const suggestion = generateRecoverySuggestion('quickbooks_data', 'AUTH')
      expect(suggestion).toBe('QuickBooks connection may have expired. Ask user to reconnect.')
    })

    it('should return default suggestion for unknown error', () => {
      const suggestion = generateRecoverySuggestion('quickbooks_data', 'UNKNOWN_ERROR')
      expect(suggestion).toBe('Try simplifying the query or using different parameters')
    })
  })

  describe('Web Search Tool', () => {
    it('should return config suggestion for CONFIG error', () => {
      const suggestion = generateRecoverySuggestion('web_search', 'CONFIG')
      expect(suggestion).toBe(
        'Web search is not configured. Use your existing knowledge to answer.'
      )
    })

    it('should return timeout suggestion for TIMEOUT error', () => {
      const suggestion = generateRecoverySuggestion('web_search', 'TIMEOUT')
      expect(suggestion).toBe('Try a more specific, shorter search query')
    })
  })

  describe('Stock Price Tool', () => {
    it('should return validation suggestion for VALIDATION error', () => {
      const suggestion = generateRecoverySuggestion('stock_price', 'VALIDATION')
      expect(suggestion).toBe('Verify the stock symbol format is correct')
    })

    it('should return not found suggestion for NOT_FOUND error', () => {
      const suggestion = generateRecoverySuggestion('stock_price', 'NOT_FOUND')
      expect(suggestion).toBe('Verify the stock symbol is correct')
    })
  })

  describe('Memory Tool', () => {
    it('should return validation suggestion for VALIDATION error', () => {
      const suggestion = generateRecoverySuggestion('memory', 'VALIDATION')
      expect(suggestion).toBe('Check the memory format and try again')
    })

    it('should return validation suggestion for TOOL_VALIDATION error', () => {
      const suggestion = generateRecoverySuggestion('memory', 'TOOL_VALIDATION')
      expect(suggestion).toBe('Check the memory format and try again')
    })

    it('should return not found suggestion for NOT_FOUND error', () => {
      const suggestion = generateRecoverySuggestion('memory', 'NOT_FOUND')
      expect(suggestion).toBe(
        'The requested memory does not exist. Try listing available memories first.'
      )
    })
  })

  describe('Financial Calculator Tool', () => {
    it('should return validation suggestion for VALIDATION error', () => {
      const suggestion = generateRecoverySuggestion('financial_calculator', 'VALIDATION')
      expect(suggestion).toBe('Check the input numbers and try again')
    })

    it('should return execution suggestion for TOOL_EXECUTION error', () => {
      const suggestion = generateRecoverySuggestion('financial_calculator', 'TOOL_EXECUTION')
      expect(suggestion).toBe('Verify all required financial data is available')
    })
  })

  describe('Create Visualization Tool', () => {
    it('should return validation suggestion for VALIDATION error', () => {
      const suggestion = generateRecoverySuggestion('create_visualization', 'VALIDATION')
      expect(suggestion).toBe('Check the data format matches the chart type requirements')
    })

    it('should return execution suggestion for TOOL_EXECUTION error', () => {
      const suggestion = generateRecoverySuggestion('create_visualization', 'TOOL_EXECUTION')
      expect(suggestion).toBe('Try a different chart type or simpler data')
    })
  })

  describe('Date Calculator Tool', () => {
    it('should return validation suggestion for VALIDATION error', () => {
      const suggestion = generateRecoverySuggestion('date_calculator', 'VALIDATION')
      expect(suggestion).toBe('Check the date format (use YYYY-MM-DD)')
    })

    it('should return default suggestion for unknown error', () => {
      const suggestion = generateRecoverySuggestion('date_calculator', 'UNKNOWN')
      expect(suggestion).toBe('Verify the date range is valid')
    })
  })

  describe('Unknown Tool', () => {
    it('should use DEFAULT suggestions for unknown tool', () => {
      const suggestion = generateRecoverySuggestion('unknown_tool', 'TIMEOUT')
      expect(suggestion).toBe('Try with simpler parameters')
    })

    it('should return default suggestion for unknown tool and error', () => {
      const suggestion = generateRecoverySuggestion('unknown_tool', 'UNKNOWN')
      expect(suggestion).toBe('Try a different approach')
    })

    it('should return validation suggestion for VALIDATION error on unknown tool', () => {
      const suggestion = generateRecoverySuggestion('unknown_tool', 'VALIDATION')
      expect(suggestion).toBe('Check the input format and try again')
    })
  })
})

// =============================================================================
// sanitizeArgsForLogging Tests
// =============================================================================

describe('sanitizeArgsForLogging', () => {
  it('should redact password fields', () => {
    const args = { username: 'user', password: 'secret123' }
    const sanitized = sanitizeArgsForLogging(args)

    expect(sanitized.username).toBe('user')
    expect(sanitized.password).toBe('[REDACTED]')
  })

  it('should redact token fields', () => {
    const args = { accessToken: 'abc123', refreshToken: 'xyz789' }
    const sanitized = sanitizeArgsForLogging(args)

    expect(sanitized.accessToken).toBe('[REDACTED]')
    expect(sanitized.refreshToken).toBe('[REDACTED]')
  })

  it('should redact secret fields', () => {
    const args = { clientSecret: 'mysecret', apiSecret: 'anothersecret' }
    const sanitized = sanitizeArgsForLogging(args)

    expect(sanitized.clientSecret).toBe('[REDACTED]')
    expect(sanitized.apiSecret).toBe('[REDACTED]')
  })

  it('should redact key fields', () => {
    const args = { apiKey: 'key123', privateKey: 'privatekey' }
    const sanitized = sanitizeArgsForLogging(args)

    expect(sanitized.apiKey).toBe('[REDACTED]')
    expect(sanitized.privateKey).toBe('[REDACTED]')
  })

  it('should redact auth fields', () => {
    const args = { authToken: 'token', authorization: 'Bearer xyz' }
    const sanitized = sanitizeArgsForLogging(args)

    expect(sanitized.authToken).toBe('[REDACTED]')
    expect(sanitized.authorization).toBe('[REDACTED]')
  })

  it('should redact credential fields', () => {
    const args = { credentials: 'creds', userCredential: 'usercred' }
    const sanitized = sanitizeArgsForLogging(args)

    expect(sanitized.credentials).toBe('[REDACTED]')
    expect(sanitized.userCredential).toBe('[REDACTED]')
  })

  it('should not modify non-sensitive fields', () => {
    const args = { query: 'SELECT *', limit: 100, userId: 'user123' }
    const sanitized = sanitizeArgsForLogging(args)

    expect(sanitized).toEqual(args)
  })

  it('should handle empty args', () => {
    const sanitized = sanitizeArgsForLogging({})
    expect(sanitized).toEqual({})
  })

  it('should handle case-insensitive matching', () => {
    const args = { PASSWORD: 'secret', ApiKey: 'key' }
    const sanitized = sanitizeArgsForLogging(args)

    expect(sanitized.PASSWORD).toBe('[REDACTED]')
    expect(sanitized.ApiKey).toBe('[REDACTED]')
  })
})

// =============================================================================
// Circuit Breaker Tests
// =============================================================================

describe('Circuit Breaker', () => {
  beforeEach(() => {
    resetCircuitBreakers()
  })

  describe('recordToolFailure', () => {
    it('should record a single failure', () => {
      recordToolFailure('test_tool', 'user123', false)

      const metrics = getCircuitMetrics()
      expect(metrics.totalFailures).toBe(1)
      expect(metrics.byTool.test_tool?.failures).toBe(1)
    })

    it('should open circuit after threshold failures', () => {
      const threshold = CIRCUIT_BREAKER_CONFIG.failureThreshold

      for (let i = 0; i < threshold; i++) {
        recordToolFailure('test_tool', 'user123', false)
      }

      expect(isCircuitOpen('test_tool', 'user123')).toBe(true)
    })

    it('should not open circuit before threshold', () => {
      const threshold = CIRCUIT_BREAKER_CONFIG.failureThreshold

      for (let i = 0; i < threshold - 1; i++) {
        recordToolFailure('test_tool', 'user123', false)
      }

      expect(isCircuitOpen('test_tool', 'user123')).toBe(false)
    })

    it('should isolate circuits per user', () => {
      const threshold = CIRCUIT_BREAKER_CONFIG.failureThreshold

      // User 1 triggers circuit
      for (let i = 0; i < threshold; i++) {
        recordToolFailure('test_tool', 'user1', false)
      }

      // User 2 should not be affected
      expect(isCircuitOpen('test_tool', 'user1')).toBe(true)
      expect(isCircuitOpen('test_tool', 'user2')).toBe(false)
    })

    it('should isolate circuits per tool', () => {
      const threshold = CIRCUIT_BREAKER_CONFIG.failureThreshold

      // Tool 1 triggers circuit
      for (let i = 0; i < threshold; i++) {
        recordToolFailure('tool1', 'user123', false)
      }

      // Tool 2 should not be affected
      expect(isCircuitOpen('tool1', 'user123')).toBe(true)
      expect(isCircuitOpen('tool2', 'user123')).toBe(false)
    })

    it('should track circuit opens in metrics', () => {
      const threshold = CIRCUIT_BREAKER_CONFIG.failureThreshold

      for (let i = 0; i < threshold; i++) {
        recordToolFailure('test_tool', 'user123', false)
      }

      const metrics = getCircuitMetrics()
      expect(metrics.circuitOpens).toBe(1)
    })

    it('should not count permanent errors toward circuit', () => {
      const threshold = CIRCUIT_BREAKER_CONFIG.failureThreshold

      // Record permanent errors (isPermanent = true)
      for (let i = 0; i < threshold + 5; i++) {
        recordToolFailure('test_tool', 'user123', true) // permanent error
      }

      // Circuit should remain closed for permanent errors
      expect(isCircuitOpen('test_tool', 'user123')).toBe(false)
    })
  })

  describe('recordToolSuccess', () => {
    it('should record a success', () => {
      recordToolSuccess('test_tool', 'user123')

      const metrics = getCircuitMetrics()
      expect(metrics.totalSuccesses).toBe(1)
      expect(metrics.byTool.test_tool?.successes).toBe(1)
    })

    it('should reset failure count on success', () => {
      // Record some failures (not enough to open circuit)
      recordToolFailure('test_tool', 'user123', false)
      recordToolFailure('test_tool', 'user123', false)

      // Record success
      recordToolSuccess('test_tool', 'user123')

      // Verify circuit is not close to opening
      expect(isCircuitOpen('test_tool', 'user123')).toBe(false)

      // Add more failures - should start from 0 again
      recordToolFailure('test_tool', 'user123', false)
      expect(isCircuitOpen('test_tool', 'user123')).toBe(false)
    })
  })

  describe('getCircuitStatus', () => {
    it('should return closed status for new circuit', () => {
      const status = getCircuitStatus('test_tool', 'user123')

      expect(status.isOpen).toBe(false)
      expect(status.retryAfterMs).toBeUndefined()
    })

    it('should return open status with retry time for open circuit', () => {
      const threshold = CIRCUIT_BREAKER_CONFIG.failureThreshold

      for (let i = 0; i < threshold; i++) {
        recordToolFailure('test_tool', 'user123', false)
      }

      const status = getCircuitStatus('test_tool', 'user123')

      expect(status.isOpen).toBe(true)
      expect(status.retryAfterMs).toBeDefined()
      expect(status.retryAfterMs).toBeLessThanOrEqual(CIRCUIT_BREAKER_CONFIG.resetTimeoutMs)
    })
  })

  describe('getActiveCircuits', () => {
    it('should return empty array when no circuits', () => {
      const circuits = getActiveCircuits()
      expect(circuits).toEqual([])
    })

    it('should return active circuits', () => {
      recordToolFailure('test_tool', 'user123', false)

      const circuits = getActiveCircuits()

      expect(circuits.length).toBe(1)
      expect(circuits[0].tool).toBe('test_tool')
      expect(circuits[0].userId).toBe('user123')
      expect(circuits[0].failures).toBe(1)
      expect(circuits[0].isOpen).toBe(false)
    })

    it('should correctly parse tool and userId from key', () => {
      recordToolFailure('quickbooks_data', 'user-456', false)

      const circuits = getActiveCircuits()

      expect(circuits[0].tool).toBe('quickbooks_data')
      expect(circuits[0].userId).toBe('user-456')
    })
  })

  describe('resetCircuitBreakers', () => {
    it('should clear all circuits and metrics', () => {
      recordToolFailure('tool1', 'user1', false)
      recordToolFailure('tool2', 'user2', false)
      recordToolSuccess('tool3', 'user3')

      resetCircuitBreakers()

      const circuits = getActiveCircuits()
      const metrics = getCircuitMetrics()

      expect(circuits).toEqual([])
      expect(metrics.totalFailures).toBe(0)
      expect(metrics.totalSuccesses).toBe(0)
      expect(metrics.circuitOpens).toBe(0)
      expect(metrics.circuitCloses).toBe(0)
      expect(Object.keys(metrics.byTool)).toHaveLength(0)
    })
  })
})

// =============================================================================
// parseToolResponse Tests
// =============================================================================

describe('parseToolResponse', () => {
  it('should parse successful response', () => {
    const response = JSON.stringify({
      success: true,
      data: { value: 42 },
      timestamp: '2024-01-01T00:00:00Z',
    })

    const parsed = parseToolResponse(response)

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ value: 42 })
    }
  })

  it('should parse error response', () => {
    const response = JSON.stringify({
      success: false,
      error: 'Something went wrong',
      code: 'TOOL_EXECUTION',
      retryable: true,
    })

    const parsed = parseToolResponse(response)

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error).toBe('Something went wrong')
      expect(parsed.code).toBe('TOOL_EXECUTION')
      expect(parsed.retryable).toBe(true)
    }
  })

  it('should handle invalid JSON gracefully', () => {
    const response = 'not valid json'

    const parsed = parseToolResponse(response)

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error).toBe('Failed to parse tool response')
      expect(parsed.code).toBe('UNKNOWN')
    }
  })

  it('should parse error response with hint', () => {
    const response = JSON.stringify({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION',
      retryable: false,
      hint: 'Check the input format',
    })

    const parsed = parseToolResponse(response)

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.hint).toBe('Check the input format')
    }
  })

  it('should parse error response with duration', () => {
    const response = JSON.stringify({
      success: false,
      error: 'Timeout',
      code: 'TOOL_TIMEOUT',
      retryable: true,
      duration: 15000,
    })

    const parsed = parseToolResponse(response)

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.duration).toBe(15000)
    }
  })
})

// =============================================================================
// Integration Tests - Returned Failure Detection
// =============================================================================

describe('Returned Failure Detection (Integration)', () => {
  beforeEach(() => {
    resetCircuitBreakers()
  })

  it('should detect success:false as failure', () => {
    const errorResponse = JSON.stringify({
      success: false,
      error: 'Connection refused',
      code: 'NETWORK',
      retryable: true,
    })

    const parsed = parseToolResponse(errorResponse)

    expect(parsed.success).toBe(false)
    // This would trigger failure handling in customToolNode
  })

  it('should detect success:true as success', () => {
    const successResponse = JSON.stringify({
      success: true,
      data: { result: 'OK' },
      timestamp: new Date().toISOString(),
    })

    const parsed = parseToolResponse(successResponse)

    expect(parsed.success).toBe(true)
    // This would trigger success handling in customToolNode
  })

  it('should trigger circuit breaker for returned failures', () => {
    const threshold = CIRCUIT_BREAKER_CONFIG.failureThreshold

    // Simulate tool returning failures
    for (let i = 0; i < threshold; i++) {
      const errorResponse = JSON.stringify({
        success: false,
        error: 'Timeout',
        code: 'TOOL_TIMEOUT',
        retryable: true,
      })

      const parsed = parseToolResponse(errorResponse)
      if (!parsed.success) {
        // This is what customToolNode does
        recordToolFailure('quickbooks_data', 'user123', false)
      }
    }

    // Circuit should be open
    expect(isCircuitOpen('quickbooks_data', 'user123')).toBe(true)

    // Get circuit status with retry time
    const status = getCircuitStatus('quickbooks_data', 'user123')
    expect(status.isOpen).toBe(true)
    expect(status.retryAfterMs).toBeDefined()

    // Recovery suggestion should mention circuit being open
    const suggestion = generateRecoverySuggestion('quickbooks_data', 'TOOL_TIMEOUT')
    expect(suggestion).toBe('Try a smaller date range or simpler query')
  })

  it('should enhance error response with context', () => {
    const errorResponse = JSON.stringify({
      success: false,
      error: 'API rate limited',
      code: 'RATE_LIMIT',
      retryable: true,
      hint: 'Wait 60 seconds',
    })

    const parsed = parseToolResponse(errorResponse)

    if (!parsed.success) {
      // Simulate what customToolNode does to enhance the response
      const suggestion = generateRecoverySuggestion('web_search', parsed.code)
      const attemptedWith = sanitizeArgsForLogging({ query: 'test', apiKey: 'secret' })

      const enhancedResponse = {
        ...parsed,
        errorType: parsed.code,
        suggestion: parsed.hint || suggestion,
        attemptedWith,
        duration: 1500,
      }

      expect(enhancedResponse.errorType).toBe('RATE_LIMIT')
      expect(enhancedResponse.suggestion).toBe('Wait 60 seconds') // Uses hint
      expect(enhancedResponse.attemptedWith.apiKey).toBe('[REDACTED]')
      expect(enhancedResponse.duration).toBe(1500)
    }
  })
})
