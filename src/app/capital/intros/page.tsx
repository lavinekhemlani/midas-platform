'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, Clock, Mail, MessageSquare, Users, Zap, ChevronLeft, ChevronRight, ChevronDown, Linkedin, Search } from 'lucide-react'

// ─── Frustration illustrations (inline SVG, Metal.so-style minimal) ──────────

function IllustrationTarget() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="100" cy="100" r="70" stroke="#d1cec9" strokeWidth="1"/>
      <circle cx="100" cy="100" r="48" stroke="#d1cec9" strokeWidth="1"/>
      <circle cx="100" cy="100" r="26" stroke="#d1cec9" strokeWidth="1"/>
      <circle cx="100" cy="100" r="6" fill="#d1cec9"/>
      <line x1="128" y1="72" x2="148" y2="52" stroke="#c5bfb8" strokeWidth="1" strokeDasharray="2 2"/>
      <circle cx="152" cy="48" r="4" fill="none" stroke="#c5bfb8" strokeWidth="1"/>
    </svg>
  )
}

function IllustrationSearch() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="40" y="40" width="52" height="52" rx="2" stroke="#d1cec9" strokeWidth="1" strokeDasharray="3 2"/>
      <rect x="60" y="60" width="52" height="52" rx="2" stroke="#c5bfb8" strokeWidth="1" strokeDasharray="3 2"/>
      <rect x="80" y="80" width="52" height="52" rx="2" stroke="#d1cec9" strokeWidth="1" strokeDasharray="3 2"/>
      <circle cx="106" cy="106" r="3" fill="#c5bfb8"/>
    </svg>
  )
}

function IllustrationMisaligned() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="30" y="60" width="65" height="38" rx="2" stroke="#d1cec9" strokeWidth="1"/>
      <rect x="105" y="75" width="65" height="55" rx="2" stroke="#d1cec9" strokeWidth="1"/>
      <rect x="55" y="112" width="50" height="28" rx="2" stroke="#c5bfb8" strokeWidth="1" strokeDasharray="3 2"/>
      <line x1="95" y1="79" x2="105" y2="85" stroke="#c5bfb8" strokeWidth="1" strokeDasharray="2 2"/>
    </svg>
  )
}

function IllustrationPatchwork() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="70" cy="80" r="20" stroke="#d1cec9" strokeWidth="1"/>
      <circle cx="130" cy="70" r="28" stroke="#d1cec9" strokeWidth="1"/>
      <circle cx="95" cy="130" r="16" stroke="#c5bfb8" strokeWidth="1" strokeDasharray="3 2"/>
      <circle cx="145" cy="130" r="22" stroke="#d1cec9" strokeWidth="1"/>
      <line x1="90" y1="80" x2="102" y2="80" stroke="#c5bfb8" strokeWidth="0.5" strokeDasharray="2 2"/>
      <line x1="130" y1="98" x2="110" y2="115" stroke="#c5bfb8" strokeWidth="0.5" strokeDasharray="2 2"/>
    </svg>
  )
}

function IllustrationInactive() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M 60 140 A 60 60 0 1 1 147 147" stroke="#d1cec9" strokeWidth="1" strokeLinecap="round"/>
      <path d="M 147 147 A 60 60 0 0 1 148 148" stroke="#c5bfb8" strokeWidth="1" strokeDasharray="3 2" strokeLinecap="round"/>
      <circle cx="148" cy="150" r="4" fill="#c5bfb8"/>
    </svg>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FIRMS = [
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
  { name: 'Vida Ventures',         slug: 'vida-ventures' },
  { name: 'MPM BioVentures',       slug: 'mpm-bioventures' },
  { name: 'Polaris Partners',      slug: 'polaris-partners' },
  { name: 'NEA',                   slug: 'nea' },
  { name: 'GV',                    slug: 'gv' },
  { name: 'Sofinnova Partners',    slug: 'sofinnova-partners' },
  { name: 'F-Prime Capital',       slug: 'f-prime-capital' },
  { name: 'SR One',                slug: 'sr-one' },
  { name: 'HBM Healthcare',        slug: 'hbm-healthcare' },
  { name: 'Perceptive Advisors',   slug: 'perceptive-advisors' },
  { name: 'Redmile Group',         slug: 'redmile-group' },
  { name: 'RTW Investments',       slug: 'rtw-investments' },
  { name: 'Boxer Capital',         slug: 'boxer-capital' },
  { name: 'Cormorant Asset Mgmt',  slug: 'cormorant' },
  { name: 'Flagship Pioneering',   slug: 'flagship-pioneering' },
  { name: 'ARCH Venture Partners', slug: 'arch-venture' },
  { name: 'Omega Funds',           slug: 'omega-funds' },
  { name: 'Perceptive Life Sci',   slug: 'perceptive-life-sciences' },
  { name: 'Deerfield Agency',      slug: 'deerfield-agency' },
  { name: 'RA Capital Mgmt',       slug: 'ra-capital-mgmt' },
]

