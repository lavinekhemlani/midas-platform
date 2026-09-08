export type InvestorType =
  | 'vc'
  | 'corporate-vc'
  | 'venture-debt'
  | 'strategic-acquirer'
  | 'distribution'
  | 'growth-pe'
  | 'family-office'

export type Stage =
  | 'seed'
  | 'series-a'
  | 'series-b'
  | 'series-c'
  | 'growth'
  | 'pre-ipo'
  | 'crossover'

export type TherapeuticArea =
  | 'oncology'
  | 'rare-disease'
  | 'neurology'
  | 'cardiology'
  | 'immunology'
  | 'infectious-disease'
  | 'metabolic'
  | 'gene-therapy'
  | 'cell-therapy'
  | 'diagnostics'
  | 'medtech'
  | 'platform'
  | 'dermatology'
  | 'ophthalmology'
  | 'gi'
  | 'respiratory'

export type Geography = 'US' | 'EU' | 'APAC' | 'Middle East' | 'Global' | 'LatAm'

export type WhatTheyOffer =
  | 'equity'
  | 'debt'
  | 'royalty-financing'
  | 'distribution'
  | 'bd-deal'
  | 'strategic-partnership'
  | 'acquisition'
  | 'licensing'

export interface Investor {
  id: string
  name: string
  type: InvestorType
  headquarters: string
  geography: Geography[]
  stages: Stage[]
  therapeuticAreas: TherapeuticArea[]
  checkSizeMin: number // USD millions
  checkSizeMax: number // USD millions
  whatTheyOffer: WhatTheyOffer[]
  description: string
  website: string
  recentDeals?: string[]
  keyFocus?: string
  contactName?: string
  contactEmail?: string
}

// ── Investor records removed before this repository was made public ──
// The original array held ~3,195 named individuals with email addresses.
// That is personal data, not product code. Types and label maps are intact.
export const INVESTORS: Investor[] = []

export const INVESTOR_TYPE_LABELS: Record<InvestorType, string> = {
  vc: 'Venture Capital',
  'corporate-vc': 'Corporate VC / Pharma',
  'venture-debt': 'Venture Debt & Royalty',
  'strategic-acquirer': 'Strategic Acquirer',
  distribution: 'Distribution & Licensing',
  'growth-pe': 'Growth PE',
  'family-office': 'Family Office',
}

export const INVESTOR_TYPE_COLORS: Record<InvestorType, string> = {
  vc: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'corporate-vc': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'venture-debt': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'strategic-acquirer': 'bg-red-500/15 text-red-400 border-red-500/30',
  distribution: 'bg-green-500/15 text-green-400 border-green-500/30',
  'growth-pe': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'family-office': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
}

export const STAGE_LABELS: Record<Stage, string> = {
  seed: 'Seed',
  'series-a': 'Series A',
  'series-b': 'Series B',
  'series-c': 'Series C',
  growth: 'Growth',
  'pre-ipo': 'Pre-IPO',
  crossover: 'Crossover',
}

export const AREA_LABELS: Record<TherapeuticArea, string> = {
  oncology: 'Oncology',
  'rare-disease': 'Rare Disease',
  neurology: 'Neurology',
  cardiology: 'Cardiology',
  immunology: 'Immunology',
  'infectious-disease': 'Infectious Disease',
  metabolic: 'Metabolic',
  'gene-therapy': 'Gene Therapy',
  'cell-therapy': 'Cell Therapy',
  diagnostics: 'Diagnostics',
  medtech: 'MedTech / Devices',
  platform: 'Platform / AI Bio',
  dermatology: 'Dermatology',
  ophthalmology: 'Ophthalmology',
  gi: 'GI / Liver',
  respiratory: 'Respiratory',
}

export const OFFER_LABELS: Record<WhatTheyOffer, string> = {
  equity: 'Equity',
  debt: 'Debt',
  'royalty-financing': 'Royalty Financing',
  distribution: 'Distribution',
  'bd-deal': 'BD Deal',
  'strategic-partnership': 'Strategic Partnership',
  acquisition: 'Acquisition',
  licensing: 'Licensing',
}
