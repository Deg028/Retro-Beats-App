import { createContext, ReactNode, useContext, useEffect, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { DEFAULT_THEME, getTheme, resolveTheme, Theme } from "./themes"

const THEME_KEY = "retro-beats:theme"
// The prototype stored a player design; map it to the closest theme once
const LEGACY_KEY = "retro-beats:design"
const LEGACY: Record<string, string> = { retro: "arcade", flat: "cinta", material: "pixel" }

type ThemeState = { theme: Theme; themeId: string; setThemeId: (id: string) => void; /** The saved theme has been read */ ready: boolean }

const ThemeCtx = createContext<ThemeState | null>(null)

export function ThemeProvider({ songId, children }: { songId: number | null; children: ReactNode }) {
  const [themeId, setId] = useState(DEFAULT_THEME)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(THEME_KEY), AsyncStorage.getItem(LEGACY_KEY)])
      .then(([saved, legacy]) => {
        const id = saved ?? (legacy ? LEGACY[legacy] : null)
        if (id) setId(getTheme(id).id)
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  const setThemeId = (id: string) => {
    setId(id)
    AsyncStorage.setItem(THEME_KEY, id).catch(() => {})
  }

  const theme = resolveTheme(getTheme(themeId), songId)
  return <ThemeCtx.Provider value={{ theme, themeId, setThemeId, ready }}>{children}</ThemeCtx.Provider>
}

function useThemeState() {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}

export const useTheme = () => useThemeState().theme
export const useThemeControl = () => useThemeState()
