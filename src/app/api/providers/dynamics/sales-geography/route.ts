import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/sales-geography
 *
 * Returns sales data aggregated by country from posted sales invoices.
 * Includes smart country inference from customer names when invoice geo fields are empty.
 */

// ── Customer name → country inference patterns ──
const CUSTOMER_COUNTRY_PATTERNS: Array<{
  pattern: RegExp
  country: string
  region?: string
}> = [
  { pattern: /amazon\s*(us|usa|u\.s)/i, country: 'US', region: 'Amazon US' },
  { pattern: /amazon.*united\s*states/i, country: 'US', region: 'Amazon US' },
  { pattern: /amazon\s*(eu|europe)/i, country: 'EU', region: 'Amazon EU' },
  { pattern: /amazon\s*(uk|united\s*kingdom|gb|britain)/i, country: 'GB', region: 'Amazon UK' },
  { pattern: /amazon\s*(ca|canada)/i, country: 'CA', region: 'Amazon CA' },
  { pattern: /amazon\s*(au|australia)/i, country: 'AU', region: 'Amazon AU' },
  { pattern: /amazon\s*(de|germany|deutschland)/i, country: 'DE', region: 'Amazon DE' },
  { pattern: /amazon\s*(fr|france)/i, country: 'FR', region: 'Amazon FR' },
  { pattern: /amazon\s*(it|ital)/i, country: 'IT', region: 'Amazon IT' },
  { pattern: /amazon\s*(es|spain|españa)/i, country: 'ES', region: 'Amazon ES' },
  { pattern: /amazon\s*(jp|japan)/i, country: 'JP', region: 'Amazon JP' },
  { pattern: /amazon\s*(mx|mexico)/i, country: 'MX', region: 'Amazon MX' },
  { pattern: /\(us\)\s*(limited|ltd|inc|corp|llc)/i, country: 'US' },
  { pattern: /\(uk\)\s*(limited|ltd|inc|corp|llc)/i, country: 'GB' },
  { pattern: /teknoloji\s*ürün/i, country: 'TR' },
]

function inferCountryFromName(
  name: string
): { country: string; inferred: boolean; region?: string } | null {
  for (const rule of CUSTOMER_COUNTRY_PATTERNS) {
    if (rule.pattern.test(name)) {
      return { country: rule.country, inferred: true, region: rule.region }
    }
  }
  return null
}

