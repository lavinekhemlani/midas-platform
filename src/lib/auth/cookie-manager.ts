// src/lib/auth/cookie-manager.ts
/**
 * Authentication cookie management
 * Handles setting, clearing, and checking auth cookies
 */

import { fetchAuthSession } from 'aws-amplify/auth'
import { AUTH_CONFIG } from './constants'
import { logger } from '../logger'

/**
 * Manages authentication cookies for JWT tokens
 */
export class AuthCookies {
  /**
   * Build cookie options string
   * @param secure Whether to use secure flag
   * @returns Cookie options string
   *
   * Note: httpOnly flag cannot be set from client-side JavaScript.
   * Using samesite=lax instead of strict for OAuth/SSO compatibility.
   * For enhanced security, consider implementing CSRF tokens for state-changing operations.
   */
  private static buildCookieString(secure: boolean): string {
    return `; path=/; ${secure ? 'secure; ' : ''}samesite=lax; max-age=${AUTH_CONFIG.COOKIE_MAX_AGE}`
  }

  /**
   * Determine if secure cookies should be used
   * @returns true if cookies should be secure
   */
  private static shouldUseSecureCookies(): boolean {
    return (
      process.env.NODE_ENV === 'production' ||
      (typeof window !== 'undefined' && window.location.protocol === 'https:')
    )
  }

  /**
   * Extract JWT string from token object
   * Handles different token formats from AWS Amplify
   * @param tokenObj The token object from Amplify
   * @returns JWT string or undefined
   */
  private static extractTokenString(tokenObj: any): string | undefined {
    // Direct string
    if (typeof tokenObj === 'string') {
      return tokenObj
    }

    // Has toString method
    if (tokenObj?.toString && typeof tokenObj.toString === 'function') {
      return tokenObj.toString()
    }

    // Has jwtToken property
    if (tokenObj?.jwtToken) {
      return tokenObj.jwtToken
    }

    return undefined
  }

  /**
   * Set authentication cookies from current session
   * Retrieves tokens from Amplify and stores them as httpOnly cookies
   */
  static async set(): Promise<void> {
    try {
      const session = await fetchAuthSession()

      if (!session.tokens?.accessToken || !session.tokens?.idToken) {
        logger.warn('No tokens available in session')
        return
      }

      const isSecure = this.shouldUseSecureCookies()
      const options = this.buildCookieString(isSecure)

      // Extract token strings
      const accessToken = this.extractTokenString(session.tokens.accessToken)
      const idToken = this.extractTokenString(session.tokens.idToken)

      // Validate tokens were extracted
      if (!accessToken || !idToken) {
        logger.error('Failed to extract JWT tokens from session', {
          hasAccessToken: !!session.tokens.accessToken,
          hasIdToken: !!session.tokens.idToken,
          accessTokenType: typeof session.tokens.accessToken,
          idTokenType: typeof session.tokens.idToken,
        })
        return
      }

      // Set cookies
      document.cookie = `accessToken=${accessToken}${options}`
      document.cookie = `idToken=${idToken}${options}`
    } catch (error) {
      logger.error('Failed to set auth cookies', { error })
      // Clear cookies on error to prevent inconsistent state
      this.clear()
    }
  }

  /**
   * Clear authentication cookies
   * Sets expiration to past date to remove cookies
   */
  static clear(): void {
    if (typeof document === 'undefined') {
      return
    }

    const expired = `; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    document.cookie = `accessToken=${expired}`
    document.cookie = `idToken=${expired}`
  }

  /**
   * Check if authentication cookies are present and valid
   * @returns true if both access and ID tokens are present
   */
  static check(): boolean {
    if (typeof document === 'undefined') {
      return false
    }

    const cookies = document.cookie

    // Check for presence of both tokens
    const hasAccessToken = cookies.includes('accessToken=') && !cookies.includes('accessToken=;')
    const hasIdToken = cookies.includes('idToken=') && !cookies.includes('idToken=;')

    return hasAccessToken && hasIdToken
  }
}
