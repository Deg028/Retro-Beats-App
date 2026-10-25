// Renders the 8-bit demo tracks into assets/audio from src/tracks.json.
// Run with: node scripts/generate-tracks.mjs
import { Buffer } from "node:buffer"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const RATE = 22050
const root = new URL("..", import.meta.url)
const tracks = JSON.parse(readFileSync(new URL("src/tracks.json", root), "utf8"))
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
}

const hz = (m) => 440 * 2 ** ((m - 69) / 12)
const frac = (x) => x - Math.floor(x)

function rng(seed) {
  let s = seed * 9301 + 49297
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

/** wave is a pulse duty cycle (0-1) or "tri" for the triangle channel. */
function tone(buf, start, dur, freq, wave, vol, decay = 0) {
  const i0 = Math.floor(start * RATE)
  const n = Math.floor(dur * RATE)
  const attack = Math.min(n, 40)
  const release = Math.min(n, 300)
  for (let i = 0; i < n && i0 + i < buf.length; i++) {
    const t = i / RATE
    const p = frac(freq * t)
    const v = wave === "tri" ? 4 * Math.abs(p - 0.5) - 1 : p < wave ? 1 : -1
    let env = decay ? Math.exp(-t * decay) : 1
    if (i < attack) env *= i / attack
    if (i > n - release) env *= (n - i) / release
    buf[i0 + i] += v * vol * env
  }
}

function kick(buf, start, vol) {
  const i0 = Math.floor(start * RATE)
  let phase = 0
  for (let i = 0; i < 0.16 * RATE && i0 + i < buf.length; i++) {
    const t = i / RATE
    phase += (45 + 110 * Math.exp(-t * 30)) / RATE
    buf[i0 + i] += Math.sin(2 * Math.PI * phase) * vol * Math.exp(-t * 18)
  }
}

function noise(buf, start, dur, vol, decay, bright, r) {
  const i0 = Math.floor(start * RATE)
  let last = 0
  for (let i = 0; i < dur * RATE && i0 + i < buf.length; i++) {
    const x = r() * 2 - 1
    buf[i0 + i] += (bright ? x - last : x) * vol * Math.exp((-i / RATE) * decay)
    last = x
  }
}

function render(tr) {
  const r = rng(tr.id * 7 + 3)
  const beat = 60 / tr.bpm
  const bar = beat * 4
  const step = beat / 4
  const buf = new Float32Array(Math.round(tr.bars * bar * RATE))
  const scale = SCALES[tr.scale]
  const note = (base, deg) => base + scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7)
  const soft = tr.drums === "soft"

  // A 2-bar motif: [16th step, length in 16ths, degree offset from the chord root]
  const motif = () => {
    const out = []
    for (let s = 0; s < 32; ) {
      const len = [2, 2, 4, 1, 3][Math.floor(r() * 5)]
      if (s % 4 !== 0 && r() < 0.2) {
        s += len
        continue
      }
      const pool = s % 8 === 0 ? [0, 2, 4, 7] : [0, 1, 2, 3, 4, 5, 7, -1]
      out.push([s, Math.min(len, 32 - s), pool[Math.floor(r() * pool.length)]])
      s += len
    }
    return out
  }
  const motifs = { A: motif(), B: motif() }

  const outro = tr.bars - 4
  const section = (b) => (b < 4 ? "intro" : b >= outro ? "outro" : Math.floor((b - 4) / 8) % 2 ? "B" : "A")

  for (let b = 0; b < tr.bars; b++) {
    const t0 = b * bar
    const sec = section(b)
    const deg = tr.prog[b % tr.prog.length]

    for (let e = 0; e < 8; e++) {
      if (soft && e % 2) continue
      const d = e % 2 ? deg + 7 : deg
      tone(buf, t0 + (e * beat) / 2, (beat / 2) * (soft ? 1.9 : 0.9), hz(note(tr.key - 12, d)), "tri", 0.32)
    }

    if (sec !== "intro" && !(sec === "outro" && b >= outro + 2)) {
      const half = b % 2
      for (const [s, len, off] of motifs[sec === "B" ? "B" : "A"]) {
        if (Math.floor(s / 16) !== half) continue
        tone(buf, t0 + (s % 16) * step, len * step * 0.95, hz(note(tr.key + 12, deg + off)), tr.duty, 0.16, 2)
      }
    }

    if (sec === "B" || sec === "outro" || (soft && b >= 2)) {
      for (let s = 0; s < 16; s++) {
        const d = deg + [0, 2, 4, 7][s % 4]
        tone(buf, t0 + s * step, step * 0.9, hz(note(tr.key + (soft ? 12 : 0), d)), 0.125, soft ? 0.08 : 0.06, soft ? 6 : 0)
      }
    }

    const fill = b >= 4 && sec !== "outro" && (b - 4) % 8 === 7
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * step
      if (soft) {
        if (s === 0) kick(buf, t, 0.35)
        if (s % 4 === 2 && b >= 2) noise(buf, t, 0.04, 0.05, 90, true, r)
        continue
      }
      const k = tr.drums === "drive" ? s % 4 === 0 : s === 0 || s === 8 || (s === 10 && r() < 0.5)
      if (k) kick(buf, t, 0.5)
      if (b >= 2 && (s === 4 || s === 12)) noise(buf, t, 0.15, 0.28, 22, false, r)
      if (fill && s >= 12) noise(buf, t, 0.08, 0.18, 30, false, r)
      if (s % 2 === 0 || tr.drums === "drive") noise(buf, t, 0.04, s % 4 === 2 ? 0.07 : 0.04, 90, true, r)
    }
  }

  // Fade the last two bars, soften the square edges, normalize
  const fadeFrom = buf.length - Math.round(2 * bar * RATE)
  let y = 0
  let peak = 0
  for (let i = 0; i < buf.length; i++) {
    if (i > fadeFrom) buf[i] *= 1 - (i - fadeFrom) / (buf.length - fadeFrom)
    y += 0.55 * (buf[i] - y)
    buf[i] = y
    peak = Math.max(peak, Math.abs(y))
  }
  return buf.map((v) => Math.max(-1, Math.min(1, (v / peak) * 0.95)))
}

/** 8-bit unsigned mono PCM WAV */
function wav(samples) {
  const out = Buffer.alloc(44 + samples.length)
  out.write("RIFF", 0)
  out.writeUInt32LE(36 + samples.length, 4)
  out.write("WAVE", 8)
  out.write("fmt ", 12)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(1, 22)
  out.writeUInt32LE(RATE, 24)
  out.writeUInt32LE(RATE, 28)
  out.writeUInt16LE(1, 32)
  out.writeUInt16LE(8, 34)
  out.write("data", 36)
  out.writeUInt32LE(samples.length, 40)
  samples.forEach((v, i) => (out[44 + i] = Math.round((v + 1) * 127.5)))
  return out
}

const dir = new URL("assets/audio/", root)
mkdirSync(dir, { recursive: true })
for (const tr of tracks) {
  const name = `track-${String(tr.id).padStart(2, "0")}.wav`
  const data = wav(render(tr))
  writeFileSync(new URL(name, dir), data)
  console.log(`${name}  ${((tr.bars * 240) / tr.bpm).toFixed(1)}s  ${(data.length / 1024).toFixed(0)} KB`)
}
