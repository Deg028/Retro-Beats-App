import { useEffect, useState } from "react"
import { Equalizer } from "./Pixel"

export default function Splash({ onStart }: { onStart: () => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!exiting) return
    const timeout = window.setTimeout(onStart, 360)
    return () => window.clearTimeout(timeout)
  }, [exiting, onStart])

  return (
    <div
      className={`splash-screen relative flex h-full w-full flex-col items-center justify-center gap-8 overflow-hidden bg-ink px-6 text-center ${
        exiting ? "splash-exit" : ""
      }`}
    >
      {[12, 30, 52, 70, 86].map((left, i) => (
        <span
          key={left}
          className="float-note absolute bottom-24 font-pixel text-lg text-blood"
          style={{ left: `${left}%`, animationDelay: `${i * 0.6}s` }}
        >
          {i % 2 ? "♪" : "♫"}
        </span>
      ))}

      <div className="splash-enter font-pixel text-[11px] text-coral">
        ★ 1UP ★
      </div>

      <h1 className="splash-title font-pixel text-3xl leading-[1.6] text-cream">
        RETRO
        <br />
        <span className="text-crimson [text-shadow:4px_4px_0_var(--color-blood)]">
          BEATS
        </span>
      </h1>

      <div className="splash-enter" style={{ animationDelay: "0.18s" }}>
        <Equalizer bars={11} h={64} />
      </div>

      <div className="splash-enter w-56" style={{ animationDelay: "0.3s" }}>
        <div className="h-5 border-4 border-secondary bg-ink">
          <div
            className="load-fill h-full bg-crimson"
            onAnimationEnd={() => setExiting(true)}
          />
        </div>
        <p className="splash-loading-label mt-3 font-pixel text-[8px] text-coral">
          CARGANDO...
        </p>
      </div>
    </div>
  )
}