const AREAS = [
  { label: 'Oncology', count: 312 },
  { label: 'Cell & Gene Therapy', count: 134 },
  { label: 'Immunology', count: 143 },
  { label: 'Med Device', count: 204 },
  { label: 'Genomics', count: 187 },
  { label: 'Rare Disease', count: 98 },
  { label: 'Diagnostics', count: 95 },
  { label: 'Neurology', count: 76 },
  { label: 'Metabolic & Cardio', count: 112 },
  { label: 'Infectious Disease', count: 89 },
  { label: 'Synthetic Biology', count: 43 },
  { label: 'Digital Health', count: 67 },
]

const FRUSTRATIONS = [
  {
    title: 'Warm intro hunts',
    desc: 'Spending hours digging through networks just to find a mutual connection — then learning they barely know the investor.',
    Illustration: IllustrationSearch,
    bg: 'bg-[#f5f3ef]',
  },
  {
    title: 'Wasted first calls',
    desc: "Landing a meeting with a lead investor, only to learn their thesis shifted and they haven't led a round in eight months.",
    Illustration: IllustrationTarget,
    bg: 'bg-[#f0f2ec]',
  },
  {
    title: 'Misaligned sweet spots',
    desc: 'Getting deep into diligence with a fund that loves the science — but writes $2M checks and you need $12M.',
    Illustration: IllustrationMisaligned,
    bg: 'bg-[#f5f0f0]',
  },
  {
    title: 'The patchwork investor list',
    desc: 'Cobbling together targets from news articles, generic databases, and stale spreadsheets someone shared two years ago.',
    Illustration: IllustrationPatchwork,
    bg: 'bg-[#f5f3ef]',
  },
  {
    title: 'Inactive investors taking calls',
    desc: 'Waiting weeks for a response, then discovering the fund quietly paused new investments three months ago.',
    Illustration: IllustrationInactive,
    bg: 'bg-[#f0f2ec]',
  },
]

const FOUNDERS = [
  {
    initials: 'SC',
    name: 'Sarah Chen',
    title: 'CEO & Co-Founder',
    company: 'Radiant Bio',
    quote: '"Lavine had the right intro lined up within 48 hours. The investor had already been briefed on us before the call — that never happens with a cold reach-out."',
    raised: '$14M',
    stage: 'Series A',
    area: 'Oncology',
  },
  {
    initials: 'MO',
    name: 'Marcus Osei',
    title: 'Founder & CEO',
    company: 'NovaStem Therapeutics',
    quote: '"The database alone saved us weeks of research. Finding the right Seed-stage gene therapy fund used to take a consultant and three months. We did it in an afternoon."',
    raised: '$6M',
    stage: 'Seed',
    area: 'Gene Therapy',
  },
  {
    initials: 'PR',
    name: 'Priya Rajan',
    title: 'Co-Founder & CSO',
    company: 'Helix Diagnostics',
    quote: '"The double opt-in process is what makes this real. The investor knew what they were walking into. First call was a genuine conversation, not a pitch-and-pray."',
    raised: '$9M',
    stage: 'Series A',
    area: 'Diagnostics',
  },
  {
    initials: 'TL',
    name: 'Tom Lund',
    title: 'CEO',
    company: 'Carta Immunology',
    quote: '"We\'d been trying to get in front of one fund for six months. Lavine got us a call in a week. Deal closed two months later."',
    raised: '$22M',
    stage: 'Series B',
    area: 'Immunology',
  },
  {
    initials: 'AK',
    name: 'Ananya Kumar',
    title: 'Founder',
    company: 'Lumio Therapeutics',
    quote: '"What sets ZenithOS apart isn\'t just the database — it\'s that someone actually knows these investors personally and can vouch for you before you walk in."',
    raised: '$4M',
    stage: 'Seed',
    area: 'Rare Disease',
  },
  {
    initials: 'JH',
    name: 'James Hartley',
    title: 'CEO & Co-Founder',
    company: 'PrecisionNeuro',
    quote: '"I\'d tried every platform. ZenithOS was the first one where we actually got responses — because the intro came with credibility attached."',
    raised: '$11M',
    stage: 'Series A',
    area: 'Neurology',
  },
]