function mostFrequent(freq: Record<string, number>): string {
  let best = '',
    bestCount = 0
  for (const [val, count] of Object.entries(freq)) {
    if (count > bestCount) {
      best = val
      bestCount = count
    }
  }
  return best
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    let resolvedConnectionId = connectionId
    if (!resolvedConnectionId) {
      resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
    }
    if (!resolvedConnectionId) {
      return NextResponse.json({ error: 'No active BC connection' }, { status: 404 })
    }

    const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
    if (!credentials?.connected || !credentials?.access_token) {
      return NextResponse.json({ error: 'Connection not active' }, { status: 404 })
    }

    const client = new BusinessCentralClient({
      organizationId,
      connectionId: resolvedConnectionId,
    })
    const t0 = Date.now()

    // Fetch sales invoices with geographic fields
    const filters: string[] = []
    if (startDate) filters.push(`invoiceDate ge ${startDate}`)
    if (endDate) filters.push(`invoiceDate le ${endDate}`)

    const invoices = await client.queryAll('salesInvoices', {
      $select:
        'number,invoiceDate,customerNumber,customerName,sellToCity,sellToCountry,sellToState,shipToCity,shipToCountry,shipToState,totalAmountExcludingTax,totalAmountIncludingTax,currencyCode',
      ...(filters.length > 0 && { $filter: filters.join(' and ') }),
    })

    // Pass 1: Build per-customer geo frequency maps
    const custGeoFrequency: Record<
      string,
      { countries: Record<string, number>; cities: Record<string, number> }
    > = {}

    for (const inv of invoices) {
      const custNum = inv.customerNumber || 'Unknown'
      if (!custGeoFrequency[custNum]) {
        custGeoFrequency[custNum] = { countries: {}, cities: {} }
      }
      const rawCountry = inv.sellToCountry || inv.shipToCountry || ''
      const rawCity = inv.sellToCity || inv.shipToCity || ''
      if (rawCountry)
        custGeoFrequency[custNum].countries[rawCountry] =
          (custGeoFrequency[custNum].countries[rawCountry] || 0) + 1
      if (rawCity)
        custGeoFrequency[custNum].cities[rawCity] =
          (custGeoFrequency[custNum].cities[rawCity] || 0) + 1
    }

    // Pass 2: Aggregate with smart country resolution
    const byCountry: Record<
      string,
      {
        country: string
        totalAmount: number
        invoiceCount: number
        inferredCount: number
        customers: Set<string>
        cities: Set<string>
      }
    > = {}
    const byCity: Record<
      string,
      {
        city: string
        country: string
        state: string
        totalAmount: number
        invoiceCount: number
        customers: Set<string>
      }
    > = {}

    for (const inv of invoices) {
      const amount = inv.totalAmountIncludingTax ?? 0
      const custNum = inv.customerNumber || 'Unknown'
      const custName = inv.customerName || custNum

      let country = inv.sellToCountry || inv.shipToCountry || ''
      let city = inv.sellToCity || inv.shipToCity || ''
      const state = inv.sellToState || inv.shipToState || ''
      let isInferred = false

      if (!country) {
        const inferred = inferCountryFromName(custName)
        if (inferred) {
          country = inferred.country
          isInferred = true
        } else {
          const freq = custGeoFrequency[custNum]
          if (freq) {
            const freqCountry = mostFrequent(freq.countries)
            if (freqCountry) {
              country = freqCountry
              isInferred = true
            }
          }
        }
      }
      if (!city) {
        const freq = custGeoFrequency[custNum]
        if (freq) {
          const freqCity = mostFrequent(freq.cities)
          if (freqCity) city = freqCity
        }
      }

      if (country === 'UK') country = 'GB'
      const finalCountry = country || '(unknown)'
      const finalCity = city || '(unknown)'
      const cityKey = `${finalCity}|${finalCountry}`

      if (!byCountry[finalCountry]) {
        byCountry[finalCountry] = {
          country: finalCountry,
          totalAmount: 0,
          invoiceCount: 0,
          inferredCount: 0,
          customers: new Set(),
          cities: new Set(),
        }
      }
      byCountry[finalCountry].totalAmount += amount
      byCountry[finalCountry].invoiceCount++
      if (isInferred) byCountry[finalCountry].inferredCount++
      byCountry[finalCountry].customers.add(custName)
      if (city) byCountry[finalCountry].cities.add(city)

      if (!byCity[cityKey]) {
        byCity[cityKey] = {
          city: finalCity,
          country: finalCountry,
          state,
          totalAmount: 0,
          invoiceCount: 0,
          customers: new Set(),
        }
      }
      byCity[cityKey].totalAmount += amount
      byCity[cityKey].invoiceCount++
      byCity[cityKey].customers.add(custName)
    }

    const countrySales = Object.values(byCountry)
      .map((c) => ({
        country: c.country,
        totalAmount: Math.round(c.totalAmount * 100) / 100,
        invoiceCount: c.invoiceCount,
        customerCount: c.customers.size,
        inferredCount: c.inferredCount,
        cities: [...c.cities].filter((x) => x !== '(unknown)'),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

    const citySales = Object.values(byCity)
      .map((c) => ({
        city: c.city,
        country: c.country,
        state: c.state,
        totalAmount: Math.round(c.totalAmount * 100) / 100,
        invoiceCount: c.invoiceCount,
        customerCount: c.customers.size,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

    return NextResponse.json({
      data: {
        byCountry: countrySales,
        byCity: citySales,
        totalInvoices: invoices.length,
        totalAmount:
          Math.round(
            invoices.reduce((s: number, inv: any) => s + (inv.totalAmountIncludingTax ?? 0), 0) *
              100
          ) / 100,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Sales geography failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
