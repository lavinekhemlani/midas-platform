'use client'

import { ArrowRight, MapPin } from 'lucide-react'

const STATS = [
  { value: '3,859+', label: 'VCs & institutional investors mapped' },
  { value: '500+', label: 'Family offices in our network' },
  { value: '$180B+', label: 'Biopharma M&A pipeline covered' },
  { value: '$540M+', label: 'In startup funding facilitated' },
]

const TEAM = [
  {
    name: 'Everett Kamin',
    role: 'BioCapital Network & Digital Health',
    highlights: [
      '500+ investors, BioCapital Network Digital Health Director, San Diego',
      '5K+ family offices, SFO and GPFO Ambassador',
      'VC and M&A across digital health, techbio',
    ],
  },
  {
    name: 'Paul Sargeant',
    role: 'Life Sciences CFO',
    highlights: [
      '25+ years life sciences C-level executive leadership',
      'Led finance at Organovo',
      'Raised $200M+ across venture-backed diagnostics startups',
    ],
  },
  {
    name: 'Christian Parrish',
    role: 'Biotech Investment Banking',
    highlights: [
      'UBS Biotech Investment Banking Executive',
      'Covers $180B+ biopharma M&A pipeline',
      'Multiple FDA device launches and strategic exits',
    ],
  },
  {
    name: 'Thomas Hess',
    role: 'Fractional CFO',
    highlights: [
      'CFO at Comanche Biopharma — $40M raise',
      'CFO at rce.ai, Hayden AI, Tharimmune, Genomind',
      'Johns Hopkins trained, 500+ institutional investor network',
    ],
  },
  {
    name: 'Lin Chan',
    role: 'Startup Finance',
    highlights: [
      'Led ASX listing, built finance for 20+ startups',
      'Fractional CFO across 5 venture-backed pharma companies',
      '32+ years international finance expertise',
    ],
  },
]

const ADVISORS = [
  {
    name: 'Dr. Tomasz',
    role: 'Global Health & M&A',
    credential: 'CEO, Freyr Health; UN Ambassador, Sustainable Health Development. Founded and scaled global AI healthtech ventures.',
  },
  {
    name: 'George',
    role: 'Deal Volume',
    credential: '$10B+ deal volume across healthcare transactions. Raised billions across multiple M&A transactions.',
  },
  {
    name: 'Ian Akash Morrison',
    role: 'CoreWeave / IPO',
    credential: 'Led CoreWeave to $30B+ valuation and Nasdaq IPO. Co-founder, oncology biotech Avesta76 Therapeutics.',
  },
  {
    name: 'Evan Meagher',
    role: 'Venture Partner',
    credential: 'Venture Partner: Millennia Capital, 10X Capital, Modi Ventures. Facilitated $540M+ in startup funding.',
  },
  {
    name: 'Jimmy Ku',
    role: 'Healthcare Ventures',
    credential: 'Ex-CSO, $250M NASDAQ biotech; multiple successful exits. Builds and funds early-stage healthcare ventures, Optio.',
  },
]

const PARTNERS = [
  {
    name: 'Vantage',
    type: 'Clinical Trial Partner',
    description: 'FDA-aligned trials in Kazakhstan at 20–30% of US cost. Government-backed site activation, ICH GCP compliance, and sovereign patient access across the CIS region.',
    stats: ['20–30% of US trial cost', '3–5 month setup timeline', 'ICH GCP / 21 CFR 312.120'],
    url: 'vantage-ct.com',
  },
  {
    name: 'Allos',
    type: 'Causal AI · Drug Formulation',
    description: 'Causal AI platform leveraging proprietary CMC data to optimize reformulation programs — cutting experiments by 60%, timelines by 40%, and saving up to $15M per program.',
    stats: ['60% fewer experiments', '40% faster timelines', '$6–15M saved per program'],
    url: 'allos.ai',
  },
  {
    name: 'Freyr Health',
    type: 'Global Health Data Platform',
    description: 'Unified Health Record platform consolidating patient data across 100+ countries — enabling trial recruitment, real-world evidence generation, and longitudinal patient monitoring at scale.',
    stats: ['122M–219M records by 2031', 'R&D, trials & healthcare BI', 'GDPR · HIPAA · HL7 FHIR'],
    url: 'freyrhealth.com',
  },
  {
    name: 'Merova Healthcare',
    type: 'GCC Healthcare Platform',
    description: 'First-of-its-kind integrated MedTech investment, manufacturing, and marketing platform in the GCC — enabling Zenith clients to access MENA markets through a single trusted relationship.',
    stats: ['$60B+ GCC healthcare market', 'Local manufacturing in UAE', 'MENA commercialization at scale'],
    url: 'merova-healthcare.com',
  },
]