const STEPS = [
  {
    number: '01',
    icon: Zap,
    title: 'You find the investor',
    who: 'You',
    time: '2 min',
    description: 'Browse 3,262 investors or describe your raise in plain language. Find the exact partner that fits your stage, area, and check size.',
    color: 'emerald',
  },
  {
    number: '02',
    icon: Mail,
    title: 'You request the intro',
    who: 'You',
    time: '1 min',
    description: 'Click "Request warm intro via Zenith." An email opens to Lavine with the investor, your details, and a place to attach your deck.',
    color: 'blue',
  },
  {
    number: '03',
    icon: MessageSquare,
    title: 'Lavine reviews fit',
    who: 'Zenith',
    time: '24h',
    description: "Lavine reviews your company against the investor's actual thesis. She checks her direct relationships for the strongest path — or tells you honestly if the fit isn't there.",
    color: 'amber',
  },
  {
    number: '04',
    icon: Users,
    title: 'Double opt-in',
    who: 'Zenith + Investor',
    time: '24–72h',
    description: "Lavine contacts the investor first — before your name is mentioned. She pitches the opportunity and confirms they're open. No surprise intros.",
    color: 'purple',
  },
  {
    number: '05',
    icon: CheckCircle2,
    title: 'The intro lands',
    who: 'Zenith',
    time: 'After opt-in',
    description: "A proper email intro with context — why this company, why this fund, why now. Both parties CC'd. You take it from there.",
    color: 'emerald',
  },
]

const STEP_COLORS: Record<string, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  purple: 'border-purple-200 bg-purple-50 text-purple-700',
}

const PLANS = [
  {
    name: 'Intro Access',
    price: 'Free',
    priceSub: 'No commitment required',
    desc: 'For founders who need the right door opened.',
    features: [
      'Full access to 3,262 investor profiles',
      'Filter by stage, area & check size',
      'Unlimited warm intro requests',
      '24h response from Lavine',
      'Double opt-in — no surprise intros',
    ],
    cta: 'Request an intro',
    href: 'mailto:lavine@zenith-grp.co?subject=Intro%20Request%20via%20ZenithOS',
    highlight: false,
  },
  {
    name: 'CFO Advisory',
    price: 'Custom',
    priceSub: 'Monthly retainer',
    desc: 'Fractional CFO support through your raise and beyond.',
    features: [
      'Everything in Intro Access',
      'Financial modeling & projections',
      'Investor memo & data room build-out',
      'Term sheet review & negotiation',
      'Board reporting & KPI tracking',
      'Monthly strategic finance sessions',
    ],
    cta: 'Talk to Lavine',
    href: 'mailto:lavine@zenith-grp.co?subject=CFO%20Advisory%20Inquiry',
    highlight: true,
  },
  {
    name: 'Fundraise Mandate',
    price: 'Custom',
    priceSub: 'Success-based structure',
    desc: 'End-to-end fundraising from first pitch to close.',
    features: [
      'Everything in CFO Advisory',
      'Investor targeting & outreach strategy',
      'Full pitch process management',
      'Negotiation & close support',
      'Post-close cap table & reporting',
    ],
    cta: 'Talk to Lavine',
    href: 'mailto:lavine@zenith-grp.co?subject=Fundraise%20Mandate%20Inquiry',
    highlight: false,
  },
]

