// src/lib/auth-init.ts
// Authentication initialization - warm up JWKS cache on startup
import { TokenVerifier } from './auth'
import { logger } from './logger'

// Use global to persist across module reloads in development
const globalForAuth = global as typeof globalThis & {
  __authInitialized?: boolean
  __authRefreshInterval?: NodeJS.Timeout | null
}

/**
 * Initialize authentication system
 * - Warms up JWKS cache
 * - Starts periodic cache refresh
 * - Should be called once on application startup
 */
export async function initializeAuth(): Promise<void> {
  if (globalForAuth.__authInitialized) {
    logger.debug('Auth already initialized, skipping')
    return
  }

  try {
    logger.debug('Initializing authentication system')

    // Warm up the JWKS cache
    await TokenVerifier.warmCache()

    // Start cache refresh (every 5 minutes by default)
    globalForAuth.__authRefreshInterval = TokenVerifier.startCacheRefresh(5 * 60 * 1000)

    globalForAuth.__authInitialized = true
    logger.info('Authentication system initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize authentication', { error })
    // Don't throw - app should still work even if initialization fails
  }
}

// Auto-initialization removed - now handled by instrumentation.ts
