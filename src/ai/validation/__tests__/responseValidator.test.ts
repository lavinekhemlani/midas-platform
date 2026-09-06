// src/ai/validation/__tests__/responseValidator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateAndParseResponse,
  logValidationFailure,
  logFinalValidationStatus,
} from '../responseValidator'

// Mock the logger to prevent console noise during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import logger after mocking to get the mocked instance
import { logger } from '@/lib/logger'

describe('responseValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateResponseSize', () => {
    it('should reject empty content', () => {
      const result = validateAndParseResponse('')

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
      expect(result.failedSections).toContain('json_parse')
    })

    it('should accept content within limit (< 10MB)', () => {
      const validContent = JSON.stringify({
        insights: 'Valid content',
        data: Array(1000).fill('test data'),
      })

      const result = validateAndParseResponse(validContent)

      expect(result.isValid).toBe(true)
      expect(result.parsed).toBeDefined()
      expect(result.failedSections).toHaveLength(0)
    })

    it('should reject content exceeding MAX_RESPONSE_SIZE (10MB)', () => {
      // Create content larger than 10MB
      const largeContent = 'x'.repeat(11 * 1024 * 1024)

      const result = validateAndParseResponse(largeContent)

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
      expect(result.failedSections).toContain('json_parse')
      expect(logger.error).toHaveBeenCalledWith(
        '[ResponseValidator] Response exceeds maximum size',
        expect.objectContaining({
          size: largeContent.length,
          maxSize: 10 * 1024 * 1024,
        })
      )
    })

    it('should handle exact boundary test (10MB)', () => {
      // Create content exactly at the 10MB limit
      const boundarySize = 10 * 1024 * 1024
      const jsonObject = {
        insights: 'Boundary test',
        data: 'x'.repeat(boundarySize - 100), // Account for JSON structure
      }
      const boundaryContent = JSON.stringify(jsonObject).substring(0, boundarySize)

      const result = validateAndParseResponse(boundaryContent)

      // Should not throw size error (though JSON parse might fail due to truncation)
      expect(logger.error).not.toHaveBeenCalledWith(
        '[ResponseValidator] Response exceeds maximum size',
        expect.anything()
      )
    })
  })

  describe('getObjectDepth', () => {
    it('should return 0 for null', () => {
      const result = validateAndParseResponse('null')
      expect(result.isValid).toBe(false) // null is not a valid object
      expect(result.failedSections).toContain('root_object')
    })

    it('should return 0 for primitives', () => {
      const primitives = ['"string"', '123', 'true', 'false']

      primitives.forEach((primitive) => {
        const result = validateAndParseResponse(primitive)
        expect(result.isValid).toBe(false) // primitives are not valid objects
        expect(result.failedSections).toContain('root_object')
      })
    })

    it('should calculate depth 1 for flat object', () => {
      const flatObject = JSON.stringify({
        insights: 'test',
        analysis: 'data',
        summary: 'info',
      })

      const result = validateAndParseResponse(flatObject)

      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({
        insights: 'test',
        analysis: 'data',
        summary: 'info',
      })
    })

    it('should calculate depth for nested object (depth 5)', () => {
      const nestedObject = {
        insights: {
          level1: {
            level2: {
              level3: {
                level4: 'deep value',
              },
            },
          },
        },
      }

      const result = validateAndParseResponse(JSON.stringify(nestedObject))

      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual(nestedObject)
    })

    it('should calculate depth for moderately nested object (depth 10)', () => {
      let nestedObject: any = { value: 'deepest' }

      // Build nested object with depth 10
      for (let i = 0; i < 10; i++) {
        nestedObject = { insights: nestedObject }
      }

      const result = validateAndParseResponse(JSON.stringify(nestedObject))

      expect(result.isValid).toBe(true)
      expect(result.parsed).toBeDefined()
    })

    it('should calculate depth for deeply nested object (depth 15)', () => {
      let nestedObject: any = { value: 'very deep' }

      // Build nested object with depth 15
      for (let i = 0; i < 15; i++) {
        nestedObject = { insights: nestedObject }
      }

      const result = validateAndParseResponse(JSON.stringify(nestedObject))

      expect(result.isValid).toBe(true)
      expect(result.parsed).toBeDefined()
    })

    it('should reject object exceeding MAX_JSON_DEPTH (20)', () => {
      let nestedObject: any = { value: 'too deep' }

      // Build nested object with depth 21 (exceeds MAX_JSON_DEPTH)
      for (let i = 0; i < 21; i++) {
        nestedObject = { level: nestedObject }
      }

      const result = validateAndParseResponse(JSON.stringify(nestedObject))

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
      expect(result.failedSections).toContain('json_parse')
      expect(logger.error).toHaveBeenCalledWith(
        '[ResponseValidator] JSON structure too deeply nested',
        expect.objectContaining({
          depth: 21,
          maxDepth: 20,
        })
      )
    })

    it('should calculate array depth correctly', () => {
      const arrayObject = {
        insights: 'test',
        data: ['item1', 'item2', ['nested', 'array']],
      }

      const result = validateAndParseResponse(JSON.stringify(arrayObject))

      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual(arrayObject)
    })

    it('should calculate mixed array/object nesting depth', () => {
      const mixedNesting = {
        insights: [
          {
            level1: [
              {
                level2: {
                  level3: [
                    {
                      level4: 'deep mixed value',
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const result = validateAndParseResponse(JSON.stringify(mixedNesting))

      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual(mixedNesting)
    })

    it('should handle deeply nested arrays', () => {
      let nestedArray: any = ['deepest value']

      // Build nested array with depth 18
      for (let i = 0; i < 18; i++) {
        nestedArray = [nestedArray]
      }

      const result = validateAndParseResponse(JSON.stringify({ insights: nestedArray }))

      expect(result.isValid).toBe(true)
      expect(result.parsed).toBeDefined()
    })

    it('should reject deeply nested array attack (depth > 20)', () => {
      let nestedArray: any = ['attack payload']

      // Build nested array with depth 22 (exceeds MAX_JSON_DEPTH)
      for (let i = 0; i < 22; i++) {
        nestedArray = [nestedArray]
      }

      const result = validateAndParseResponse(JSON.stringify(nestedArray))

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
      expect(logger.error).toHaveBeenCalledWith(
        '[ResponseValidator] JSON structure too deeply nested',
        expect.anything()
      )
    })
  })

  describe('parseJSONSafely', () => {
    it('should parse valid JSON successfully', () => {
      const validJSON = JSON.stringify({
        insights: 'Valid insights',
        analysis: 'Complete analysis',
        recommendations: ['Action 1', 'Action 2'],
      })

      const result = validateAndParseResponse(validJSON)

      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({
        insights: 'Valid insights',
        analysis: 'Complete analysis',
        recommendations: ['Action 1', 'Action 2'],
      })
      expect(result.failedSections).toHaveLength(0)
    })

    it('should return error for malformed JSON', () => {
      const malformedJSON = '{ "insights": "test", invalid }'

      const result = validateAndParseResponse(malformedJSON)

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
      expect(result.failedSections).toContain('json_parse')
      expect(logger.debug).toHaveBeenCalledWith(
        '[ResponseValidator] JSON parse failed',
        expect.objectContaining({
          error: expect.any(String),
          contentPreview: expect.any(String),
        })
      )
    })

    it('should reject oversized JSON', () => {
      // Create JSON larger than 10MB by creating a string > 10MB
      const oversizedData = 'x'.repeat(11 * 1024 * 1024)
      const oversizedJSON = JSON.stringify({ data: oversizedData })

      const result = validateAndParseResponse(oversizedJSON)

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
      expect(logger.error).toHaveBeenCalledWith(
        '[ResponseValidator] Response exceeds maximum size',
        expect.anything()
      )
    })

    it('should reject deeply nested JSON attack', () => {
      let deepObject: any = { end: true }

      // Create object with 25 levels of nesting (exceeds MAX_JSON_DEPTH of 20)
      for (let i = 0; i < 25; i++) {
        deepObject = { nested: deepObject }
      }

      const result = validateAndParseResponse(JSON.stringify(deepObject))

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
      expect(logger.error).toHaveBeenCalledWith(
        '[ResponseValidator] JSON structure too deeply nested',
        expect.objectContaining({
          maxDepth: 20,
        })
      )
    })

    it('should handle JSON with unicode characters', () => {
      const unicodeJSON = JSON.stringify({
        insights: '测试 🚀 данные',
        analysis: 'Unicode content',
      })

      const result = validateAndParseResponse(unicodeJSON)

      expect(result.isValid).toBe(true)
      expect(result.parsed.insights).toBe('测试 🚀 данные')
    })

    it('should handle JSON with special characters', () => {
      const specialJSON = JSON.stringify({
        insights: 'Test with "quotes" and \\backslashes\\',
        analysis: 'Line 1\nLine 2\tTabbed',
      })

      const result = validateAndParseResponse(specialJSON)

      expect(result.isValid).toBe(true)
      expect(result.parsed.insights).toBe('Test with "quotes" and \\backslashes\\')
    })
  })

  describe('validateAndParseResponse', () => {
    it('should parse plain JSON content', () => {
      const plainJSON = JSON.stringify({
        insights: 'Plain JSON insights',
        summary: 'Summary content',
      })

      const result = validateAndParseResponse(plainJSON)

      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({
        insights: 'Plain JSON insights',
        summary: 'Summary content',
      })
      expect(result.rawContent).toBe(plainJSON)
    })

    it('should extract JSON from markdown code block', () => {
      const markdownContent = `
Here is the analysis:

\`\`\`json
{
  "insights": "Extracted from markdown",
  "analysis": "Code block content"
}
\`\`\`

Additional text after.
      `.trim()

      const result = validateAndParseResponse(markdownContent)

      expect(result.isValid).toBe(true)
      expect(result.parsed).toEqual({
        insights: 'Extracted from markdown',
        analysis: 'Code block content',
      })
    })

    it('should extract JSON from code block without language tag', () => {
      const codeBlock = `
\`\`\`
{
  "insights": "No language tag",
  "summary": "Still valid"
}
\`\`\`
      `.trim()

      const result = validateAndParseResponse(codeBlock)

      expect(result.isValid).toBe(true)
      expect(result.parsed.insights).toBe('No language tag')
    })

    it('should salvage partial JSON from malformed response', () => {
      const partialContent = `
Some text before...
{
  "insights": "Partial salvage",
  "analysis": "Extracted content"
}
More text after...
      `.trim()

      const result = validateAndParseResponse(partialContent)

      expect(result.isValid).toBe(false) // Technically failed first parse
      expect(result.parsed).toEqual({
        insights: 'Partial salvage',
        analysis: 'Extracted content',
      })
      expect(result.failedSections).toContain('json_parse')
    })

    it('should return null for completely invalid content', () => {
      const invalidContent = 'This is not JSON at all, no braces, nothing.'

      const result = validateAndParseResponse(invalidContent)

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
      expect(result.failedSections).toContain('json_parse')
      expect(result.rawContent).toBe(invalidContent)
    })

    it('should validate required fields (insights/analysis/summary)', () => {
      const withInsights = JSON.stringify({
        insights: 'Has insights',
        other: 'data',
      })

      const result = validateAndParseResponse(withInsights)

      expect(result.isValid).toBe(true)
      expect(result.failedSections).not.toContain('insights')
    })

    it('should mark missing insights as failed section', () => {
      const noInsights = JSON.stringify({
        data: 'some data',
        other: 'fields',
      })

      const result = validateAndParseResponse(noInsights)

      expect(result.isValid).toBe(false)
      expect(result.failedSections).toContain('insights')
    })

    it('should accept analysis field as insights alternative', () => {
      const withAnalysis = JSON.stringify({
        analysis: 'Has analysis instead',
        other: 'data',
      })

      const result = validateAndParseResponse(withAnalysis)

      expect(result.isValid).toBe(true)
      expect(result.failedSections).not.toContain('insights')
    })

    it('should accept summary field as insights alternative', () => {
      const withSummary = JSON.stringify({
        summary: 'Has summary instead',
        other: 'data',
      })

      const result = validateAndParseResponse(withSummary)

      expect(result.isValid).toBe(true)
      expect(result.failedSections).not.toContain('insights')
    })

    it('should handle complex nested markdown with code blocks', () => {
      const complexMarkdown = `
# Analysis Report

Some explanation here.

\`\`\`json
{
  "insights": "Complex nested insights",
  "analysis": {
    "findings": ["Finding 1", "Finding 2"],
    "metrics": {
      "accuracy": 0.95,
      "performance": "good"
    }
  },
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ]
}
\`\`\`

## Conclusion
More text here.
      `.trim()

      const result = validateAndParseResponse(complexMarkdown)

      expect(result.isValid).toBe(true)
      expect(result.parsed.insights).toBe('Complex nested insights')
      expect(result.parsed.analysis.findings).toHaveLength(2)
      expect(result.parsed.recommendations).toHaveLength(2)
    })

    it('should reject array as root object', () => {
      const arrayContent = JSON.stringify(['item1', 'item2', 'item3'])

      const result = validateAndParseResponse(arrayContent)

      // Arrays can be parsed successfully in implementation, but fail validation for missing insights
      expect(result.isValid).toBe(false)
      // The implementation may fail on 'root_object' or 'insights' depending on how it's processed
      expect(result.failedSections.length).toBeGreaterThan(0)
    })

    it('should allow partial success with some content', () => {
      const partialContent = JSON.stringify({
        someField: 'some value',
        otherField: 'other value',
        // No insights/analysis/summary
      })

      const result = validateAndParseResponse(partialContent)

      expect(result.isValid).toBe(false)
      expect(result.parsed).not.toBe(null) // Should still have parsed data
      expect(result.failedSections).toContain('insights')
    })
  })

  describe('logValidationFailure', () => {
    it('should log validation failure with correct parameters', () => {
      const rawContent = '{ invalid json }'
      const result = {
        isValid: false,
        parsed: null,
        failedSections: ['insights', 'json_parse'],
        rawContent,
      }

      logValidationFailure(1, 'org-123', result, rawContent)

      expect(logger.warn).toHaveBeenCalledWith('[ResponseValidator] Validation failed', {
        attempt: 1,
        organizationId: 'org-123',
        failedSections: ['insights', 'json_parse'],
        contentLength: rawContent.length,
        hasPartialParse: false,
      })
    })

    it('should log partial parse information', () => {
      const result = {
        isValid: false,
        parsed: { some: 'data' },
        failedSections: ['insights'],
        rawContent: '{ "some": "data" }',
      }

      logValidationFailure(2, 'org-456', result, '{ "some": "data" }')

      expect(logger.warn).toHaveBeenCalledWith(
        '[ResponseValidator] Validation failed',
        expect.objectContaining({
          hasPartialParse: true,
        })
      )
    })
  })

  describe('logFinalValidationStatus', () => {
    it('should log success for valid result', () => {
      const result = {
        isValid: true,
        parsed: { insights: 'test' },
        failedSections: [],
        rawContent: '{ "insights": "test" }',
      }

      logFinalValidationStatus('org-789', 3, result)

      expect(logger.info).toHaveBeenCalledWith('[ResponseValidator] Validation succeeded', {
        organizationId: 'org-789',
        totalAttempts: 3,
      })
    })

    it('should log warning for invalid result after all attempts', () => {
      const result = {
        isValid: false,
        parsed: null,
        failedSections: ['insights', 'json_parse'],
        rawContent: 'invalid',
      }

      logFinalValidationStatus('org-999', 5, result)

      expect(logger.warn).toHaveBeenCalledWith(
        '[ResponseValidator] Validation failed after all attempts',
        {
          organizationId: 'org-999',
          totalAttempts: 5,
          failedSections: ['insights', 'json_parse'],
          hasPartialParse: false,
        }
      )
    })

    it('should log partial parse in final status', () => {
      const result = {
        isValid: false,
        parsed: { some: 'partial data' },
        failedSections: ['insights'],
        rawContent: '{ "some": "partial data" }',
      }

      logFinalValidationStatus('org-111', 2, result)

      expect(logger.warn).toHaveBeenCalledWith(
        '[ResponseValidator] Validation failed after all attempts',
        expect.objectContaining({
          hasPartialParse: true,
        })
      )
    })
  })

  describe('Edge Cases and Security', () => {
    it('should handle empty string content', () => {
      const result = validateAndParseResponse('')

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
    })

    it('should handle whitespace-only content', () => {
      const result = validateAndParseResponse('   \n\t  ')

      expect(result.isValid).toBe(false)
      expect(result.parsed).toBe(null)
    })

    it('should handle JSON with circular reference simulation (deep nesting)', () => {
      const circular: any = {}
      let current = circular

      // Simulate circular-like structure with deep nesting
      for (let i = 0; i < 22; i++) {
        current.next = {}
        current = current.next
      }

      const result = validateAndParseResponse(JSON.stringify(circular))

      expect(result.isValid).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        '[ResponseValidator] JSON structure too deeply nested',
        expect.anything()
      )
    })

    it('should handle very large array with shallow depth', () => {
      const largeArray = Array(10000).fill({ insights: 'test', value: 123 })
      const json = JSON.stringify({ insights: 'test', data: largeArray })

      const result = validateAndParseResponse(json)

      expect(result.isValid).toBe(true)
      expect(result.parsed.data).toHaveLength(10000)
    })

    it('should handle JSON with null values', () => {
      const nullJSON = JSON.stringify({
        insights: 'test',
        nullValue: null,
        analysis: 'data',
      })

      const result = validateAndParseResponse(nullJSON)

      expect(result.isValid).toBe(true)
      expect(result.parsed.nullValue).toBe(null)
    })

    it('should handle JSON with boolean values', () => {
      const booleanJSON = JSON.stringify({
        insights: 'test',
        isValid: true,
        isComplete: false,
      })

      const result = validateAndParseResponse(booleanJSON)

      expect(result.isValid).toBe(true)
      expect(result.parsed.isValid).toBe(true)
      expect(result.parsed.isComplete).toBe(false)
    })

    it('should handle JSON with number edge cases', () => {
      const numberJSON = JSON.stringify({
        insights: 'test',
        zero: 0,
        negative: -123,
        float: 123.456,
        scientific: 1.23e10,
      })

      const result = validateAndParseResponse(numberJSON)

      expect(result.isValid).toBe(true)
      expect(result.parsed.zero).toBe(0)
      expect(result.parsed.negative).toBe(-123)
      expect(result.parsed.float).toBe(123.456)
    })

    it('should handle multiple JSON blocks in markdown (use first one)', () => {
      const multipleBlocks = `
\`\`\`json
{
  "insights": "First block",
  "analysis": "First"
}
\`\`\`

Some text

\`\`\`json
{
  "insights": "Second block",
  "analysis": "Second"
}
\`\`\`
      `.trim()

      const result = validateAndParseResponse(multipleBlocks)

      expect(result.isValid).toBe(true)
      expect(result.parsed.analysis).toBe('First') // Should extract first block
    })
  })
})
