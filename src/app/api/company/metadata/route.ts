// src/app/api/company/metadata/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import type { Organization } from '@/lib/data'
import { TokenVerifier } from '@/lib/auth'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'
import { QuickBooksClient } from '@/quickbooks/client'
import { createOrgPK } from '@/lib/db/keys'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
})

const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

async function handleGetCompanyMetadata(
  request: NextRequest,
  { provider, apiClient, organizationId, providerId, plan, features, realmId }: any
) {
  try {
    // Get organization data from database for additional business details
    let organizationData: Organization | null = null
    if (ORGANIZATIONS_TABLE_NAME && organizationId) {
      try {
        const getOrgCommand = new GetCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: createOrgPK(organizationId), SK: 'PROFILE' },
        })
        const { Item } = await ddbDocClient.send(getOrgCommand)
        organizationData = Item as Organization
      } catch (error) {
        console.error('[/api/company/metadata] Failed to fetch organization from DB:', error)
      }
    }

    // Get provider-specific company info
    let companyInfo = null
    let connectionStatus = null
    const operationalMetrics: {
      activeCustomers?: number
      activeVendors?: number
      activeEmployees?: number
      bankAccounts?: number
    } = {}

    // Check for stored metadata first to avoid unnecessary API calls
    const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)

    // Since withActiveProvider already verified the provider is connected,
    // we can safely fetch the company info
    try {
      // Only fetch from provider API if we don't have stored metadata
      // This avoids unnecessary API calls for data that rarely changes
      if (storedMetadata.homeCurrency && storedMetadata.companyName) {
        // Use stored metadata - construct a minimal companyInfo object
        // We still need to fetch full company info for other fields (address, phone, etc.)
        // but we can use stored values for the critical fields
        if (provider.organizations?.getOrganizationInfo) {
          // Zoho path - has organizations module
          companyInfo = await (provider.organizations.getOrganizationInfo as any)(
            organizationId,
            apiClient
          )
        } else if (providerId === 'quickbooks') {
          // QuickBooks path - use QuickBooksClient directly
          const qbClient = new QuickBooksClient({ organizationId, realmId })
          companyInfo = await qbClient.getCompanyInfo()
        }
        // Override with stored values (user may have manually updated in DynamoDB)
        if (companyInfo && storedMetadata.companyName) {
          companyInfo.name = storedMetadata.companyName
        }
        if (companyInfo && storedMetadata.homeCurrency) {
          companyInfo.currency_code = storedMetadata.homeCurrency
        }
      } else {
        // Fetch organization info using the provider passed by withActiveProvider
        if (provider.organizations?.getOrganizationInfo) {
          // Zoho path - has organizations module
          companyInfo = await (provider.organizations.getOrganizationInfo as any)(
            organizationId,
            apiClient
          )
        } else if (providerId === 'quickbooks') {
          // QuickBooks path - use QuickBooksClient directly
          const qbClient = new QuickBooksClient({ organizationId, realmId })
          companyInfo = await qbClient.getCompanyInfo()
        }

        // Store metadata for future requests (migration for existing users)
        // QB API returns CompanyName (PascalCase), Zoho uses name (camelCase)
        updateProviderCompanyMetadata(organizationId, providerId, {
          homeCurrency: companyInfo?.currency_code || undefined,
          companyName: companyInfo?.CompanyName || companyInfo?.name || undefined,
        }).catch((err) => console.warn('[Company Metadata] Failed to store metadata:', err))
      }

      // Get connection status from the provider info (this could be enhanced with actual DB lookup if needed)
      // IMPORTANT: Use actual realmId from credentials (QuickBooks realm ID), not organizationId
      // This ensures chat history and localStorage are scoped correctly
      connectionStatus = {
        providerName: providerId,
        connected: true,
        lastSync: new Date().toISOString(), // This could be fetched from DB if needed
        expiresAt: null, // This could be fetched from DB if needed
        realmId: realmId || organizationId,
        health: 'healthy',
      }

      // Fetch operational metrics for QuickBooks provider
      // TODO: Restore operational metrics functionality - the organizations module was archived
      if (providerId === 'quickbooks') {
        console.log('[/api/company/metadata] Operational metrics temporarily unavailable')
      }
    } catch (error) {
      console.error('[/api/company/metadata] Failed to fetch company info from provider:', error)

      // If we fail to get company info, still return basic metadata
      // Use actual realmId from credentials for consistency
      connectionStatus = {
        providerName: providerId,
        connected: false,
        lastSync: null,
        expiresAt: null,
        realmId: realmId || organizationId,
        health: 'error',
      }
    }

    // Calculate data freshness
    const calculateDataFreshness = () => {
      if (!connectionStatus?.lastSync) return { status: 'unknown', ageInHours: null }

      const now = new Date()
      const lastSync = new Date(connectionStatus.lastSync)
      const diffHours = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60))

      if (diffHours < 1) return { status: 'fresh', ageInHours: 0 }
      if (diffHours <= 24) return { status: 'recent', ageInHours: diffHours }
      return { status: 'stale', ageInHours: diffHours }
    }

    // Calculate token expiration
    const calculateTokenExpiration = () => {
      if (!connectionStatus?.expiresAt) return { status: 'unknown', daysUntilExpiry: null }

      const now = new Date()
      const expiresAt = new Date(connectionStatus.expiresAt)
      const daysUntilExpiry = Math.floor(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysUntilExpiry < 0) return { status: 'expired', daysUntilExpiry: 0 }
      if (daysUntilExpiry <= 7) return { status: 'expiring_soon', daysUntilExpiry }
      return { status: 'valid', daysUntilExpiry }
    }

    const dataFreshness = calculateDataFreshness()
    const tokenStatus = calculateTokenExpiration()

    // Calculate business age if incorporation date is available
    const calculateBusinessAge = () => {
      const incDate = organizationData?.incorporation_date || companyInfo?.account_created_date
      if (!incDate) return null

      const incorporation = new Date(incDate)
      const now = new Date()
      const years = now.getFullYear() - incorporation.getFullYear()

      if (years < 1) {
        const months =
          (now.getFullYear() - incorporation.getFullYear()) * 12 +
          (now.getMonth() - incorporation.getMonth())
        return `${months} month${months !== 1 ? 's' : ''} old`
      }

      return `${years} year${years !== 1 ? 's' : ''} old`
    }

    // Log missing organization data fields
    const missingFields = []
    if (!organizationData?.registration_no) missingFields.push('registration_no')
    if (!organizationData?.jurisdiction) missingFields.push('jurisdiction')
    if (!organizationData?.revenue_model) missingFields.push('revenue_model')
    if (organizationData?.vat_registered === undefined) missingFields.push('vat_registered')

    if (missingFields.length > 0) {
      console.warn(
        `[/api/company/metadata] Missing organization data fields for ${organizationId}:`,
        missingFields
      )
    }

    // Prepare response with all metadata
    const metadata = {
      // Company Identity
      identity: {
        name: companyInfo?.CompanyName || companyInfo?.name || storedMetadata?.companyName || null,
        legalName:
          companyInfo?.LegalName ||
          organizationData?.legal_name ||
          companyInfo?.contact_name ||
          null,
        organizationId: companyInfo?.organization_id || organizationId,
        taxId: null, // Not available from QuickBooks API
        country: companyInfo?.address?.country || 'US',
        establishedDate:
          organizationData?.incorporation_date || companyInfo?.account_created_date || null,
        businessAge: calculateBusinessAge() || null,
        registrationNumber: organizationData?.registration_no || null,
        jurisdiction: organizationData?.jurisdiction || null,
        revenueModel: organizationData?.revenue_model || null,
        vatRegistered: organizationData?.vat_registered ?? null,
      },

      // Contact & Location
      contact: {
        email: companyInfo?.email || null,
        phone: companyInfo?.phone || null,
        fax: companyInfo?.fax || null,
        website: companyInfo?.website || null,
        address: companyInfo?.address || null,
        addressString: companyInfo?.org_address || null,
      },

      // Financial Configuration
      financial: {
        fiscalYearStartMonth: companyInfo?.fiscal_year_start_month || 1,
        fiscalYearEnd: getFiscalYearEnd(companyInfo?.fiscal_year_start_month || 1),
        currencyCode: companyInfo?.currency_code || 'USD',
        currencySymbol: companyInfo?.currency_symbol || '$',
        currencyFormat: companyInfo?.currency_format || '$#,##0.00',
        pricePrecision: companyInfo?.price_precision || 2,
        taxBasis: companyInfo?.tax_basis || 'accrual',
        timezone: inferTimezoneFromAddress(companyInfo?.address) || null,
        languageCode: companyInfo?.language_code || 'en',
      },

      // Integration Status
      integration: {
        provider: providerId || null,
        connected: connectionStatus?.connected || false,
        connectionHealth: connectionStatus?.health || 'disconnected',
        lastSync: connectionStatus?.lastSync || null,
        dataFreshness: dataFreshness.status,
        dataAgeHours: dataFreshness.ageInHours,
        tokenStatus: tokenStatus.status,
        tokenExpiryDays: tokenStatus.daysUntilExpiry,
        realmId: connectionStatus?.realmId || null,
      },

      // System & Subscription
      subscription: {
        tier: plan || detectSubscriptionTier(providerId),
        activeFeatures: features || getActiveFeatures(providerId),
        userCount: 1, // Default user count - would need to fetch from provider
        accountAge: calculateAccountAge(
          organizationData?.created_at || companyInfo?.account_created_date
        ),
      },

      // Operational Metrics - populated if available from provider
      operational: {
        activeCustomers: operationalMetrics?.activeCustomers ?? null,
        activeVendors: operationalMetrics?.activeVendors ?? null,
        activeEmployees: operationalMetrics?.activeEmployees ?? null,
        bankAccounts: operationalMetrics?.bankAccounts ?? null,
      },
    }

    return NextResponse.json({
      success: true,
      data: metadata,
    })
  } catch (error) {
    console.error('[/api/company/metadata] Error:', error)

    if (error instanceof Error && error.message.includes('Token')) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch company metadata' }, { status: 500 })
  }
}

