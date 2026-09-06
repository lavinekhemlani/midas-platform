'use client'

import { useTheme } from '@/hooks/useTheme'
import {
  ShoppingCart,
  ArrowRight,
  LineChart,
  TrendingUp,
  FileText,
  Users,
  Package,
  BarChart3,
  DollarSign,
  Building,
  Briefcase,
  ChevronRight,
  LayoutDashboard,
  Zap,
  Presentation,
  MessageSquare,
  GitMerge,
  PieChart,
  Rocket,
  Newspaper,
  Gauge,
  Grid3x3,
  Coins,
  Telescope,
  Eye,
  Sprout,
  ClipboardCheck,
  BellRing,
  Target,
  Wallet,
  Receipt,
  Store,
  type LucideIcon,
} from 'lucide-react'
import { DM_Sans, STIX_Two_Text, EB_Garamond } from 'next/font/google'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-stix-two-text',
})

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

// Refined solution diagram component with varied colors
function SolutionDiagram({
  icon: Icon,
  type,
  theme,
}: {
  icon: LucideIcon
  type: string
  theme: string
}) {
  const dark = theme === 'dark'

  if (type === 'analytics' || type === 'chart') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div
          className={cn(
            'relative w-20 h-11 rounded-lg border border-[var(--theme-card-border)] overflow-hidden',
            dark ? 'bg-[#2a2a2a]' : 'bg-[var(--theme-bg)]/50'
          )}
        >
          <svg className="w-full h-full" viewBox="0 0 80 44" fill="none">
            <path
              d="M0 36 L16 28 L32 32 L48 18 L64 22 L80 14"
              stroke={dark ? 'rgba(110, 231, 183, 0.95)' : 'rgba(5, 150, 105, 0.85)'}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M0 40 L16 34 L32 38 L48 26 L64 30 L80 22"
              stroke={dark ? 'rgba(110, 231, 183, 0.55)' : 'rgba(5, 150, 105, 0.4)'}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute top-1 right-1.5">
            <Icon
              className={cn('w-2.5 h-2.5', dark ? 'text-emerald-300' : 'text-emerald-600')}
            />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'sync' || type === 'realtime') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div
          className={cn(
            'relative w-11 h-11 rounded-full border border-dashed animate-[spin_12s_linear_infinite]',
            dark ? 'border-violet-300/60' : 'border-violet-600/50'
          )}
        >
          <div
            className={cn(
              'absolute inset-1.5 rounded-full border flex items-center justify-center',
              dark ? 'border-violet-300/70 bg-[#2a2a2a]' : 'border-violet-600/60 bg-[var(--theme-bg)]/50'
            )}
          >
            <Icon className={cn('w-4 h-4', dark ? 'text-violet-300' : 'text-violet-600')} />
          </div>
          <div
            className={cn(
              'absolute w-2 h-2 rounded-full shadow-lg',
              dark
                ? 'bg-cyan-300 shadow-cyan-300/70'
                : 'bg-cyan-600 shadow-cyan-600/60'
            )}
            style={{ top: '-4px', left: '50%', transform: 'translateX(-50%)' }}
          />
        </div>
      </div>
    )
  }

  if (type === 'document' || type === 'report') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div
          className={cn(
            'relative w-11 h-14 rounded border border-[var(--theme-card-border)] shadow-sm',
            dark ? 'bg-[#2a2a2a]' : 'bg-[var(--theme-bg)]/50'
          )}
        >
          <div className="absolute top-2.5 left-2 right-2 space-y-1.5">
            <div
              className={cn(
                'h-1 w-full rounded-full',
                dark ? 'bg-blue-300/75' : 'bg-blue-600/60'
              )}
            />
            <div
              className={cn(
                'h-1 w-3/4 rounded-full',
                dark ? 'bg-blue-300/55' : 'bg-blue-600/40'
              )}
            />
            <div
              className={cn(
                'h-1 w-full rounded-full',
                dark ? 'bg-blue-300/55' : 'bg-blue-600/40'
              )}
            />
            <div
              className={cn(
                'h-1 w-1/2 rounded-full',
                dark ? 'bg-blue-300/45' : 'bg-blue-600/30'
              )}
            />
          </div>
          <div className="absolute bottom-1.5 right-1.5">
            <Icon className={cn('w-2.5 h-2.5', dark ? 'text-blue-300' : 'text-blue-600')} />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'users' || type === 'collaboration') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div className="flex -space-x-2">
          <div
            className={cn(
              'w-8 h-8 rounded-full border-2 border-[var(--theme-bg)] flex items-center justify-center ring-1',
              dark
                ? 'bg-amber-400/45 ring-amber-300/60'
                : 'bg-amber-500/35 ring-amber-500/50'
            )}
          >
            <span
              className={cn(
                'text-[10px] font-medium',
                dark ? 'text-amber-200' : 'text-amber-700'
              )}
            >
              A
            </span>
          </div>
          <div
            className={cn(
              'w-8 h-8 rounded-full border-2 border-[var(--theme-bg)] flex items-center justify-center ring-1',
              dark
                ? 'bg-rose-400/45 ring-rose-300/60'
                : 'bg-rose-500/35 ring-rose-500/50'
            )}
          >
            <span
              className={cn(
                'text-[10px] font-medium',
                dark ? 'text-rose-200' : 'text-rose-700'
              )}
            >
              B
            </span>
          </div>
          <div
            className={cn(
              'w-8 h-8 rounded-full border-2 border-[var(--theme-bg)] flex items-center justify-center ring-1',
              dark
                ? 'bg-indigo-400/45 ring-indigo-300/60'
                : 'bg-indigo-500/35 ring-indigo-500/50'
            )}
          >
            <Icon
              className={cn('w-3 h-3', dark ? 'text-indigo-300' : 'text-indigo-600')}
            />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'money' || type === 'cashflow') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div className="flex items-end gap-1">
          <div
            className={cn(
              'w-3 h-6 rounded-t bg-gradient-to-t',
              dark
                ? 'from-emerald-300/80 to-emerald-300/45'
                : 'from-emerald-600/65 to-emerald-600/35'
            )}
          />
          <div
            className={cn(
              'w-3 h-9 rounded-t bg-gradient-to-t',
              dark
                ? 'from-amber-300/85 to-amber-300/50'
                : 'from-amber-500/75 to-amber-500/40'
            )}
          />
          <div
            className={cn(
              'w-3 h-5 rounded-t bg-gradient-to-t',
              dark
                ? 'from-rose-300/80 to-rose-300/45'
                : 'from-rose-500/65 to-rose-500/35'
            )}
          />
          <div
            className={cn(
              'w-3 h-7 rounded-t bg-gradient-to-t',
              dark
                ? 'from-blue-300/80 to-blue-300/45'
                : 'from-blue-500/65 to-blue-500/35'
            )}
          />
        </div>
        <div className="absolute top-0 right-6">
          <Icon
            className={cn('w-3.5 h-3.5', dark ? 'text-emerald-300' : 'text-emerald-600')}
          />
        </div>
      </div>
    )
  }

  if (type === 'building' || type === 'enterprise') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div className="flex items-end gap-1">
          <div
            className={cn(
              'w-4 h-7 rounded-t-sm border border-b-0',
              dark
                ? 'bg-slate-300/45 border-slate-300/60'
                : 'bg-slate-400/40 border-slate-400/55'
            )}
          />
          <div
            className={cn(
              'w-5 h-11 rounded-t-sm border border-b-0',
              dark
                ? 'bg-slate-300/55 border-slate-300/70'
                : 'bg-slate-400/50 border-slate-400/65'
            )}
          />
          <div
            className={cn(
              'w-4 h-5 rounded-t-sm border border-b-0',
              dark
                ? 'bg-slate-300/45 border-slate-300/60'
                : 'bg-slate-400/40 border-slate-400/55'
            )}
          />
        </div>
        <div className="absolute top-0 right-6">
          <Icon
            className={cn('w-3.5 h-3.5', dark ? 'text-slate-300' : 'text-slate-500')}
          />
        </div>
      </div>
    )
  }

  if (type === 'dashboard') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div
          className={cn(
            'relative w-16 h-12 rounded-lg border border-[var(--theme-card-border)] overflow-hidden p-1.5',
            dark ? 'bg-[#2a2a2a]' : 'bg-[var(--theme-bg)]/50'
          )}
        >
          <div className="grid grid-cols-2 gap-1 h-full">
            <div
              className={cn(
                'rounded-sm border',
                dark
                  ? 'bg-cyan-300/50 border-cyan-300/45'
                  : 'bg-cyan-500/40 border-cyan-500/35'
              )}
            />
            <div
              className={cn(
                'rounded-sm border flex items-center justify-center',
                dark
                  ? 'bg-violet-300/45 border-violet-300/40'
                  : 'bg-violet-500/35 border-violet-500/30'
              )}
            >
              <Icon
                className={cn('w-2.5 h-2.5', dark ? 'text-violet-300' : 'text-violet-600')}
              />
            </div>
            <div
              className={cn(
                'col-span-2 rounded-sm border flex items-center justify-center gap-1',
                dark
                  ? 'bg-emerald-300/35 border-emerald-300/35'
                  : 'bg-emerald-500/25 border-emerald-500/25'
              )}
            >
              <div
                className={cn(
                  'w-4 h-1 rounded-full',
                  dark ? 'bg-emerald-300/70' : 'bg-emerald-500/60'
                )}
              />
              <div
                className={cn(
                  'w-2.5 h-1 rounded-full',
                  dark ? 'bg-emerald-300/50' : 'bg-emerald-500/40'
                )}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'target') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div className="relative w-12 h-12">
          <div
            className={cn(
              'absolute inset-0 rounded-full border',
              dark ? 'border-rose-300/55' : 'border-rose-500/40'
            )}
          />
          <div
            className={cn(
              'absolute inset-1.5 rounded-full border',
              dark ? 'border-rose-300/65' : 'border-rose-500/50'
            )}
          />
          <div
            className={cn(
              'absolute inset-3 rounded-full border',
              dark
                ? 'border-amber-300/75 bg-amber-300/25'
                : 'border-amber-500/60 bg-amber-500/20'
            )}
          />
          <div
            className={cn(
              'absolute inset-[14px] rounded-full flex items-center justify-center',
              dark ? 'bg-amber-300/80' : 'bg-amber-500/70'
            )}
          >
            <Icon
              className={cn('w-2.5 h-2.5', dark ? 'text-amber-100' : 'text-amber-800')}
            />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'pie') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <svg className="w-12 h-12" viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={dark ? 'rgba(165, 180, 252, 0.3)' : 'rgba(79, 70, 229, 0.2)'}
            strokeWidth="8"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={dark ? 'rgba(165, 180, 252, 0.9)' : 'rgba(79, 70, 229, 0.75)'}
            strokeWidth="8"
            strokeDasharray="50 76"
            strokeDashoffset="0"
            strokeLinecap="round"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={dark ? 'rgba(253, 224, 71, 0.85)' : 'rgba(217, 119, 6, 0.75)'}
            strokeWidth="8"
            strokeDasharray="30 96"
            strokeDashoffset="-50"
            strokeLinecap="round"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={dark ? 'rgba(110, 231, 183, 0.85)' : 'rgba(5, 150, 105, 0.65)'}
            strokeWidth="8"
            strokeDasharray="20 106"
            strokeDashoffset="-80"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute">
          <Icon className={cn('w-3 h-3', dark ? 'text-indigo-300' : 'text-indigo-600')} />
        </div>
      </div>
    )
  }

  if (type === 'gauge') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <svg className="w-14 h-10" viewBox="0 0 56 36">
          <path
            d="M 8 32 A 20 20 0 0 1 48 32"
            fill="none"
            stroke={dark ? 'rgba(203, 213, 225, 0.4)' : 'rgba(148, 163, 184, 0.35)'}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M 8 32 A 20 20 0 0 1 42 16"
            fill="none"
            stroke={dark ? 'rgba(110, 231, 183, 0.95)' : 'rgba(5, 150, 105, 0.8)'}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="28" cy="32" r="3" fill={dark ? 'rgba(110, 231, 183, 1)' : 'rgba(5, 150, 105, 0.9)'} />
          <line
            x1="28"
            y1="32"
            x2="40"
            y2="18"
            stroke={dark ? 'rgba(110, 231, 183, 0.95)' : 'rgba(5, 150, 105, 0.8)'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute top-0.5 right-4">
          <Icon className={cn('w-2.5 h-2.5', dark ? 'text-emerald-300' : 'text-emerald-600')} />
        </div>
      </div>
    )
  }

  if (type === 'merge') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <svg className="w-14 h-12" viewBox="0 0 56 48" fill="none">
          <path
            d="M 8 8 Q 28 8, 36 24"
            stroke={dark ? 'rgba(196, 181, 253, 0.8)' : 'rgba(109, 40, 217, 0.6)'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M 8 24 L 36 24"
            stroke={dark ? 'rgba(196, 181, 253, 0.9)' : 'rgba(109, 40, 217, 0.7)'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M 8 40 Q 28 40, 36 24"
            stroke={dark ? 'rgba(196, 181, 253, 0.8)' : 'rgba(109, 40, 217, 0.6)'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle
            cx="8"
            cy="8"
            r="3"
            fill={dark ? 'rgba(196, 181, 253, 0.6)' : 'rgba(109, 40, 217, 0.45)'}
            stroke={dark ? 'rgba(196, 181, 253, 0.9)' : 'rgba(109, 40, 217, 0.7)'}
            strokeWidth="1"
          />
          <circle
            cx="8"
            cy="24"
            r="3"
            fill={dark ? 'rgba(196, 181, 253, 0.6)' : 'rgba(109, 40, 217, 0.45)'}
            stroke={dark ? 'rgba(196, 181, 253, 0.9)' : 'rgba(109, 40, 217, 0.7)'}
            strokeWidth="1"
          />
          <circle
            cx="8"
            cy="40"
            r="3"
            fill={dark ? 'rgba(196, 181, 253, 0.6)' : 'rgba(109, 40, 217, 0.45)'}
            stroke={dark ? 'rgba(196, 181, 253, 0.9)' : 'rgba(109, 40, 217, 0.7)'}
            strokeWidth="1"
          />
          <path
            d="M 36 24 L 50 24"
            stroke={dark ? 'rgba(147, 197, 253, 0.9)' : 'rgba(37, 99, 235, 0.7)'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="36"
            cy="24"
            r="5"
            fill={dark ? 'rgba(147, 197, 253, 0.4)' : 'rgba(37, 99, 235, 0.25)'}
            stroke={dark ? 'rgba(147, 197, 253, 0.9)' : 'rgba(37, 99, 235, 0.7)'}
            strokeWidth="1.5"
          />
        </svg>
        <div className="absolute right-4">
          <Icon className={cn('w-3 h-3', dark ? 'text-blue-300' : 'text-blue-600')} />
        </div>
      </div>
    )
  }

  if (type === 'notification') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div
          className={cn(
            'relative w-14 h-10 rounded-lg border flex items-center gap-2 px-2',
            dark
              ? 'border-amber-300/55 bg-amber-300/15'
              : 'border-amber-600/40 bg-amber-500/10'
          )}
        >
          <Icon className={cn('w-4 h-4', dark ? 'text-amber-300' : 'text-amber-600')} />
          <div className="flex-1 space-y-1">
            <div
              className={cn(
                'h-1 w-full rounded-full',
                dark ? 'bg-amber-300/65' : 'bg-amber-500/50'
              )}
            />
            <div
              className={cn(
                'h-1 w-2/3 rounded-full',
                dark ? 'bg-amber-300/45' : 'bg-amber-500/35'
              )}
            />
          </div>
        </div>
        <div className="absolute -top-0.5 right-5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[var(--theme-bg)]" />
      </div>
    )
  }

  if (type === 'growth') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <svg className="w-16 h-12" viewBox="0 0 64 48" fill="none">
          <rect
            x="4"
            y="36"
            width="8"
            height="8"
            rx="2"
            fill={dark ? 'rgba(110, 231, 183, 0.45)' : 'rgba(5, 150, 105, 0.35)'}
            stroke={dark ? 'rgba(110, 231, 183, 0.75)' : 'rgba(5, 150, 105, 0.6)'}
            strokeWidth="1"
          />
          <rect
            x="16"
            y="28"
            width="8"
            height="16"
            rx="2"
            fill={dark ? 'rgba(110, 231, 183, 0.55)' : 'rgba(5, 150, 105, 0.45)'}
            stroke={dark ? 'rgba(110, 231, 183, 0.8)' : 'rgba(5, 150, 105, 0.65)'}
            strokeWidth="1"
          />
          <rect
            x="28"
            y="20"
            width="8"
            height="24"
            rx="2"
            fill={dark ? 'rgba(110, 231, 183, 0.65)' : 'rgba(5, 150, 105, 0.55)'}
            stroke={dark ? 'rgba(110, 231, 183, 0.85)' : 'rgba(5, 150, 105, 0.7)'}
            strokeWidth="1"
          />
          <rect
            x="40"
            y="10"
            width="8"
            height="34"
            rx="2"
            fill={dark ? 'rgba(110, 231, 183, 0.75)' : 'rgba(5, 150, 105, 0.65)'}
            stroke={dark ? 'rgba(110, 231, 183, 0.9)' : 'rgba(5, 150, 105, 0.75)'}
            strokeWidth="1"
          />
          <rect
            x="52"
            y="4"
            width="8"
            height="40"
            rx="2"
            fill={dark ? 'rgba(110, 231, 183, 0.85)' : 'rgba(5, 150, 105, 0.75)'}
            stroke={dark ? 'rgba(110, 231, 183, 0.95)' : 'rgba(5, 150, 105, 0.85)'}
            strokeWidth="1"
          />
        </svg>
        <div className="absolute top-0 right-3">
          <Icon className={cn('w-3 h-3', dark ? 'text-emerald-300' : 'text-emerald-600')} />
        </div>
      </div>
    )
  }

  if (type === 'grid') {
    const baseOpacities = [0.5, 0.3, 0.4, 0.2, 0.6, 0.35, 0.45, 0.25, 0.55]
    const opacities = dark ? baseOpacities.map((o) => Math.min(o + 0.35, 0.95)) : baseOpacities
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-1">
          {opacities.map((opacity, i) => (
            <div
              key={i}
              className={cn(
                'w-3 h-3 rounded-sm border',
                dark ? 'border-cyan-300/60' : 'border-cyan-600/50'
              )}
              style={{
                backgroundColor: dark
                  ? `rgba(34, 211, 238, ${opacity})`
                  : `rgba(8, 145, 178, ${Math.min(opacity + 0.15, 0.85)})`,
              }}
            />
          ))}
        </div>
        <div className="absolute top-0 right-5">
          <Icon className={cn('w-2.5 h-2.5', dark ? 'text-cyan-300' : 'text-cyan-600')} />
        </div>
      </div>
    )
  }

  if (type === 'barchart') {
    return (
      <div className="relative w-full h-14 flex items-center justify-center">
        <svg className="w-16 h-12" viewBox="0 0 64 48" fill="none">
          <rect
            x="2"
            y="24"
            width="10"
            height="20"
            rx="2"
            fill={dark ? 'rgba(165, 180, 252, 0.65)' : 'rgba(79, 70, 229, 0.5)'}
            stroke={dark ? 'rgba(165, 180, 252, 0.9)' : 'rgba(79, 70, 229, 0.7)'}
            strokeWidth="1"
          />
          <rect
            x="15"
            y="16"
            width="10"
            height="28"
            rx="2"
            fill={dark ? 'rgba(165, 180, 252, 0.75)' : 'rgba(79, 70, 229, 0.6)'}
            stroke={dark ? 'rgba(165, 180, 252, 0.9)' : 'rgba(79, 70, 229, 0.75)'}
            strokeWidth="1"
          />
          <rect
            x="28"
            y="8"
            width="10"
            height="36"
            rx="2"
            fill={dark ? 'rgba(253, 224, 71, 0.75)' : 'rgba(217, 119, 6, 0.65)'}
            stroke={dark ? 'rgba(253, 224, 71, 0.9)' : 'rgba(217, 119, 6, 0.8)'}
            strokeWidth="1"
          />
          <rect
            x="41"
            y="18"
            width="10"
            height="26"
            rx="2"
            fill={dark ? 'rgba(165, 180, 252, 0.7)' : 'rgba(79, 70, 229, 0.55)'}
            stroke={dark ? 'rgba(165, 180, 252, 0.9)' : 'rgba(79, 70, 229, 0.7)'}
            strokeWidth="1"
          />
          <rect
            x="54"
            y="4"
            width="8"
            height="40"
            rx="2"
            fill={dark ? 'rgba(110, 231, 183, 0.75)' : 'rgba(5, 150, 105, 0.6)'}
            stroke={dark ? 'rgba(110, 231, 183, 0.9)' : 'rgba(5, 150, 105, 0.75)'}
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="44"
            x2="64"
            y2="44"
            stroke={dark ? 'rgba(203, 213, 225, 0.5)' : 'rgba(100, 116, 139, 0.45)'}
            strokeWidth="1"
          />
        </svg>
      </div>
    )
  }

  // Default icon display
  return (
    <div className="relative w-full h-14 flex items-center justify-center">
      <div
        className={cn(
          'w-11 h-11 rounded-xl bg-gradient-to-br border flex items-center justify-center',
          dark
            ? 'from-amber-300/40 to-amber-300/15 border-amber-300/50'
            : 'from-amber-500/30 to-amber-500/10 border-amber-500/40'
        )}
      >
        <Icon className={cn('w-5 h-5', dark ? 'text-amber-300' : 'text-amber-600')} />
      </div>
    </div>
  )
}

