'use client'

import { ShopifyDateProvider } from './hooks/useShopifyDateRange'

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  return <ShopifyDateProvider>{children}</ShopifyDateProvider>
}