// Helper function to calculate account age in days
function calculateAccountAge(createdAt: string | null): number | null {
  if (!createdAt) return null

  const created = new Date(createdAt)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - created.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

// Helper function to get fiscal year end date
function getFiscalYearEnd(startMonth: number): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  const endMonth = startMonth === 1 ? 12 : startMonth - 1
  return `${months[endMonth - 1]} ${endMonth === 12 ? 31 : 30}`
}

// Helper function to detect subscription tier
function detectSubscriptionTier(providerId: string): string {
  // Enhanced detection with more specific tiers
  if (providerId === 'quickbooks') return 'QuickBooks Plus' // More specific plan name
  if (providerId === 'zoho') return 'Zoho Books Professional'
  return 'Essential'
}

// Helper function to get active features
function getActiveFeatures(providerId: string): string[] {
  const features = []
  if (providerId === 'quickbooks') {
    // More comprehensive feature list for QuickBooks
    features.push(
      'invoices',
      'expenses',
      'reports',
      'banking',
      'bills',
      'projects',
      'classes',
      'locations',
      'budgets',
      'time_tracking',
      'inventory',
      'purchase_orders'
    )
  }
  if (providerId === 'zoho') {
    features.push(
      'invoicing',
      'expense_tracking',
      'financial_reports',
      'crm_integration',
      'inventory_management',
      'project_management',
      'time_tracking',
      'multi_currency'
    )
  }
  return features
}

