'use client'

import { Construction, ArrowLeft } from 'lucide-react'
import { DM_Sans } from 'next/font/google'
import Link from 'next/link'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

export default function AboutPage() {
  return (
    <main className={`min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 ${dmSans.variable}`}>
      <div className="max-w-3xl mx-auto">
        {/* Back to Home */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium theme-text-secondary hover:text-amber-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="mb-6">
            <div className="p-4 rounded-full bg-amber-500/10">
              <Construction className="w-12 h-12 text-amber-500" />
            </div>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold theme-text-primary mb-4"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            About Us
          </h1>
          <p className="text-lg theme-text-secondary max-w-md">
            This page is under construction. Check back soon to learn more about our story and
            mission.
          </p>
        </div>
      </div>
    </main>
  )
}
