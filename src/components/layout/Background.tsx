// src/components/layout/Background.tsx
'use client'

import { useEffect, useState } from 'react'

export default function Background() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="shell-base" />
  }

  return (
    <div className="fixed inset-0 pointer-events-none shell-particles">
      {/* Theme-responsive background */}
      <div className="shell-base" />

      {/* Beautiful gradient overlay without parallax effect */}
      <div className="absolute inset-0 opacity-[0.03] theme-light:opacity-[0.02] theme-dark:opacity-[0.05]">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-transparent to-amber-600/20" />
        <div className="absolute inset-0 bg-gradient-to-tl from-amber-500/10 via-transparent to-amber-300/10" />
      </div>

      {/* Static corner accents */}
      <div className="absolute inset-0">
        {/* Top corners */}
        <div className="absolute top-0 left-0 w-32 h-32 opacity-8 theme-light:opacity-4 theme-dark:opacity-12">
          <div className="absolute top-4 left-4 w-16 h-px bg-gradient-to-r from-amber-400/60 to-transparent" />
          <div className="absolute top-4 left-4 w-px h-16 bg-gradient-to-b from-amber-400/60 to-transparent" />
        </div>

        <div className="absolute top-0 right-0 w-32 h-32 opacity-8 theme-light:opacity-4 theme-dark:opacity-12">
          <div className="absolute top-4 right-4 w-16 h-px bg-gradient-to-l from-amber-400/60 to-transparent" />
          <div className="absolute top-4 right-4 w-px h-16 bg-gradient-to-b from-amber-400/60 to-transparent" />
        </div>

        {/* Bottom corners */}
        <div className="absolute bottom-0 left-0 w-32 h-32 opacity-8 theme-light:opacity-4 theme-dark:opacity-12">
          <div className="absolute bottom-4 left-4 w-16 h-px bg-gradient-to-r from-amber-400/60 to-transparent" />
          <div className="absolute bottom-4 left-4 w-px h-16 bg-gradient-to-t from-amber-400/60 to-transparent" />
        </div>

        <div className="absolute bottom-0 right-0 w-32 h-32 opacity-8 theme-light:opacity-4 theme-dark:opacity-12">
          <div className="absolute bottom-4 right-4 w-16 h-px bg-gradient-to-l from-amber-400/60 to-transparent" />
          <div className="absolute bottom-4 right-4 w-px h-16 bg-gradient-to-t from-amber-400/60 to-transparent" />
        </div>
      </div>
    </div>
  )
}
