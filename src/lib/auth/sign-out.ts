// src/lib/auth/sign-out.ts
/**
 * Sign-out functionality
 * Handles complete user sign-out with cleanup
 */

import { signOut } from 'aws-amplify/auth'
import { AuthCookies } from './cookie-manager'
import { logger } from '../logger'

/**
 * Sign out the current user
 * Clears cookies, signs out from Cognito, and clears local storage
 * @throws Error if sign-out fails (but still performs cleanup)
 */
export async function signOutUser(): Promise<void> {
  try {
    // Clear auth cookies first
    AuthCookies.clear()

    // Sign out from Cognito (global sign-out)
    await signOut({ global: true })

    // Clear browser storage
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }
  } catch (error) {
    logger.error('Sign-out error', { error })

    // Ensure cleanup even on error
    AuthCookies.clear()

    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }

    throw error
  }
}
