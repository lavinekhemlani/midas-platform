// src/app/(main)/layout.tsx
// Server component wrapper that exports dynamic config
// The actual layout logic is in MainLayoutClient.tsx

import MainLayout from './MainLayoutClient'

// Force dynamic rendering for all pages under (main)
// This is required because Sidebar and TopBar use useSearchParams
export const dynamic = 'force-dynamic'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>
}