// Map icons to diagram types
const iconToDiagramType: Record<string, string> = {
  LineChart: 'analytics',
  TrendingUp: 'chart',
  FileText: 'document',
  Users: 'users',
  Package: 'sync',
  BarChart3: 'barchart',
  DollarSign: 'cashflow',
  Building: 'building',
  Briefcase: 'enterprise',
  LayoutDashboard: 'dashboard',
  Zap: 'notification',
  Presentation: 'document',
  MessageSquare: 'collaboration',
  GitMerge: 'merge',
  PieChart: 'pie',
  Rocket: 'growth',
  Newspaper: 'document',
  Gauge: 'gauge',
  Grid3x3: 'grid',
  Coins: 'cashflow',
  Telescope: 'analytics',
  Eye: 'gauge',
  Sprout: 'growth',
  ClipboardCheck: 'document',
  BellRing: 'notification',
  Target: 'target',
  Wallet: 'cashflow',
  Receipt: 'document',
  Store: 'building',
}

interface Industry {
  id: string
  name: string
  tagline: string
  icon: LucideIcon
  accentColor: string
  description: string
  challenges: string[]
  solutions: Array<{
    icon: LucideIcon
    title: string
    description: string
    diagramType?: string
  }>
  stats: Array<{
    value: string
    label: string
  }>
}

