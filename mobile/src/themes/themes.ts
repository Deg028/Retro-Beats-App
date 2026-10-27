export type ThemeCategory = "retro" | "moderno" | "combinado"
export type TextRole = "display" | "title" | "body" | "label" | "caption" | "number"

type TextSpec = {
  /** Custom font file; undefined uses the system font (Roboto on Android) with `weight` */
  family?: string
  size: number
  line: number
  weight?: "400" | "500" | "600" | "700" | "800"
  spacing?: number
  upper?: boolean
}

export type ThemeColors = {
  bg: string
  surface: string
  surface2: string
  border: string
  borderInput: string
  text: string
  textMuted: string
  accent: string
  onAccent: string
  highlight: string
  warm: string
  danger: string
  /** Header band behind the cover when background is "tonal" */
  tonal: string
  cover: [string, string, string]
  coverBg: string
  /** Outline around covers; omit for borderless covers */
  coverBorder?: string
  lyricsBg: string
  lyricsText: string
  lyricsDim: string
}

export type Theme = {
  id: string
  name: string
  category: ThemeCategory
  tagline: string
  dark: boolean
  c: ThemeColors
  type: Record<TextRole, TextSpec>
  radius: { sm: number; md: number; lg: number; cover: number }
  /** Border width of controls and cards; 0 = none */
  border: number
  shadow: "none" | "solid" | "glow" | "soft"
  shadowColor: string
  /** Stepped "pixel" corners on covers and the play button */
  pixelCorners: boolean
  progress: "blocks" | "segments" | "glow" | "wave" | "line"
  play: "square" | "sticker" | "circle" | "morph" | "lcd"
  background: "solid" | "artGlow" | "tonal"
  cover: "disc" | "square"
  signature: "none" | "reels" | "scanlines" | "lcd"
  actions: "blocks" | "pills" | "toolbar"
  nav: "blocks" | "indicator" | "plain"
  icons: "pixel" | "material" | "rounded"
  /** Accent and lyrics colors follow the current cover */
  dynamic: boolean
  lyricsLined: boolean
  /** Opening animation shown at launch */
  intro: "coin" | "boot" | "tape" | "morph" | "flicker" | "fade" | "vinyl" | "terminal"
  /** How screens and buttons move: stepped frames (retro), springy or smooth easing */
  motion: "stepped" | "spring" | "smooth"
  /** Shown in the now-playing notification */
  emoji: string
}

const PS = "PressStart2P_400Regular"
const VT = "VT323_400Regular"
const SG = "SpaceGrotesk_400Regular"
const SGM = "SpaceGrotesk_500Medium"
const SGB = "SpaceGrotesk_700Bold"
const PX = "PixelifySans_500Medium"
const PXB = "PixelifySans_700Bold"
const SO = "Sora_400Regular"
const SOS = "Sora_600SemiBold"
const SOB = "Sora_700Bold"
const SOX = "Sora_800ExtraBold"
const SK = "Silkscreen_400Regular"

