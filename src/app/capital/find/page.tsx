'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, ArrowRight, CheckCircle2 } from 'lucide-react'

const STARTERS = [
  { label: 'Series A — oncology platform', full: "I'm raising a $15M Series A for an oncology platform. Who are the right investors to target?" },
  { label: 'Seed — diagnostics startup', full: "We're raising a $4M Seed for a diagnostics company. Which investors focus on early-stage diagnostics?" },
  { label: 'Gene therapy Series B', full: 'Looking for investors who lead gene therapy Series B rounds in the $20–30M range.' },
  { label: 'Rare disease, non-dilutive', full: 'What non-dilutive funding options exist for a rare disease company pre-Series A?' },
]

const STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Non-dilutive / Grants']

type Phase = 'idle' | 'thinking' | 'gate' | 'success'

export default function FindPage() {
  const [input, setInput] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [form, setForm] = useState({ name: '', email: '', company: '', stage: '', raise: '', area: '', deck: '' })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (phase === 'idle') textareaRef.current?.focus()
  }, [phase])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || phase !== 'idle') return
    setUserMessage(trimmed)
    setInput('')
    setPhase('thinking')
    setTimeout(() => setPhase('gate'), 1800)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const subject = encodeURIComponent(`ZenithOS Lead: ${form.name} at ${form.company}`)
    const body = encodeURIComponent(
`New intro request from ZenithOS /capital/find

Name: ${form.name}
Email: ${form.email}
Company: ${form.company}
Stage: ${form.stage}
Raise amount: $${form.raise}M
Therapeutic area: ${form.area}
Deck: ${form.deck || 'Not provided'}

Their question:
"${userMessage}"

---
Submitted via ZenithOS capital/find`
    )
    window.location.href = `mailto:lavine@zenith-grp.co?subject=${subject}&body=${body}`
    setPhase('success')
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center px-5 pb-40">

        {/* IDLE: intro + starters */}
        {phase === 'idle' && (
          <div className="w-full max-w-2xl pt-14 sm:pt-20">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Free for life sciences founders
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-3 tracking-tight">
                Find your investors.
              </h1>
              <p className="text-sm text-[#888] max-w-sm mx-auto leading-relaxed">
                Describe your raise. We match you to the right life sciences investors — then make the intro.
              </p>
            </div>

            {/* Starter chips */}
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.full)}
                  className="text-xs border border-black/10 bg-white rounded-full px-4 py-2 hover:border-black/25 text-[#555] transition-colors hover:bg-white shadow-sm"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* THINKING + GATE: message + form */}
        {(phase === 'thinking' || phase === 'gate') && (
          <div className="w-full max-w-2xl pt-14 space-y-5">

            {/* User bubble */}
            <div className="flex justify-end">
              <div className="bg-[#1a1a1a] text-white text-sm rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] leading-relaxed shadow-sm">
                {userMessage}
              </div>
            </div>

            {phase === 'thinking' && (
              <div className="flex items-center gap-2.5 pl-1">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-[#d0ccc7] inline-block"
                      style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-[#aaa]">Reviewing your raise...</span>
              </div>
            )}

            {phase === 'gate' && (
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-[#1a1a1a] mb-1">Sign up to see your investor matches</p>
                <p className="text-xs text-[#888] mb-5 leading-relaxed">
                  Lavine reviews every submission personally and returns a shortlist within 24 hours.
                </p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Your name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="border border-black/12 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-[#ccc] focus:outline-none focus:border-black/30 transition-colors"
                    />
                    <input
                      required
                      type="email"
                      placeholder="Work email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="border border-black/12 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-[#ccc] focus:outline-none focus:border-black/30 transition-colors"
                    />
                    <input
                      required
                      placeholder="Company name"
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      className="border border-black/12 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-[#ccc] focus:outline-none focus:border-black/30 transition-colors"
                    />
                    <select
                      required
                      value={form.stage}
                      onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                      className="border border-black/12 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-black/30 bg-white text-[#555] transition-colors"
                    >
                      <option value="">Stage</option>
                      {STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <input
                      placeholder="Raise amount (e.g. 12)"
                      value={form.raise}
                      onChange={(e) => setForm((f) => ({ ...f, raise: e.target.value }))}
                      className="border border-black/12 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-[#ccc] focus:outline-none focus:border-black/30 transition-colors"
                    />
                    <input
                      placeholder="Therapeutic area"
                      value={form.area}
                      onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                      className="border border-black/12 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-[#ccc] focus:outline-none focus:border-black/30 transition-colors"
                    />
                  </div>
                  <input
                    placeholder="Deck link — Google Drive or Dropbox (optional)"
                    value={form.deck}
                    onChange={(e) => setForm((f) => ({ ...f, deck: e.target.value }))}
                    className="border border-black/12 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-[#ccc] focus:outline-none focus:border-black/30 transition-colors"
                  />
                  <button
                    type="submit"
                    className="mt-1 w-full rounded-xl bg-[#1a1a1a] text-white text-sm font-semibold py-3 hover:bg-[#333] transition-colors flex items-center justify-center gap-2"
                  >
                    Get my investor matches <ArrowRight size={14} />
                  </button>
                  <p className="text-[10px] text-[#ccc] text-center leading-relaxed">
                    Your info goes directly to Lavine. No spam, no third-party sharing.
                  </p>
                </form>
              </div>
            )}
          </div>
        )}

        {/* SUCCESS */}
        {phase === 'success' && (
          <div className="w-full max-w-sm text-center pt-24">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-[#1a1a1a] mb-2">You're in.</h2>
            <p className="text-sm text-[#555] leading-relaxed mb-8">
              Lavine reviews every submission personally. You'll hear back within 24 hours with a shortlist of investors matched to your raise.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/capital"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#1a1a1a] rounded-xl px-5 py-2.5 hover:bg-[#333] transition-colors"
              >
                Browse investors now
              </a>
              <a
                href="/capital/intros"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#555] border border-black/15 rounded-xl px-5 py-2.5 hover:border-black/30 transition-colors"
              >
                How intros work
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── FLOATING INPUT (idle only) ───────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-8 bg-gradient-to-t from-[#faf8f5] via-[#faf8f5]/90 to-transparent pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            <div className="flex items-end gap-3 bg-white border border-black/15 rounded-2xl shadow-md px-4 py-3">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Describe your raise — stage, area, amount..."
                className="flex-1 resize-none text-sm text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none bg-transparent leading-relaxed"
                style={{ maxHeight: 120 }}
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0 disabled:opacity-25 hover:bg-[#333] transition-all"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
            <p className="text-[10px] text-[#ccc] text-center mt-2">
              ZenithOS · Life Sciences Investor Network · lavine@zenith-grp.co
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
