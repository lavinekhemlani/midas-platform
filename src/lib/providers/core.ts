// src/lib/providers/core.ts
import { ProviderApiClient } from './apiClient';
import { ProviderID } from './database';

export interface PaginatedResponse<T> {
  data: T[];
  page_context?: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    sort_order?: string;
  };
}

export interface QueryOptions {
  page?: number;
  per_page?: number;
  sort_order?: 'A' | 'D' | 'asc' | 'desc';
  date_start?: string;
  date_end?: string;
  status?: string;
  [key: string]: string | number | undefined;
}

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Enhanced fetch wrapper with auto-pagination, retry logic, and organization management
 */
export async function providerFetch<T>(
  apiClient: ProviderApiClient,
  providerId: ProviderID,
  organizationId: string,
  path: string,
  options: QueryOptions = {}
): Promise<T> {
  try {
    // For Zoho, we need to get the organization ID first
    if (providerId === 'zoho') {
      // Get organizations first to determine Zoho org ID
      const orgsResponse = await apiClient.callApi<{ organizations: any[] }>('/organizations');
      const zohoOrgId = orgsResponse.organizations?.[0]?.organization_id;
      
      if (!zohoOrgId) {
        console.error('No Zoho organization found in response:', orgsResponse);
        throw new Error('No Zoho organization found');
      }

      // Build query string with organization_id for Zoho
      const queryParams = new URLSearchParams({
        organization_id: zohoOrgId,
        ...Object.entries(options).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      });

      // Ensure path starts with / and handle query params properly
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const queryString = queryParams.toString();
      const hasExistingParams = cleanPath.includes('?');
      const endpoint = queryString 
        ? (hasExistingParams ? `${cleanPath}&${queryString}` : `${cleanPath}?${queryString}`)
        : cleanPath;
      
      // Only log the endpoint being called, not the full response
      console.log(`providerFetch calling ${providerId} endpoint: ${endpoint}`);
      const response = await apiClient.callApi<T>(endpoint);
      
      // Log summary instead of full response
      const responseInfo = {
        endpoint,
        status: 'success',
        dataKeys: response ? Object.keys(response).filter(k => k !== 'code' && k !== 'message') : [],
        itemCount: Array.isArray((response as any)?.data) ? (response as any).data.length :
                   Array.isArray((response as any)?.contacts) ? (response as any).contacts.length :
                   Array.isArray((response as any)?.invoices) ? (response as any).invoices.length :
                   Array.isArray((response as any)?.expenses) ? (response as any).expenses.length :
                   Array.isArray((response as any)?.bankaccounts) ? (response as any).bankaccounts.length :
                   undefined
      };
      
      // For reports endpoints, log more detailed info
      if (endpoint.includes('/reports/')) {
        console.log(`Report response structure for ${endpoint}:`, {
          hasData: !!response,
          topLevelKeys: response ? Object.keys(response) : [],
          sampleData: response ? JSON.stringify(response, null, 2).substring(0, 300) : 'No data'
        });
      }
      
      console.log(`providerFetch response summary:`, responseInfo);
      
      return response;
    }

    // For other providers, build query string normally
    const queryParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.set(key, String(value));
      }
    });

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const queryString = queryParams.toString();
    const hasExistingParams = cleanPath.includes('?');
    const endpoint = queryString 
      ? (hasExistingParams ? `${cleanPath}&${queryString}` : `${cleanPath}?${queryString}`)
      : cleanPath;
    
    console.log(`providerFetch calling ${providerId} endpoint: ${endpoint}`);
    return await apiClient.callApi<T>(endpoint);
  } catch (error) {
    console.error(`providerFetch error for ${providerId} ${path}:`, error);
    throw error;
  }
}

/**
 * Auto-paginate through all results
 */
export async function providerFetchAll<T>(
  apiClient: ProviderApiClient,
  providerId: ProviderID,
  organizationId: string,
  path: string,
  options: QueryOptions = {}
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let hasMore = true;
  
  const perPage = options.per_page || (providerId === 'zoho' ? 50 : 50); // Optimized default: 50 for better performance
  
  while (hasMore && page <= 50) { // Safety limit
    const response = await providerFetch<PaginatedResponse<T>>(
      apiClient,
      providerId,
      organizationId,
      path,
      { ...options, page, per_page: perPage }
    );
    
    // Handle different response structures based on provider
    let data: T[] = [];
    let pageContext: any = null;
    
    if (Array.isArray(response)) {
      data = response;
      hasMore = false;
    } else if (response && typeof response === 'object') {
      const responseObj = response as any;
      
      if (providerId === 'zoho') {
        // Zoho response structure
        data = responseObj.data || 
               responseObj.invoices || 
               responseObj.expenses || 
               responseObj.bills || 
               responseObj.contacts || 
               responseObj.items || 
               responseObj.payments || 
               responseObj.banktransactions || 
               [];
        pageContext = responseObj.page_context;
      } else {
        // Generic response structure for other providers
        data = responseObj.data || responseObj.items || [];
        pageContext = responseObj.pagination || responseObj.page_context;
      }
    }
    
    if (Array.isArray(data)) {
      results.push(...data);
    }
    
    // Check for more pages based on provider
    if (providerId === 'zoho') {
      if (pageContext?.has_more_page === false || !pageContext || data.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      // Generic pagination logic for other providers
      if (!pageContext || data.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }
  
  return results;
}

/**
 * Memoized organization discovery for providers that need it
 */
const orgCache = new Map<string, string>();

export async function getProviderOrgId(
  apiClient: ProviderApiClient,
  providerId: ProviderID,
  userOrgId: string
): Promise<string> {
  const cacheKey = `${providerId}:${userOrgId}`;
  
  if (orgCache.has(cacheKey)) {
    return orgCache.get(cacheKey)!;
  }
  
  if (providerId === 'zoho') {
    const orgsResponse = await apiClient.callApi<{ organizations: any[] }>('/organizations');
    const zohoOrgId = orgsResponse.organizations?.[0]?.organization_id;
    
    if (!zohoOrgId) {
      throw new Error('No Zoho organization found');
    }
    
    orgCache.set(cacheKey, zohoOrgId);
    return zohoOrgId;
  }
  
  // For other providers, return the user org ID as-is
  return userOrgId;
}

/**
 * Exponential backoff retry wrapper
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = DEFAULT_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on auth errors or client errors
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('403') ||
        error.message.includes('400')
      )) {
        throw error;
      }
      
      if (attempt === maxAttempts) {
        break;
      }
      
      // Exponential backoff: 1s, 2s, 4s...
      const delay = DEFAULT_RETRY_DELAY * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Provider-specific data mapping utilities
 */
export function mapProviderResponse<T>(
  providerId: ProviderID,
  response: any,
  dataKey?: string
): T[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  switch (providerId) {
    case 'zoho':
      return response[dataKey || 'data'] || 
             response.invoices || 
             response.expenses || 
             response.contacts || 
             response.items || 
             [];
    
    case 'quickbooks':
      return response.QueryResponse?.[dataKey || 'data'] || [];
    
    case 'xero':
      return response[dataKey || 'data'] || [];
    
    default:
      return response.data || response.items || [];
  }
}