const FAQS = [
  { q: 'How many intros can I request?', a: "No hard limit — but quality beats volume. A targeted list of 10 with strong fit outperforms 50 spray-and-pray requests. Lavine will flag if you're reaching too broadly." },
  { q: 'What if the investor says no?', a: 'Lavine tells you and shares feedback if there is any. Sometimes it\'s timing, sometimes thesis fit. Either way you get a real answer — not silence.' },
  { q: 'How is this different from Metal.so or other platforms?', a: "Metal maps your own network. Zenith uses Lavine's network — one built over years in life sciences. You don't import contacts, pay per intro, or manage a CRM. You just ask." },
  { q: 'Do I need to be at a specific stage?', a: 'No. ZenithOS covers Seed through Series C, plus non-dilutive sources (grants, royalty financing, debt). The pathway works at any stage as long as the investor match is real.' },
  { q: 'Is there a fee?', a: 'Intro requests through ZenithOS are free for qualified life sciences founders. Zenith\'s broader CFO advisory services are separate — this is a starting point, not a sales funnel.' },
]

// ─── Components ───────────────────────────────────────────────────────────────

function FounderCard({ founder }: { founder: typeof FOUNDERS[0] }) {
  const colors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700']
  const colorIdx = founder.initials.charCodeAt(0) % colors.length
  return (
    <div className="flex flex-col rounded-2xl border border-black/8 bg-white p-5 min-w-[280px] max-w-[320px] shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colors[colorIdx]}`}>
          {founder.initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">{founder.name}</p>
          <p className="text-[11px] text-[#888]">{founder.title} · {founder.company}</p>
        </div>
      </div>
      <p className="text-xs text-[#555] leading-relaxed italic flex-1 mb-4">{founder.quote}</p>
      <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-black/6">
        <span className="text-xs font-bold text-[#1a1a1a]">{founder.raised}</span>
        <span className="text-[10px] text-[#aaa]">raised</span>
        <span className="ml-auto text-[10px] font-medium text-[#888] bg-[#f5f3ef] rounded-full px-2 py-0.5">{founder.stage} · {founder.area}</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntrosPage() {
  const [frustIdx, setFrustIdx] = useState(0)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  const introMailto = `mailto:lavine@zenith-grp.co?subject=${encodeURIComponent('Intro Request via ZenithOS')}&body=${encodeURIComponent(`Hi Lavine,

I found ZenithOS and would love a warm intro to [Investor Name] at [Fund Name].

Company: [Company]
Stage: [Stage]
Raise: $[X]M
Therapeutic area: [Area]

One-liner: [What you do in one sentence]

Happy to share my deck.

[Your name]`)}`

  const curFrust = FRUSTRATIONS[frustIdx]
  const FrustIllustration = curFrust.Illustration

  const allFirms = [...FIRMS, ...FIRMS, ...FIRMS]

  return (
    <>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .firm-ticker { animation: ticker 45s linear infinite; }
        .firm-ticker:hover { animation-play-state: paused; }
      `}</style>

      <div className="min-h-screen bg-[#faf8f5]">

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="pt-24 pb-16 px-5 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Warm Intro Service — Free for life sciences founders
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#1a1a1a] leading-[1.1] tracking-tight mb-4">
            We make the intro.<br />You close the deal.
          </h1>
          <p className="text-lg text-[#555] leading-relaxed max-w-xl mx-auto mb-8">
            Find your target investor in ZenithOS. Request a warm intro. Lavine reaches out through her
            life sciences network — and only connects you if the investor opts in first.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => { window.location.href = introMailto }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold px-6 py-3 hover:bg-[#333] transition-colors"
            >
              Request an intro <ArrowRight size={15} />
            </button>
            <a
              href="/capital"
              className="inline-flex items-center gap-2 rounded-xl border border-black/15 bg-white text-[#1a1a1a] text-sm font-semibold px-6 py-3 hover:border-black/30 transition-colors"
            >
              Browse 3,262 investors
            </a>
          </div>
        </section>

        {/* ── FIRM TICKER ───────────────────────────────────────────────────── */}
        <div className="py-7 border-y border-black/8 bg-white overflow-hidden">
          <p className="text-[10px] font-bold text-[#ccc] uppercase tracking-widest text-center mb-5">Investor network includes</p>
          <div className="overflow-hidden relative">
            {/* fade edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-white to-transparent" />
            <div className="firm-ticker flex items-center gap-12 w-max">
              {allFirms.map((firm, i) => (
                <div key={i} className="shrink-0 group flex items-center h-8">
                  <img
                    src={`/vc-logos/${firm.slug}.png`}
                    alt=""
                    title={firm.name}
                    className="h-7 w-auto max-w-[110px] object-contain grayscale opacity-40 group-hover:opacity-80 group-hover:grayscale-0 transition-all duration-200"
                    onError={(e) => {
                      // Try SVG fallback, then show text
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
                  <span
                    className="items-center gap-1.5 whitespace-nowrap"
                    style={{ display: 'none' }}
                  >
                    <span className="w-1 h-1 rounded-full bg-[#ddd] shrink-0" />
                    <span className="text-[11px] font-medium text-[#bbb]">{firm.name}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── STATS ─────────────────────────────────────────────────────────── */}
        <section className="border-b border-black/8 bg-white py-8">
          <div className="max-w-4xl mx-auto px-5 grid grid-cols-2 sm:grid-cols-4 divide-x divide-black/8 text-center">
            {[
              { value: '3,262', label: 'Life sciences investors' },
              { value: '24h', label: 'Average first response' },
              { value: '72h', label: 'Typical opt-in turnaround' },
              { value: '100%', label: 'Life sciences focus' },
            ].map(({ value, label }) => (
              <div key={label} className="px-4 py-2">
                <p className="text-2xl font-bold text-[#1a1a1a]">{value}</p>
                <p className="text-xs text-[#888] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRODUCT FEATURES ──────────────────────────────────────────────── */}
        <section className="py-16 px-5 bg-[#faf8f5]">
          <div className="max-w-5xl mx-auto">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-2 text-center">Platform</p>
            <h2 className="text-2xl font-bold text-[#1a1a1a] text-center mb-3">Three things ZenithOS does.</h2>
            <p className="text-sm text-[#888] text-center mb-10 max-w-md mx-auto">Find the right fund. Know they're actively deploying. Get the intro — double opt-in, no cold reach.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  Icon: Search,
                  color: 'bg-emerald-50',
                  iconColor: 'text-emerald-600',
                  title: 'Investor Search',
                  desc: 'Browse 3,262 life sciences investors filtered by stage, therapeutic area, check size, and lead/follow preference.',
                  items: ['Stage filter — Seed through Series C', 'Therapeutic area & disease focus', 'Check size & co-investment history', 'Non-dilutive sources included'],
                },
                {
                  Icon: Clock,
                  color: 'bg-blue-50',
                  iconColor: 'text-blue-600',
                  title: 'Active Mandate Tracking',
                  desc: 'Know who\'s deploying before you reach out. See last deal activity, fund status, and named partner thesis.',
                  items: ['Last deal activity date', 'Current fund deployment status', 'Named partner focus areas', 'Verified contact details'],
                },
                {
                  Icon: Users,
                  color: 'bg-amber-50',
                  iconColor: 'text-amber-600',
                  title: 'Warm Intro Pathway',
                  desc: 'Request a warm intro through Lavine\'s network. She pitches the investor first — no surprise intros.',
                  items: ['24h fit review by Lavine', 'Double opt-in before you\'re named', 'Proper email intro with context', 'Honest feedback if fit isn\'t there'],
                },
              ].map(({ Icon, color, iconColor, title, desc, items }) => (
                <div key={title} className="rounded-2xl border border-black/8 bg-white p-5 flex flex-col">
                  <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-4 shrink-0`}>
                    <Icon size={18} className={iconColor} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1a1a1a] mb-2">{title}</h3>
                  <p className="text-xs text-[#555] leading-relaxed mb-4">{desc}</p>
                  <ul className="flex flex-col gap-1.5 mt-auto">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-[#555]">
                        <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Chat CTA */}
            <div className="mt-8 rounded-2xl border border-black/8 bg-white px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#1a1a1a] mb-0.5">Not sure where to start?</p>
                <p className="text-xs text-[#888]">Describe your raise and we'll match you to the right investors in plain English.</p>
              </div>
              <a
                href="/capital/find"
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#333] transition-colors"
              >
                Find my investors <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </section>

        {/* ── COMMON FRUSTRATIONS ───────────────────────────────────────────── */}
        <section className="py-20 px-5">
          <div className="max-w-5xl mx-auto">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-2 text-center">Sound familiar?</p>
            <h2 className="text-3xl sm:text-4xl font-light text-[#1a1a1a] text-center mb-2 tracking-tight">
              Common Frustrations, Solved.
            </h2>
            <p className="text-base text-[#888] text-center mb-14 max-w-lg mx-auto">
              Life sciences fundraising is broken in specific, predictable ways. ZenithOS is built to fix them.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className={`rounded-3xl ${curFrust.bg} aspect-square max-w-md mx-auto w-full flex items-center justify-center p-12 transition-all duration-300`}>
                <FrustIllustration />
              </div>
              <div>
                <div className="flex flex-col gap-3 mb-8">
                  {FRUSTRATIONS.map((f, i) => (
                    <button
                      key={f.title}
                      onClick={() => setFrustIdx(i)}
                      className={`text-left px-4 py-3 rounded-xl transition-all ${
                        i === frustIdx
                          ? 'bg-white border border-black/10 shadow-sm'
                          : 'hover:bg-white/50'
                      }`}
                    >
                      <p className={`text-sm font-semibold mb-0.5 ${i === frustIdx ? 'text-[#1a1a1a]' : 'text-[#888]'}`}>
                        {f.title}
                      </p>
                      {i === frustIdx && (
                        <p className="text-xs text-[#555] leading-relaxed">{f.desc}</p>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFrustIdx(i => Math.max(0, i - 1))}
                    disabled={frustIdx === 0}
                    className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center hover:border-black/40 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setFrustIdx(i => Math.min(FRUSTRATIONS.length - 1, i + 1))}
                    disabled={frustIdx === FRUSTRATIONS.length - 1}
                    className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center hover:border-black/40 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <span className="text-xs text-[#aaa] ml-2">{frustIdx + 1} / {FRUSTRATIONS.length}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── THERAPEUTIC AREA COVERAGE ─────────────────────────────────────── */}
        <section className="py-16 px-5 border-y border-black/8 bg-white">
          <div className="max-w-4xl mx-auto">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-2 text-center">Investor depth</p>
            <h2 className="text-2xl font-bold text-[#1a1a1a] text-center mb-3">
              Built for every area of life sciences.
            </h2>
            <p className="text-sm text-[#888] text-center mb-10 max-w-md mx-auto">
              If you can name the therapeutic area, we have investors that focus on it — with verified active mandates.
            </p>
            <div className="flex flex-wrap gap-2.5 justify-center mb-10">
              {AREAS.map(({ label, count }) => (
                <a
                  key={label}
                  href="/capital"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#faf8f5] px-4 py-2 text-sm text-[#555] hover:border-black/25 hover:bg-white transition-colors"
                >
                  <span className="font-medium text-[#1a1a1a]">{label}</span>
                  <span className="text-[11px] text-[#aaa] font-mono">{count}</span>
                </a>
              ))}
            </div>
            <p className="text-center text-xs text-[#bbb]">
              Numbers reflect active investors across 3,262 tracked profiles · Updated quarterly
            </p>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
        <section className="py-20 px-5 bg-[#faf8f5]">
          <div className="max-w-3xl mx-auto">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-2 text-center">The process</p>
            <h2 className="text-2xl font-bold text-[#1a1a1a] text-center mb-12">What happens after you click the button</h2>

            <div className="relative">
              <div className="absolute left-[19px] top-8 bottom-8 w-px bg-black/8 hidden sm:block" />
              <div className="flex flex-col gap-8">
                {STEPS.map((step) => {
                  const Icon = step.icon
                  const colorClass = STEP_COLORS[step.color]
                  return (
                    <div key={step.number} className="flex gap-5 relative">
                      <div className={`shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center ${colorClass} z-10`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-[#aaa] tracking-widest">{step.number}</span>
                          <h3 className="text-sm font-bold text-[#1a1a1a]">{step.title}</h3>
                          <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>
                            {step.who} · {step.time}
                          </span>
                        </div>
                        <p className="text-sm text-[#555] leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── WHAT THE INTRO EMAIL LOOKS LIKE ───────────────────────────────── */}
        <section className="py-20 px-5 bg-white border-y border-black/8">
          <div className="max-w-3xl mx-auto">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-2 text-center">The intro email</p>
            <h2 className="text-2xl font-bold text-[#1a1a1a] text-center mb-10">What it actually looks like</h2>

            <div className="rounded-2xl border border-black/10 bg-white overflow-hidden shadow-sm">
              <div className="border-b border-black/8 px-5 py-4 bg-[#fafafa]">
                <div className="flex flex-col gap-1.5 text-sm">
                  {[
                    { label: 'From', val: 'Lavine Hemlani <lavine@zenith-grp.co>' },
                    { label: 'To', val: 'Kevin Gillis <demo-investor2@example.com>' },
                    { label: 'CC', val: 'Sarah Chen <demo-founder2@example.com>' },
                    { label: 'Re', val: 'Introduction — Radiant Bio × Third Rock Ventures' },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex gap-3">
                      <span className="text-[#aaa] w-10 text-right shrink-0 text-xs">{label}</span>
                      <span className="font-medium text-[#1a1a1a] text-xs">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-5 text-sm text-[#333] leading-relaxed space-y-3">
                <p>Kevin,</p>
                <p>Wanted to connect you with <strong>Sarah Chen</strong>, founder of <strong>Radiant Bio</strong> — a Series A oncology platform company developing next-generation CAR-T therapies for solid tumors. They're closing a $15M round.</p>
                <p>Sarah's team includes former Novartis and Blueprint Medicines scientists. I reviewed the deck — the differentiation is real and I think this fits squarely in Third Rock's wheelhouse.</p>
                <p>Sarah is absolutely open to a conversation. Over to you both.</p>
                <p className="pt-1">Lavine<br /><span className="text-[#888] text-xs">Zenith — zenith-grp.co</span></p>
              </div>
            </div>
            <p className="text-xs text-[#bbb] text-center mt-3">Illustrative example. Names and companies are fictional.</p>
          </div>
        </section>

        {/* ── TRUSTED BY FOUNDERS ───────────────────────────────────────────── */}
        <section className="py-20 px-5 bg-[#faf8f5]">
          <div className="max-w-5xl mx-auto">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-2 text-center">Founders</p>
            <h2 className="text-3xl font-bold text-[#1a1a1a] text-center mb-3">Trusted By Founders</h2>
            <p className="text-sm text-[#888] text-center mb-10 max-w-md mx-auto">
              Life sciences companies that used ZenithOS to find, reach, and close their investors.
            </p>

            <div className="overflow-x-auto pb-4 -mx-5 px-5">
              <div className="flex gap-4 w-max">
                {FOUNDERS.map((founder) => (
                  <FounderCard key={founder.name} founder={founder} />
                ))}
              </div>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 max-w-lg mx-auto text-center">
              {[
                { value: '$66M+', label: 'Raised by founders in network' },
                { value: '6', label: 'Active portfolio companies' },
                { value: '100%', label: 'Life sciences focus' },
              ].map(({ value, label }) => (
                <div key={label} className="rounded-xl bg-white border border-black/6 py-4 px-3">
                  <p className="text-xl font-bold text-[#1a1a1a]">{value}</p>
                  <p className="text-[11px] text-[#888] mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LAVINE BIO ────────────────────────────────────────────────────── */}
        <section className="py-16 px-5 border-y border-black/8 bg-white">
          <div className="max-w-2xl mx-auto">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-8 text-center">Who makes the intro</p>
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[#e8e4df] shrink-0 flex items-center justify-center text-lg font-bold text-[#888]">
                LH
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <p className="text-base font-bold text-[#1a1a1a]">Lavine Hemlani</p>
                  <a
                    href="https://linkedin.com/in/lavinehemlani"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#0077B5] hover:underline font-medium"
                  >
                    <Linkedin size={11} />
                    LinkedIn
                  </a>
                </div>
                <p className="text-xs text-[#888] mb-4">Founder, Zenith · Life Sciences Financial Advisory · lavine@zenith-grp.co</p>
                <p className="text-sm text-[#555] leading-relaxed mb-4">
                  Lavine is a life sciences financial advisor who has spent years building relationships across the biotech and medtech investment ecosystem — from early Seed funds to late-stage crossover investors. She founded Zenith to give founders direct access to the investor network that used to take a decade to build.
                </p>
                <p className="text-sm text-[#555] leading-relaxed">
                  Before making an intro, she reads your deck, checks current thesis alignment, and pre-pitches the opportunity. If the fit isn't real, she tells you — and points you somewhere better.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
        <section className="py-20 px-5 bg-[#faf8f5]">
          <div className="max-w-5xl mx-auto">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-2 text-center">How we work together</p>
            <h2 className="text-2xl font-bold text-[#1a1a1a] text-center mb-3">Simple, transparent services.</h2>
            <p className="text-sm text-[#888] text-center mb-12 max-w-md mx-auto">
              Start with a free intro request. Expand as your raise gets serious.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-6 flex flex-col ${
                    plan.highlight
                      ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white shadow-lg'
                      : 'border-black/10 bg-white text-[#1a1a1a]'
                  }`}
                >
                  {plan.highlight && (
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">Most popular</div>
                  )}
                  <p className={`text-xs font-semibold mb-1 ${plan.highlight ? 'text-[#888]' : 'text-[#888]'}`}>{plan.name}</p>
                  <p className={`text-3xl font-bold mb-0.5 ${plan.highlight ? 'text-white' : 'text-[#1a1a1a]'}`}>{plan.price}</p>
                  <p className={`text-[11px] mb-4 ${plan.highlight ? 'text-[#666]' : 'text-[#aaa]'}`}>{plan.priceSub}</p>
                  <p className={`text-xs leading-relaxed mb-5 ${plan.highlight ? 'text-[#aaa]' : 'text-[#555]'}`}>{plan.desc}</p>
                  <ul className="flex flex-col gap-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 size={12} className={`shrink-0 mt-0.5 ${plan.highlight ? 'text-emerald-400' : 'text-emerald-500'}`} />
                        <span className={plan.highlight ? 'text-[#aaa]' : 'text-[#555]'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => { window.location.href = plan.href }}
                    className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                      plan.highlight
                        ? 'bg-white text-[#1a1a1a] hover:bg-[#f0f0f0]'
                        : 'bg-[#1a1a1a] text-white hover:bg-[#333]'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section className="py-20 px-5 max-w-3xl mx-auto">
          <p className="text-[11px] font-bold text-[#999] uppercase tracking-widest mb-2 text-center">Questions</p>
          <h2 className="text-2xl font-bold text-[#1a1a1a] text-center mb-10">Common questions</h2>
          <div className="flex flex-col divide-y divide-black/8">
            {FAQS.map(({ q, a }, i) => (
              <div key={q} className="py-4">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="flex items-center justify-between w-full text-left gap-4"
                >
                  <p className="text-sm font-semibold text-[#1a1a1a]">{q}</p>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-[#aaa] transition-transform duration-200 ${faqOpen === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {faqOpen === i && (
                  <p className="text-sm text-[#555] leading-relaxed mt-3 pr-6">{a}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
        <section className="py-16 px-5 bg-[#1a1a1a]">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to request an intro?</h2>
            <p className="text-sm text-[#888] mb-8 leading-relaxed">
              Browse 3,262 life sciences investors. Find your target. Request the intro.
              Lavine handles the rest.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => { window.location.href = introMailto }}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-[#1a1a1a] text-sm font-semibold px-6 py-3 hover:bg-[#f0f0f0] transition-colors"
              >
                Request an intro <ArrowRight size={15} />
              </button>
              <a
                href="/capital"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 text-white text-sm font-semibold px-6 py-3 hover:border-white/40 transition-colors"
              >
                Browse investors
              </a>
            </div>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <div className="border-t border-white/10 bg-[#1a1a1a] py-4 text-center">
          <p className="text-xs text-[#555]">
            <a href="https://zenith-grp.co" target="_blank" rel="noopener noreferrer" className="hover:text-[#888]">zenith-grp.co</a>
            {' '}·{' '}
            <a href="mailto:lavine@zenith-grp.co" className="hover:text-[#888]">lavine@zenith-grp.co</a>
            {' '}·{' '}
            <a href="/capital" className="hover:text-[#888]">Browse investors</a>
          </p>
        </div>

      </div>
    </>
  )
}
