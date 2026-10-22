import { Equalizer } from './Pixel'

export default function Splash({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 overflow-hidden bg-ink px-6 text-center">
      {[12, 30, 52, 70, 86].map((left, i) => (
        <span
          key={left}
          className="float-note absolute bottom-24 font-pixel text-lg text-blood"
          style={{ left: `${left}%`, animationDelay: `${i * 0.6}s` }}
        >
          {i % 2 ? '♪' : '♫'}
        </span>
      ))}

      <div className="drop-in font-pixel text-[11px] text-coral">★ 1UP ★</div>

      <h1 className="drop-in font-pixel text-3xl leading-[1.6] text-cream" style={{ animationDelay: '0.2s' }}>
        RETRO
        <br />
        <span className="text-crimson [text-shadow:4px_4px_0_var(--color-blood)]">BEATS</span>
      </h1>

      <div className="drop-in" style={{ animationDelay: '0.5s' }}>
        <Equalizer bars={11} h={64} />
      </div>

      <div className="w-56">
        <div className="h-5 border-4 border-secondary bg-ink">
          <div className="load-fill h-full bg-crimson" onAnimationEnd={onStart} />
        </div>
        <p className="mt-3 font-pixel text-[8px] text-coral">CARGANDO...</p>
      </div>
    </div>
  )
}
