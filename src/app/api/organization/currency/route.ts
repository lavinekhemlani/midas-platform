// src/app/api/organization/currency/route.ts
import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'
import { QuickBooksClient } from '@/quickbooks/client'
import { logger } from '@/lib/logger'

// Lightweight endpoint to fetch organization currency and name
// Prioritizes stored values from DynamoDB to avoid repeated QuickBooks API calls
export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId, realmId }) => {
    try {
      // First, check if we have the metadata stored in DynamoDB
      const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)

      if (storedMetadata.homeCurrency) {
        logger.debug('[Currency] Using stored metadata', {
          organizationId,
          currency: storedMetadata.homeCurrency,
          companyName: storedMetadata.companyName,
        })
        return NextResponse.json({
          currency: storedMetadata.homeCurrency,
          organizationName: storedMetadata.companyName || 'Organization',
          source: 'stored',
        })
      }

      // Metadata not stored - fetch from provider API (migration path for existing users)
      logger.debug('[Currency] No stored metadata, fetching from provider API', {
        organizationId,
        providerId,
      })

      // Fetch organization info based on provider type
      let orgInfo = null
      if (provider.organizations?.getOrganizationInfo) {
        // Zoho path - has organizations module
        orgInfo = await (provider.organizations.getOrganizationInfo as any)(
          organizationId,
          apiClient
        )
      } else if (providerId === 'quickbooks') {
        // QuickBooks path - use QuickBooksClient directly
        const qbClient = new QuickBooksClient({ organizationId, realmId })
        orgInfo = await qbClient.getCompanyInfo()
      }

      // Extract currency with fallback logic
      // QuickBooks: HomeCurrency.value or Country-based inference
      // Zoho: currency_code
      const getCurrency = (info: any): string => {
        if (info?.HomeCurrency?.value) return info.HomeCurrency.value
        if (info?.currency_code) return info.currency_code
        // Country-based fallback for QuickBooks
        if (info?.Country === 'US') return 'USD'
        if (info?.Country === 'CA') return 'CAD'
        if (info?.Country === 'GB') return 'GBP'
        if (info?.Country === 'AU') return 'AUD'
        if (info?.Country === 'HK') return 'HKD'
        return 'USD'
      }

      const currency = getCurrency(orgInfo)
      // QuickBooks uses CompanyName, Zoho uses name
      const companyName = orgInfo?.CompanyName || orgInfo?.name || 'Organization'

      // Store the fetched metadata for future requests (migration for existing users)
      updateProviderCompanyMetadata(organizationId, providerId, {
        homeCurrency: currency,
        companyName: companyName !== 'Organization' ? companyName : undefined,
      })
        .then((success) => {
          if (success) {
            logger.debug('[Currency] Stored metadata', {
              organizationId,
              currency,
              companyName,
            })
          }
        })
        .catch((err) => {
          logger.warn('[Currency] Failed to store metadata', {
            organizationId,
            error: err instanceof Error ? err.message : String(err),
          })
        })

      return NextResponse.json({
        currency,
        organizationName: companyName,
        source: 'api',
      })
    } catch (error) {
      logger.error('[Currency] Fetch error', {
        organizationId,
        providerId,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Failed to fetch currency' }, { status: 500 })
    }
  }
)
