'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function CapitalNav() {
  const [open, setOpen] = useState(false)

  const links = [
    { label: 'Browse Investors', href: '/capital' },
    { label: 'Find My Investors', href: '/capital/find' },
    { label: 'How Intros Work', href: '/capital/intros' },
    { label: 'For Investors', href: '/capital/investors' },
    { label: 'About', href: '/capital/about' },
    { label: 'Contact Lavine', href: 'mailto:lavine@zenith-grp.co' },
  ]

  return (
    <>
      {/* Left: logo */}
      <a href="/capital" className="text-sm font-bold tracking-tight text-[#1a1a1a]">ZenithOS</a>

      {/* Right: desktop links + mobile toggle */}
      <div className="flex items-center gap-3">
        <a href="/capital/find" className="text-xs font-medium text-[#555] hover:text-[#1a1a1a] transition-colors hidden sm:block">Find investors</a>
        <a href="/capital/intros" className="text-xs font-medium text-[#555] hover:text-[#1a1a1a] transition-colors hidden sm:block">How intros work</a>
        <a href="/capital/investors" className="text-xs font-medium text-[#555] hover:text-[#1a1a1a] transition-colors hidden sm:block">For investors</a>
        <a href="/capital/about" className="text-xs font-medium text-[#555] hover:text-[#1a1a1a] transition-colors hidden sm:block">About</a>
        <a
          href="https://zenithglobal.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[#888] hover:text-[#1a1a1a] border border-black/12 rounded-lg px-3 py-1.5 hover:border-black/25 transition-colors hidden sm:block"
        >
          Zenith Global
        </a>

        {/* Hamburger — mobile only */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="sm:hidden p-1.5 rounded-lg hover:bg-black/6 transition-colors"
        >
          {open ? <X size={18} className="text-[#1a1a1a]" /> : <Menu size={18} className="text-[#1a1a1a]" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[200] sm:hidden bg-[#faf8f5] border-t border-black/8 shadow-2xl" style={{ top: 56 }}>
          <nav className="flex flex-col px-5 py-3">
            {links.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className="py-4 text-base font-semibold text-[#1a1a1a] border-b border-black/6 last:border-0 hover:text-[#555] transition-colors"
              >
                {label}
              </a>
            ))}
            <a
              href="https://zenithglobal.io"
              target="_blank"
              rel="noopener noreferrer"
              className="pt-5 text-sm text-[#aaa] hover:text-[#555] transition-colors"
            >
              Zenith Global →
            </a>
          </nav>
        </div>
      )}
    </>
  )
}
