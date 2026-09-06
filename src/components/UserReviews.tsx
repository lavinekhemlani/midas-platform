'use client'

import { Quote } from 'lucide-react'
import { Fragment } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useTheme } from '@/hooks/useTheme'

const reviews = [
  {
    name: 'Ursus Negenborn, Rune Kippervik',
    role: 'Founder',
    company: 'NANOBAG',
    logo: '/testimonials/image 29.png',
    pfp: '/testimonials/image 30.png',
    text: "I was dreading the financial prep for our exit. Midas organized years of scattered data and surfaced insights I didn't even know mattered to buyers. Made the whole process way less stressful.",
  },
  {
    name: 'Marisa Peer',
    role: 'Founder',
    company: 'Inner Belief',
    logo: '/testimonials/image 31.png',
    logoSize: 140,
    pfp: '/testimonials/image 32.png',
    text: 'We were doing acquisition after acquisition. Midas helped us see the real impact of each deal on our business before signing.',
  },
  {
    name: 'Astrid Montalta',
    role: 'Founder',
    company: 'NOOD',
    logo: '/testimonials/image 33.png',
    pfp: '/testimonials/image 34.png',
    text: 'I used to stare at spreadsheets for hours trying to figure out our unit economics. Midas just... showed me. Clear answers on pricing, marketing ROI, all of it.',
  },
  {
    name: 'Ilya Fedorovich',
    role: 'Founder',
    company: 'Xeela',
    logo: '/testimonials/image 35.png',
    pfp: '/testimonials/image 36.png',
    text: "Prepping for investor meetings used to take days of spreadsheet work. Now I can answer 'what if' questions on the spot with actual data.",
  },
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
    name: 'Sean Conaty',
    role: 'Founder',
    company: 'HealthStay.io',
    logo: '/testimonials/image 41.png',
    pfp: '/testimonials/image 42.png',
    text: 'Pricing our healthcare software felt impossible. Too high kills deals, too low kills margins. Midas let me test scenarios until we found what actually worked.',
  },
]

interface ReviewCardProps {
  name: string
  role: string
  company: string
  logo: string
  logoSize?: number
  pfp: string
  text: string
}

const ReviewCard = ({ name, role, company, logo, logoSize, pfp, text }: ReviewCardProps) => {
  const { theme } = useTheme()
  const size = logoSize || 100

  return (
    <Card
      className="border hover:shadow-md transition-all duration-200 backdrop-filter backdrop-blur-[20px] h-[280px] sm:h-[320px] md:h-[360px]"
      style={{
        backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.05)' : '#13215B33',
        borderColor: theme === 'light' ? 'rgb(148, 163, 184)' : 'rgba(146, 64, 14, 0.4)',
      }}
    >
      <CardContent className="pt-3 px-4 pb-4 sm:pt-4 sm:px-6 sm:pb-6 md:px-8 md:pb-8 h-full flex flex-col">
        {/* Header with logo and quote */}
        <div className="flex justify-between items-center mb-2 sm:mb-3 md:mb-4">
          <img
            src={logo}
            alt={`${company} logo`}
            className="object-contain"
            style={{ width: size, height: 50 }}
          />
          <Quote className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" style={{ color: '#AFBFFF' }} />
        </div>

        {/* Review text with ellipsis */}
        <p
          className="text-[14px] sm:text-[16px] md:text-[18px] font-light leading-[120%] tracking-[-0.03em] theme-text-secondary mb-4 sm:mb-6 md:mb-8 line-clamp-5 sm:line-clamp-6"
          style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
        >
          "{text}"
        </p>

        {/* Profile section at absolute bottom */}
        <div className="flex flex-row items-center gap-2 sm:gap-3 mt-auto">
          <img
            src={pfp}
            alt={name}
            className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full object-cover"
          />
          <div className="flex flex-col gap-1 sm:gap-2">
            <div
              className="text-[13px] sm:text-[14px] md:text-[16px] font-semibold leading-[100%] tracking-[-0.03em] theme-text-primary"
              style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 600 }}
            >
              {name}
            </div>
            <p
              className="text-[11px] sm:text-[12px] md:text-[14px] font-light leading-[100%] tracking-[-0.03em] theme-text-secondary"
              style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
            >
              {role} at {company}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function UserReviews() {
  return (
    <div className="relative overflow-hidden mb-12">
      {/* First Row - Left Direction */}
      <div className="relative w-full max-w-full overflow-visible mask-fade-edges-horizontal group mb-4 sm:mb-6 md:mb-8 h-[280px] sm:h-[320px] md:h-[360px]">
        <div className="reviews-carousel flex gap-4 sm:gap-6 md:gap-8 w-max animate-marquee-left will-change-transform">
          {[0, 1].map((loop) => (
            <Fragment key={`first-loop-${loop}`}>
              {reviews.slice(0, 3).map((review, idx) => (
                <div
                  key={`first-${review.name}-${loop}-${idx}`}
                  className="flex-shrink-0 w-[280px] sm:w-[360px] md:w-[480px]"
                >
                  <ReviewCard {...review} />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Second Row - Right Direction */}
      <div className="relative w-full max-w-full overflow-visible mask-fade-edges-horizontal group h-[280px] sm:h-[320px] md:h-[360px]">
        <div className="reviews-carousel flex gap-4 sm:gap-6 md:gap-8 w-max animate-marquee-right will-change-transform">
          {[0, 1].map((loop) => (
            <Fragment key={`second-loop-${loop}`}>
              {reviews.slice(3, 6).map((review, idx) => (
                <div
                  key={`second-${review.name}-${loop}-${idx}`}
                  className="flex-shrink-0 w-[280px] sm:w-[360px] md:w-[480px]"
                >
                  <ReviewCard {...review} />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee-left {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @keyframes marquee-right {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-marquee-left {
          animation: marquee-left 40s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 40s linear infinite;
        }
        .mask-fade-edges-horizontal {
          overflow-x: hidden;
          overflow-y: visible;
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0%,
            rgba(0, 0, 0, 0.55) 6%,
            rgba(0, 0, 0, 1) 14%,
            rgba(0, 0, 0, 1) 86%,
            rgba(0, 0, 0, 0.55) 94%,
            transparent 100%
          );
          mask-image: linear-gradient(
            to right,
            transparent 0%,
            rgba(0, 0, 0, 0.55) 6%,
            rgba(0, 0, 0, 1) 14%,
            rgba(0, 0, 0, 1) 86%,
            rgba(0, 0, 0, 0.55) 94%,
            transparent 100%
          );
        }
      `}</style>
    </div>
  )
}
