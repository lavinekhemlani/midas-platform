// src/lib/auth/token-extractor.ts
/**
 * Token extraction from HTTP requests
 * Handles Authorization headers and cookies
 */

import type { NextRequest } from 'next/server'
import type { ExtractedToken, TokenUse } from './types'
import { TOKEN_CONFIG } from './constants'
import { logger } from '../logger'

/**
 * Extracts JWT tokens from HTTP requests
 */
export class TokenExtractor {
  /**
   * Extract token from request (Authorization header or cookies)
   * @param request The Next.js request object
   * @param preferredType Preferred token type to extract
   * @returns Extracted token with metadata
   */
  static extract(request: NextRequest, preferredType?: TokenUse): ExtractedToken {
    const correlationId = request.headers.get('x-correlation-id') || 'unknown'

    // Try Authorization header first
    const headerToken = this.extractFromHeader(request, correlationId)
    if (headerToken) {
      return headerToken
    }

    // Try cookies
    const cookies = request.headers.get('cookie') || ''
    const tokenType = preferredType || 'id'
    const cookieToken = this.extractFromCookie(cookies, tokenType, correlationId)

    if (cookieToken) {
      return cookieToken
    }

    // Try alternate token type if no preference was specified
    if (!preferredType) {
      const altToken = this.extractFromCookie(cookies, 'access', correlationId)
      if (altToken) {
        return altToken
      }
    }

    // No token found
    logger.debug('[TokenExtractor] No token found in request', {
      correlationId,
      preferredType,
      hasCookies: cookies.length > 0,
      cookieCount: cookies.split(';').length,
    })

    return { value: null, type: tokenType }
  }

  /**
   * Extract token from Authorization header
   * @param request The request object
   * @param correlationId Correlation ID for logging
   * @returns Extracted token or null
   */
  private static extractFromHeader(
    request: NextRequest,
    correlationId: string
  ): ExtractedToken | null {
    const authHeader = request.headers.get('authorization')

    if (!authHeader) {
      return null
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
      return null
    }

    logger.debug('[TokenExtractor] Token extracted from Authorization header', {
      correlationId,
      tokenLength: token.length,
    })

    return { value: token, type: 'access' }
  }

  /**
   * Extract token from cookies
   * @param cookies Cookie string
   * @param tokenType Type of token to extract
   * @param correlationId Correlation ID for logging
   * @returns Extracted token or null
   */
  private static extractFromCookie(
    cookies: string,
    tokenType: TokenUse,
    correlationId: string
  ): ExtractedToken | null {
    const pattern = new RegExp(`${tokenType}Token=([^;]+)`)
    const match = cookies.match(pattern)

    if (!match) {
      return null
    }

    let tokenValue = match[1]

    // Clean up the token
    tokenValue = this.cleanTokenValue(tokenValue)

    // Validate token format
    if (!this.validateTokenFormat(tokenValue)) {
      logger.error('[TokenExtractor] Malformed token extracted from cookie', {
        correlationId,
        tokenType,
        partsFound: tokenValue.split(TOKEN_CONFIG.JWT_SEPARATOR).length,
        tokenLength: tokenValue.length,
      })
    } else {
      logger.debug('[TokenExtractor] Token extracted from cookie', {
        correlationId,
        tokenType,
        tokenLength: tokenValue.length,
      })
    }

    return { value: tokenValue, type: tokenType }
  }

  /**
   * Clean token value (URL decode, remove quotes)
   * @param value Raw token value
   * @returns Cleaned token value
   */
  private static cleanTokenValue(value: string): string {
    let cleaned = value

    // Try URL decoding
    try {
      cleaned = decodeURIComponent(cleaned)
    } catch {
      // Use as-is if decode fails
    }

    // Remove quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '')

    return cleaned
  }

  /**
   * Validate token has correct JWT format
   * @param value Token value
   * @returns true if token format is valid
   */
  private static validateTokenFormat(value: string): boolean {
    const parts = value.split(TOKEN_CONFIG.JWT_SEPARATOR)
    return parts.length === TOKEN_CONFIG.JWT_PARTS_COUNT
  }
}
