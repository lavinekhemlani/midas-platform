import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ZenithOS — Life Sciences Investor Network'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#faf8f5',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Top label */}
        <div style={{ fontSize: 16, color: '#aaa', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 32 }}>
          ZENITH OS
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#1a1a1a',
            textAlign: 'center',
            lineHeight: 1.05,
            maxWidth: 900,
            marginBottom: 28,
            letterSpacing: -2,
          }}
        >
          3,262 Life Sciences Investors.{' '}One Warm Intro.
        </div>

        {/* Subline */}
        <div style={{ fontSize: 24, color: '#888', textAlign: 'center', maxWidth: 680, lineHeight: 1.5 }}>
          Find your target investor. Request a warm intro. Lavine handles the rest.
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 60, marginTop: 56 }}>
          {[
            { value: '3,262', label: 'Investors tracked' },
            { value: '24h', label: 'Average response' },
            { value: '100%', label: 'Life sciences' },
          ].map(({ value, label }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{value}</span>
              <span style={{ fontSize: 14, color: '#bbb', letterSpacing: 1 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Bottom domain */}
        <div style={{ position: 'absolute', bottom: 40, right: 60, fontSize: 14, color: '#ccc' }}>
          zenith-grp.co
        </div>
      </div>
    ),
    { ...size }
  )
}
