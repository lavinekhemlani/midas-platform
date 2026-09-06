// src/lib/providers/zoho/core.ts
import { getValidZohoToken, storeZohoError, callZohoAPIWithOrg } from '@/lib/zoho-dynamo'

export interface ZohoPaginatedResponse<T> {
  data: T[]
  page_context?: {
    page: number
    per_page: number
    has_more_page: boolean
    sort_order?: string
  }
}

export interface ZohoQueryOptions {
  page?: number
  per_page?: number
  sort_order?: 'A' | 'D'
  date_start?: string
  date_end?: string
  status?: string
  [key: string]: string | number | undefined
}

const ZOHO_BASE_URL = 'https://www.zohoapis.com/books/v3'
const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY = 1000 // 1 second

/**
 * Enhanced fetch wrapper with auto-pagination, retry logic, and organization management
 */
export async function zohoFetch<T>(
  userOrgId: string,
  path: string,
  options: ZohoQueryOptions = {}
): Promise<T> {
  // Get organizations first to determine Zoho org ID
  const orgsResponse = await callZohoAPIWithOrg<{ organizations: any[] }>(
    userOrgId, 
    '/organizations'
  )
  
  const zohoOrgId = orgsResponse.organizations?.[0]?.organization_id
  if (!zohoOrgId) {
    throw new Error('No Zoho organization found')
  }

  // Build query string with organization_id
  const queryParams = new URLSearchParams({
    organization_id: zohoOrgId,
    ...Object.entries(options).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = String(value)
      }
      return acc
    }, {} as Record<string, string>)
  })

  // Ensure path starts with / and handle query params properly
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const queryString = queryParams.toString()
  const hasExistingParams = cleanPath.includes('?')
  const endpoint = queryString 
    ? (hasExistingParams ? `${cleanPath}&${queryString}` : `${cleanPath}?${queryString}`)
    : cleanPath
  
  // Use existing authenticated call method
  console.log(`zohoFetch calling endpoint: ${endpoint}`);
  return await callZohoAPIWithOrg<T>(userOrgId, endpoint)
}

/**
 * Auto-paginate through all results
 */
export async function zohoFetchAll<T>(
  userOrgId: string,
  path: string,
  options: ZohoQueryOptions = {}
): Promise<T[]> {
  const results: T[] = []
  let page = 1
  let hasMore = true
  
  const perPage = options.per_page || 200 // Zoho max is 200
  
  while (hasMore && page <= 50) { // Safety limit
    const response = await zohoFetch<ZohoPaginatedResponse<T>>(
      userOrgId,
      path,
      { ...options, page, per_page: perPage }
    )
    
    // Handle different response structures
    let data: T[] = []
    let pageContext: any = null
    
    if (Array.isArray(response)) {
      data = response
      hasMore = false
    } else if (response && typeof response === 'object') {
      // Try different property names that Zoho uses
      const responseObj = response as any
      data = responseObj.data || 
             responseObj.invoices || 
             responseObj.expenses || 
             responseObj.bills || 
             responseObj.contacts || 
             responseObj.items || 
             responseObj.payments || 
             responseObj.banktransactions || 
             []
      
      pageContext = responseObj.page_context
    }
    
    if (Array.isArray(data)) {
      results.push(...data)
    }
    
    // Check for more pages
    if (pageContext?.has_more_page === false || !pageContext || data.length < perPage) {
      hasMore = false
    } else {
      page++
    }
  }
  
  return results
}

/**
 * Memoized organization discovery
 */
const orgCache = new Map<string, string>()

export async function getZohoOrgId(userOrgId: string): Promise<string> {
  if (orgCache.has(userOrgId)) {
    return orgCache.get(userOrgId)!
  }
  
  const orgsResponse = await callZohoAPIWithOrg<{ organizations: any[] }>(
    userOrgId, 
    '/organizations'
  )
  
  const zohoOrgId = orgsResponse.organizations?.[0]?.organization_id
  if (!zohoOrgId) {
    throw new Error('No Zoho organization found')
  }
  
  orgCache.set(userOrgId, zohoOrgId)
  return zohoOrgId
}

/**
 * Exponential backoff retry wrapper
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = DEFAULT_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on auth errors or client errors
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('403') ||
        error.message.includes('400')
      )) {
        throw error
      }
      
      if (attempt === maxAttempts) {
        break
      }
      
      // Exponential backoff: 1s, 2s, 4s...
      const delay = DEFAULT_RETRY_DELAY * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}