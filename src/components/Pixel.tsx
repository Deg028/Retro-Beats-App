const PALETTE = ['#e62429', '#ff7547', '#f2c14e', '#8c1519']

function rng(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function PixelCover({ seed, className = '' }: { seed: number; className?: string }) {
  const r = rng(seed)
  const bg = seed % 2 ? '#223a66' : '#0c1628'
  const fg = PALETTE[seed % 3]
  const cells: boolean[] = []
  for (let y = 0; y < 8; y++) {
    const half = Array.from({ length: 4 }, () => r() > 0.5)
    cells.push(...half, ...[...half].reverse())
  }
  return (
    <div
      className={`grid shrink-0 grid-cols-8 ${className}`}
      style={{ background: bg }}
      role="img"
      aria-label="Portada pixel art"
    >
      {cells.map((on, i) => (
        <i key={i} style={{ background: on ? fg : 'transparent' }} />
      ))}
    </div>
  )
}

export function PixelHeart({ active, className = '' }: { active: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 34 34"
      className={`pixel-heart ${className} ${active ? 'pixel-heart-pop' : ''}`}
      style={{ imageRendering: 'pixelated' }}
      aria-hidden="true"
    >
      <path
        d="M7 3h7v2h4v2h4V5h4V3h6v2h2v4h2v7h-2v5h-2v4h-3v3h-4v2h-4v2h-3v-2h-4v-2h-3v-3H8v-4H5v-5H3V9h2V5h2z"
        fill={active ? '#e3131c' : '#526079'}
      />
      {active && (
        <>
          <path
            d="M20 19h12v2h-2v4h-3v3h-4v2h-4v2h-3v-3h2v-3h3v-3h2v-3h-3z"
            fill="#8f080d"
          />
          <path d="M7 7h6v2h-2v2H9v2H7v7H5v-8h2z" fill="#fff0f0" />
        </>
      )}
    </svg>
  )
}

export function PixelSaveIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M14 14h36a3 3 0 0 1 0 6H14a3 3 0 0 1 0-6Zm0 11h36a3 3 0 0 1 0 6H14a3 3 0 0 1 0-6Zm0 11h15v6H14a3 3 0 0 1 0-6Zm0 12h15v6H14a3 3 0 0 1 0-6Zm29-12h6v21h-6V41H32v-6h11z"
        fill="currentColor"
      />
    </svg>
  )
}

export function Equalizer({ playing = true, bars = 5, h = 20 }: { playing?: boolean; bars?: number; h?: number }) {
  return (
    <span className="flex items-end gap-[3px]" style={{ height: h }} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <i
          key={i}
          className="eq-bar w-[5px] bg-coral"
          style={{
            height: '100%',
            animationDelay: `${i * 0.13}s`,
            animationDuration: `${0.55 + (i % 3) * 0.2}s`,
            animationPlayState: playing ? 'running' : 'paused',
          }}
        />
      ))}
    </span>
  )
}
