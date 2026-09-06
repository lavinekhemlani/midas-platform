import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security - Midas',
  description:
    'Learn about security practices and data protection at Midas financial intelligence platform. Enterprise-grade security with SOC 2, GDPR, and CCPA compliance.',
}

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
