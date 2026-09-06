'use client'

import { BCOAuthDevLayout } from './_shared/BCOAuthDevLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <BCOAuthDevLayout>{children}</BCOAuthDevLayout>
}