// Helper function to infer timezone from address
function inferTimezoneFromAddress(address: any): string | null {
  if (!address) return null

  const state = address.state || address.region || address.countrySubDivisionCode
  const country = address.country

  // US timezone mapping by state
  const usTimezones: Record<string, string> = {
    // Eastern
    CT: 'America/New_York',
    DE: 'America/New_York',
    FL: 'America/New_York',
    GA: 'America/New_York',
    ME: 'America/New_York',
    MD: 'America/New_York',
    MA: 'America/New_York',
    NH: 'America/New_York',
    NJ: 'America/New_York',
    NY: 'America/New_York',
    NC: 'America/New_York',
    OH: 'America/New_York',
    PA: 'America/New_York',
    RI: 'America/New_York',
    SC: 'America/New_York',
    VT: 'America/New_York',
    VA: 'America/New_York',
    WV: 'America/New_York',
    DC: 'America/New_York',
    // Central
    AL: 'America/Chicago',
    AR: 'America/Chicago',
    IL: 'America/Chicago',
    IN: 'America/Chicago',
    IA: 'America/Chicago',
    KS: 'America/Chicago',
    KY: 'America/Chicago',
    LA: 'America/Chicago',
    MI: 'America/Chicago',
    MN: 'America/Chicago',
    MS: 'America/Chicago',
    MO: 'America/Chicago',
    NE: 'America/Chicago',
    ND: 'America/Chicago',
    OK: 'America/Chicago',
    SD: 'America/Chicago',
    TN: 'America/Chicago',
    TX: 'America/Chicago',
    WI: 'America/Chicago',
    // Mountain
    AZ: 'America/Phoenix',
    CO: 'America/Denver',
    ID: 'America/Denver',
    MT: 'America/Denver',
    NV: 'America/Denver',
    NM: 'America/Denver',
    UT: 'America/Denver',
    WY: 'America/Denver',
    // Pacific
    CA: 'America/Los_Angeles',
    OR: 'America/Los_Angeles',
    WA: 'America/Los_Angeles',
    // Alaska & Hawaii
    AK: 'America/Anchorage',
    HI: 'Pacific/Honolulu',
  }

  // Country-based timezone defaults
  const countryTimezones: Record<string, string> = {
    US: 'America/New_York', // Default US timezone
    CA: 'America/Toronto', // Canada
    GB: 'Europe/London', // UK
    FR: 'Europe/Paris', // France
    DE: 'Europe/Berlin', // Germany
    AU: 'Australia/Sydney', // Australia
    JP: 'Asia/Tokyo', // Japan
    IN: 'Asia/Kolkata', // India
    CN: 'Asia/Shanghai', // China
  }

  // Try US state-specific timezone first
  if (country === 'US' && state && usTimezones[state]) {
    return usTimezones[state]
  }

  // Fall back to country default
  if (country && countryTimezones[country]) {
    return countryTimezones[country]
  }

  return null
}

export const GET = withActiveProvider(handleGetCompanyMetadata)