const TESTIMONIALS = [
  {
    quote: 'Zenith redesigned our investor deck and refined our fundraising narrative, helping present a stronger investment story for our $25M capital raise.',
    context: 'Biotech — $25M raise',
  },
  {
    quote: 'Zenith improved our pricing strategy, financial planning, and profitability, creating a stronger foundation to scale following our $11M raise.',
    context: 'Digital Health — $11M raise',
  },
  {
    quote: 'Zenith strengthened our financial planning and optimized R&D tax credits, helping maximize non-dilutive funding to support our ~$5M growth journey.',
    context: 'Life Sciences — non-dilutive capital',
  },
  {
    quote: 'Zenith developed an acquisition evaluation framework that enabled faster M&A decisions and financial scenario modelling, supporting Apollo\'s continued growth following $45M+ raised.',
    context: 'MedTech — $45M+ raised',
  },
  {
    quote: 'Zenith helped us build an investor-ready operating model and growth scenarios that strengthened our Series A fundraising preparation.',
    context: 'HealthTech — Series A preparation',
  },
  {
    quote: 'Zenith delivered a multi-region financial model, valuation framework, and fundraising strategy that strengthened the company\'s $10M capital raise and investor positioning.',
    context: 'Medical Device — $10M raise',
  },
]

const OFFICES = [
  { city: 'San Francisco', role: 'BD Office' },
  { city: 'New York', role: 'BD Office' },
  { city: 'Boston', role: 'Client Office' },
  { city: 'London', role: 'CFO Office' },
  { city: 'UAE', role: 'Client Office' },
  { city: 'Hong Kong', role: 'Client Office' },
  { city: 'India', role: 'Operations' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">

      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="px-5 pt-24 pb-20 max-w-[720px] mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-[#888] mb-8">
          Life Sciences · Biotech · Digital Health · Medtech
        </div>
        <h1
          className="font-bold text-[#1a1a1a] leading-[0.93] mb-6"
          style={{ fontSize: 'clamp(40px, 7vw, 72px)', letterSpacing: '-0.04em' }}
        >
          Not advisors<br />on the sidelines.<br />
          <span className="text-[#888]">Operators accountable<br />for outcomes.</span>
        </h1>
        <p className="text-[#888] text-lg max-w-md mx-auto leading-relaxed mb-10">
          Zenith Global embeds directly into life sciences companies — finance, clinical, commercial, and strategic — all connected under one roof.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="https://zenithglobal.io"
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-6 rounded-2xl bg-[#1a1a1a] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#333] transition-colors"
          >
            Book a consultation <ArrowRight size={14} />
          </a>
          <a
            href="/capital"
            className="h-11 px-6 rounded-2xl border border-black/12 bg-white text-[#1a1a1a] text-sm font-semibold inline-flex items-center gap-2 hover:border-black/25 transition-colors"
          >
            Find investors
          </a>
        </div>
      </section>

      {/* ─── STATS ────────────────────────────────────────────── */}
      <section className="px-5 pb-20 max-w-[800px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map(s => (
            <div key={s.value} className="rounded-2xl border border-black/10 bg-white p-6 text-center">
              <div className="text-3xl font-bold text-[#1a1a1a] mb-1" style={{ letterSpacing: '-0.03em' }}>{s.value}</div>
              <div className="text-xs text-[#888] leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── MISSION ──────────────────────────────────────────── */}
      <section className="px-5 pb-20 max-w-[720px] mx-auto">
        <div className="rounded-2xl border border-black/10 bg-white p-10">
          <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-6">Our founding belief</p>
          <blockquote className="text-2xl font-semibold text-[#1a1a1a] leading-snug mb-6" style={{ letterSpacing: '-0.02em' }}>
            "The best fundraises don't start with investor outreach — they start with building a business that's already diligence-ready."
          </blockquote>
          <p className="text-[#888] leading-relaxed mb-4">
            Science breakthroughs stall when the operational foundation isn't built to support them. Most life sciences founders are world-class researchers facing CRO overcharges, messy cap tables, wrong hires, and capital strategies assembled in a panic six weeks before the pitch.
          </p>
          <p className="text-[#888] leading-relaxed">
            Zenith was built backwards from the exit. We embed at Seed and stay through NDA submission — finance first, clinical next, commercial when ready — so your science reaches its full value.
          </p>
          <div className="mt-8 pt-6 border-t border-black/6">
            <p className="text-sm font-semibold text-[#1a1a1a]">Lavine Hemlani</p>
            <p className="text-xs text-[#aaa]">CEO & Founder, Zenith Global</p>
          </div>
        </div>
      </section>

      {/* ─── THE ZENITH WAY ───────────────────────────────────── */}
      <section className="px-5 pb-20 max-w-[800px] mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-3">Our process</p>
          <h2 className="text-3xl font-bold text-[#1a1a1a]" style={{ letterSpacing: '-0.03em' }}>Proactive ops vs reactive ops</h2>
          <p className="text-[#888] mt-3 max-w-sm mx-auto">Most consulting is reactive. Zenith is built backwards from your exit.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* The Reactive Way */}
          <div className="rounded-2xl border border-black/10 bg-white p-7">
            <p className="text-xs font-semibold text-[#ccc] uppercase tracking-wider mb-5">The reactive way</p>
            <div className="space-y-4">
              {[
                'Problem surfaces mid-engagement after dollars are spent',
                'Hire reactively; generalist advisors patch holes with no unified strategy',
                'Financial model built when asked — not milestone-based, not clinical',
                'Data room assembled 8 weeks before close; investors find discrepancies',
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-xs font-bold text-[#ddd] mt-0.5 shrink-0">{i + 1}</span>
                  <p className="text-sm text-[#999] leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The Zenith Way */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-7">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-5">The Zenith way</p>
            <div className="space-y-4">
              {[
                'Start with a free audit — find the gaps before they cost you',
                'Activate the right capability milestone by milestone: finance first, clinical next',
                'Build the architecture backward from your exit — forecasts aligned to milestones and valuation targets',
                'Raise from a position of strength with a diligence-ready business and data room',
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-xs font-bold text-emerald-500 mt-0.5 shrink-0">{i + 1}</span>
                  <p className="text-sm text-[#444] leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── TEAM ─────────────────────────────────────────────── */}
      <section className="px-5 pb-20 max-w-[800px] mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-3">The team</p>
          <h2 className="text-3xl font-bold text-[#1a1a1a]" style={{ letterSpacing: '-0.03em' }}>Top 1% proven operators</h2>
          <p className="text-[#888] mt-3">Life sciences specialists with 25+ operators ready to deploy for every business need.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {TEAM.map(member => (
            <div key={member.name} className="rounded-2xl border border-black/10 bg-white p-6">
              <div className="mb-4">
                <p className="font-semibold text-[#1a1a1a] text-base">{member.name}</p>
                <p className="text-xs text-[#888] mt-0.5">{member.role}</p>
              </div>
              <ul className="space-y-1.5">
                {member.highlights.map((h, i) => (
                  <li key={i} className="text-xs text-[#777] leading-relaxed flex gap-2">
                    <span className="text-[#ccc] shrink-0 mt-0.5">—</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Advisors */}
        <div className="rounded-2xl border border-black/10 bg-white p-7">
          <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-6">Strategic advisors & board</p>
          <p className="text-xs text-[#999] mb-6">Advisors behind billions in capital raises, major exits, FDA pathways, and global healthcare expansion.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {ADVISORS.map(a => (
              <div key={a.name}>
                <p className="text-sm font-semibold text-[#1a1a1a]">{a.name}</p>
                <p className="text-[11px] text-emerald-600 mb-1.5">{a.role}</p>
                <p className="text-xs text-[#888] leading-relaxed">{a.credential}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Institutional backgrounds */}
        <div className="mt-4 rounded-2xl border border-black/10 bg-white px-7 py-5">
          <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-4">Institutional backgrounds</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {['Goldman Sachs', 'JP Morgan', 'Lazard', 'Morgan Stanley', 'BNP Paribas', 'HSBC', 'Standard Chartered', 'UBS'].map(firm => (
              <span key={firm} className="text-sm font-medium text-[#555]">{firm}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="px-5 pb-20 max-w-[800px] mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-3">Client outcomes</p>
          <h2 className="text-3xl font-bold text-[#1a1a1a]" style={{ letterSpacing: '-0.03em' }}>Trusted by high-growth founders</h2>
          <p className="text-[#888] mt-3">Helping science-led companies raise capital, improve financial performance, and scale confidently.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="rounded-2xl border border-black/10 bg-white p-6">
              <p className="text-sm text-[#444] leading-relaxed mb-4">"{t.quote}"</p>
              <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider">{t.context}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ECOSYSTEM PARTNERS ───────────────────────────────── */}
      <section className="px-5 pb-20 max-w-[800px] mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-3">Ecosystem partners</p>
          <h2 className="text-3xl font-bold text-[#1a1a1a]" style={{ letterSpacing: '-0.03em' }}>Specialist partners at every stage</h2>
          <p className="text-[#888] mt-3 max-w-sm mx-auto">Zenith clients access partners across clinical development, AI, and global health data.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {PARTNERS.map(p => (
            <div key={p.name} className="rounded-2xl border border-black/10 bg-white p-6">
              <div className="mb-3">
                <p className="font-semibold text-[#1a1a1a]">{p.name}</p>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">{p.type}</p>
              </div>
              <p className="text-xs text-[#777] leading-relaxed mb-4">{p.description}</p>
              <div className="flex flex-wrap gap-2">
                {p.stats.map(s => (
                  <span key={s} className="text-[11px] text-[#666] bg-[#f5f5f2] rounded-lg px-2.5 py-1">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── GLOBAL FOOTPRINT ─────────────────────────────────── */}
      <section className="px-5 pb-20 max-w-[800px] mx-auto">
        <div className="rounded-2xl border border-black/10 bg-white p-8">
          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-3">Global footprint</p>
            <h2 className="text-2xl font-bold text-[#1a1a1a]" style={{ letterSpacing: '-0.03em' }}>Serving founders across biotech hubs</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {OFFICES.map(o => (
              <div key={o.city} className="flex items-center gap-2 rounded-xl border border-black/8 bg-[#faf8f5] px-4 py-2.5">
                <MapPin size={12} className="text-[#aaa]" />
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">{o.city}</p>
                  <p className="text-[11px] text-[#aaa]">{o.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHO WE SERVE ─────────────────────────────────────── */}
      <section className="px-5 pb-20 max-w-[800px] mx-auto">
        <div className="rounded-2xl border border-black/10 bg-white p-8">
          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-3">Who we serve</p>
            <h2 className="text-2xl font-bold text-[#1a1a1a]" style={{ letterSpacing: '-0.03em' }}>Built for this profile</h2>
            <p className="text-[#888] text-sm mt-2 max-w-sm mx-auto">Zenith delivers the greatest impact when founders have breakthrough science, a defined growth path, and the ambition to build globally.</p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Funding stage', value: 'Seed to Pre-Series B. $3–30M raised in the last 24 months.' },
              { label: 'Domain', value: 'Biotech, biopharma, medtech, digital health, or life sciences platform.' },
              { label: 'Founder profile', value: 'Science-first brain — PhD, MD, or deep domain expertise. No full-time CFO or COO yet.' },
              { label: 'Geography', value: 'US, UK, EU, or GCC. Expanding into new markets and needing the infrastructure.' },
              { label: 'Runway', value: '18–30 months. Has capital to deploy but needs it to work harder.' },
              { label: 'Next milestone', value: 'IND filing, Series A, partnership, or regulatory submission defined.' },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-[#faf8f5] border border-black/6 p-4">
                <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-2">{item.label}</p>
                <p className="text-sm text-[#555] leading-relaxed">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────── */}
      <section className="px-5 pb-24 max-w-[560px] mx-auto text-center">
        <div className="rounded-2xl border border-black/10 bg-white p-10">
          <h2 className="text-2xl font-bold text-[#1a1a1a] mb-3" style={{ letterSpacing: '-0.03em' }}>
            Let's turn great science into a great company.
          </h2>
          <p className="text-[#888] text-sm leading-relaxed mb-8">
            Book a strategy session to understand how our integrated life sciences platform can support your next stage of growth.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <a
              href="https://zenithglobal.io"
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-6 rounded-2xl bg-[#1a1a1a] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#333] transition-colors"
            >
              Book a free consultation <ArrowRight size={14} />
            </a>
            <a
              href="/capital"
              className="h-11 px-6 rounded-2xl border border-black/12 bg-white text-[#1a1a1a] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:border-black/25 transition-colors"
            >
              Find investors
            </a>
          </div>
          <div className="border-t border-black/6 pt-6 space-y-1 text-xs text-[#aaa]">
            <p>lavine@zenith-grp.co</p>
            <p>+971 50 887 4608</p>
            <p>zenithglobal.io</p>
          </div>
        </div>
      </section>
    </div>
  )
}
