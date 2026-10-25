# Build log

| ID | Fecha | Estado | Falta | Más difícil de lo esperado |
| --- | --- | --- | --- | --- |
| S02 Inicio | 2026-10-25 | partial | Banner "Tu música del teléfono" cuando no hay canciones; el menú lateral enlaza a la pantalla de escaneo | Mezclar canciones demo y del teléfono sin que la cola salte entre fuentes: la cola ahora se queda en la fuente de la canción actual |
| S03 Reproductor | 2026-10-25 | partial | Carátula incrustada y etiquetas (artista, álbum); letra desde `.lrc` | Un archivo que no abre dejaba el reproductor atascado y luego en bucle infinito (más de 80 intentos en 6 s en la prueba): `play()` le quitaba la marca de roto y el contador de fallos se reiniciaba con cualquier actualización. Corregido: solo un toque de la persona da otra oportunidad y solo la reproducción real reinicia el contador |
| S04 Catálogo | 2026-10-25 | removed | — | Se quitó a petición de la persona: la app usa solo la música del teléfono; la pestaña pasó a "Música" (S07/S09) |
| S07 Biblioteca local | 2026-10-25 | partial | Vistas por álbumes, artistas y carpetas; lista con FlashList; la lista de canciones sigue siendo Inicio | `expo-media-library` no da etiquetas ni carátulas (lo advertía architecture.md); se decidió una rebanada que corre en Expo Go y dejar el módulo Kotlin para la versión instalable |
| S09 Archivos omitidos | 2026-10-25 | partial | Probar con el teléfono real (solo se vio con datos de ejemplo en el navegador) | Los motivos se calculan en una función pura (`library/files.ts`) para poder volver a clasificar sin repetir el escaneo (por ejemplo al incluir archivos cortos) |

| S03 Reproductor (letra y carátula) | 2026-10-25 | partial | Probado en el navegador con internet real; falta en el teléfono. Sin etiquetas ni carátula incrustadas | Los nombres de YouTube: hubo que limpiar etiquetas, ids y el orden "Título - Artista"; MusicBrainz mezcla versiones en vivo y recopilatorios (sin carátula) y por eso se prueban primero las ediciones de estudio. Los servidores devuelven 503 de vez en cuando: reintentos y un botón de reintento |

## Decisiones

- **Búsqueda en internet:** MusicBrainz y Cover Art Archive (datos abiertos) para nombres y carátulas, LRCLIB para letras. Solo se envía título y artista. Va activada porque la persona lo pidió, y se puede apagar en la pestaña Música. Lo encontrado se guarda; lo no encontrado se reintenta tras una semana.

- **Expo Go en Android 13+ no puede pedir el permiso de audio** (error real: "AUDIO permission ... not declared in AndroidManifest"). La app prueba primero `expo-media-library` y, si recibe ese error, usa carpetas elegidas con el selector de Android (`expo-file-system`), que recuerda el acceso. En la APK, el plugin de `app.json` declara el permiso y la lectura es automática y completa.
- **Solo música del teléfono:** se quitaron las canciones demo (siguen en el historial de Git). En el modo carpetas la duración se aprende al reproducir.

- **Sin módulo Kotlin todavía.** `architecture.md` plantea un módulo nativo y un development build; esta rebanada usa `expo-media-library`, que funciona en Expo Go. Cambiarlo después solo toca `src/library/scan.ts`.
- **Archivos muy cortos** (menos de 15 s) se omiten por defecto: el índice de Android incluye tonos y sonidos del sistema. Se pueden incluir desde la pantalla de escaneo.
- **Ids del teléfono** = 1 000 000 + número de MediaStore, para no chocar con las canciones demo.
- **No verificado en un teléfono real:** permiso, lectura del índice y reproducción de `content://`. En el navegador solo se probó con una lista de ejemplo.

- 2026-10-25 · rendimiento y carátulas · hecho (sin probar en el teléfono): el contador de tiempo ya no vive en el objeto del reproductor (`usePlaybackTime` solo en Player y MiniPlayer), listas derivadas memorizadas, rescaneo de carpetas cada 5 min y sin reconstruir si no hay cambios; duración vieja ya no se copia a la canción siguiente; carátulas: se prueba primero el catálogo de Apple Music (`online/itunes.ts`) y luego MusicBrainz.
- 2026-10-25 · prueba en el teléfono real (TECNO, USB): nombres de SnapTube '(MP3_160K)' limpios, carátulas oficiales visibles (UB40, Creepy Nuts, Gravity Falls); búsqueda por título+duración (±3 s) para canciones sin artista; índice en línea v2.
- 2026-10-25 · letras y búsqueda · hecho y probado en el teléfono (TECNO, USB): coro expandido con sus tiempos (UB40), una sola lengua por línea (Creepy Nuts), letras solo con duración conocida, ajuste ±0,5 s por canción; búsqueda por título/artista en Inicio (icono de lupa junto al ecualizador, resultados de toda la biblioteca).
- 2026-10-25 · SnapTube y búsqueda masiva · hecho y probado en el teléfono: 58 letras .lrc leídas, 161 miniaturas desde el historial de SnapTube (expo-sqlite), miniatura completa sobre fondo borroso; búsqueda probada con 50 consultas (47 coinciden con lo esperado por nombre de archivo, 3 difieren por nombres corregidos en línea).
