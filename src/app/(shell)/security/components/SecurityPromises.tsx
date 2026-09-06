'use client'

import { EB_Garamond, DM_Sans } from 'next/font/google'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-sans',
})

const promises = [
  {
    prefix: 'We',
    highlight: 'never',
    rest: 'sell your data',
    desc: 'Your data is not our product. Subscriptions fund us.',
  },
  {
    prefix: 'We',
    highlight: 'never',
    rest: 'train AI on your data',
    desc: 'Your financials stay yours—never used to train models.',
  },
  {
    prefix: 'We',
    highlight: 'never',
    rest: 'see your credentials',
    desc: 'OAuth tokens only. We never see your login details.',
  },
  {
    prefix: 'We',
    highlight: 'never',
    rest: 'share without asking',
    desc: 'No third parties without your explicit consent.',
  },
]

export default function SecurityPromises() {
  return (
    <section className="relative py-24 2xl:py-32 px-4 sm:px-6 lg:px-8 2xl:px-12">
      <div className="max-w-4xl 2xl:max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className={`text-5xl sm:text-5xl lg:text-6xl theme-text-primary mb-4 font-light flex items-center justify-center gap-3 sm:gap-4 flex-wrap ${ebGaramond.className}`}
          >
            <span>What We</span>
            <span className="basis-full h-0 sm:hidden" />
            {/* NEVER stamp */}
            <span className="inline-flex items-center justify-center px-4 py-1 border-2 border-red-500 rounded-sm">
              <span className="text-red-500 font-bold text-xl sm:text-2xl lg:text-3xl 2xl:text-4xl tracking-[0.12em] uppercase leading-none">
                NEVER
              </span>
            </span>
            <span>Do</span>
          </h2>
          <p
            className="text-lg 2xl:text-xl theme-text-secondary max-w-lg 2xl:max-w-xl mx-auto"
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 400 }}
          >
            Clear commitments. No exceptions. No asterisks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 2xl:gap-6">
          {promises.map((item, i) => (
            <div
              key={i}
              className="relative p-5 2xl:p-6 rounded-2xl border border-red-500/20 theme-light:bg-slate-100/80 theme-light:border-red-500/30 theme-dark:bg-cyan-950/20"
            >
              <div>
                <span
                  className={`text-base font-medium theme-text-primary block mb-1 ${dmSans.className}`}
                >
                  {item.prefix} <span className="text-red-500">{item.highlight}</span> {item.rest}
                </span>
                <p className={`text-sm theme-text-secondary leading-relaxed ${dmSans.className}`}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
