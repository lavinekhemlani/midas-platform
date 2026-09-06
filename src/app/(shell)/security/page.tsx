'use client'

import SecurityHero from './components/SecurityHero'
import DataJourney from './components/DataJourney'
import SecurityPromises from './components/SecurityPromises'
import PoweredBySecurity from './components/PoweredBySecurity'
import YourDataControl from './components/YourDataControl'
import FaqSection from './components/FaqSection'
export default function SecurityPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <SecurityHero />

      {/* Section 1: Data Journey */}
      <DataJourney />

      {/* Section 2: Our Promises */}
      <SecurityPromises />

      {/* Section 3: Powered By Security */}
      <PoweredBySecurity />

      {/* Section 4: FAQ */}
      <FaqSection />

      {/* Section 5: Your Control + Compliance */}
      <YourDataControl />
    </div>
  )
}
