'use client'

import IntegrationsHero from './components/IntegrationsHero'
import IntegrationCategories from './components/IntegrationCategories'
import IntegrationsCTA from './components/IntegrationsCTA'

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <IntegrationsHero />

      {/* Integration Categories */}
      <IntegrationCategories />

      {/* CTA Section */}
      <IntegrationsCTA />
    </div>
  )
}
