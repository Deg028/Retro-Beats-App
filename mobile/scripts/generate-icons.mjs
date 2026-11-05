// Draws one app icon per theme into assets/icons/ (<id>-fg.png transparent art, <id>-bg.png background),
// plus the default icon files in assets/ (the theme chosen by DEFAULT_THEME). The Android plugin
// plugins/withThemeIcons.js turns each pair into a launcher icon that the app switches to when the theme changes.
// Run with: node scripts/generate-icons.mjs
import { Buffer } from "node:buffer"
import { mkdirSync, writeFileSync } from "node:fs"
import { crc32, deflateSync } from "node:zlib"

const DEFAULT = "pixel"
const SIZE = 1024
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** Every layer is { a(x, y) -> 0..1 coverage, c: [r, g, b] }, drawn in order; x and y run 0..1 over the icon. */
const circle = (cx, cy, r) => (x, y) => (Math.hypot(x - cx, y - cy) <= r ? 1 : 0)
const ring = (cx, cy, r, w) => (x, y) => (Math.abs(Math.hypot(x - cx, y - cy) - r) <= w / 2 ? 1 : 0)
const rect = (x0, y0, x1, y1) => (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 ? 1 : 0)
const rrect = (x0, y0, x1, y1, r) => (x, y) => {
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r))
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r))
  return x >= x0 && x <= x1 && y >= y0 && y <= y1 && dx * dx + dy * dy <= r * r ? 1 : 0
}
const tri = (ax, ay, bx, by, cx, cy) => (x, y) => {
  const s = (px, py, qx, qy) => (x - qx) * (py - qy) - (px - qx) * (y - qy)
  const d1 = s(ax, ay, bx, by)
  const d2 = s(bx, by, cx, cy)
  const d3 = s(cx, cy, ax, ay)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) ? 1 : 0
}
const glow = (cx, cy, r, spread) => (x, y) => Math.max(0, 1 - Math.abs(Math.hypot(x - cx, y - cy) - r) / spread) ** 2 * 0.7

/** Pixel art: rows of characters, each one a palette colour ('.' is empty), spread over the central area. */
function grid(rows, box = [0.24, 0.24, 0.76, 0.76]) {
  const [x0, y0, x1, y1] = box
  const w = rows[0].length
  const h = rows.length
  return (c) => (x, y) => {
    if (x < x0 || x >= x1 || y < y0 || y >= y1) return 0
    const ch = rows[Math.floor(((y - y0) / (y1 - y0)) * h)][Math.floor(((x - x0) / (x1 - x0)) * w)]
    return ch === c ? 1 : 0
  }
}
const pixels = (rows, palette) => {
  const at = grid(rows)
  return Object.entries(palette).map(([ch, col]) => ({ a: at(ch), c: hex(col) }))
}

const scan = (a, b, n = 48) => (_x, y) => (Math.floor(y * n) % 2 ? hex(b) : hex(a))
const flat = (col) => () => hex(col)

