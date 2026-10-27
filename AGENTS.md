# Retro Beats

Native Android music player prototype built with Expo (React Native). The app lives in `mobile/`; read `mobile/AGENTS.md` before changing it (Expo-specific rules and commands).

The former web prototype (React + Vite, Figma Make) was discarded; a backup is in `_respaldo/prototipo-web.zip`.

## Layout

- `mobile/App.tsx` - fonts, themed intro, tab transitions, the player as a slide-up layer (drag the top bar down or press back to close), Android back handling, tab bar and mini player
- `mobile/src/components/Intro.tsx` - one opening animation per theme (`theme.intro`)
- `mobile/src/useNowPlaying.ts` - now-playing notification with the song and the chosen theme: a local notification with buttons in Expo Go, the expo-audio media notification in native builds (themed: accent colour, theme emoji and name, previous/next arrows; the arrows and the colour come from `mobile/patches/expo-audio+*.patch`, applied by `patch-package` on `npm install`, so changing the expo-audio version means redoing that patch). Never `import` from "expo-notifications" at runtime: its entry point crashes Expo Go (missing push module); go through `src/notifications.ts`, which loads only the local-notification parts
- `mobile/src/library/` - the phone's music, which is the app's only music (no demo songs): `scan.ts` reads the system media index with `expo-media-library`, or, when the build can't get the audio permission (Expo Go on Android 13+), walks folders the person picked with `expo-file-system` (SAF; Android keeps the access, the choice is saved and rescanned on every open and return to the app); `files.ts` (pure: file name to title/artist, skip reasons, ids); `useDeviceLibrary.ts` (one scan at a time, mode switch, rescans). Songs carry the file `uri` and ids from `DEVICE_ID_BASE`. `screens/Scan.tsx` (the Música tab) shows what was found and what was skipped and why
- `mobile/src/library/tags.ts` - reads the title and artist saved inside an MP3 (ID3v2, then ID3v1) for files whose name says nothing (only digits, e.g. Telegram's `1_4945510745191220486.mp3`, or `AUD-…-WA0001`); `useDeviceLibrary.ts` applies them and remembers them
- `mobile/src/library/names.ts` - pure: cleans file names left by YouTube downloaders ("Official Video", `[id]`, "- Topic") into artist and title, builds the search guesses (with `feat.` removed, then artist and title swapped)
- `mobile/src/online/` - lookups for the song that is playing: `lrclib.ts` (lyrics, synced or plain; writes out choruses that are only labelled "CHORUS", keeps one language when a file repeats each line in three; lyrics are only looked up once the song length is known, so the timings fit that recording; the person can nudge them in the player), `itunes.ts` (official album art from the public Apple Music catalogue search, tried first: one quick request), `musicbrainz.ts` (names, album, and the front cover from the Cover Art Archive, studio releases first; 1 request per second; the fallback for covers), `lookup.ts` (runs both, saves the cover in the app's storage), `local.ts` (lyrics file beside a song, e.g. SnapTube's `name_private.lrc`), `snaptube.ts` (reads SnapTube's download history from the `snaptube/db` folder the person picks, copies it into app storage and queries it with `expo-sqlite`: each download has its video thumbnail, used as cover when no official one exists), `store.ts` (what was found, saved on the phone; lyrics under one key per song), `useSongInfo.ts` (looks up the current song once its length is known, plus a bulk run; a miss is retried after a week). Public APIs only, sending just title and artist; the person can turn it off in the Música tab. `components/Art.tsx` shows the found cover and falls back to the pixel art
- `mobile/src/usePlayer.ts` - playback engine on `expo-audio` (the running time is NOT in the player object: screens that draw it call `usePlaybackTime(player)`, so the app does not redraw four times a second): queue, shuffle, repeat, sleep timer, lock screen, persistence; files that fail to open are marked broken and skipped (a tap retries; automatic skipping never does)
- `mobile/src/themes/themes.ts` - the theme engine: 6 themes (retro, moderno, combinado), each a full set of tokens plus style switches (cover, progress, play button, background, retro signature, icon set, dynamic color). Add a theme here and it appears in the Temas screen
- `mobile/src/themes/ThemeContext.tsx` - `ThemeProvider`, `useTheme()`; persists the chosen theme
- `mobile/src/components/ui.tsx` - themed primitives (`T`, `Icon`, `Cover`, `Surface`, `Press`, `PlayButton`, `ProgressTrack`, `Action`, `Chip`, `Button`) and `motion()`; screens never hard-code colors. Use `Press` instead of `Pressable` so every control has press feedback, and keep active states as accent fill + onAccent
- `mobile/src/screens/Player.tsx` - one player that adapts to the theme; `player/shared.tsx` has the seek/swipe hooks, synced lyrics and the queue and sleep-timer sheets
- `mobile/src/screens/Themes.tsx` - theme picker (Temas tab), each card drawn with its own theme
- `mobile/src/components/Chrome.tsx` - tab bar (Inicio, Canción, Música, Temas) and mini player
- `mobile/src/theme.ts` - brand colors for the splash and pixel-art defaults only
- `mobile/src/data.ts` - the `Song` type and time formatting. `mobile/src/tracks.json`, `assets/audio` and `scripts/generate-tracks.mjs` are the old demo chiptune tracks, no longer used by the app
- `mobile/scripts/` - generators for the demo tracks and the app icons

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