const industries: Industry[] = [
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    tagline: 'Scale Profitably',
    icon: ShoppingCart,
    accentColor: 'amber',
    description:
      'Navigate the complexity of multi-channel commerce with clarity. From inventory costs to marketing ROI, Midas unifies your financial data to reveal true profitability across products, channels, and markets.',
    challenges: [
      'Fragmented data across sales channels',
      'Unclear product and channel profitability',
      'Cash flow volatility from inventory cycles',
      'Difficulty forecasting demand and cash needs',
    ],
    solutions: [
      {
        icon: Store,
        title: 'Unified Commerce Analytics',
        description:
          'Connect Shopify, Amazon, and other channels for a complete view of sales, costs, and margins.',
        diagramType: 'building',
      },
      {
        icon: Receipt,
        title: 'Product Profitability',
        description:
          'See true margins by product after COGS, fees, shipping, returns, and marketing costs.',
        diagramType: 'document',
      },
      {
        icon: Wallet,
        title: 'Cash Flow Forecasting',
        description:
          'Predict cash needs with inventory cycles, seasonal trends, and payment terms factored in.',
        diagramType: 'cashflow',
      },
      {
        icon: Target,
        title: 'Marketing ROI Tracking',
        description:
          'Track customer acquisition costs and lifetime value across marketing channels.',
        diagramType: 'target',
      },
    ],
    stats: [
      { value: '25%', label: 'Margin Improvement' },
      { value: '90%', label: 'Forecast Accuracy' },
      { value: '$50K+', label: 'Avg. Savings Found' },
    ],
  },
  {
    id: 'services',
    name: 'Professional Services',
    tagline: 'Elevate Your Practice',
    icon: Briefcase,
    accentColor: 'blue',
    description:
      'Transform your firm from number-cruncher to strategic advisor. Midas empowers service professionals to deliver CFO-level insights to every client, scaling your advisory services without scaling your team.',
    challenges: [
      'Clients expect strategic guidance beyond compliance',
      'Manual reporting consumes billable hours',
      'Difficulty scaling advisory services profitably',
      'Keeping up with client financial health across portfolio',
    ],
    solutions: [
      {
        icon: LayoutDashboard,
        title: 'Automated Client Dashboards',
        description:
          'Real-time financial dashboards for every client, automatically updated from their accounting data.',
        diagramType: 'dashboard',
      },
      {
        icon: Zap,
        title: 'Proactive Insights',
        description:
          'AI-powered alerts surface cash flow issues, growth opportunities, and risks before they become problems.',
        diagramType: 'notification',
      },
      {
        icon: Presentation,
        title: 'Board-Ready Reports',
        description:
          "Generate professional CFO reports in minutes, not hours. Customized to each client's needs.",
        diagramType: 'document',
      },
      {
        icon: MessageSquare,
        title: 'Client Collaboration',
        description:
          'Shared workspaces let clients see their financial health and collaborate with your team in real-time.',
        diagramType: 'collaboration',
      },
    ],
    stats: [
      { value: '5x', label: 'More Clients Served' },
      { value: '60%', label: 'Less Manual Reporting' },
      { value: '3x', label: 'Advisory Revenue Growth' },
    ],
  },
  {
    id: 'pe-multi-entity',
    name: 'PE & Multi-Entity',
    tagline: 'Unified Portfolio Intelligence',
    icon: Building,
    accentColor: 'purple',
    description:
      'Private equity firms and multi-entity organizations need consolidated visibility across all portfolio companies. Midas provides real-time financial intelligence across your entire portfolio with automated consolidation.',
    challenges: [
      'Disparate accounting systems across entities',
      'Time-consuming manual consolidation',
      'Inconsistent reporting standards',
      'Limited visibility into portfolio performance',
    ],
    solutions: [
      {
        icon: GitMerge,
        title: 'Multi-Entity Consolidation',
        description:
          'Automatically consolidate financials across all entities with standardized reporting.',
        diagramType: 'merge',
      },
      {
        icon: BarChart3,
        title: 'Portfolio Analytics',
        description:
          'Compare performance across portfolio companies with unified KPIs and benchmarks.',
        diagramType: 'barchart',
      },
      {
        icon: Rocket,
        title: 'Value Creation Tracking',
        description:
          'Monitor value creation initiatives and track progress against investment thesis.',
        diagramType: 'growth',
      },
      {
        icon: Newspaper,
        title: 'Investor Reporting',
        description:
          'Generate LP reports and board packages automatically with consistent formatting.',
        diagramType: 'document',
      },
    ],
    stats: [
      { value: '80%', label: 'Faster Reporting' },
      { value: '100%', label: 'Portfolio Visibility' },
      { value: '10x', label: 'Consolidation Speed' },
    ],
  },
  {
    id: 'saas',
    name: 'SaaS',
    tagline: 'Metrics That Matter',
    icon: LineChart,
    accentColor: 'emerald',
    description:
      'SaaS businesses run on subscription metrics. Midas connects your billing, accounting, and CRM data to give you real-time visibility into MRR, churn, LTV, CAC, and the metrics that drive growth.',
    challenges: [
      'Subscription metrics spread across systems',
      'Revenue recognition complexity',
      'Cohort analysis requires manual work',
      'Forecasting recurring revenue accurately',
    ],
    solutions: [
      {
        icon: Gauge,
        title: 'SaaS Metrics Dashboard',
        description:
          'Track MRR, ARR, churn, expansion, and contraction in real-time from connected data.',
        diagramType: 'gauge',
      },
      {
        icon: Grid3x3,
        title: 'Cohort Analysis',
        description:
          'Understand retention and expansion patterns across customer cohorts automatically.',
        diagramType: 'grid',
      },
      {
        icon: Coins,
        title: 'Unit Economics',
        description:
          'Calculate LTV, CAC, and payback periods with data from billing and marketing systems.',
        diagramType: 'cashflow',
      },
      {
        icon: Telescope,
        title: 'Revenue Forecasting',
        description: 'Forecast future MRR with churn models, expansion trends, and pipeline data.',
        diagramType: 'analytics',
      },
    ],
    stats: [
      { value: '95%', label: 'Metric Accuracy' },
      { value: '4hrs', label: 'Saved Weekly' },
      { value: '2x', label: 'Faster Decisions' },
    ],
  },
  {
    id: 'middle-market',
    name: 'Middle-Market',
    tagline: 'Enterprise Intelligence, Right-Sized',
    icon: Building,
    accentColor: 'rose',
    description:
      'Middle-market companies need sophisticated financial intelligence without the enterprise price tag. Midas delivers CFO-level insights and automation designed for companies doing $10M-$500M in revenue.',
    challenges: [
      'Outgrowing basic accounting tools',
      'Need for sophisticated forecasting',
      'Board and investor reporting demands',
      'Limited finance team bandwidth',
    ],
    solutions: [
      {
        icon: LayoutDashboard,
        title: 'Executive Dashboards',
        description:
          'Real-time visibility into financial performance with drill-down capabilities.',
        diagramType: 'dashboard',
      },
      {
        icon: Telescope,
        title: 'Advanced Forecasting',
        description:
          'Scenario modeling and rolling forecasts powered by AI and historical patterns.',
        diagramType: 'analytics',
      },
      {
        icon: Presentation,
        title: 'Board Reporting',
        description: 'Automated board packages and investor updates with professional formatting.',
        diagramType: 'document',
      },
      {
        icon: Target,
        title: 'Benchmarking',
        description:
          'Compare your performance against industry benchmarks and identify opportunities.',
        diagramType: 'target',
      },
    ],
    stats: [
      { value: '50%', label: 'Time Saved' },
      { value: '3x', label: 'Forecast Accuracy' },
      { value: '$100K+', label: 'Annual Savings' },
    ],
  },
  {
    id: 'sme',
    name: 'SME',
    tagline: 'Big Insights for Growing Businesses',
    icon: TrendingUp,
    accentColor: 'cyan',
    description:
      'Small and medium enterprises deserve the same financial intelligence as larger companies. Midas gives SMEs the tools to understand cash flow, plan growth, and make confident financial decisions.',
    challenges: [
      'Limited visibility into cash position',
      'Manual spreadsheet-based reporting',
      'Difficulty planning for growth',
      'No dedicated finance team',
    ],
    solutions: [
      {
        icon: Eye,
        title: 'Cash Flow Visibility',
        description: 'See exactly where you stand financially with real-time cash flow tracking.',
        diagramType: 'gauge',
      },
      {
        icon: Sprout,
        title: 'Growth Planning',
        description: 'Model different growth scenarios and understand their financial impact.',
        diagramType: 'growth',
      },
      {
        icon: ClipboardCheck,
        title: 'Automated Reports',
        description: 'Get the reports you need without spending hours in spreadsheets.',
        diagramType: 'document',
      },
      {
        icon: BellRing,
        title: 'Smart Alerts',
        description: 'Receive proactive alerts about cash flow, expenses, and financial health.',
        diagramType: 'notification',
      },
    ],
    stats: [
      { value: '8hrs', label: 'Saved Weekly' },
      { value: '90%', label: 'Cash Visibility' },
      { value: '2x', label: 'Planning Confidence' },
    ],
  },
]

