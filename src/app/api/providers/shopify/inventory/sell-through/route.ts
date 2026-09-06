import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../../getShopifyClient'
import type { ShopifyQLColumn } from '@/lib/providers/shopify/types'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const sellThroughResult = await client.shopifyqlQuery(
      `FROM inventory SHOW starting_inventory_units, ending_inventory_units, inventory_units_sold, sell_through_rate WHERE inventory_is_tracked = true GROUP BY product_title ORDER BY sell_through_rate DESC, inventory_units_sold DESC LIMIT 20 SINCE -30d UNTIL today`
    )

    const { columns, rows } = sellThroughResult
    const colMap: Record<string, number> = {}
    columns.forEach((c: ShopifyQLColumn, i: number) => {
      colMap[c.name] = i
    })

    const items = rows.map((row) => ({
      name: (row[colMap['product_title']] as string) || 'Unknown',
      startingInventory: parseInt(String(row[colMap['starting_inventory_units']] || '0'), 10),
      endingInventory: parseInt(String(row[colMap['ending_inventory_units']] || '0'), 10),
      unitsSold: parseInt(String(row[colMap['inventory_units_sold']] || '0'), 10),
      sellThroughRate: parseFloat(String(row[colMap['sell_through_rate']] || '0')),
    }))

    return NextResponse.json({ data: { sellThroughRate: items } })
  } catch (error) {
    console.error('Shopify sell-through rate error:', error)
    return NextResponse.json({ error: 'Failed to fetch sell-through rate' }, { status: 500 })
  }
})
