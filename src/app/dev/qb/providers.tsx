/**
 * QueryClient Provider for QuickBooks Dashboard
 *
 * This sets up TanStack Query for the QuickBooks development dashboard.
 * It provides centralized state management and automatic cache invalidation.
 */

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QBQueryProvider({ children }: { children: React.ReactNode }) {
  // Create a new QueryClient instance per component tree
  // This ensures server-side rendering works correctly
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 5 minutes
            staleTime: 5 * 60 * 1000,

            // Cache data for 10 minutes
            gcTime: 10 * 60 * 1000,

            // Don't refetch on window focus by default
            // (CDC polling handles updates instead)
            refetchOnWindowFocus: false,

            // Retry failed requests
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            // Retry failed mutations
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position={'bottom' as any} />
      )}
    </QueryClientProvider>
  )
}
