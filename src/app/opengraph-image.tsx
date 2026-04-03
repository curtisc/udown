import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'uDown'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f0f1a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Bowl SVG inline */}
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M4 14 Q4 26 16 26 Q28 26 28 14 Z" fill="#E8C97A" stroke="#C4974A" strokeWidth="1.5" strokeLinejoin="round"/>
          <rect x="3" y="12" width="26" height="3" rx="1.5" fill="#D4A843" stroke="#C4974A" strokeWidth="1"/>
          <rect x="11" y="26" width="10" height="2" rx="1" fill="#C4974A"/>
          <path d="M7 16 Q9 14 11 16 Q13 18 15 16 Q17 14 19 16 Q21 18 23 16 Q25 14 27 16" fill="none" stroke="#F5F0E0" strokeWidth="2" strokeLinecap="round"/>
          <path d="M7 19 Q9 17 11 19 Q13 21 15 19 Q17 17 19 19 Q21 21 23 19 Q25 17 27 19" fill="none" stroke="#F5F0E0" strokeWidth="2" strokeLinecap="round"/>
          <line x1="11" y1="5" x2="16" y2="14" stroke="#8B5E3C" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="14" y1="4" x2="19" y2="13" stroke="#8B5E3C" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M10 10 Q11 8 10 6" fill="none" stroke="#B0B0B0" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
          <path d="M16 9 Q17 7 16 5" fill="none" stroke="#B0B0B0" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
          <path d="M22 10 Q23 8 22 6" fill="none" stroke="#B0B0B0" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
        </svg>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#16a0ac',
            marginTop: 24,
          }}
        >
          uDown
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            marginTop: 8,
          }}
        >
          see what&apos;s happening
        </div>
      </div>
    ),
    { ...size }
  )
}
