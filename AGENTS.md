# Retro Beats

Native Android music player prototype built with Expo (React Native). The app lives in `mobile/`; read `mobile/AGENTS.md` before changing it (Expo-specific rules and commands).

The former web prototype (React + Vite, Figma Make) was discarded; a backup is in `_respaldo/prototipo-web.zip`.

## Layout

- `mobile/App.tsx` - fonts, themed intro, tab transitions, the player as a slide-up layer (drag the top bar down or press back to close), Android back handling, tab bar and mini player
- `mobile/src/components/Intro.tsx` - one opening animation per theme (`theme.intro`)
- `mobile/src/useNowPlaying.ts` - now-playing notification with the song and the chosen theme: a local notification with buttons in Expo Go, the expo-audio media notification in native builds. Never `import` from "expo-notifications" at runtime: its entry point crashes Expo Go (missing push module); go through `src/notifications.ts`, which loads only the local-notification parts
- `mobile/src/usePlayer.ts` - playback engine on `expo-audio`: queue, shuffle, repeat, sleep timer, lock screen, persistence
- `mobile/src/themes/themes.ts` - the theme engine: 6 themes (retro, moderno, combinado), each a full set of tokens plus style switches (cover, progress, play button, background, retro signature, icon set, dynamic color). Add a theme here and it appears in the Temas screen
- `mobile/src/themes/ThemeContext.tsx` - `ThemeProvider`, `useTheme()`; persists the chosen theme
- `mobile/src/components/ui.tsx` - themed primitives (`T`, `Icon`, `Cover`, `Surface`, `Press`, `PlayButton`, `ProgressTrack`, `Action`, `Chip`, `Button`) and `motion()`; screens never hard-code colors. Use `Press` instead of `Pressable` so every control has press feedback, and keep active states as accent fill + onAccent
- `mobile/src/screens/Player.tsx` - one player that adapts to the theme; `player/shared.tsx` has the seek/swipe hooks, synced lyrics and the queue and sleep-timer sheets
- `mobile/src/screens/Themes.tsx` - theme picker (Temas tab), each card drawn with its own theme
- `mobile/src/components/Chrome.tsx` - tab bar and mini player
- `mobile/src/theme.ts` - brand colors for the splash and pixel-art defaults only
- `mobile/src/data.ts` + `mobile/src/tracks.json` - catalog; `tracks.json` drives both the audio generator and song durations/lyric timing
- `mobile/scripts/` - generators for the demo chiptune tracks (`assets/audio`) and the app icons

## Commands (run in `mobile/`)

```bash
npx expo start          # dev server; scan the QR with Expo Go on the phone
npx tsc --noEmit        # typecheck
npm run lint            # lint
npx expo-doctor         # dependency/config checks
npm run generate:audio  # rebuild assets/audio from src/tracks.json
npm run build:apk       # installable APK through EAS
```

Write UI copy in Spanish. Binary assets are tracked with Git LFS (see `.gitattributes`).
