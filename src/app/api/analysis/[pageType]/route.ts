import { NextRequest, NextResponse } from 'next/server'
import { createLLM } from '@/lib/llm'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { logger } from '@/lib/logger'
import { saveAnalysis, getLatestAnalysis } from '@/lib/services/aiAnalysisStorage'
import {
  validateAndParseResponse,
  logValidationFailure,
  logFinalValidationStatus,
} from '@/ai/validation/responseValidator'
import { buildSystemPrompt, buildUserPrompt } from '@/ai/analysis/prompts'
import {
  getAnalysisConfig,
  getAnalysisTypeFromPageType,
  getCacheTTL,
} from '@/components/ai-analysis/ai-analysis.config'
import type { PageType } from '@/components/ai-analysis/types'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'
import { TOKEN_LIMITS } from '@/config/tokens'

// Validate page type
const VALID_PAGE_TYPES: PageType[] = [
  'pnl',
  'cashflow',
  'balancesheet',
  'sales',
  'expenses',
  'journal',
  'summary',
]

export const POST = withActiveProvider(
  async (request, { provider, apiClient, organizationId, userId, providerId }) => {
    try {
      // Extract page type from URL
      const url = new URL(request.url)
      const pathSegments = url.pathname.split('/')
      const pageType = pathSegments[pathSegments.length - 1] as PageType

      // Validate page type
      if (!VALID_PAGE_TYPES.includes(pageType)) {
        return NextResponse.json(
          {
            error: `Invalid page type: ${pageType}. Must be one of: ${VALID_PAGE_TYPES.join(', ')}`,
          },
          { status: 400 }
        )
      }

      logger.workflow(`${pageType}-analysis`, 'request_started', { userId, organizationId })

      // Check for stored metadata first to avoid unnecessary API calls
      let currency = 'USD'
      try {
        const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)

        if (storedMetadata.homeCurrency) {
          // Use stored metadata
          currency = storedMetadata.homeCurrency
        } else {
          // Fallback: fetch from provider API
          const orgInfo = await provider.organizations.getOrganizationInfo(organizationId)
          currency = orgInfo?.currency_code || 'USD'

          // Store metadata for future requests
          updateProviderCompanyMetadata(organizationId, providerId, {
            homeCurrency: currency,
            companyName: orgInfo?.name || undefined,
          }).catch((err) => logger.warn('[Analysis] Failed to store metadata:', { error: err }))
        }
      } catch (error) {
        logger.warn('Failed to fetch organization currency for analysis, using USD', { error })
      }

      const body = await request.json()
      const { data, dateRange, context = {}, forceRegenerate } = body

      // Validate required fields
      if (!data || typeof data !== 'object') {
        return NextResponse.json(
          { error: 'Invalid request: data is required and must be an object' },
          { status: 400 }
        )
      }

      if (!dateRange || !dateRange.start || !dateRange.end) {
        return NextResponse.json(
          { error: 'Invalid request: dateRange with start and end dates is required' },
          { status: 400 }
        )
      }

      // Validate date range format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(dateRange.start) || !dateRegex.test(dateRange.end)) {
        return NextResponse.json(
          { error: 'Invalid request: dates must be in YYYY-MM-DD format' },
          { status: 400 }
        )
      }

      // Get config for this page type
      const config = getAnalysisConfig(pageType)
      const analysisType = getAnalysisTypeFromPageType(pageType)

      // Check for cached analysis (unless force regenerate)
      if (!forceRegenerate) {
        logger.workflow(`${pageType}-analysis`, 'checking_cache', { organizationId })
        const cachedAnalysis = await getLatestAnalysis(organizationId, analysisType, dateRange)

        if (cachedAnalysis) {
          logger.workflow(`${pageType}-analysis`, 'cache_hit', {
            organizationId,
            analysisId: cachedAnalysis.analysis_id,
            remainingMinutes: Math.floor((cachedAnalysis.expires_at - Date.now()) / 60000),
          })

          // Parse cached JSON if possible
          let analysis: any = cachedAnalysis.analysis_text
          try {
            analysis = JSON.parse(cachedAnalysis.analysis_text)
          } catch {
            // Keep as string if not valid JSON (legacy format)
          }

          return NextResponse.json({
            analysis,
            tokensUsed: 0,
            cached: true,
            cacheExpiresAt: cachedAnalysis.expires_at,
            createdAt: cachedAnalysis.created_at,
          })
        }
      } else {
        logger.workflow(`${pageType}-analysis`, 'force_regenerate', { organizationId })
      }

      logger.workflow(`${pageType}-analysis`, 'cache_miss', { organizationId })

      // Build prompts with currency context
      const systemPrompt = buildSystemPrompt(pageType, currency)
      const userPrompt = buildUserPrompt(pageType, data, dateRange, { ...context, currency })

      // Retry configuration
      const MAX_RETRIES = 3 // 4 total attempts
      const RETRY_DELAYS = [500, 1000, 2000] // Exponential backoff
      let analysisContent = ''
      let validationResult
      let attempt = 0

      // Retry loop with validation
      for (attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // Add delay before retry (skip on first attempt)
        if (attempt > 0) {
          logger.workflow(`${pageType}-analysis`, 'retrying', {
            organizationId,
            attempt: attempt + 1,
            maxAttempts: MAX_RETRIES + 1,
            delay: RETRY_DELAYS[attempt - 1],
          })
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt - 1]))
        }

        // Create LLM instance
        const llm = createLLM({
          temperature: TOKEN_LIMITS.TEMPERATURE_STRUCTURED,
          maxTokens: TOKEN_LIMITS.ANALYSIS,
        })

        // Generate analysis
        const response = await llm.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ])

        // Extract text content
        analysisContent =
          typeof response === 'string'
            ? response
            : typeof response.content === 'string'
              ? response.content
              : response.text || ''

        // Validate and parse JSON response
        validationResult = validateAndParseResponse(analysisContent)

        if (validationResult.isValid && validationResult.parsed) {
          logger.workflow(`${pageType}-analysis`, 'validation_success', {
            organizationId,
            attempt: attempt + 1,
          })
          break
        } else {
          logValidationFailure(attempt + 1, organizationId, validationResult, analysisContent)

          if (attempt === MAX_RETRIES) {
            logger.workflow(`${pageType}-analysis`, 'max_retries_reached', {
              organizationId,
              totalAttempts: attempt + 1,
              failedSections: validationResult.failedSections,
            })
          }
        }
      }

      // Log final validation status
      logFinalValidationStatus(organizationId, attempt + 1, validationResult!)

      // Use parsed JSON if valid, otherwise store raw content
      const analysisToStore = validationResult!.parsed
        ? JSON.stringify(validationResult!.parsed)
        : analysisContent

      // Save analysis to cache
      logger.workflow(`${pageType}-analysis`, 'saving_to_cache', { organizationId })
      const savedAnalysis = await saveAnalysis(
        organizationId,
        userId,
        analysisType,
        analysisToStore,
        dateRange,
        {
          pageType,
          data,
          context,
        },
        providerId,
        'openai/gpt-oss-120b',
        getCacheTTL(pageType) // Use page-specific TTL
      )

      logger.workflow(`${pageType}-analysis`, 'analysis_saved', {
        organizationId,
        analysisId: savedAnalysis.analysis_id,
      })

      return NextResponse.json({
        analysis: validationResult!.parsed || analysisContent,
        cached: false,
        cacheExpiresAt: savedAnalysis.expires_at,
        createdAt: savedAnalysis.created_at,
        validation: {
          passed: validationResult!.isValid,
          attempts: attempt + 1,
          failedSections: validationResult!.failedSections,
        },
      })
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error'
      const errorName = error?.name || 'Error'

      logger.error('Error generating AI analysis', {
        error,
        errorMessage,
        errorName,
        userId,
        organizationId,
      })

      // LLM/Network errors
      if (
        errorMessage.includes('timeout') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorName.includes('TimeoutError') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429')
      ) {
        return NextResponse.json(
          {
            error: 'AI service temporarily unavailable',
            message:
              'The analysis service is experiencing high demand. Please try again in a moment.',
            retry: true,
          },
          { status: 503 }
        )
      }

      // Database/Storage errors
      if (
        errorMessage.includes('DynamoDB') ||
        errorMessage.includes('ResourceNotFoundException') ||
        errorName.includes('DynamoDB')
      ) {
        return NextResponse.json(
          {
            error: 'Storage error',
            message: 'Unable to save analysis. Please try again.',
            cached: false,
          },
          { status: 500 }
        )
      }

      // Invalid response from LLM
      if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
        return NextResponse.json(
          {
            error: 'Invalid AI response',
            message: 'The AI generated an invalid response. Please try again.',
            retry: true,
          },
          { status: 500 }
        )
      }

      // Generic fallback
      console.error('Unexpected error in AI analysis:', error)
      return NextResponse.json(
        {
          error: 'An unexpected error occurred',
          message: 'Please try again or contact support if the issue persists.',
        },
        { status: 500 }
      )
    }
  }
)