export default function IndustryShowcase() {
  const { theme } = useTheme()

  return (
    <section
      id="industries-showcase"
      className={`py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 ${dmSans.variable} ${stixTwoText.variable} ${ebGaramond.variable}`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20 lg:mb-28">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-500/40" />
            <span
              className="text-xs font-semibold tracking-[0.25em] uppercase"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: theme === 'light' ? '#CF6900' : '#f59e0b',
              }}
            >
              Industries We Serve
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-500/40" />
          </div>

          {/* Main heading with strong hierarchy */}
          <h2
            className="text-5xl sm:text-5xl lg:text-6xl theme-text-primary mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
          >
            Specialized Solutions,
            <br className="sm:hidden" />
            <span
              className="italic text-transparent bg-clip-text pl-[0.12em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #fbbf24, #d97706)',
              }}
            >
              Universal Results
            </span>
          </h2>

          {/* Subheading - optimal line length */}
          <p
            className="text-base sm:text-lg lg:text-xl theme-text-secondary max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Every industry has unique financial challenges. Midas adapts to deliver the insights
            that matter most to your business.
          </p>
        </div>

        {/* Industry Cards */}
        <div className="space-y-8 lg:space-y-12">
          {industries.map((industry, index) => {
            const isReversed = index % 2 === 1
            const Icon = industry.icon

            return (
              <div key={industry.id}>
                {/* Decorative divider between sections */}
                {index > 0 && (
                  <div className="relative py-6 lg:py-8 mb-8 lg:mb-12">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl">
                      <div className="h-px bg-gradient-to-r from-transparent via-[var(--theme-card-border)] to-transparent" />
                    </div>
                    <div className="relative flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-[var(--theme-bg)] border border-amber-500/30 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-amber-500/50" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Industry content panel */}
                <div
                  id={industry.id}
                  className={cn(
                    'rounded-3xl overflow-hidden',
                    'border border-[var(--theme-card-border)]',
                    theme === 'light' ? 'bg-[#FFFDFA]' : 'bg-[#1a1a1a]'
                  )}
                >
                  <div className="p-8 sm:p-10 lg:p-14">
                    <div
                      className={cn(
                        'grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start',
                        isReversed && 'lg:[direction:rtl]'
                      )}
                    >
                      {/* Content Side - 7 columns */}
                      <div className={cn('lg:col-span-7', isReversed && 'lg:[direction:ltr]')}>
                        {/* Industry header */}
                        <div className="flex items-center gap-4 mb-4">
                          <Icon
                            className="w-10 h-10"
                            strokeWidth={1.5}
                            style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                          />
                          <div>
                            <h3
                              className="text-2xl sm:text-3xl lg:text-4xl theme-text-primary"
                              style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
                            >
                              {industry.name}
                            </h3>
                          </div>
                        </div>

                        {/* Description */}
                        <p
                          className="theme-text-secondary mb-8 leading-relaxed text-base lg:text-lg max-w-2xl"
                          style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
                        >
                          {industry.description}
                        </p>

                        {/* Challenges */}
                        <div className="mb-10">
                          <h4
                            className="text-[11px] font-semibold theme-text-secondary uppercase tracking-[0.15em] mb-4"
                            style={{ fontFamily: 'var(--font-dm-sans)' }}
                          >
                            Common Challenges
                          </h4>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                            {industry.challenges.map((challenge) => (
                              <li key={challenge} className="flex items-start gap-3">
                                <ChevronRight
                                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                                  style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
                                />
                                <span
                                  className="text-sm theme-text-secondary leading-relaxed"
                                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                                >
                                  {challenge}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-3 justify-items-center sm:flex sm:gap-6 lg:gap-10 mb-8">
                          {industry.stats.map((stat) => (
                            <div key={stat.label} className="text-center sm:text-left min-w-0">
                              <div
                                className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1"
                                style={{
                                  fontFamily: 'var(--font-dm-sans)',
                                  fontWeight: 700,
                                  color: theme === 'light' ? '#CF6900' : '#f59e0b',
                                }}
                              >
                                {stat.value}
                              </div>
                              <div
                                className="text-[10px] sm:text-xs theme-text-secondary uppercase tracking-wider max-w-[70px] sm:max-w-none leading-tight"
                                style={{ fontFamily: 'var(--font-dm-sans)' }}
                              >
                                {stat.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* CTA - desktop only */}
                        <Link
                          href="/sign-up"
                          className="hidden lg:inline-flex group/link items-center gap-2 text-sm font-medium transition-colors"
                          style={{
                            fontFamily: 'var(--font-dm-sans)',
                            color: theme === 'light' ? '#CF6900' : '#f59e0b',
                          }}
                        >
                          Get started with {industry.name}
                          <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                      </div>

                      {/* Solutions Grid Side - 5 columns */}
                      <div className={cn('lg:col-span-5', isReversed && 'lg:[direction:ltr]')}>
                        <h4
                          className="text-[11px] font-semibold theme-text-secondary uppercase tracking-[0.15em] mb-5"
                          style={{ fontFamily: 'var(--font-dm-sans)' }}
                        >
                          How Midas Helps
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4">
                          {industry.solutions.map((solution) => {
                            const iconName = solution.icon.displayName || solution.icon.name || ''
                            const diagramType =
                              solution.diagramType || iconToDiagramType[iconName] || 'default'
                            return (
                              <div
                                key={solution.title}
                                className={cn(
                                  'p-3 sm:p-5 rounded-lg sm:rounded-2xl',
                                  'sm:border sm:border-[var(--theme-card-border)]',
                                  theme === 'light' ? 'sm:bg-[#FFFDFA]' : 'sm:bg-[#1a1a1a]'
                                )}
                              >
                                {/* Diagram */}
                                <div className="h-14 sm:h-auto">
                                  <SolutionDiagram icon={solution.icon} type={diagramType} theme={theme} />
                                </div>

                                {/* Text */}
                                <div className="mt-2 sm:mt-4 text-center">
                                  <h5
                                    className="text-xs sm:text-sm font-normal sm:font-semibold theme-text-primary sm:mb-2"
                                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                                  >
                                    {solution.title}
                                  </h5>
                                  <p
                                    className="hidden sm:block text-xs theme-text-secondary leading-relaxed"
                                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                                  >
                                    {solution.description}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* CTA - mobile only, below the grid */}
                        <Link
                          href="/sign-up"
                          className="lg:hidden inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors mt-6 w-full"
                          style={{
                            fontFamily: 'var(--font-dm-sans)',
                            color: theme === 'light' ? '#CF6900' : '#f59e0b',
                          }}
                        >
                          Get started with {industry.name}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
