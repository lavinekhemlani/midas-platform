import { NextRequest, NextResponse } from 'next/server'
import {
  getProviderCredentialsFromDB,
  getShopifyConnectionCredentials,
} from '@/lib/providers/database'
import { ShopifyClient } from '@/lib/providers/shopify/client'

/**
 * Resolve the correct Shopify credentials and build a client.
 * If ?shop=domain is in the URL, fetch credentials for that specific store.
 * Otherwise, fall back to the active store.
 */
export async function getShopifyClient(
  request: NextRequest,
  organizationId: string
): Promise<{ client: ShopifyClient; shopDomain: string } | { error: NextResponse }> {
  const url = new URL(request.url)
  const shopParam = url.searchParams.get('shop')

  let credentials
  if (shopParam) {
    credentials = await getShopifyConnectionCredentials(organizationId, shopParam)
  } else {
    credentials = await getProviderCredentialsFromDB(organizationId, 'shopify')
  }

  if (!credentials?.connected || !credentials?.access_token) {
    return {
      error: NextResponse.json({ error: 'Shopify not connected' }, { status: 404 }),
    }
  }

  const shopDomain = credentials.shop_domain
  if (!shopDomain) {
    return {
      error: NextResponse.json(
        { error: 'Shopify shop domain not found. Please reconnect your Shopify store.' },
        { status: 500 }
      ),
    }
  }

  return {
    client: new ShopifyClient({ shopDomain, accessToken: credentials.access_token }),
    shopDomain,
  }
}
