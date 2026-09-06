// src/lib/apiClient.ts
import { fetchAuthSession } from 'aws-amplify/auth'
import { AuthCookies } from './auth'

// Request deduplication cache - prevents identical concurrent requests
const inFlightRequests = new Map<string, Promise<Response>>()

// Helper function to create a cache key for requests
function getCacheKey(input: RequestInfo | URL, init?: RequestInit): string {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method || 'GET'
  const body = init?.body ? String(init.body) : ''
  return `${method}:${url}:${body}`
}

// Helper function to dispatch loading events
function dispatchLoadingEvent(type: 'start' | 'stop') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`loading-${type}`))
  }
}

/**
 * A wrapper around fetch that uses cookies for authentication.
 * Tokens are automatically included via cookies set by Amplify.
 * Automatically dispatches loading events for global loading state.
 * Includes request deduplication to prevent identical concurrent requests.
 */
export async function apiClient(
  input: RequestInfo | URL,
  init?: RequestInit | undefined
): Promise<Response> {
  const config = {
    ...init,
    credentials: 'include' as RequestCredentials,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  }

  // Check if an identical request is already in flight
  const cacheKey = getCacheKey(input, config)
  const existingRequest = inFlightRequests.get(cacheKey)

  if (existingRequest) {
    // Wait for the cached request and return a cloned response
    // This allows multiple callers to independently read the response body
    console.debug('[apiClient] Deduplicating request:', cacheKey)
    const response = await existingRequest
    return response.clone()
  }

  // Dispatch loading start event
  dispatchLoadingEvent('start')

  // Create the request promise
  const requestPromise = (async () => {
    const MAX_RETRIES = 2
    let lastError: unknown

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Ensure we have fresh auth cookies before making the request
        try {
          await AuthCookies.set()
        } catch (authError) {
          console.warn('Failed to refresh auth cookies:', authError)
        }

        const response = await fetch(input, config)

        // Retry on server errors (5xx) — these are often transient (e.g. token refresh timeout)
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          const delay = 1000 * (attempt + 1)
          console.warn(
            `[apiClient] Server error ${response.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        if (response.status === 401) {
          // Clear invalid cookies and try to refresh
          AuthCookies.clear()

          try {
            const session = await fetchAuthSession({ forceRefresh: true })
            if (session.tokens?.accessToken) {
              await AuthCookies.set()
              // Retry the request with fresh tokens
              const retryResponse = await fetch(input, config)
              if (retryResponse.status !== 401) {
                return retryResponse
              }
            }
          } catch (refreshError) {
            console.error('Failed to refresh authentication:', refreshError)
          }

          // Don't auto-redirect on 401 - let the caller handle it
          // Provider-specific APIs (QuickBooks, Dynamics, etc.) return 401 when
          // that provider isn't connected, which is NOT an auth failure.
          // The SessionProvider handles actual auth state, and components
          // should handle provider-specific errors gracefully (show "connect provider" UI)
          console.warn(
            '[apiClient] Request returned 401 after token refresh attempt:',
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
          )

          // Return the 401 response so callers can handle it appropriately
          return response
        }

        // Return the response - callers will clone as needed via deduplication logic
        return response
      } catch (error) {
        lastError = error
        if (attempt < MAX_RETRIES) {
          const delay = 1000 * (attempt + 1) // 1s, 2s
          console.warn(
            `[apiClient] Request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`,
            error
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    // All retries exhausted
    const isNetworkError =
      lastError instanceof TypeError ||
      (lastError instanceof Error && lastError.message === 'Failed to fetch')
    const message = isNetworkError
      ? 'Network error — please check your connection and try again'
      : 'Request failed — please try again'
    console.error(`[apiClient] All ${MAX_RETRIES + 1} attempts failed:`, lastError)
    throw new Error(message)
  })().finally(() => {
    // Always dispatch loading stop event and clean up cache
    dispatchLoadingEvent('stop')
    inFlightRequests.delete(cacheKey)
  })

  // Store the promise in the cache
  inFlightRequests.set(cacheKey, requestPromise)

  // Return a cloned response for this caller as well
  // This ensures all callers (including the first) get independent readable streams
  const response = await requestPromise
  return response.clone()
}
