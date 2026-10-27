# Retro Beats

Native Android music player prototype built with Expo (React Native). The app lives in `mobile/`; read `mobile/AGENTS.md` before changing it (Expo-specific rules and commands).

The former web prototype (React + Vite, Figma Make) was discarded; a backup is in `_respaldo/prototipo-web.zip`.

## Layout

- `mobile/App.tsx` - fonts, themed intro, tab transitions, the player as a slide-up layer (drag the top bar down or press back to close), Android back handling, tab bar and mini player
- `mobile/src/components/Intro.tsx` - one opening animation per theme (`theme.intro`)
- `mobile/src/useNowPlaying.ts` - now-playing notification with the song and the chosen theme: a local notification with buttons in Expo Go, the expo-audio media notification in native builds (themed: accent colour, theme emoji and name, previous/next arrows; the arrows and the colour come from `mobile/patches/expo-audio+*.patch`, applied by `patch-package` on `npm install`; expo-audio ships precompiled, so `expo.autolinking.android.buildFromSource` in `mobile/package.json` makes the build compile it from source, and without it the patch does nothing; changing the expo-audio version means redoing the patch). Never `import` from "expo-notifications" at runtime: its entry point crashes Expo Go (missing push module); go through `src/notifications.ts`, which loads only the local-notification parts
- `mobile/src/library/` - the phone's music, which is the app's only music (no demo songs): `scan.ts` reads the system media index with `expo-media-library`, then walks the whole storage from `/storage/emulated/0` and memory cards (`scanDevice`, folders like Android, Ringtones, Alarms skipped) to find music the index doesn't list, merged by file name; it needs «all files access» (`MANAGE_EXTERNAL_STORAGE`, opened from the Música tab with `expo-intent-launcher`), and without it the walk just comes back short. When the build can't get the audio permission (Expo Go on Android 13+) it walks folders the person picked with `expo-file-system` (SAF; Android keeps the access, the choice is saved and rescanned on every open and return to the app); `files.ts` (pure: file name to title/artist, skip reasons, ids); `useDeviceLibrary.ts` (one scan at a time, mode switch, rescans). Songs carry the file `uri` and ids from `DEVICE_ID_BASE`. `screens/Scan.tsx` (the Música tab) shows what was found and what was skipped and why
- `mobile/src/library/tags.ts` - reads what is saved inside an MP3 (ID3v2, then ID3v1): the title for files whose name says nothing (only digits, e.g. Telegram's `1_4945510745191220486.mp3`, or `AUD-…-WA0001`), the artist for files whose name gives none (`useDeviceLibrary.ts` applies and remembers both), and the embedded cover picture (`useSongInfo.importEmbedded` copies it to app storage)
- `mobile/src/library/names.ts` - pure: cleans file names left by YouTube downloaders ("Official Video", `[id]`, "- Topic") into artist and title, builds the search guesses (with `feat.` removed, then artist and title swapped)
- `mobile/src/online/` - lookups of lyrics, names and covers, for the song that is playing and for the whole library: `lrclib.ts` (lyrics, synced or plain; writes out choruses that are only labelled "CHORUS", keeps one language when a file repeats each line in three; lyrics are only looked up once the song length is known, so the timings fit that recording; the person can nudge them in the player), `itunes.ts` (official album art from the public Apple Music catalogue search, tried first: one quick request), `deezer.ts` (Deezer's public catalogue search, tried next), `musicbrainz.ts` (names, album, and the front cover from the Cover Art Archive, studio releases first; 1 request per second; the fallback for covers), `lookup.ts` (runs lyrics and cover searches side by side, then with the song's title alone, and saves the cover in the app's storage), `lyricsovh.ts` (plain lyrics from lyrics.ovh when LRCLIB has none; rests 10 min after a failure), `local.ts` (lyrics file beside a song, e.g. SnapTube's `name_private.lrc`), `snaptube.ts` (reads SnapTube's download history from the `snaptube/db` folder the person picks, copies it into app storage and queries it with `expo-sqlite`: each download has its video thumbnail, used as cover when no official one exists), `store.ts` (what was found, saved on the phone; lyrics under one key per song), `useSongInfo.ts` (looks up the current song once its length is known, plus a bulk run; a miss is retried after a week, or at once when `SOURCES_V` is bumped for a new source; on opening, the app copies embedded covers, then SnapTube thumbnails, then searches every song still missing lyrics or cover; saved covers whose file is gone are forgotten and found again). Public APIs only, sending just title and artist; the person can turn it off in the Música tab. `components/Art.tsx` shows the found cover and falls back to the pixel art
- `mobile/src/usePlayer.ts` - playback engine on `expo-audio` (the running time is NOT in the player object: screens that draw it call `usePlaybackTime(player)`, so the app does not redraw four times a second): queue, shuffle, repeat, sleep timer, lock screen, persistence; files that fail to open are marked broken and skipped (a tap retries; automatic skipping never does)
- `mobile/src/playlists.ts` and `screens/Playlists.tsx` - the person's own playlists (make, rename, fill with a song picker, play in order or shuffled), saved on the phone
- `mobile/src/useListening.ts`, `mobile/src/recap.ts` (pure) and `screens/Recap.tsx` - counts the time each song is really heard, by month; the recap shows hours, top song, artist and album for a month or a year
- `mobile/src/online/romaji.ts` - Hepburn reading under Japanese lyric lines: kana on the phone, lines with kanji through Google Translate, only when the person turns «Romaji» on
- `mobile/src/screens/Home.tsx` - the song list by section (Agregadas, Favoritas, Top, Recientes) with search; `components/Drawer.tsx` is the side menu; `components/GameBoy.tsx` is the cover of the Bolsillo LCD theme; `components/Pixel.tsx` the generated pixel-art covers
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

## Status (2026-10-27)

- Current version: **0.2.3-alpha** (`mobile/app.json`: `version` 0.2.3, `android.versionCode` 5). Bump both for every APK, or Android won't treat it as an update. The `User-Agent` in `mobile/src/online/http.ts` carries the version too.
- APKs live in `apk/` as `RetroBeats-<version>-alpha.apk` (Git LFS). `RetroBeats-0.1.0-alpha.apk` is only an LFS pointer to an older 24 MB build; 0.2.0 to 0.2.3 are real EAS builds (~88 MB).
- Done and checked on the phone (TECNO LH7n, Android 14, 186 songs, mostly SnapTube and Telegram downloads):
  - Telegram files named only with digits show their real title, read from the ID3 tag.
  - Artists are read from the tag, including when they come after a large cover picture.
  - 182 of 186 songs have a cover (embedded pictures, SnapTube thumbnails, Apple Music, Deezer); 75 have lyrics.
  - The media notification has previous/next arrows and the theme's accent colour, emoji and name. Next/previous from the notification change songs and playback keeps going.
  - Synced lyrics with romaji work.
- Version history:
  - 0.2.3: music search through all folders, with the «Carpetas con música» list in the Música tab.
  - 0.2.0: ID3 titles, themed notification.
  - 0.2.1: tag artist and embedded covers, Deezer and lyrics.ovh, the bulk lookup waits and goes on after server errors.
  - 0.2.2: fixed songs pausing right after they start. Re-registering the lock-screen session rebuilds it, so `usePlayer.setNowPlaying` registers once and only again for a new theme colour while paused. Also reads the whole ID3 tag.

## Pending and known issues

- 0.2.3 whole-storage music walk, tested on the phone: it lists the folders with music (SnapTube Audio 166, Music/Telegram 32, Download/Music 3) and found a test file in a `.nomedia` folder that the system index does not list; a copy in Ringtones was left out. It works with only the audio permission; «all files access» was granted by `appops` and gave the same result, and the button opens the right Android page. The walk adds some seconds to a scan. The XMusic `.wav` backups were listed as songs; the fix (skip folders named *backup*) is in the code after 0.2.3 and not yet in an APK.

- 111 songs have no lyrics. The ones checked are instrumentals, game/anime covers and YouTube raps that LRCLIB and lyrics.ovh don't have. YouTube was not used: it has no keyless search, and scraping it breaks its terms. The official YouTube Data API or Genius would need a key from the user.
- Tags are only read from MP3 (ID3). `.m4a`/`.opus` files (MP4 atoms, Vorbis comments) keep the name from the file; WhatsApp voice notes (`AUD-…-WA0022`) show that name.
- The phone's SystemUI logs `FileNotFoundException` for `files/covers/*.jpg`: expo-audio passes the cover's private path as artwork URI, which SystemUI can't open. Harmless; the notification shows the cover the service loads itself.
- A new theme colour reaches the notification only after the music is paused (see 0.2.2 above).
- The APK ships the x86 and x86_64 libraries too (emulators only, ~20 MB). `app.json` still asks for `READ/WRITE_EXTERNAL_STORAGE` and `READ_MEDIA_VISUAL_USER_SELECTED`, which an audio player on Android 13+ doesn't need. The app data backup (`allowBackup`) is on.
- `replica/features.csv` and `replica/build-log.md` are behind the code (playlists, Recap, tags and covers are done).

## Decisions

- **Finding the music wherever the phone keeps it is a core feature, to keep through every version up to the 1.0.0 beta.** The app must not depend on one app's folder (SnapTube, Telegram…): it walks the phone's folders until it finds the audio. Keep `scanDevice` working and tested on the phone with each release, and do not regress it when changing scans or permissions. The Música tab lists the folders with music found. Before a Play Store release, `MANAGE_EXTERNAL_STORAGE` needs Google's declaration (or a different approach).

- Only public APIs that need no key, sending just title and artist; the person can turn lookups off in the Música tab.
- Stellio Player is the reference only through its public reviews (`replica/fixes.md`); its themes and visuals are not copied.
- The user talks in Spanish; replies and UI copy are in Spanish. Confirm before each Replica skill step.

## How we work (process)

- **Versions are batched.** Changes pile up on `main` as unreleased work (listed under Pending); an APK is built only when the person asks or a batch is ready. Do not build a new APK for a single small fix.
- **Commit locally as you go; push only when the person says so** (they continue from another PC after each push). Never push on your own initiative. When pushing, the APK goes in the same commit as the version bump and the AGENTS.md update.
- **Release steps:** bump `version` and `versionCode` in `mobile/app.json` and the `User-Agent` in `online/http.ts` -> `git lfs pull` -> `npx tsc --noEmit` and `npm run lint` -> `CI=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile preview --non-interactive --no-wait --json` -> wait for `FINISHED` (free queue 15-40 min, build 5-8 min) -> the APK URL is `artifacts.buildUrl` in `build:view --json` -> `curl -sL --compressed -o apk/RetroBeats-<version>-alpha.apk <url>` -> install and test on the phone -> record the result in this file.
- **Waiting for a build:** use a background `while true; do ...; case "$status" in FINISHED*|ERRORED*|CANCELED*) break;; esac; sleep 60; done`. Do NOT write it as `until x; case ...; do`: the `case` returns 0 and the loop ends at once.
- **Test on the phone after every release**, with the checks under "Testing on the phone". Whatever is not tested on the device is written down as untested here, never as done.
- **Test tricks:** `adb shell pm grant com.retrobeats.app android.permission.READ_MEDIA_AUDIO`; `adb shell appops set com.retrobeats.app MANAGE_EXTERNAL_STORAGE allow` to grant «all files access» without the settings page; `adb exec-out screencap -p > file.png`; tap by the `bounds` read from the `uiautomator dump` (the screen is 1080x2460); to test the folder walk, create a folder with a `.nomedia` file and a copy of a song under `/sdcard`, rescan, then delete it (use `MSYS_NO_PATHCONV=1` in Git Bash). Leave no test files on the phone.
- **Claude Design:** visual explorations of new themes live in a Design artifact (retro + modern mockups: "Vinilo" and "Horizonte 84", each with intro, home and player). They are mockups only; turning one into a theme means adding it to `themes.ts` and an animation to `Intro.tsx`. The canvas link is in the person's Claude account, not in this repo.

## New machine setup

1. `git clone https://github.com/Deg028/Retro-Beats-App.git`, then `git lfs pull`. The icons in `mobile/assets/*.png` are LFS files. Without them, the EAS build fails in prebuild with `Could not find MIME for Buffer <null>`.
2. `cd mobile && npm install`. Its `postinstall` runs `patch-package`, which applies `patches/expo-audio+58.0.10.patch`.
3. No local Java or Android SDK is needed: builds run on EAS. `npx eas-cli login` (account `deg_018`, project `retro-beats`).
4. Build: `npx eas-cli build --platform android --profile preview --non-interactive --json`.
   - The JSON's `artifacts.buildUrl` is the APK; save it as `apk/RetroBeats-<version>-alpha.apk`, then commit and push.
   - Build logs (`logFiles`) are compressed: fetch them with `curl --compressed`.
   - The Gradle log shows `> Task :expo-audio:…` lines when the patch is really compiled.
5. Phone over wireless ADB (Android platform-tools, installed at `C:\platform-tools` on the first PC):
   - Pair once: `adb pair <ip>:<pairing port> <code>` (Opciones de desarrollador → Depuración inalámbrica → Vincular con código).
   - Connect: `adb connect <ip>:<port>`, with the port shown on the main Depuración inalámbrica screen; it changes every time wireless debugging restarts. The phone was at 192.168.1.15.
   - VS Code has the `android-adb` MCP server in `.vscode/mcp.json`, which expects ADB in `C:\platform-tools`.
6. Install with `adb install -r apk/RetroBeats-<version>-alpha.apk`. Same signing key on EAS, so the person's data stays.

## Testing on the phone

- Playback state and the song in the notification: `adb shell dumpsys media_session`, the `ExpoAudioLockScreenSession` entry (`state=PLAYING/PAUSED`, `custom actions` lists Previous/Next Track).
- Notification colour: `adb shell dumpsys notification --noredact`, the `pkg=com.retrobeats.app` record's `color=`.
- Screen text: `adb shell uiautomator dump`, then read the XML. Song rows have `content-desc` "Reproducir <título>", covers "Carátula del álbum", "Miniatura del video" or "Portada pixel art".
- The Música tab shows "N con carátula · N con letra" and the progress of the library lookup ("Buscando X de Y…", about 5 songs a minute).
- The notification shade also shows the person's private messages: read the notification with `dumpsys` instead of screenshots where possible. The phone also has a third-party "Reproductor de música" (`musicplayer.musicapps.music.mp3player`). When looking at it, skip its full-screen ads and never tap "Instalar".
