'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  INVESTORS,
  INVESTOR_TYPE_LABELS,
  INVESTOR_TYPE_COLORS,
  STAGE_LABELS,
  AREA_LABELS,
  OFFER_LABELS,
  type Investor,
  type InvestorType,
  type Stage,
  type TherapeuticArea,
  type Geography,
  type WhatTheyOffer,
} from '@/data/biotech-investors'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search, X, ChevronDown, ChevronUp, ExternalLink, Building2,
  Filter, Sparkles, ArrowRight, Globe, DollarSign, Linkedin,
  Mail, Target, Send, Newspaper, CheckCircle2, Upload, FileText,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface MatchInput {
  founderName: string
  companyName: string
  email: string
  stage: Stage | ''
  therapeuticArea: TherapeuticArea | ''
  raiseSizeMn: number
  geography: Geography | ''
  capitalType: WhatTheyOffer | ''
  deckFileName?: string
}

type Tab = 'search' | 'match'
type MatchStep = 'upload' | 'about' | 'profile' | 'results'

const STEP_ORDER: MatchStep[] = ['upload', 'about', 'profile', 'results']
const STEPS_META: { key: MatchStep; label: string }[] = [
  { key: 'upload', label: 'Your Deck' },
  { key: 'about', label: 'About You' },
  { key: 'profile', label: 'Company' },
]

// ─── Scoring ───────────────────────────────────────────────────────────────

function scoreInvestor(inv: Investor, input: Partial<MatchInput>): number {
  let score = 0
  const stageOrder: Stage[] = ['seed', 'series-a', 'series-b', 'series-c', 'growth', 'crossover', 'pre-ipo']
  if (input.stage && inv.stages.includes(input.stage)) score += 40
  else if (input.stage) {
    const targetIdx = stageOrder.indexOf(input.stage)
    if (inv.stages.some((s) => Math.abs(stageOrder.indexOf(s) - targetIdx) === 1)) score += 20
  }
  if (input.therapeuticArea && inv.therapeuticAreas.includes(input.therapeuticArea)) score += 30
  if (input.geography) {
    if (inv.geography.includes(input.geography) || inv.geography.includes('Global')) score += 10
  }
  if (input.capitalType && inv.whatTheyOffer.includes(input.capitalType)) score += 20
  if (input.raiseSizeMn && input.raiseSizeMn > 0) {
    if (input.raiseSizeMn >= inv.checkSizeMin && input.raiseSizeMn <= inv.checkSizeMax) score += 10
    else if (input.raiseSizeMn < inv.checkSizeMin * 0.5) score -= 10
  }
  return Math.max(0, Math.min(100, score))
}

function getMatchReasons(inv: Investor, input: Partial<MatchInput>): string[] {
  const reasons: string[] = []
  if (input.stage && inv.stages.includes(input.stage)) reasons.push(`${STAGE_LABELS[input.stage]} stage`)
  if (input.therapeuticArea && inv.therapeuticAreas.includes(input.therapeuticArea)) {
    reasons.push(AREA_LABELS[input.therapeuticArea])
  }
  if (input.geography && (inv.geography.includes(input.geography) || inv.geography.includes('Global'))) {
    reasons.push(input.geography + '-based')
  }
  if (input.capitalType && inv.whatTheyOffer.includes(input.capitalType)) {
    reasons.push(OFFER_LABELS[input.capitalType])
  }
  if (input.raiseSizeMn && input.raiseSizeMn > 0 && input.raiseSizeMn >= inv.checkSizeMin && input.raiseSizeMn <= inv.checkSizeMax) {
    reasons.push(`$${inv.checkSizeMin}M–$${inv.checkSizeMax}M check range`)
  }
  return reasons
}

// ─── Natural language parser ───────────────────────────────────────────────

function parseNaturalQuery(text: string): Partial<MatchInput> {
  let stage: Stage | '' = ''
  if (/pre.?seed/i.test(text)) stage = 'seed'
  else if (/\bseed\b/i.test(text)) stage = 'seed'
  else if (/series.?a\b/i.test(text)) stage = 'series-a'
  else if (/series.?b\b/i.test(text)) stage = 'series-b'
  else if (/series.?c\b/i.test(text)) stage = 'series-c'
  else if (/\bgrowth\b|late.?stage/i.test(text)) stage = 'growth'
  else if (/crossover/i.test(text)) stage = 'crossover'

  let therapeuticArea: TherapeuticArea | '' = ''
  const areaMap: [RegExp, TherapeuticArea][] = [
    [/oncol|cancer|tumor/i, 'oncology'],
    [/neuro|brain|\bcns\b|alzheimer|parkinson/i, 'neurology'],
    [/cardio|heart|cardiovasc/i, 'cardiology'],
    [/rare.?disease|orphan/i, 'rare-disease'],
    [/\bdiag/i, 'diagnostics'],
    [/gene.?therap|crispr|gene.?edit/i, 'gene-therapy'],
    [/immuno|autoimmun|inflamm/i, 'immunology'],
    [/infect|antimicro|antiviral|antibiotic/i, 'infectious-disease'],
    [/medtech|medical.?device/i, 'medtech'],
    [/mental.?health|psychiatr/i, 'mental-health'],
    [/digital.?health|digital.?therap/i, 'digital-health'],
    [/metabol|diabetes|obesity/i, 'metabolic'],
    [/ophthal|eye.?disease|retina/i, 'ophthalmology'],
    [/women|femtech|reproduct/i, 'womens-health'],
    [/ai.?drug|ml.?drug|drug.?discov/i, 'ai-drug-discovery'],
    [/platform.?tech|tech.?platform/i, 'platform-tech'],
  ]
  for (const [re, area] of areaMap) {
    if (re.test(text)) { therapeuticArea = area; break }
  }

  let raiseSizeMn = 0
  const m = text.match(/\$?\s*(\d+(?:\.\d+)?)\s*[Mm](?:illion)?/i)
  if (m) raiseSizeMn = parseFloat(m[1])

  let geography: Geography | '' = ''
  if (/\bUS\b|\bUSA\b|united states|america/i.test(text)) geography = 'US'
  else if (/\bEU\b|europe/i.test(text)) geography = 'EU'
  else if (/apac|asia|china|japan|singapore/i.test(text)) geography = 'APAC'
  else if (/middle east|gulf|\buae\b|saudi/i.test(text)) geography = 'Middle East'
  else if (/latam|latin america|brazil/i.test(text)) geography = 'LatAm'

  let capitalType: WhatTheyOffer | '' = 'equity'
  if (/\bdebt\b|non.?dilut|royalt/i.test(text)) capitalType = 'venture-debt'
  else if (/distribut|licens|commercializ/i.test(text)) capitalType = 'distribution'
  else if (/strategic|pharma.?partner|\bbd\b/i.test(text)) capitalType = 'strategic-partnership'

  return { stage, therapeuticArea, raiseSizeMn, geography, capitalType }
}