export const THEMES: Theme[] = [
  {
    id: "arcade",
    name: "Arcade 8-bit",
    category: "retro",
    tagline: "El Retro Beats original, pulido: pixeles, bordes gruesos y disco de vinilo.",
    dark: true,
    c: {
      bg: "#0c1628",
      surface: "#162644",
      surface2: "#223a66",
      border: "#f2c14e",
      borderInput: "#f2c14e",
      text: "#fff6e0",
      textMuted: "#ff8f66",
      accent: "#ff4a4a",
      onAccent: "#0c1628",
      highlight: "#f2c14e",
      warm: "#ff8f66",
      danger: "#ff6b6b",
      tonal: "#162644",
      cover: ["#e62429", "#ff7547", "#f2c14e"],
      coverBg: "#223a66",
      coverBorder: "#f2c14e",
      lyricsBg: "#162644",
      lyricsText: "#fff6e0",
      lyricsDim: "rgba(255,246,224,0.4)",
    },
    type: {
      display: { family: PS, size: 16, line: 26, upper: true },
      title: { family: PS, size: 11, line: 19 },
      body: { family: VT, size: 22, line: 24 },
      label: { family: PS, size: 8, line: 12, upper: true, spacing: 1 },
      caption: { family: VT, size: 18, line: 20 },
      number: { family: PS, size: 8, line: 12 },
    },
    radius: { sm: 0, md: 0, lg: 0, cover: 0 },
    border: 3,
    shadow: "solid",
    shadowColor: "#8c1519",
    pixelCorners: false,
    progress: "blocks",
    play: "square",
    background: "solid",
    cover: "disc",
    signature: "none",
    actions: "blocks",
    nav: "blocks",
    icons: "pixel",
    dynamic: false,
    lyricsLined: false,
    intro: "coin",
    motion: "stepped",
    emoji: "👾",
  },
  {
    id: "bolsillo",
    name: "Bolsillo LCD",
    category: "retro",
    tagline: "Pantalla de consola portátil: cuatro tonos de verde y matriz de puntos.",
    dark: false,
    c: {
      bg: "#9bbc0f",
      surface: "#a9c62a",
      surface2: "#b6d03f",
      border: "#306230",
      borderInput: "#306230",
      text: "#0f380f",
      textMuted: "#1f4a1f",
      accent: "#0f380f",
      onAccent: "#c4d98a",
      highlight: "#0f380f",
      warm: "#1f4a1f",
      danger: "#5a1010",
      tonal: "#8bac0f",
      cover: ["#0f380f", "#306230", "#0f380f"],
      coverBg: "#8bac0f",
      coverBorder: "#306230",
      lyricsBg: "#a9c62a",
      lyricsText: "#0f380f",
      lyricsDim: "#3d6b2a",
    },
    type: {
      display: { family: PXB, size: 26, line: 30 },
      title: { family: PXB, size: 19, line: 24 },
      body: { family: PX, size: 16, line: 22 },
      label: { family: SK, size: 10, line: 14, upper: true, spacing: 1 },
      caption: { family: PX, size: 13, line: 18 },
      number: { family: SK, size: 11, line: 14 },
    },
    radius: { sm: 2, md: 4, lg: 6, cover: 0 },
    border: 2,
    shadow: "none",
    shadowColor: "#306230",
    pixelCorners: true,
    progress: "segments",
    play: "lcd",
    background: "solid",
    cover: "square",
    signature: "lcd",
    actions: "blocks",
    nav: "blocks",
    icons: "pixel",
    dynamic: false,
    lyricsLined: false,
    intro: "boot",
    motion: "stepped",
    emoji: "🎮",
  },
  {
    id: "cinta",
    name: "Cinta",
    category: "combinado",
    tagline: "Etiqueta de cassette moderna: crema, bloques planos y bobinas que giran.",
    dark: true,
    c: {
      bg: "#16130f",
      surface: "#221d17",
      surface2: "#2e2720",
      border: "#3d342a",
      borderInput: "#8a7a66",
      text: "#f7efe1",
      textMuted: "#c2b49f",
      accent: "#ff5a43",
      onAccent: "#1a0d09",
      highlight: "#f2c14e",
      warm: "#ff8a5c",
      danger: "#ff6b6b",
      tonal: "#221d17",
      cover: ["#e62429", "#ff8a5c", "#f2c14e"],
      coverBg: "#2e2720",
      coverBorder: "#f7efe1",
      lyricsBg: "#f7efe1",
      lyricsText: "#16130f",
      lyricsDim: "#6b5f50",
    },
    type: {
      display: { family: SGB, size: 28, line: 32 },
      title: { family: SGB, size: 18, line: 24 },
      body: { family: SG, size: 16, line: 22 },
      label: { family: PX, size: 12, line: 16, upper: true, spacing: 2 },
      caption: { family: SGM, size: 13, line: 18 },
      number: { family: PX, size: 13, line: 16 },
    },
    radius: { sm: 8, md: 14, lg: 20, cover: 14 },
    border: 1.5,
    shadow: "solid",
    shadowColor: "#000000",
    pixelCorners: false,
    progress: "segments",
    play: "sticker",
    background: "solid",
    cover: "square",
    signature: "reels",
    actions: "pills",
    nav: "plain",
    icons: "rounded",
    dynamic: false,
    lyricsLined: true,
    intro: "tape",
    motion: "spring",
    emoji: "📼",
  },
  {
    id: "pixel",
    name: "Pixel dinámico",
    category: "combinado",
    tagline: "Material moderno con esquinas pixel; los colores siguen a cada carátula.",
    dark: true,
    c: {
      bg: "#10131a",
      surface: "#1b1f29",
      surface2: "#262b37",
      border: "#353b4a",
      borderInput: "#8e94a6",
      text: "#e6e8ef",
      textMuted: "#b4bacb",
      accent: "#ffb4ab",
      onAccent: "#690005",
      highlight: "#f2c14e",
      warm: "#ffb59b",
      danger: "#ffb4ab",
      tonal: "#2b1618",
      cover: ["#e62429", "#ff7547", "#f2c14e"],
      coverBg: "#262b37",
      lyricsBg: "#8c1519",
      lyricsText: "#ffdad6",
      lyricsDim: "#f0b8b3",
    },
    type: {
      display: { size: 24, line: 30, weight: "500" },
      title: { size: 17, line: 22, weight: "500" },
      body: { size: 15, line: 22, weight: "400" },
      label: { family: PX, size: 12, line: 16, upper: true, spacing: 2 },
      caption: { size: 13, line: 18, weight: "400" },
      number: { family: PX, size: 13, line: 16 },
    },
    radius: { sm: 8, md: 16, lg: 28, cover: 0 },
    border: 0,
    shadow: "none",
    shadowColor: "#000000",
    pixelCorners: true,
    progress: "wave",
    play: "morph",
    background: "tonal",
    cover: "square",
    signature: "none",
    actions: "toolbar",
    nav: "indicator",
    icons: "material",
    dynamic: true,
    lyricsLined: false,
    intro: "morph",
    motion: "spring",
    emoji: "🎨",
  },
  {
    id: "neon",
    name: "Neón",
    category: "moderno",
    tagline: "Synthwave refinado: índigo profundo, brillo suave y scanlines en la portada.",
    dark: true,
    c: {
      bg: "#0b0b1a",
      surface: "#16162d",
      surface2: "#20203f",
      border: "#2e2e57",
      borderInput: "#7a78a8",
      text: "#f3f0ff",
      textMuted: "#aeabcf",
      accent: "#ff4f6d",
      onAccent: "#14040b",
      highlight: "#ffc94d",
      warm: "#ff8a5c",
      danger: "#ff6b81",
      tonal: "#16162d",
      cover: ["#ff4f6d", "#ff8a5c", "#ffc94d"],
      coverBg: "#20203f",
      lyricsBg: "#16162d",
      lyricsText: "#f3f0ff",
      lyricsDim: "#aeabcf",
    },
    type: {
      display: { family: SOX, size: 26, line: 32 },
      title: { family: SOB, size: 17, line: 22 },
      body: { family: SO, size: 15, line: 22 },
      label: { family: SK, size: 11, line: 14, upper: true, spacing: 2 },
      caption: { family: SO, size: 13, line: 18 },
      number: { family: SK, size: 11, line: 14 },
    },
    radius: { sm: 10, md: 16, lg: 24, cover: 24 },
    border: 1,
    shadow: "glow",
    shadowColor: "#ff4f6d",
    pixelCorners: false,
    progress: "glow",
    play: "circle",
    background: "artGlow",
    cover: "square",
    signature: "scanlines",
    actions: "toolbar",
    nav: "plain",
    icons: "rounded",
    dynamic: false,
    lyricsLined: false,
    intro: "flicker",
    motion: "smooth",
    emoji: "🌆",
  },
  {
    id: "estudio",
    name: "Estudio",
    category: "moderno",
    tagline: "Claro y limpio, con el rojo de Retro Beats como único acento.",
    dark: false,
    c: {
      bg: "#f7f5f0",
      surface: "#ffffff",
      surface2: "#ece8e0",
      border: "#ddd7cc",
      borderInput: "#8a8478",
      text: "#17150f",
      textMuted: "#5c574d",
      accent: "#c8231c",
      onAccent: "#ffffff",
      highlight: "#8a5a00",
      warm: "#b0441a",
      danger: "#b42318",
      tonal: "#ece8e0",
      cover: ["#e62429", "#ff7547", "#f2c14e"],
      coverBg: "#ece8e0",
      lyricsBg: "#ffffff",
      lyricsText: "#17150f",
      lyricsDim: "#8a8478",
    },
    type: {
      display: { family: SOX, size: 28, line: 34 },
      title: { family: SOB, size: 17, line: 22 },
      body: { family: SO, size: 15, line: 22 },
      label: { family: SOS, size: 11, line: 14, upper: true, spacing: 1.5 },
      caption: { family: SO, size: 13, line: 18 },
      number: { family: SOS, size: 12, line: 16 },
    },
    radius: { sm: 10, md: 16, lg: 22, cover: 22 },
    border: 0,
    shadow: "soft",
    shadowColor: "#000000",
    pixelCorners: false,
    progress: "line",
    play: "circle",
    background: "solid",
    cover: "square",
    signature: "none",
    actions: "pills",
    nav: "indicator",
    icons: "material",
    dynamic: false,
    lyricsLined: false,
    intro: "fade",
    motion: "smooth",
    emoji: "🎧",
  },
  {
    id: "vinilo",
    name: "Vinilo",
    category: "combinado",
    tagline: "Tienda de discos de los 70 con interfaz moderna: crema, naranja y un disco que gira.",
    dark: false,
    c: {
      bg: "#f2e8d5",
      surface: "#fbf4e4",
      surface2: "#e7dac0",
      border: "#cdbd9c",
      borderInput: "#1c1510",
      text: "#1c1510",
      textMuted: "#6b5a48",
      accent: "#e4572e",
      onAccent: "#1c1510",
      highlight: "#1e6f6a",
      warm: "#b8741a",
      danger: "#b42318",
      tonal: "#e7dac0",
      cover: ["#e4572e", "#e9b44c", "#1e6f6a"],
      coverBg: "#e7dac0",
      coverBorder: "#1c1510",
      lyricsBg: "#1c1510",
      lyricsText: "#f2e8d5",
      lyricsDim: "rgba(242,232,213,0.45)",
    },
    type: {
      display: { family: SOX, size: 28, line: 34 },
      title: { family: SOB, size: 17, line: 22 },
      body: { family: SO, size: 15, line: 22 },
      label: { family: SGM, size: 12, line: 16, upper: true, spacing: 2 },
      caption: { family: SGM, size: 13, line: 18 },
      number: { family: SGM, size: 12, line: 16 },
    },
    radius: { sm: 10, md: 16, lg: 24, cover: 24 },
    border: 1.5,
    shadow: "solid",
    shadowColor: "#1c1510",
    pixelCorners: false,
    progress: "wave",
    play: "sticker",
    background: "solid",
    cover: "disc",
    signature: "none",
    actions: "pills",
    nav: "plain",
    icons: "rounded",
    dynamic: false,
    lyricsLined: false,
    intro: "vinyl",
    motion: "spring",
    emoji: "💿",
  },
  {
    id: "terminal",
    name: "Terminal Pro",
    category: "combinado",
    tagline: "Consola de fósforo verde con alma de editor moderno: texto monoespaciado y barras de bloques.",
    dark: true,
    c: {
      bg: "#0b0f0c",
      surface: "#101a13",
      surface2: "#16261b",
      border: "#2c7a47",
      borderInput: "#5bff8a",
      text: "#e8fff0",
      textMuted: "#8fb09a",
      accent: "#5bff8a",
      onAccent: "#0b0f0c",
      highlight: "#ffc857",
      warm: "#ffc857",
      danger: "#ff6b5b",
      tonal: "#101a13",
      cover: ["#5bff8a", "#0b7a3a", "#ffc857"],
      coverBg: "#101a13",
      coverBorder: "#5bff8a",
      lyricsBg: "#101a13",
      lyricsText: "#5bff8a",
      lyricsDim: "rgba(91,255,138,0.4)",
    },
    type: {
      display: { family: VT, size: 40, line: 40, upper: true },
      title: { family: VT, size: 26, line: 28 },
      body: { family: VT, size: 22, line: 26 },
      label: { family: VT, size: 18, line: 20, upper: true, spacing: 1 },
      caption: { family: VT, size: 18, line: 22 },
      number: { family: VT, size: 20, line: 22 },
    },
    radius: { sm: 0, md: 0, lg: 0, cover: 0 },
    border: 1,
    shadow: "glow",
    shadowColor: "#5bff8a",
    pixelCorners: false,
    progress: "blocks",
    play: "square",
    background: "solid",
    cover: "square",
    signature: "scanlines",
    actions: "blocks",
    nav: "blocks",
    icons: "pixel",
    dynamic: false,
    lyricsLined: false,
    intro: "terminal",
    motion: "stepped",
    emoji: "🖥️",
  },
]

export const DEFAULT_THEME = "pixel"

export const CATEGORY_LABEL: Record<ThemeCategory, string> = {
  retro: "Retro",
  moderno: "Moderno",
  combinado: "Combinado",
}

// Dark-scheme tones for the three pixel-cover colors (red, coral, yellow), used by dynamic themes
const TONES = [
  { accent: "#ffb4ab", onAccent: "#690005", tonal: "#2b1618", lyricsBg: "#8c1519", lyricsText: "#ffdad6", lyricsDim: "#f0b8b3" },
  { accent: "#ffb59b", onAccent: "#5c1900", tonal: "#2e1c14", lyricsBg: "#7d2d10", lyricsText: "#ffdbcf", lyricsDim: "#f2bfa9" },
  { accent: "#f2c14e", onAccent: "#3f2e00", tonal: "#29220f", lyricsBg: "#5b4300", lyricsText: "#ffdf9e", lyricsDim: "#e9cd86" },
]

export function resolveTheme(theme: Theme, songId: number | null): Theme {
  if (!theme.dynamic || songId === null) return theme
  return { ...theme, c: { ...theme.c, ...TONES[songId % 3] } }
}

export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!
