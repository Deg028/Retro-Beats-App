// Draws the pixel-art equalizer app icons into assets/ (the originals were Git LFS pointers).
// Run with: node scripts/generate-icons.mjs
import { Buffer } from "node:buffer"
import { writeFileSync } from "node:fs"
import { crc32, deflateSync } from "node:zlib"

const INK = [12, 22, 40, 255]
const SCAN = [16, 29, 52, 255]
const CREAM = [255, 246, 224, 255]
const WHITE = [255, 255, 255, 255]
const CLEAR = [0, 0, 0, 0]
const BARS = [
  { h: 6, color: [230, 36, 41, 255] },
  { h: 10, color: [255, 117, 71, 255] },
  { h: 14, color: [242, 193, 78, 255] },
  { h: 9, color: [255, 117, 71, 255] },
  { h: 5, color: [230, 36, 41, 255] },
]

/** 32x32 cell grid; the art fits the adaptive-icon safe zone (central ~60%). */
function art(mono) {
  const cells = Array.from({ length: 32 }, () => Array(32).fill(null))
  const base = 22
  BARS.forEach((b, i) => {
    const x = 9 + i * 3
    for (let y = base - b.h + 1; y <= base; y++) cells[y][x] = cells[y][x + 1] = mono ? WHITE : b.color
    cells[base - b.h - 1][x] = cells[base - b.h - 1][x + 1] = mono ? WHITE : CREAM
  })
  for (let x = 9; x < 23; x++) cells[base + 2][x] = mono ? WHITE : CREAM
  return cells
}

function render(size, bg, cells) {
  const px = Buffer.alloc(size * size * 4)
  const cell = size / 32
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = cells?.[Math.floor(y / cell)][Math.floor(x / cell)] ?? bg(y, cell)
      px.set(c, (y * size + x) * 4)
    }
  }
  return px
}

function png(size, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const scanlines = (y, cell) => (Math.floor(y / cell) % 2 ? SCAN : INK)
const clear = () => CLEAR
const out = (name, size, bg, cells) => {
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), png(size, render(size, bg, cells)))
  console.log(name)
}

out("icon.png", 1024, scanlines, art(false))
out("android-icon-background.png", 1024, scanlines, null)
out("android-icon-foreground.png", 1024, clear, art(false))
out("android-icon-monochrome.png", 1024, clear, art(true))
out("splash-icon.png", 1024, clear, art(false))
out("favicon.png", 64, scanlines, art(false))
