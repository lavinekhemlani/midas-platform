'use client'

import { useTheme } from '@/hooks/useTheme'
import { Quote } from 'lucide-react'

const reviews = [
  {
    name: 'Patrick Deloy',
    role: 'Founder',
    company: 'Zupe',
    logo: '/testimonials/image 37.png',
    pfp: '/testimonials/image 38.png',
    text: 'I was building pricing models in Excel that broke every time we changed something. Midas showed me instantly how pricing affects our runway and growth. Made our fundraising story so much clearer.',
  },
  {
    name: 'Christopher Condron',
    role: 'Founder',
    company: 'PowerModels',
    logo: '/testimonials/image 45.png',
    pfp: '/testimonials/image 46.png',
    text: 'We were three months from running out of money. Midas helped us cut the right costs and extend our runway by over six months—seconds after integrating our books.',
  },
  {
    name: 'Kevin Cho',
    role: 'Founder',
    company: 'Peeba',
    logo: '/testimonials/image 43.png',
    pfp: '/testimonials/image 44.png',
    text: 'I kept second-guessing our projections before investor meetings. Midas gave me confidence our numbers actually told the right story. Made a huge difference with top-tier VCs.',
  },
  {
    name: 'Leon Fischer-Brocks, Imanuel H. Kaiser',
    role: 'Founder',
    company: 'Bloxley',
    logo: '/testimonials/image 47.png',
    pfp: '/testimonials/image 48.png',
    text: 'First-time founder, zero finance background. Midas helped me build professional forecasts that impressed investors. Got our seed round done faster than expected.',
  },
  {
    name: 'Brandon Weaver',
    role: 'Founder',
    company: 'Navigate',
    logo: '/testimonials/image 39.png',
    pfp: '/testimonials/image 40.png',
    text: "We knew we were burning too much, but couldn't pinpoint where. Midas showed us exactly which expenses to cut without hurting the business. Saved us over six figures in weeks.",
  },
  {
    name: 'Henri Schmidt',
    role: 'Founder',
    company: 'VisionBody',
    logo: '/testimonials/visionbody.png',
    pfp: '/testimonials/henri_vb.jpeg',
    text: 'Midas transformed how we manage our finances. The insights are incredible, and the time saved is invaluable. It\u2019s like having a full-time CFO at a fraction of the cost.',
  },
]

interface TestimonialCardProps {
  name: string
  role: string
  company: string
  logo: string
  logoSize?: number
  pfp: string
  text: string
}

const TestimonialCard = ({
  name,
  role,
  company,
  logo,
  logoSize,
  pfp,
  text,
}: TestimonialCardProps) => {
  const { theme } = useTheme()
  const accent = theme === 'light' ? '#CF6900' : '#f59e0b'

  return (
    <div
      className="relative p-6 md:p-8 flex flex-col justify-between h-full min-h-[280px] rounded-xl"
      style={{
        backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a',
        borderColor: theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-20 rounded-full"
        style={{ background: accent, opacity: 0.5 }}
      />

      {/* Header with logo and quote icon */}
      <div className="mb-5 flex justify-between items-center">
        <img
          src={logo}
          alt={`${company} logo`}
          className="h-6 md:h-7 w-auto object-contain"
          style={{
            maxWidth: logoSize || 100,
            opacity: 1,
          }}
        />
        <Quote className="w-5 h-5" strokeWidth={1.5} style={{ color: accent, opacity: 0.4 }} />
      </div>

      {/* Quote text */}
      <p
        className="text-sm md:text-[15px] leading-[1.7] mb-6 flex-grow"
        style={{
          fontFamily: 'var(--font-dm-sans)',
          fontWeight: 400,
          color: theme === 'light' ? '#555555' : '#d4d4d4',
        }}
      >
        &ldquo;{text}&rdquo;
      </p>

      {/* Profile section */}
      <div
        className="flex items-center gap-3 mt-auto pt-5"
        style={{
          borderTop: `1px solid ${theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)'}`,
        }}
      >
        <img
          src={pfp}
          alt={name}
          className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex flex-col min-w-0">
          <span
            className="text-sm font-medium theme-text-primary truncate"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            {name}
          </span>
          <span
            className="text-xs theme-text-secondary"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            {role}, {company}
          </span>
        </div>
      </div>
    </div>
  )
}

export function TestimonialsGrid() {
  const { theme } = useTheme()

  return (
    <section className="w-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
            <span
              className="text-xs font-semibold tracking-[0.2em] uppercase"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: theme === 'light' ? '#CF6900' : '#f59e0b',
              }}
            >
              Testimonials
            </span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>
          <h2
            className="text-[48px] sm:text-[60px] font-light leading-[1.1] tracking-[-0.02em] mb-4 theme-text-primary"
            style={{ fontFamily: 'var(--font-eb-garamond)' }}
          >
            From Founders Who{' '}
            <span
              className="italic bg-clip-text text-transparent pl-[0.12em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #f59e0b, #d97706)',
              }}
            >
              Use Midas
            </span>
          </h2>
          <p
            className="text-lg 2xl:text-xl theme-text-secondary"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            See what founders are saying about their experience with Midas
          </p>
        </div>

        {/* Mobile: Infinite auto-scroll marquee */}
        <div
          className="md:hidden relative w-full overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
          }}
        >
          <div className="flex gap-4 animate-testimonial-marquee">
            {[...reviews, ...reviews].map((review, idx) => (
              <div key={`marquee-${idx}`} className="flex-shrink-0 w-[80vw]">
                <TestimonialCard {...review} />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: Grid layout */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {reviews.map((review, idx) => (
            <TestimonialCard key={`testimonial-${idx}`} {...review} />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes testimonial-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-6 * 80vw - 6 * 1rem));
          }
        }
        .animate-testimonial-marquee {
          animation: testimonial-marquee 30s linear infinite;
        }
      `}</style>
    </section>
  )
}