// ─── URL helpers ───────────────────────────────────────────────────────────

function linkedinPersonUrl(contactName: string | undefined, firmName: string): string {
  // Google search for "[name] [firm] site:linkedin.com" — top result is their actual profile
  const query = contactName
    ? `${contactName} ${firmName} site:linkedin.com/in`
    : `${firmName} site:linkedin.com/in`
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function directEmailUrl(inv: Investor, input: Partial<MatchInput>): string {
  if (!inv.contactEmail) return ''
  const firstName = inv.contactName?.split(' ')[0] ?? 'there'
  const subject = `Introduction — ${input.companyName || 'Biotech Founder'}`
  const body = `Hi ${firstName},

My name is ${input.founderName || '[Your Name]'} and I'm the founder of ${input.companyName || '[Company]'}. We're a ${input.stage ? input.stage.replace(/-/g, ' ') : 'biotech'} company focused on ${input.therapeuticArea ? input.therapeuticArea.replace(/-/g, ' ') : 'life sciences'}${input.raiseSizeMn ? ` and we're currently raising $${input.raiseSizeMn}M` : ''}.

I came across ${inv.name} through ZenithOS and believe there's a strong fit. Would love to connect if you have 20 minutes.

Best,
${input.founderName || '[Your Name]'}
${input.email || ''}`
  return `mailto:${inv.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function zenithIntroMailto(inv: Investor, input: Partial<MatchInput>): string {
  const contact = inv.contactName
    ? inv.contactName.split(' ').slice(0, 2).join(' ')
    : 'the right person at ' + inv.name
  const subject = `Intro Request: ${input.companyName || 'My Startup'} → ${inv.name}`
  const body = `Hi Lavine,

I'm ${input.founderName || '[Name]'} from ${input.companyName || '[Company]'} — ${input.stage ? STAGE_LABELS[input.stage] : ''} ${input.therapeuticArea ? AREA_LABELS[input.therapeuticArea] : 'life sciences'} company${input.raiseSizeMn ? ` raising $${input.raiseSizeMn}M` : ''}.

I found ${inv.name} on ZenithOS and would love a warm introduction to ${contact}. ${(input as MatchInput).deckFileName ? `My deck is attached: ${(input as MatchInput).deckFileName}` : 'Happy to share my deck if helpful.'}

My email: ${input.email || '[your email]'}

Thanks,
${input.founderName || '[Name]'}`
  return `mailto:lavine@zenith-grp.co?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ─── InvestorCard ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: InvestorType }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${INVESTOR_TYPE_COLORS[type]}`}>
      {INVESTOR_TYPE_LABELS[type]}
    </span>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
        active
          ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
          : 'border-black/10 bg-black/3 text-[#555] hover:border-black/25'
      }`}
    >
      {label}
    </button>
  )
}

function InvestorCard({
  investor,
  score,
  showScore,
  matchInput,
  expandedIntros = false,
}: {
  investor: Investor
  score?: number
  showScore?: boolean
  matchInput?: Partial<MatchInput>
  expandedIntros?: boolean
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [introsOpen, setIntrosOpen] = useState(expandedIntros)
  const matchReasons = showScore && matchInput ? getMatchReasons(investor, matchInput) : []

  return (
    <div className="rounded-xl border border-black/8 bg-white p-4 flex flex-col gap-3 hover:border-black/15 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-[#1a1a1a] text-sm">{investor.name}</h3>
            {showScore && score !== undefined && score > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                {score}% fit
              </span>
            )}
          </div>
          <p className="text-xs text-[#888] mt-0.5">{investor.headquarters}</p>
          {investor.contactName && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                {investor.contactName}
              </p>
              {investor.contactEmail && (
                <button
                  onClick={() => { window.location.href = `mailto:${investor.contactEmail}` }}
                  className="text-[11px] text-[#0077B5] hover:underline font-medium ml-2.5 text-left"
                >
                  {investor.contactEmail}
                </button>
              )}
            </div>
          )}
        </div>
        <a
          href={investor.website}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[#aaa] hover:text-[#555] transition-colors mt-0.5"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Why this matches */}
      {matchReasons.length > 0 && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">Why this matches:</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {matchReasons.map((reason) => (
              <span key={reason} className="inline-flex items-center gap-1 text-[11px] text-emerald-800">
                <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                {reason}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Type + offer badges */}
      <div className="flex flex-wrap gap-1.5">
        <TypeBadge type={investor.type} />
        {investor.whatTheyOffer.map((o) => (
          <span key={o} className="inline-flex items-center rounded-full border border-black/8 bg-black/3 px-2 py-0.5 text-[10px] text-[#666]">
            {OFFER_LABELS[o]}
          </span>
        ))}
      </div>

      {/* Check size + geo */}
      <div className="flex items-center gap-4 text-xs text-[#888]">
        <span className="flex items-center gap-1">
          <DollarSign size={11} />${investor.checkSizeMin}M – ${investor.checkSizeMax}M
        </span>
        <span className="flex items-center gap-1">
          <Globe size={11} />{investor.geography.join(', ')}
        </span>
      </div>

      {/* Stages */}
      <div className="flex flex-wrap gap-1">
        {investor.stages.map((s) => (
          <span key={s} className="rounded-md border border-black/8 bg-black/3 px-1.5 py-0.5 text-[10px] text-[#777]">
            {STAGE_LABELS[s]}
          </span>
        ))}
      </div>

      {/* Description */}
      <p className="text-xs text-[#666] leading-relaxed line-clamp-2">{investor.description}</p>

      {/* Details toggle */}
      <button
        onClick={() => setDetailsOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-[#999] hover:text-[#555] transition-colors self-start"
      >
        {detailsOpen ? <><ChevronUp size={11} /> Less detail</> : <><ChevronDown size={11} /> More detail</>}
      </button>

      {detailsOpen && (
        <div className="border-t border-black/6 pt-3 flex flex-col gap-2">
          {investor.keyFocus && (
            <div>
              <p className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">Key Focus</p>
              <p className="text-xs text-[#444]">{investor.keyFocus}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">Therapeutic Areas</p>
            <div className="flex flex-wrap gap-1">
              {investor.therapeuticAreas.map((a) => (
                <span key={a} className="rounded-md border border-black/8 bg-black/3 px-1.5 py-0.5 text-[10px] text-[#777]">
                  {AREA_LABELS[a]}
                </span>
              ))}
            </div>
          </div>
          {investor.recentDeals && investor.recentDeals.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">Notable Deals</p>
              <p className="text-xs text-[#444]">{investor.recentDeals.join(' · ')}</p>
            </div>
          )}
        </div>
      )}

      {/* Intro pathways */}
      <div className="border-t border-black/6 pt-3">
        {!expandedIntros && !introsOpen ? (
          <button
            onClick={() => setIntrosOpen(true)}
            className="w-full rounded-lg border border-[#1a1a1a] bg-[#1a1a1a] text-white text-xs font-medium py-2 hover:bg-[#333] transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowRight size={12} /> Get Introduced
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-[#999] uppercase tracking-wide mb-0.5">Choose your pathway</p>

            {/* 1. Direct email — opens mail client with pre-filled email */}
            {investor.contactEmail && investor.contactName && (
              <button
                onClick={() => { window.location.href = directEmailUrl(investor, matchInput ?? {}) }}
                className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-2 hover:bg-emerald-100 transition-colors w-full text-left"
              >
                <Mail size={13} />
                Email {investor.contactName.split(' ').slice(0, 2).join(' ')} directly
                <span className="ml-auto text-[10px] opacity-60 font-normal truncate max-w-[130px]">
                  {investor.contactEmail}
                </span>
              </button>
            )}

            {/* 2. LinkedIn — goes to the person, not mutual search */}
            <a
              href={linkedinPersonUrl(investor.contactName, investor.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[#0077B5]/30 bg-[#0077B5]/5 text-[#0077B5] text-xs font-medium px-3 py-2 hover:bg-[#0077B5]/10 transition-colors"
            >
              <Linkedin size={13} />
              {investor.contactName
                ? `Find ${investor.contactName.split(' ')[0]} on LinkedIn`
                : 'Find on LinkedIn'}
            </a>

            {/* 3. Zenith intro — email to Lavine: "Hi Lavine, I'm X, intro to Y, here's my deck" */}
            <button
              onClick={() => { window.location.href = zenithIntroMailto(investor, matchInput ?? {}) }}
              className="flex items-center gap-2 rounded-lg border border-black/10 bg-black/3 text-[#555] text-xs font-medium px-3 py-2 hover:bg-black/6 transition-colors w-full text-left"
            >
              <Mail size={13} />
              Request warm intro via Zenith
              <a
                href="/capital/intros"
                onClick={(e) => e.stopPropagation()}
                className="ml-auto text-[10px] text-[#aaa] hover:text-[#555] underline font-normal"
              >
                how it works
              </a>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CategorySection ───────────────────────────────────────────────────────

function CategorySection({
  title,
  description,
  investors,
  matchInput,
  showScore,
}: {
  title: string
  description: string
  investors: { investor: Investor; score: number }[]
  matchInput: Partial<MatchInput>
  showScore?: boolean
}) {
  if (investors.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-[#1a1a1a] text-sm">{title}</h3>
        <p className="text-xs text-[#888] mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {investors.map(({ investor, score }) => (
          <InvestorCard
            key={investor.id}
            investor={investor}
            score={score}
            showScore={showScore}
            matchInput={matchInput}
            expandedIntros
          />
        ))}
      </div>
    </div>
  )
}

// ─── Constants ─────────────────────────────────────────────────────────────

const ALL_TYPES = Object.keys(INVESTOR_TYPE_LABELS) as InvestorType[]
const ALL_STAGES = Object.keys(STAGE_LABELS) as Stage[]
const ALL_AREAS = Object.keys(AREA_LABELS) as TherapeuticArea[]
const ALL_GEOS: Geography[] = ['US', 'EU', 'APAC', 'Middle East', 'LatAm', 'Global']
const ALL_OFFERS = Object.keys(OFFER_LABELS) as WhatTheyOffer[]

// ─── VC Firm ticker data ───────────────────────────────────────────────────

const VC_FIRMS = [
  { name: 'Third Rock Ventures',   slug: 'third-rock-ventures' },
  { name: 'Atlas Venture',         slug: 'atlas-venture' },
  { name: 'RA Capital',            slug: 'ra-capital' },
  { name: 'Novo Holdings',         slug: 'novo-holdings' },
  { name: 'Foresite Capital',      slug: 'foresite-capital' },
  { name: 'EQT Life Sciences',     slug: 'eqt-life-sciences' },
  { name: 'OrbiMed',               slug: 'orbimed' },
  { name: 'Deerfield',             slug: 'deerfield' },
  { name: 'Versant Ventures',      slug: 'versant-ventures' },
  { name: 'The Column Group',      slug: 'the-column-group' },
  { name: 'MPM BioVentures',       slug: 'mpm-bioventures' },
  { name: 'Polaris Partners',      slug: 'polaris-partners' },
  { name: 'NEA',                   slug: 'nea' },
  { name: 'GV',                    slug: 'gv' },
  { name: 'Sofinnova Partners',    slug: 'sofinnova-partners' },
  { name: 'F-Prime Capital',       slug: 'f-prime-capital' },
  { name: 'HBM Healthcare',        slug: 'hbm-healthcare' },
  { name: 'Perceptive Advisors',   slug: 'perceptive-advisors' },
  { name: 'RTW Investments',       slug: 'rtw-investments' },
  { name: 'Cormorant Asset Mgmt',  slug: 'cormorant' },
  { name: 'Flagship Pioneering',   slug: 'flagship-pioneering' },
  { name: 'ARCH Venture Partners', slug: 'arch-venture' },
  { name: 'Omega Funds',           slug: 'omega-funds' },
]

// ─── Main page ─────────────────────────────────────────────────────────────

export default function CapitalPage() {
  const [tab, setTab] = useState<Tab>('match')
  const [allInvestors, setAllInvestors] = useState<Investor[]>(INVESTORS)
  const [extendedLoading, setExtendedLoading] = useState(true)
  const [deckFile, setDeckFile] = useState<File | null>(null)
  const toolRef = useRef<HTMLDivElement>(null)

  // Natural language search (Origami-style instant results)
  const [naturalQuery, setNaturalQuery] = useState('')
  const [naturalResults, setNaturalResults] = useState<{ investor: Investor; score: number }[]>([])
  const [naturalParsed, setNaturalParsed] = useState<Partial<MatchInput>>({})
  const [naturalSearched, setNaturalSearched] = useState(false)

  useEffect(() => {
    fetch('/investors-extended.json')
      .then((r) => r.json())
      .then((extended: Investor[]) => {
        const curatedIds = new Set(INVESTORS.map((i) => i.id))
        const curatedNames = new Set(INVESTORS.map((i) => i.name.toLowerCase().slice(0, 20)))
        const fresh = extended.filter(
          (i) => !curatedIds.has(i.id) && !curatedNames.has(i.name.toLowerCase().slice(0, 20))
        )
        setAllInvestors([...INVESTORS, ...fresh])
      })
      .catch(() => {})
      .finally(() => setExtendedLoading(false))
  }, [])

  // Search state
  const [query, setQuery] = useState('')
  const [activeTypes, setActiveTypes] = useState<InvestorType[]>([])
  const [activeStages, setActiveStages] = useState<Stage[]>([])
  const [activeAreas, setActiveAreas] = useState<TherapeuticArea[]>([])
  const [activeGeos, setActiveGeos] = useState<Geography[]>([])
  const [activeOffers, setActiveOffers] = useState<WhatTheyOffer[]>([])
  const [showFilters, setShowFilters] = useState(true)

  // Match state
  const [matchStep, setMatchStep] = useState<MatchStep>('upload')
  const [matchInput, setMatchInput] = useState<MatchInput>({
    founderName: '', companyName: '', email: '', stage: '',
    therapeuticArea: '', raiseSizeMn: 0, geography: '', capitalType: '',
  })

  // VC + newsletter state
  const [vcForm, setVcForm] = useState({ name: '', firm: '', email: '', thesis: '' })
  const [vcSubmitted, setVcSubmitted] = useState(false)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterDone, setNewsletterDone] = useState(false)

  // Filtered investors (search tab)
  const filtered = useMemo(
    () =>
      allInvestors.filter((inv) => {
        if (query && !inv.name.toLowerCase().includes(query.toLowerCase()) &&
          !inv.description.toLowerCase().includes(query.toLowerCase()) &&
          !inv.headquarters.toLowerCase().includes(query.toLowerCase())) return false
        if (activeTypes.length && !activeTypes.includes(inv.type)) return false
        if (activeStages.length && !inv.stages.some((s) => activeStages.includes(s))) return false
        if (activeAreas.length && !inv.therapeuticAreas.some((a) => activeAreas.includes(a))) return false
        if (activeGeos.length && !inv.geography.some((g) => activeGeos.includes(g)) && !inv.geography.includes('Global')) return false
        if (activeOffers.length && !inv.whatTheyOffer.some((o) => activeOffers.includes(o))) return false
        return true
      }),
    [allInvestors, query, activeTypes, activeStages, activeAreas, activeGeos, activeOffers]
  )

  // Match results
  const matchResults = useMemo(() => {
    if (matchStep !== 'results') return { primary: [], nonDilutive: [], strategic: [], distribution: [] }
    const scored = allInvestors
      .map((inv) => ({ investor: inv, score: scoreInvestor(inv, matchInput) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
    return {
      primary: scored.filter((r) =>
        ['vc', 'growth-pe', 'family-office'].includes(r.investor.type) &&
        (!matchInput.capitalType || r.investor.whatTheyOffer.includes(matchInput.capitalType))
      ).slice(0, 8),
      nonDilutive: scored.filter((r) => r.investor.type === 'venture-debt').slice(0, 4),
      strategic: scored.filter((r) => ['corporate-vc', 'strategic-acquirer'].includes(r.investor.type)).slice(0, 6),
      distribution: scored.filter((r) => r.investor.type === 'distribution').slice(0, 4),
    }
  }, [matchStep, matchInput, allInvestors])

  function toggleFilter<T>(arr: T[], val: T, setArr: (v: T[]) => void) {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])
  }

  const hasFilters = activeTypes.length || activeStages.length || activeAreas.length ||
    activeGeos.length || activeOffers.length || query
  const aboutComplete = matchInput.founderName.trim() && matchInput.companyName.trim() && matchInput.email.trim()
  const profileComplete = matchInput.stage || matchInput.therapeuticArea || matchInput.capitalType
  const totalMatches = matchResults.primary.length + matchResults.nonDilutive.length +
    matchResults.strategic.length + matchResults.distribution.length

  const allFirms = [...VC_FIRMS, ...VC_FIRMS, ...VC_FIRMS]

  function scrollToTool() {
    setTimeout(() => toolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function handleNaturalSearch() {
    if (!naturalQuery.trim()) return
    const parsed = parseNaturalQuery(naturalQuery)
    setNaturalParsed(parsed)
    const scored = allInvestors
      .map((inv) => ({ investor: inv, score: scoreInvestor(inv, parsed) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
    setNaturalResults(scored)
    setNaturalSearched(true)
  }

  function setExample(q: string) {
    setNaturalQuery(q)
    setNaturalSearched(false)
    setNaturalResults([])
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">

      {/* ─── HERO ───────────────────────────────────────────────────── */}
      <section className="px-5 pt-24 pb-20 max-w-[700px] mx-auto text-center">

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 mb-8">
          <Sparkles size={11} />
          {extendedLoading ? `${INVESTORS.length}+` : allInvestors.length.toLocaleString()} investors · Real emails · No gatekeeping
        </div>

        {/* Headline — Origami scale */}
        <h1
          className="font-bold text-[#1a1a1a] leading-[0.93] mb-6"
          style={{ fontSize: 'clamp(60px, 10vw, 96px)', letterSpacing: '-0.04em' }}
        >
          Find your<br />biotech<br />investors.
        </h1>

        <p className="text-[#888] text-lg mb-9 max-w-sm mx-auto leading-relaxed">
          Describe your raise, get ranked matches, and email them directly. No account required.
        </p>

        {/* Two-mode toggle — Origami "Enter a customer profile / Use my domain" */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-black/15 bg-white shadow-sm px-4 py-2 text-sm font-semibold text-[#1a1a1a]">
            <FileText size={13} /> Describe your raise
          </button>
          <button
            onClick={() => { setTab('search'); scrollToTool() }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/8 px-4 py-2 text-sm font-medium text-[#888] hover:text-[#555] hover:border-black/15 transition-colors"
          >
            <Search size={13} /> Browse all investors
          </button>
        </div>

        {/* Big input — Origami style */}
        <div className="rounded-2xl border border-black/12 bg-white shadow-sm text-left">
          <textarea
            value={naturalQuery}
            onChange={(e) => {
              setNaturalQuery(e.target.value)
              if (naturalSearched) { setNaturalSearched(false); setNaturalResults([]) }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && naturalQuery.trim()) {
                e.preventDefault()
                handleNaturalSearch()
              }
            }}
            placeholder="Find Series A oncology investors writing $10–25M checks in the US..."
            className="w-full px-5 pt-5 pb-3 text-[15px] text-[#1a1a1a] placeholder:text-[#c0bcb8] resize-none outline-none bg-transparent leading-relaxed"
            rows={3}
          />
          <div className="px-4 pb-4 flex items-center justify-between">
            <span className="text-[11px] text-[#d0ccc7]">Press ↵ to search</span>
            <button
              onClick={handleNaturalSearch}
              disabled={!naturalQuery.trim()}
              className="h-9 px-4 rounded-xl bg-[#1a1a1a] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-20 hover:bg-[#333] transition-colors"
            >
              Find investors <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Subtle social proof below input */}
        <p className="text-[11px] text-[#ccc] mt-3">
          No account required · {extendedLoading ? `${INVESTORS.length.toLocaleString()}+` : allInvestors.length.toLocaleString()} life sciences investors mapped
        </p>
      </section>

      {/* ─── INSTANT RESULTS ─────────────────────────────────────────── */}
      {naturalSearched && (
        <section className="px-4 pb-12 max-w-5xl mx-auto">
          {naturalResults.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-[#888]">
                  Top {naturalResults.length} matches for{' '}
                  <span className="text-[#1a1a1a] font-medium">"{naturalQuery}"</span>
                </p>
                <button
                  onClick={() => { setNaturalSearched(false); setNaturalResults([]); setNaturalQuery('') }}
                  className="text-xs text-[#bbb] hover:text-[#555] underline"
                >
                  clear
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {naturalResults.map(({ investor, score }) => (
                  <InvestorCard
                    key={investor.id}
                    investor={investor}
                    score={score}
                    showScore
                    matchInput={naturalParsed}
                    expandedIntros
                  />
                ))}
              </div>
              <div className="text-center mt-10">
                <p className="text-sm text-[#888] mb-3">
                  Want personalized introductions with your name and deck?
                </p>
                <button
                  onClick={() => { setTab('match'); setMatchStep('upload'); scrollToTool() }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1a1a1a] text-white px-6 py-3 text-sm font-semibold hover:bg-[#333] transition-colors"
                >
                  Get Full Match Report <ArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-[#bbb]">
              <Building2 size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-2">No matches for that description.</p>
              <p className="text-xs">Try: "Series A oncology $15M US" or "seed diagnostics"</p>
            </div>
          )}
        </section>
      )}

      {/* ─── VC FIRM TICKER ──────────────────────────────────────────── */}
      <style>{`
        @keyframes vc-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .vc-ticker { animation: vc-ticker 50s linear infinite; }
        .vc-ticker:hover { animation-play-state: paused; }
      `}</style>
      {!naturalSearched && (
        <div className="py-7 border-y border-black/8 bg-white overflow-hidden">
          <p className="text-[10px] font-bold text-[#ccc] uppercase tracking-widest text-center mb-5">Trusted by founders backed by</p>
          <div className="overflow-hidden relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-white to-transparent" />
            <div className="vc-ticker flex items-center gap-12 w-max">
              {allFirms.map((firm, i) => (
                <div key={i} className="shrink-0 group flex items-center h-8">
                  <img
                    src={`/vc-logos/${firm.slug}.png`}
                    alt=""
                    title={firm.name}
                    className="h-7 w-auto max-w-[110px] object-contain grayscale opacity-40 group-hover:opacity-80 group-hover:grayscale-0 transition-all duration-200"
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement
                      if (!el.dataset.triedSvg) {
                        el.dataset.triedSvg = '1'
                        el.src = `/vc-logos/${firm.slug}.svg`
                      } else {
                        el.style.display = 'none'
                        const fb = el.nextElementSibling as HTMLElement | null
                        if (fb) fb.style.display = 'flex'
                      }
                    }}
                  />
                  <span className="items-center gap-1.5 whitespace-nowrap" style={{ display: 'none' }}>
                    <span className="w-1 h-1 rounded-full bg-[#ddd] shrink-0" />
                    <span className="text-[11px] font-medium text-[#bbb]">{firm.name}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── HOW IT WORKS ────────────────────────────────────────────── */}
      {!naturalSearched && (
        <section className="border-t border-b border-black/6 bg-white py-10">
          <div className="max-w-4xl mx-auto px-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[#bbb] text-center mb-7">How ZenithOS works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                {
                  Icon: FileText,
                  step: '01',
                  title: 'Describe your raise or use the form',
                  desc: 'Type your stage, area, and size above for instant results. Or use the Match Me form for a full report.',
                },
                {
                  Icon: Target,
                  step: '02',
                  title: 'Get ranked matches with explanations',
                  desc: 'We score 3,262+ investors against your criteria. Best fits appear first with a clear match explanation.',
                },
                {
                  Icon: Mail,
                  step: '03',
                  title: 'Email directly — no gatekeeping',
                  desc: 'Real contact names and email addresses shown on every card. Direct email, LinkedIn profile, or warm intro via Zenith.',
                },
              ].map(({ Icon, step, title, desc }) => (
                <div key={step} className="flex flex-col gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#f5f5f5] flex items-center justify-center">
                    <Icon size={18} className="text-[#555]" />
                  </div>
                  <p className="text-[10px] font-bold text-[#bbb] tracking-widest">{step}</p>
                  <h3 className="font-semibold text-[#1a1a1a] text-sm leading-snug">{title}</h3>
                  <p className="text-xs text-[#888] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── STICKY TABS ─────────────────────────────────────────────── */}
      <div id="tool" ref={toolRef} className="sticky top-14 z-40 border-y border-black/8 bg-[#faf8f5]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex">
          {(
            [
              { key: 'match' as Tab, label: 'Match Me — Full Report', icon: Target },
              { key: 'search' as Tab, label: `Browse All (${allInvestors.length.toLocaleString()}+)`, icon: Search },
            ] as { key: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-[#1a1a1a] text-[#1a1a1a]'
                  : 'border-transparent text-[#999] hover:text-[#555]'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── MATCH TAB ───────────────────────────────────────────────── */}
      {tab === 'match' && (
        <div className="max-w-2xl mx-auto px-4 py-10">
          {matchStep !== 'results' && (
            <div className="flex items-center gap-2 mb-8">
              {STEPS_META.map(({ key, label }, i) => {
                const stepIdx = STEP_ORDER.indexOf(key)
                const currentIdx = STEP_ORDER.indexOf(matchStep)
                const isComplete = currentIdx > stepIdx
                const isCurrent = matchStep === key
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isComplete ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-[#1a1a1a] text-white' : 'bg-black/8 text-[#999]'
                    }`}>
                      {isComplete ? <CheckCircle2 size={12} /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${isCurrent ? 'text-[#1a1a1a]' : 'text-[#bbb]'}`}>{label}</span>
                    {i < STEPS_META.length - 1 && <div className="w-6 h-px bg-black/10 mx-2" />}
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 0: Upload Deck */}
          {matchStep === 'upload' && (
            <div className="rounded-2xl border border-black/8 bg-white p-7 flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-bold text-[#1a1a1a] mb-1">Upload your pitch deck</h2>
                <p className="text-sm text-[#888]">
                  Optional — Lavine at Zenith reviews every deck personally. Or skip and enter your details manually.
                </p>
              </div>
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                deckFile ? 'border-emerald-300 bg-emerald-50' : 'border-black/10 bg-[#faf8f5] hover:border-black/20'
              }`}>
                {deckFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                    <p className="font-semibold text-sm text-[#1a1a1a]">{deckFile.name}</p>
                    <p className="text-xs text-[#888]">{(deckFile.size / 1024 / 1024).toFixed(1)} MB · Deck received</p>
                    <button onClick={() => setDeckFile(null)} className="text-xs text-[#bbb] hover:text-[#555] underline">Remove</button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-3">
                    <Upload size={28} className="text-[#bbb]" />
                    <div>
                      <p className="text-sm font-medium text-[#1a1a1a]">Drop your deck here</p>
                      <p className="text-xs text-[#999] mt-0.5">PDF, PPT, or PPTX · Max 50MB</p>
                    </div>
                    <input type="file" accept=".pdf,.ppt,.pptx" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setDeckFile(file)
                      if (file) setMatchInput((p) => ({ ...p, deckFileName: file.name }))
                    }} />
                    <span className="text-xs text-[#1a1a1a] border border-black/12 rounded-lg px-4 py-2 hover:bg-black/3 transition-colors bg-white">
                      Browse files
                    </span>
                  </label>
                )}
              </div>
              <Button onClick={() => setMatchStep('about')} className="gap-2">
                {deckFile ? 'Continue — Tell Us About You' : 'Skip — Enter Details Manually'}
                <ArrowRight size={14} />
              </Button>
            </div>
          )}

          {/* Step 1: About You */}
          {matchStep === 'about' && (
            <div className="rounded-2xl border border-black/8 bg-white p-7 flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-bold text-[#1a1a1a] mb-1">Tell us about yourself</h2>
                <p className="text-sm text-[#888]">We'll personalise your matches and pre-fill your intro emails.</p>
              </div>
              {deckFile && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <FileText size={13} className="text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-700">
                    <span className="font-semibold">{deckFile.name}</span> will be referenced in your intro requests.
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">Your Name</label>
                  <Input placeholder="e.g. Sarah Chen" value={matchInput.founderName}
                    onChange={(e) => setMatchInput((p) => ({ ...p, founderName: e.target.value }))}
                    className="bg-[#faf8f5] border-black/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">Company Name</label>
                  <Input placeholder="e.g. Cloverleaf Bio" value={matchInput.companyName}
                    onChange={(e) => setMatchInput((p) => ({ ...p, companyName: e.target.value }))}
                    className="bg-[#faf8f5] border-black/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">Your Email</label>
                  <Input type="email" placeholder="e.g. demo-founder@example.com" value={matchInput.email}
                    onChange={(e) => setMatchInput((p) => ({ ...p, email: e.target.value }))}
                    className="bg-[#faf8f5] border-black/10" />
                  <p className="text-[10px] text-[#bbb] mt-1.5">Used to send your match report and pre-fill intro emails.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setMatchStep('upload')} className="border-black/10">Back</Button>
                <Button onClick={() => setMatchStep('profile')} disabled={!aboutComplete} className="flex-1 gap-2">
                  Continue <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Company Profile */}
          {matchStep === 'profile' && (
            <div className="rounded-2xl border border-black/8 bg-white p-7 flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-[#1a1a1a] mb-1">
                  Tell us about {matchInput.companyName || 'your company'}
                </h2>
                <p className="text-sm text-[#888]">We'll rank capital sources across all 7 categories.</p>
              </div>
              {[
                {
                  label: 'Current Stage',
                  items: ALL_STAGES as string[],
                  value: matchInput.stage,
                  getLabel: (s: string) => STAGE_LABELS[s as Stage],
                  onSelect: (s: string) => setMatchInput((p) => ({ ...p, stage: p.stage === s ? '' : s as Stage })),
                },
                {
                  label: 'Primary Therapeutic Area',
                  items: ALL_AREAS as string[],
                  value: matchInput.therapeuticArea,
                  getLabel: (a: string) => AREA_LABELS[a as TherapeuticArea],
                  onSelect: (a: string) => setMatchInput((p) => ({ ...p, therapeuticArea: p.therapeuticArea === a ? '' : a as TherapeuticArea })),
                },
                {
                  label: 'What Do You Need?',
                  items: ALL_OFFERS as string[],
                  value: matchInput.capitalType,
                  getLabel: (o: string) => OFFER_LABELS[o as WhatTheyOffer],
                  onSelect: (o: string) => setMatchInput((p) => ({ ...p, capitalType: p.capitalType === o ? '' : o as WhatTheyOffer })),
                },
                {
                  label: 'Primary Geography',
                  items: ALL_GEOS as string[],
                  value: matchInput.geography,
                  getLabel: (g: string) => g,
                  onSelect: (g: string) => setMatchInput((p) => ({ ...p, geography: p.geography === g ? '' : g as Geography })),
                },
              ].map(({ label, items, value, getLabel, onSelect }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-[#555] mb-2 uppercase tracking-wide">{label}</label>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <FilterPill key={item} label={getLabel(item)} active={value === item} onClick={() => onSelect(item)} />
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-2 uppercase tracking-wide">
                  Target Raise ($M USD) <span className="normal-case font-normal text-[#bbb]">— optional</span>
                </label>
                <Input type="number" placeholder="e.g. 25" value={matchInput.raiseSizeMn || ''}
                  onChange={(e) => setMatchInput((p) => ({ ...p, raiseSizeMn: parseFloat(e.target.value) || 0 }))}
                  className="max-w-[180px] bg-[#faf8f5] border-black/10" />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setMatchStep('about')} className="border-black/10">Back</Button>
                <Button onClick={() => setMatchStep('results')} disabled={!profileComplete} className="flex-1 gap-2">
                  Find My Investors <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {matchStep === 'results' && (
            <div className="flex flex-col gap-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1a1a1a]">
                    {totalMatches} capital matches for {matchInput.companyName}
                  </h2>
                  <p className="text-sm text-[#888] mt-1">
                    Ranked by fit. Real emails shown. All intro pathways ready.
                  </p>
                </div>
                <Button variant="outline" size="sm"
                  onClick={() => {
                    setMatchStep('upload')
                    setMatchInput({ founderName: '', companyName: '', email: '', stage: '', therapeuticArea: '', raiseSizeMn: 0, geography: '', capitalType: '' })
                    setDeckFile(null)
                  }}
                  className="shrink-0 border-black/10 text-xs">
                  Start over
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {matchInput.stage && <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs text-[#666]">Stage: {STAGE_LABELS[matchInput.stage]}</span>}
                {matchInput.therapeuticArea && <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs text-[#666]">Area: {AREA_LABELS[matchInput.therapeuticArea]}</span>}
                {matchInput.capitalType && <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs text-[#666]">Need: {OFFER_LABELS[matchInput.capitalType]}</span>}
                {matchInput.geography && <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs text-[#666]">Geo: {matchInput.geography}</span>}
                {matchInput.raiseSizeMn > 0 && <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs text-[#666]">Raising: ${matchInput.raiseSizeMn}M</span>}
              </div>

              <CategorySection title="Primary VC & Equity Matches"
                description="Funds that match your stage, therapeutic area, and geography."
                investors={matchResults.primary} matchInput={matchInput} showScore />
              <CategorySection title="Corporate Pharma & Strategic Investors"
                description="Pharma-backed CVCs that invest and often follow with BD deals or acquisitions."
                investors={matchResults.strategic} matchInput={matchInput} showScore />
              <CategorySection title="Non-Dilutive Options"
                description="Venture debt and royalty financing — keep your equity, extend your runway."
                investors={matchResults.nonDilutive} matchInput={matchInput} />
              <CategorySection title="Distribution & Licensing Partners"
                description="Partners who can take your product to market in exchange for regional rights."
                investors={matchResults.distribution} matchInput={matchInput} />

              {totalMatches === 0 && (
                <div className="py-12 text-center text-[#bbb]">
                  <Building2 size={28} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No matches found. Try broadening your criteria.</p>
                </div>
              )}

              <div className="rounded-xl border border-black/8 bg-white p-6 text-center">
                <p className="text-sm font-semibold text-[#1a1a1a] mb-1">Need help approaching these investors?</p>
                <p className="text-xs text-[#888] mb-4 max-w-sm mx-auto">
                  ZenithOS works with life sciences founders on fundraising strategy, financial preparation, and warm introductions.
                </p>
                <a href={`mailto:lavine@zenith-grp.co?subject=Fundraising Support — ${matchInput.companyName}&body=Hi Lavine,%0A%0AI used ZenithOS and would love to discuss fundraising support for ${matchInput.companyName}.%0A%0A${matchInput.founderName}%0A${matchInput.email}`}>
                  <Button size="sm" className="gap-1.5">Talk to Zenith <ArrowRight size={12} /></Button>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SEARCH TAB ──────────────────────────────────────────────── */}
      {tab === 'search' && (
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
              <Input placeholder="Search by name, location, or description…" value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-white border-black/10 text-[#1a1a1a] placeholder:text-[#bbb]" />
              {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-[#777]"><X size={13} /></button>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}
              className="gap-1.5 shrink-0 bg-white border-black/10">
              <Filter size={13} /> Filters
              {hasFilters ? <span className="rounded-full bg-[#1a1a1a] text-white text-[10px] px-1.5 font-bold">
                {activeTypes.length + activeStages.length + activeAreas.length + activeGeos.length + activeOffers.length}
              </span> : null}
            </Button>
            {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setActiveTypes([]); setActiveStages([]); setActiveAreas([]); setActiveGeos([]); setActiveOffers([]) }} className="shrink-0">Clear</Button>}
          </div>

          {showFilters && (
            <div className="rounded-xl border border-black/8 bg-white p-5 flex flex-col gap-4">
              {[
                { label: 'Capital Type', items: ALL_TYPES, active: activeTypes, set: setActiveTypes, getLabel: (t: InvestorType) => INVESTOR_TYPE_LABELS[t] },
                { label: 'Stage', items: ALL_STAGES, active: activeStages, set: setActiveStages, getLabel: (s: Stage) => STAGE_LABELS[s] },
                { label: 'Therapeutic Area', items: ALL_AREAS, active: activeAreas, set: setActiveAreas, getLabel: (a: TherapeuticArea) => AREA_LABELS[a] },
                { label: 'Geography', items: ALL_GEOS, active: activeGeos, set: setActiveGeos, getLabel: (g: Geography) => g },
                { label: 'What They Offer', items: ALL_OFFERS, active: activeOffers, set: setActiveOffers, getLabel: (o: WhatTheyOffer) => OFFER_LABELS[o] },
              ].map(({ label, items, active, set, getLabel }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#bbb] mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {(items as string[]).map((item) => (
                      <FilterPill key={item} label={getLabel(item as never)}
                        active={(active as string[]).includes(item)}
                        onClick={() => toggleFilter(active as string[], item, set as (v: string[]) => void)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <p className="text-sm text-[#999]">
              {filtered.length.toLocaleString()} investor{filtered.length !== 1 ? 's' : ''}{hasFilters ? ' matching filters' : ''}
            </p>
            {extendedLoading && (
              <span className="text-[11px] text-[#bbb] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ccc] animate-pulse inline-block" />
                Loading full database…
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((inv) => <InvestorCard key={inv.id} investor={inv} />)}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-[#bbb]">
                <Building2 size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No investors match these filters.</p>
                <button onClick={() => { setQuery(''); setActiveTypes([]); setActiveStages([]); setActiveAreas([]); setActiveGeos([]); setActiveOffers([]) }}
                  className="mt-2 text-xs underline hover:text-[#555]">Clear all filters</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── VC THESIS ───────────────────────────────────────────────── */}
      <div className="border-t border-black/8 bg-white mt-16">
        <div className="max-w-2xl mx-auto px-4 py-14">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-[#faf8f5] px-3 py-1 text-xs text-[#888] mb-4">
              <Send size={11} /> For Investors
            </div>
            <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Are you a VC, CVC, or lender?</h2>
            <p className="text-[#888] text-sm max-w-md mx-auto">
              Submit your investment thesis and receive curated, weekly deal flow matched to your focus.
              We source from 10,000+ biotech and medtech founders.
            </p>
          </div>
          {vcSubmitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-600" />
              <p className="font-semibold text-emerald-800 text-sm">Thank you, {vcForm.name}.</p>
              <p className="text-emerald-700 text-xs mt-1">We'll be in touch with deal flow matched to {vcForm.firm}'s thesis.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-black/8 bg-[#faf8f5] p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">Your Name</label>
                  <Input placeholder="Zach Loomis" value={vcForm.name}
                    onChange={(e) => setVcForm((p) => ({ ...p, name: e.target.value }))} className="bg-white border-black/10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">Firm</label>
                  <Input placeholder="Valeron Partners" value={vcForm.firm}
                    onChange={(e) => setVcForm((p) => ({ ...p, firm: e.target.value }))} className="bg-white border-black/10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">Email</label>
                <Input type="email" placeholder="demo-investor3@example.com" value={vcForm.email}
                  onChange={(e) => setVcForm((p) => ({ ...p, email: e.target.value }))} className="bg-white border-black/10" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1.5 uppercase tracking-wide">
                  Investment Thesis <span className="normal-case font-normal text-[#bbb]">(stage, areas, check size)</span>
                </label>
                <textarea placeholder="e.g. Series A–B neurology and rare disease, $10–50M checks, US + EU"
                  value={vcForm.thesis} onChange={(e) => setVcForm((p) => ({ ...p, thesis: e.target.value }))} rows={3}
                  className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-1 focus:ring-black/20 resize-none" />
              </div>
              <a href={`mailto:lavine@zenith-grp.co?subject=VC Thesis Submission — ${vcForm.firm}&body=Name: ${vcForm.name}%0AFirm: ${vcForm.firm}%0AEmail: ${vcForm.email}%0A%0AThesis:%0A${vcForm.thesis}`}
                onClick={() => { if (vcForm.name && vcForm.firm && vcForm.email) setVcSubmitted(true) }}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                  vcForm.name && vcForm.firm && vcForm.email
                    ? 'bg-[#1a1a1a] text-white hover:bg-[#333]'
                    : 'bg-black/10 text-[#bbb] pointer-events-none'
                }`}>
                <Send size={13} /> Submit Thesis & Get Weekly Deal Flow
              </a>
              <p className="text-[10px] text-[#bbb]">We manually review submissions. Expect a response within 48 hours.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── NEWSLETTER ──────────────────────────────────────────────── */}
      <div className="bg-[#1a1a1a]">
        <div className="max-w-xl mx-auto px-4 py-12 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 mb-4">
            <Newspaper size={11} /> Weekly Intelligence
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Biotech Capital Weekly</h2>
          <p className="text-white/50 text-sm mb-6">New investors added, deal flow intel, and M&A signals — every week. Sent to 500+ life sciences founders.</p>
          {newsletterDone ? (
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 size={16} /> You're on the list. Check your inbox.
            </div>
          ) : (
            <div className="flex gap-2 max-w-sm mx-auto">
              <Input type="email" placeholder="your@biotech.com" value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="bg-white/8 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20" />
              <a href={`mailto:lavine@zenith-grp.co?subject=Newsletter Signup&body=Please add me to Biotech Capital Weekly.%0A%0AEmail: ${newsletterEmail}`}
                onClick={() => { if (newsletterEmail) setNewsletterDone(true) }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-white text-[#1a1a1a] text-sm font-medium px-4 py-2 hover:bg-white/90 transition-colors">
                Subscribe
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-black/8 bg-[#faf8f5] py-5 text-center">
        <p className="text-xs text-[#bbb]">
          Built by{' '}
          <a href="https://zenith-grp.co" className="underline hover:text-[#555]" target="_blank" rel="noopener noreferrer">ZenithOS</a>
          {' '}· Life Sciences Financial Advisory ·{' '}
          <a href="mailto:lavine@zenith-grp.co" className="underline hover:text-[#555]">lavine@zenith-grp.co</a>
          {' '}·{' '}
          <a href="/capital/intros" className="underline hover:text-[#555]">How intros work</a>
        </p>
      </div>
    </div>
  )
}
