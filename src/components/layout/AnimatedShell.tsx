// src/components/layout/AnimatedShell.tsx

// 1. Import 'useId' from React
import { useEffect, useMemo, useState, useId } from 'react';

interface AnimatedShellProps {
  intensity?: 'subtle' | 'normal' | 'bold';
  fadeCenter?: boolean;
  fadeRadius?: number;
}

type Tendril = {
  id: string;
  path: string;
  delay: number;
  width: number;
};

export default function AnimatedShell({
  intensity = 'normal',
  fadeCenter = true,
  fadeRadius = 0.35,
}: AnimatedShellProps) {
  /* ------------------------------------------------------------------ */
  const [mounted, setMounted] = useState(false);
  
  // 2. Replace the useMemo hook with the useId hook
  const uniqueId = useId(); 

  useEffect(() => setMounted(true), []);

  const opacity = { subtle: 0.55, normal: 0.9, bold: 1.25 }[intensity];

  /* Ring radii */
  const INNER_R = 630;
  const MASK_R = 0;
  const ACCENT_R = 645;
  const SHIMMER_R = 750;

  /* ------------------------------------------------------------------ */
  /* Tendrils (no changes needed here) */
  const tendrils = useMemo<Tendril[]>(() => {
  const rand = (mi: number, ma: number) => Math.random() * (ma - mi) + mi;
    const list: Tendril[] = [];
    const R = 1400;

    for (let i = 0; i < 14; i++) {
      let a: number;
      if (Math.random() < 0.5) {
        a = rand((2 * Math.PI) / 3, (4 * Math.PI) / 3);
      } else {
        if (Math.random() < 0.5) {
          a = rand((5 * Math.PI) / 3, 2 * Math.PI);
        } else {
          a = rand(0, Math.PI / 3);
        }
      }
      const ex = 960 + Math.cos(a) * R;
      const ey = 540 + Math.sin(a) * R;
      const mid1R = rand(300, 430);
      const mid2R = rand(650, 820);
      const mid1x = 960 + Math.cos(a + rand(-0.3, 0.3)) * mid1R;
      const mid1y = 540 + Math.sin(a + rand(-0.3, 0.3)) * mid1R;
      const mid2x = 960 + Math.cos(a + rand(-0.2, 0.2)) * mid2R;
      const mid2y = 540 + Math.sin(a + rand(-0.2, 0.2)) * mid2R;
      list.push({
        id: `t${i}`,
        path: `M960 540 C ${mid1x} ${mid1y} ${mid2x} ${mid2y} ${ex} ${ey}`,
        delay: rand(0, 10),
        width: rand(0.8, 1.4),
      });
    }
    return list;
  }, []);

  /* Optional radial mask */
  const outerMask = fadeCenter
    ? {
        WebkitMaskImage: `radial-gradient(circle at center, transparent ${fadeRadius * 100}%, black 100%)`,
        maskImage: `radial-gradient(circle at center, transparent ${fadeRadius * 100}%, black 100%)`,
      }
    : undefined;

  /* ------------------------------------------------------------------ */
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1] animated-shell-container" style={outerMask}>
      {mounted && (
        <svg
          className="absolute inset-0 w-full h-full select-none"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
          style={{ opacity }}
        >
          <defs>
            {/* 3. Update all ID references to use the new 'uniqueId' */}
            <linearGradient id={`mainGold-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.1"/>
              <stop offset="40%" stopColor="#FACC15" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.1" />
              <animateTransform attributeName="gradientTransform" type="rotate"
                values="0 0.5 0.5;-360 0.5 0.5" dur="60s" repeatCount="indefinite" />
            </linearGradient>

            {/* Mask so tendrils vanish at INNER_R */}
            <mask id={`haloMask-${uniqueId}`}>
              <rect width="1920" height="1080" fill="white" />
              <circle cx="960" cy="540" r={MASK_R} fill="black" />
            </mask>

            {/* Outer ring – counter-clockwise shimmer */}
            <linearGradient id={`ringSweepOuter-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"  stopColor="#FACC15" stopOpacity="0"   />
              <stop offset="12%" stopColor="#FFFFFF" stopOpacity="0.6" />
              <stop offset="25%" stopColor="#FACC15" stopOpacity="0"   />
              <animateTransform attributeName="gradientTransform" type="rotate"
                values="0 0.5 0.5;-360 0.5 0.5" dur="35s" repeatCount="indefinite" />
            </linearGradient>

            {/* Accent ring – clockwise shimmer */}
            <linearGradient id={`ringSweepAccent-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"  stopColor="#FFEEC7" stopOpacity="0"   />
              <stop offset="15%" stopColor="#FACC15" stopOpacity="0.8" />
              <stop offset="30%" stopColor="#FFEEC7" stopOpacity="0"   />
              <animateTransform attributeName="gradientTransform" type="rotate"
                values="0 0.5 0.5;360 0.5 0.5" dur="40s" repeatCount="indefinite" />
            </linearGradient>
          </defs>

          {/* Halo rings */}
          <g fill="none">
            <circle cx="960" cy="540" r={INNER_R} stroke={`url(#mainGold-${uniqueId})`} strokeWidth="2.2" />
            <circle cx="960" cy="540" r={ACCENT_R} stroke={`url(#ringSweepAccent-${uniqueId})`} strokeWidth="1.8" />
            <circle cx="960" cy="540" r={SHIMMER_R} stroke={`url(#ringSweepOuter-${uniqueId})`} strokeWidth="1.4" />
          </g>

          <g mask={`url(#haloMask-${uniqueId})`} strokeLinecap="round" fill="none">
            {tendrils.map(t => (
              <path
                key={t.id}
                d={t.path}
                stroke={`url(#mainGold-${uniqueId})`}
                strokeWidth={t.width}
                style={{
                  strokeDasharray: 1800,
                  strokeDashoffset: 1800,
                  animation: `tGrow-${uniqueId} 14s ease-out ${t.delay}s infinite`,
                }}
              />
            ))}
          </g>

          <style>{`
            @keyframes tGrow-${uniqueId} {
              0%   { stroke-dashoffset:1800; opacity:0 }
              12%  { opacity:1 }
              80%  { opacity:0.25 }
              100% { stroke-dashoffset:0; opacity:0 }
            }
          `}</style>
        </svg>
      )}
    </div>
  )
}
