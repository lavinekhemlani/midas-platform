'use client'

import IndustriesHero from './components/IndustriesHero'
import IndustryShowcase from './components/IndustryShowcase'
import IndustriesCTA from './components/IndustriesCTA'

export default function IndustriesPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <IndustriesHero />

      {/* Industry Showcase */}
      <IndustryShowcase />

      {/* CTA Section */}
      <IndustriesCTA />
    </div>
  )
}
