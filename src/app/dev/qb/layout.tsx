/**
 * Layout for QuickBooks Dashboard
 *
 * Wraps the dashboard with QueryClientProvider for TanStack Query support
 */

import { QBQueryProvider } from './providers'

export default function QBLayout({ children }: { children: React.ReactNode }) {
  return <QBQueryProvider>{children}</QBQueryProvider>
}
