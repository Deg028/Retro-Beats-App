import { useEffect } from "react"
import { AppState } from "react-native"
import { requireOptionalNativeModule } from "expo"
import { THEMES } from "./themes/themes"

type ThemeIconModule = { setIcon: (id: string, all: string[]) => boolean }
// Missing in Expo Go and in builds older than the one that added it
const native = requireOptionalNativeModule<ThemeIconModule>("ThemeIcon")
const ALL = THEMES.map((t) => t.id)

/**
 * Keeps the app's launcher icon in the style of the chosen theme. The switch is made when the app goes to the background,
 * so the launcher never changes the icon under the screen the person is looking at.
 */
export function useThemeIcon(themeId: string) {
  useEffect(() => {
    if (!native) return
    const apply = () => {
      try {
        native.setIcon(themeId, ALL)
      } catch {
        // the icon just stays as it was
      }
    }
    const sub = AppState.addEventListener("change", (state) => state !== "active" && apply())
    return () => sub.remove()
  }, [themeId])
}
