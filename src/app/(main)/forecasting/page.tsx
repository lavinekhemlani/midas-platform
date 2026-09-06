'use client'

import { TrendingUp } from 'lucide-react'
import { ForecastingView } from './components/ForecastingView'

export default function ForecastingPage() {
  return (
    <div className="@container space-y-4">
      {/* Subheading (title comes from TopBar pageTitles) */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xl theme-text-secondary flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Project future cash position based on historical patterns
        </span>
      </div>

      <ForecastingView />
    </div>
  )
}
