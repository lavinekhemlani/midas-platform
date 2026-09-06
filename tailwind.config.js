/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Your existing safelist
    'bg-red-500',
    'bg-slate-950',
    'text-white',
    'p-4',
    'text-xl',
    'font-bold',
    'bg-blue-500',
    'm-4',
    'w-full',
    'h-20',
    'bg-green-500',
    'text-6xl',
    'text-black',
    'flex',
    'gap-4',
    'bg-yellow-500',
    'bg-purple-500',
    // Memory border colors (dynamic classes)
    'border-amber-700/30',
    'hover:border-red-500/50',
    'hover:border-green-500/50',
    'hover:border-emerald-500/50',
    'hover:border-purple-500/50',
    'hover:border-blue-500/50',
    'hover:border-amber-500/50',
    'hover:border-orange-500/50',
    // Custom animation classes
    'animate-rotate-slow',
    'animate-fade-in-delayed',
    'animate-fade-in-then-rotate',
    'animate-fade-in-then-rotate-reverse',
    'animate-line-appear',
    'animate-appear-then-flow',
    'animate-flow-horizontal-enhanced',
    'animate-appear-then-slide',
    'animate-slide-diagonal-enhanced',
    'animate-appear-then-pulse',
    'animate-fade-pulse',
    'animate-pulse-ambient',
    'animate-pulse-ambient-large',
    'animate-appear-then-float',
    'animate-float-geometric',
    'animate-appear-then-ambient',
    'animate-appear-then-pulse-large',
    'animate-element-appear',
    'animate-ambient-appear',
  ],
  theme: {
    extend: {
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        // Add a new slow slide-in animation
        'slide-in-slow': 'slide-in-from-right 1.2s ease-out',
      },
      fontSize: {
        // Fluid typography using clamp() for responsive scaling
        // Format: clamp(min, preferred, max) - scales smoothly across all resolutions
        'fluid-xs': 'clamp(0.625rem, 0.5rem + 0.5vw, 0.75rem)', // 10-12px
        'fluid-sm': 'clamp(0.75rem, 0.65rem + 0.5vw, 0.875rem)', // 12-14px
        'fluid-base': 'clamp(0.875rem, 0.75rem + 0.625vw, 1rem)', // 14-16px
        'fluid-lg': 'clamp(1rem, 0.85rem + 0.75vw, 1.125rem)', // 16-18px
        'fluid-xl': 'clamp(1.125rem, 0.95rem + 0.875vw, 1.25rem)', // 18-20px
        'fluid-2xl': 'clamp(1.25rem, 1rem + 1.25vw, 1.5rem)', // 20-24px
        'fluid-3xl': 'clamp(1.5rem, 1.2rem + 1.5vw, 1.875rem)', // 24-30px
        'fluid-4xl': 'clamp(1.875rem, 1.5rem + 1.875vw, 2.25rem)', // 30-36px
      },
      spacing: {
        // Fluid spacing for responsive padding, margin, gap
        'fluid-1': 'clamp(0.25rem, 0.2rem + 0.25vw, 0.375rem)', // 4-6px
        'fluid-2': 'clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem)', // 8-12px
        'fluid-3': 'clamp(0.75rem, 0.6rem + 0.75vw, 1.125rem)', // 12-18px
        'fluid-4': 'clamp(1rem, 0.8rem + 1vw, 1.5rem)', // 16-24px
        'fluid-6': 'clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem)', // 24-36px
        'fluid-8': 'clamp(2rem, 1.6rem + 2vw, 3rem)', // 32-48px
      },
      colors: {
        slate: {
          50: '#f8fafc',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        amber: {
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        blue: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        purple: {
          500: '#a855f7',
          600: '#9333ea',
        },
        gray: {
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          800: '#1f2937',
        },
        red: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        indigo: {
          // Add indigo if not present
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
        },
      },
    },
  },
  darkMode: ['selector', 'html.theme-dark'],
  plugins: [require('@tailwindcss/container-queries')],
}