const THEMES = {
  // The original equalizer: red, coral and yellow bars on a scanlined navy field
  arcade: {
    bg: scan("#0c1628", "#101d34"),
    layers: (() => {
      const bars = [
        { h: 3, c: "#e62429" },
        { h: 5, c: "#ff7547" },
        { h: 7, c: "#f2c14e" },
        { h: 4, c: "#ff7547" },
        { h: 2, c: "#e62429" },
      ]
      const rows = Array.from({ length: 16 }, () => Array(16).fill("."))
      const pal = { c: "#fff6e0" }
      bars.forEach((b, i) => {
        const x = 1 + i * 3
        const ch = String(i)
        pal[ch] = b.c
        for (let y = 13 - b.h; y <= 12; y++) rows[y][x] = rows[y][x + 1] = ch
        rows[12 - b.h][x] = rows[12 - b.h][x + 1] = "c"
      })
      for (let x = 1; x < 15; x++) rows[14][x] = "c"
      return pixels(rows.map((r) => r.join("")), pal)
    })(),
  },
  // A handheld with a green LCD
  bolsillo: {
    bg: flat("#9bbc0f"),
    layers: pixels(
      [
        "................",
        "..DDDDDDDDDDDD..",
        ".DDDDDDDDDDDDDD.",
        ".DDLLLLLLLLLLDD.",
        ".DDLLLLLLLLLLDD.",
        ".DDLLMMLLMMLLDD.",
        ".DDLLMMLLMMLLDD.",
        ".DDLLLLLLLLLLDD.",
        ".DDDDDDDDDDDDDD.",
        ".DDDLDDDDDDDDLD.",
        ".DDLLLDDDDDDLDD.",
        ".DDDLDDDDDDDDDD.",
        ".DDDDDDDDDDDDDD.",
        "..DDDDDDDDDDDD..",
        "................",
        "................",
      ],
      { D: "#0f380f", L: "#8bac0f", M: "#306230" },
    ),
  },
  // A cassette
  cinta: {
    bg: flat("#16130f"),
    layers: [
      { a: rrect(0.24, 0.33, 0.76, 0.67, 0.04), c: hex("#f7efe1") },
      { a: rect(0.29, 0.37, 0.71, 0.5), c: hex("#ff5a43") },
      { a: rrect(0.35, 0.54, 0.65, 0.64, 0.05), c: hex("#16130f") },
      { a: circle(0.42, 0.59, 0.03), c: hex("#f7efe1") },
      { a: circle(0.58, 0.59, 0.03), c: hex("#f7efe1") },
      { a: rect(0.42, 0.43, 0.58, 0.445), c: hex("#16130f") },
    ],
  },
  // The red, coral and yellow disc of the dynamic pixel theme, with a play triangle cut out
  pixel: {
    bg: flat("#10131a"),
    layers: (() => {
      const rows = []
      for (let y = 0; y < 16; y++) {
        let row = ""
        for (let x = 0; x < 16; x++) {
          const inside = Math.hypot(x - 7.5, y - 7.5) <= 7.6
          row += !inside ? "." : y < 6 ? "R" : y < 11 ? "C" : "Y"
        }
        rows.push(row)
      }
      // play triangle: columns 6..10, rows 4..11
      const out = rows.map((r) => r.split(""))
      for (let y = 4; y <= 11; y++) {
        const half = 3.5 - Math.abs(y - 7.5)
        for (let x = 6; x <= 6 + Math.round(half * 1.4); x++) out[y][x] = "K"
      }
      return pixels(out.map((r) => r.join("")), { R: "#e62429", C: "#ff7547", Y: "#f2c14e", K: "#10131a" })
    })(),
  },
  // A glowing neon ring around a play triangle
  neon: {
    bg: flat("#0b0b1a"),
    layers: [
      { a: glow(0.5, 0.5, 0.25, 0.1), c: hex("#ff4f6d") },
      { a: ring(0.5, 0.5, 0.25, 0.04), c: hex("#ff4f6d") },
      { a: ring(0.5, 0.5, 0.17, 0.022), c: hex("#35e0ff") },
      { a: tri(0.45, 0.42, 0.45, 0.58, 0.58, 0.5), c: hex("#ffc94d") },
    ],
  },
  // A red recording dot over a line
  estudio: {
    bg: flat("#f7f5f0"),
    layers: [
      { a: circle(0.5, 0.45, 0.17), c: hex("#c8231c") },
      { a: rect(0.37, 0.73, 0.63, 0.75), c: hex("#17150f") },
      { a: rect(0.42, 0.68, 0.58, 0.695), c: hex("#17150f") },
    ],
  },
  // A record with an orange label
  vinilo: {
    bg: flat("#f2e8d5"),
    layers: [
      { a: circle(0.5, 0.5, 0.28), c: hex("#1c1510") },
      { a: ring(0.5, 0.5, 0.23, 0.008), c: hex("#3b2d20") },
      { a: ring(0.5, 0.5, 0.19, 0.008), c: hex("#3b2d20") },
      { a: circle(0.5, 0.5, 0.105), c: hex("#e4572e") },
      { a: ring(0.5, 0.5, 0.075, 0.012), c: hex("#1e6f6a") },
      { a: circle(0.5, 0.5, 0.02), c: hex("#f2e8d5") },
    ],
  },
  // A green prompt with a block cursor
  terminal: {
    bg: scan("#0b0f0c", "#0e1610"),
    layers: pixels(
      [
        "................",
        "................",
        "................",
        "..GG............",
        "...GG...........",
        "....GG..........",
        "...GG...........",
        "..GG............",
        "................",
        "........GGGGGG..",
        "........GGGGGG..",
        "........GGGGGG..",
        "................",
        "................",
        "................",
        "................",
      ],
      { G: "#5bff8a" },
    ),
  },
}

function render(size, bg, layers) {
  const px = Buffer.alloc(size * size * 4)
  const sub = [0.25, 0.75]
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0
      let g = 0
      let b = 0
      let alpha = 0
      for (const sy of sub) {
        for (const sx of sub) {
          const x = (i + sx) / size
          const y = (j + sy) / size
          let col = bg ? [...bg(x, y), 1] : [0, 0, 0, 0]
          for (const l of layers ?? []) {
            const a = l.a(x, y)
            if (a <= 0) continue
            const out = a + col[3] * (1 - a)
            for (let k = 0; k < 3; k++) col[k] = (l.c[k] * a + col[k] * col[3] * (1 - a)) / out
            col[3] = out
          }
          r += col[0] * col[3]
          g += col[1] * col[3]
          b += col[2] * col[3]
          alpha += col[3]
        }
      }
      px.set([alpha ? r / alpha : 0, alpha ? g / alpha : 0, alpha ? b / alpha : 0, (alpha / 4) * 255].map(Math.round), (j * size + i) * 4)
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
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))])
}

const write = (name, size, rgba) => {
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), png(size, rgba))
  console.log(name)
}
mkdirSync(new URL("../assets/icons/", import.meta.url), { recursive: true })

for (const [id, t] of Object.entries(THEMES)) {
  write(`icons/${id}-fg.png`, SIZE, render(SIZE, null, t.layers))
  write(`icons/${id}-bg.png`, SIZE, render(SIZE, t.bg, null))
  write(`icons/${id}-full.png`, 192, render(192, t.bg, t.layers))
}

// The app's own icon files are those of the default theme
const d = THEMES[DEFAULT]
write("icon.png", SIZE, render(SIZE, d.bg, d.layers))
write("android-icon-foreground.png", SIZE, render(SIZE, null, d.layers))
write("android-icon-background.png", SIZE, render(SIZE, d.bg, null))
write("android-icon-monochrome.png", SIZE, render(SIZE, null, d.layers.map((l) => ({ ...l, c: [255, 255, 255] }))))
write("favicon.png", 64, render(64, d.bg, d.layers))
// The system splash shows nothing: the app opens straight on the theme's own intro
write("splash-blank.png", 64, Buffer.alloc(64 * 64 * 4))
