// src/app/(main)/components/chat/starterSuggestions.ts
// Starter suggestions for the empty-chat cold-start case
// Uses actual entity/company names when available, falls back to provider config names

import { PROVIDER_CONFIGS } from '@/lib/providers/provider-config'
import type { ProviderID } from '@/lib/providers/database'

export interface StarterSuggestion {
  label: string
  prompt: string
}

// Generic fallback starters (used when no integrations are connected or to fill remaining slots)
const GENERIC_STARTERS: StarterSuggestion[] = [
  {
    label: 'Financial health check',
    prompt: 'Give me a comprehensive financial health check with key metrics and visualizations',
  },
  {
    label: 'Revenue overview',
    prompt: 'Show me my revenue overview with trends and breakdown by category',
  },
  {
    label: 'P&L summary',
    prompt: 'Show me my Profit & Loss summary for last year with monthly trends',
  },
  {
    label: 'Expense breakdown',
    prompt: 'Show me my expense breakdown by category with a chart',
  },
]

/**
 * Build starter suggestions dynamically from connected providers.
 * Uses actual entity names (e.g. "Acme Corp") when available via providerNames map,
 * otherwise falls back to generic provider names from PROVIDER_CONFIGS.
 *
 * Priority: per-provider overview > cross-provider compare > generic fallbacks.
 * Returns at most 4 suggestions.
 */
export function getStarterSuggestions(
  connectedProviders: string[],
  providerNames?: Record<string, string>
): StarterSuggestion[] {
  const suggestions: StarterSuggestion[] = []

  // Helper: resolve the best display name for a provider
  const getName = (providerId: string): string => {
    // Prefer the actual entity/company name from the organization data
    if (providerNames?.[providerId]) return providerNames[providerId]
    // Fall back to the generic provider config name
    return PROVIDER_CONFIGS[providerId as ProviderID]?.name || providerId
  }

  // 1. Add a per-entity overview for each connected integration
  // QB multi-entity: providerNames['quickbooks'] may contain comma-separated company names
  for (const providerId of connectedProviders) {
    const config = PROVIDER_CONFIGS[providerId as ProviderID]
    if (!config) continue

    const rawName = providerNames?.[providerId]
    // Split comma-separated names into individual entities
    const entityNames = rawName
      ? rawName.split(',').map((n) => n.trim()).filter(Boolean)
      : [config.name]

    for (const name of entityNames) {
      if (suggestions.length >= 3) break
      suggestions.push({
        label: `${name} overview`,
        prompt: `Show me a financial overview from ${name} — revenue, expenses, top customers, and key metrics with visualizations`,
      })
    }

    // QB multi-entity comparison
    if (providerId === 'quickbooks' && entityNames.length > 1) {
      suggestions.push({
        label: `Compare QB companies`,
        prompt: `Compare financial performance across ${entityNames.join(' and ')} — revenue, expenses, and net income side by side`,
      })
    }
  }

  // 2. If multiple providers connected, add a cross-provider comparison
  if (connectedProviders.length > 1) {
    const names = connectedProviders.map(getName).filter(Boolean).join(' and ')
    suggestions.push({
      label: 'Compare integrations',
      prompt: `Compare financial data across ${names} side by side — show revenue, expenses, and net income from each`,
    })
  }

  // 3. Fill remaining slots with generic starters
  for (const generic of GENERIC_STARTERS) {
    if (suggestions.length >= 4) break
    suggestions.push(generic)
  }

  return suggestions.slice(0, 4)
}
