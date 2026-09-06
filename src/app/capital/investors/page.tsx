'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, Sparkles, Building2 } from 'lucide-react'

const STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth / Late Stage']

const AREAS = [
  'Oncology', 'Gene Therapy', 'Cell Therapy', 'Rare Disease', 'Neurology',
  'Immunology', 'Diagnostics', 'Medtech', 'Digital Health', 'Metabolic',
  'Infectious Disease', 'Cardiology', 'Dermatology', 'Ophthalmology', 'Platform / AI Bio',
]

const GEOGRAPHIES = ['United States', 'Europe', 'Israel', 'APAC', 'Global']

const CHECK_SIZES = ['<$1M', '$1M–$5M', '$5M–$15M', '$15M–$50M', '$50M+']

type Phase = 'form' | 'submitting' | 'success'

export default function InvestorsPage() {
  const [phase, setPhase] = useState<Phase>('form')
  const [form, setForm] = useState({
    firmName: '',
    contactName: '',
    email: '',
    title: '',
    stages: [] as string[],
    areas: [] as string[],
    geographies: [] as string[],
    checkSize: '',
    notes: '',
  })

  function toggle(field: 'stages' | 'areas' | 'geographies', value: string) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter(x => x !== value) : [...f[field], value],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('submitting')

    const subject = encodeURIComponent(`VC Mandate Opt-in: ${form.firmName}`)
    const body = encodeURIComponent(
`New investor mandate opt-in from ZenithOS

Firm: ${form.firmName}
Contact: ${form.contactName} (${form.title})
Email: ${form.email}

Investment Stages: ${form.stages.join(', ') || 'Not specified'}
Therapeutic Areas: ${form.areas.join(', ') || 'Not specified'}
Geographies: ${form.geographies.join(', ') || 'Not specified'}
Typical Check Size: ${form.checkSize || 'Not specified'}

Additional mandate notes:
${form.notes || 'None'}
`
    )

    window.location.href = `mailto:lavine@zenith-grp.co?subject=${subject}&body=${body}`

    setTimeout(() => setPhase('success'), 800)
  }

  const isValid = form.firmName.trim() && form.contactName.trim() && form.email.trim() && form.stages.length > 0 && form.areas.length > 0

  if (phase === 'success') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 mb-6">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#1a1a1a] mb-3" style={{ letterSpacing: '-0.03em' }}>
            You're on the list.
          </h2>
          <p className="text-[#888] text-sm leading-relaxed mb-8">
            We'll send you deal flow that matches your mandate — life sciences companies raising within your stage and thesis. Expect the first batch within a week.
          </p>
          <a
            href="/capital"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a1a1a] hover:text-[#555] transition-colors"
          >
            Browse the investor database <ArrowRight size={13} />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Hero */}
      <section className="px-5 pt-24 pb-14 max-w-[620px] mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 mb-8">
          <Sparkles size={11} />
          For investors &amp; VCs
        </div>

        <h1
          className="font-bold text-[#1a1a1a] leading-[0.93] mb-5"
          style={{ fontSize: 'clamp(44px, 8vw, 72px)', letterSpacing: '-0.04em' }}
        >
          Get deal flow<br />that fits your<br />thesis.
        </h1>

        <p className="text-[#888] text-lg mb-3 max-w-sm mx-auto leading-relaxed">
          Tell us your mandate. We'll send you life sciences companies raising that match — stage, check size, and therapeutic area.
        </p>

        <p className="text-[11px] text-[#bbb]">
          Free. No spam. Unsubscribe any time.
        </p>
      </section>

      {/* Form */}
      <section className="px-5 pb-24 max-w-[560px] mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Firm details */}
          <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
            <div className="px-5 pt-5 pb-1 border-b border-black/6">
              <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider">Your firm</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Firm name *</label>
                  <input
                    type="text"
                    value={form.firmName}
                    onChange={e => setForm(f => ({ ...f, firmName: e.target.value }))}
                    placeholder="Andreessen Horowitz"
                    className="w-full px-3 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#ccc] border border-black/12 rounded-xl outline-none focus:border-black/30 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Your name *</label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#ccc] border border-black/12 rounded-xl outline-none focus:border-black/30 transition-colors"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Work email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="demo-investor@example.com"
                    className="w-full px-3 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#ccc] border border-black/12 rounded-xl outline-none focus:border-black/30 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="General Partner"
                    className="w-full px-3 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#ccc] border border-black/12 rounded-xl outline-none focus:border-black/30 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Investment stages */}
          <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
            <div className="px-5 pt-5 pb-1 border-b border-black/6">
              <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider">Stages you invest in *</p>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                {STAGES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle('stages', s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      form.stages.includes(s)
                        ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                        : 'bg-white text-[#555] border-black/12 hover:border-black/25'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Therapeutic areas */}
          <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
            <div className="px-5 pt-5 pb-1 border-b border-black/6">
              <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider">Therapeutic areas *</p>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                {AREAS.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggle('areas', a)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      form.areas.includes(a)
                        ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                        : 'bg-white text-[#555] border-black/12 hover:border-black/25'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Check size + geography */}
          <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
            <div className="px-5 pt-5 pb-1 border-b border-black/6">
              <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider">Check size &amp; geography</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#888] mb-2">Typical check size</label>
                <div className="flex flex-wrap gap-2">
                  {CHECK_SIZES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, checkSize: f.checkSize === c ? '' : c }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        form.checkSize === c
                          ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                          : 'bg-white text-[#555] border-black/12 hover:border-black/25'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#888] mb-2">Geographies</label>
                <div className="flex flex-wrap gap-2">
                  {GEOGRAPHIES.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggle('geographies', g)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        form.geographies.includes(g)
                          ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                          : 'bg-white text-[#555] border-black/12 hover:border-black/25'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mandate notes */}
          <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
            <div className="px-5 pt-5 pb-1 border-b border-black/6">
              <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider">Anything else about your mandate?</p>
            </div>
            <div className="p-5">
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. We only back platform companies, no single-asset plays. Prefer repeat founders. Must have IP issued or filed."
                rows={3}
                className="w-full text-sm text-[#1a1a1a] placeholder:text-[#ccc] outline-none resize-none bg-transparent leading-relaxed"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || phase === 'submitting'}
            className="w-full h-12 rounded-2xl bg-[#1a1a1a] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-25 hover:bg-[#333] transition-colors"
          >
            {phase === 'submitting' ? 'Sending…' : <>Get matched deal flow <ArrowRight size={14} /></>}
          </button>

          <p className="text-center text-[11px] text-[#ccc]">
            We review every submission. You'll get a confirmation from Lavine directly.
          </p>
        </form>
      </section>
    </div>
  )
}
