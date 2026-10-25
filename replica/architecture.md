# Architecture: Retro Beats (reproductor local que arregla lo que fallaba en la categoría)

Base: `replica/recon.md` (la app propia) y `replica/features.csv`. No reutiliza nada de Stellio salvo la lista de problemas que sus usuarios describen en público.

## Stack

| layer | choice | why |
| --- | --- | --- |
| app | Expo SDK 58 + React Native + TypeScript (ya existente en `mobile/`) | Es lo que ya hay y funciona; no se reescribe |
| build | **EAS development build** en lugar de Expo Go | El módulo nativo de biblioteca no corre en Expo Go; EAS compila en la nube, sin Android Studio |
| biblioteca nativa | **Módulo Expo local en Kotlin** (`mobile/modules/retro-library`) | `expo-media-library` no da artista, álbum, ID3 ni carátula incrustada (docs v58). Kotlin lee MediaStore + `MediaMetadataRetriever` + `loadThumbnail`. Además es el primer paso hacia la migración a Kotlin |
| audio | `expo-audio` (actual) | Ya integrado: cola, fondo, pantalla de bloqueo. Siguiente/anterior en la pantalla de bloqueo y Android Auto quedan para Media3 en el módulo nativo |
| database | **SQLite local** con `expo-sqlite`, WAL, migraciones con `PRAGMA user_version` en `SQLiteProvider.onInit` | Todo es local y offline; está incluido en Expo; soporta bibliotecas de miles de canciones |
| listas largas | `@shopify/flash-list` | Bibliotecas grandes sin tirones (queja "gives up" con muchos temas) |
| carpetas extra / SD | Storage Access Framework desde el módulo Kotlin (`ACTION_OPEN_DOCUMENT_TREE` + `takePersistableUriPermission`) | Las docs de `expo-file-system` v58 no garantizan que el permiso persista; en Kotlin se controla |
| backup | Auto Backup de Android para la base de datos + exportar/importar un JSON (`expo-file-system` + `expo-sharing`) | Ajustes y listas sobreviven al cambio de teléfono sin preguntar al abrir |
| auth | ninguna | No hay cuentas: la música es del teléfono |
| payments | Google Play Billing (vía `react-native-iap` o RevenueCat), **más adelante** | En Play los bienes digitales deben cobrarse con Play Billing; no aplica Stripe. "Restaurar compra" sale gratis de la cuenta de Google |
| datos online opcionales | MusicBrainz + Cover Art Archive (carátulas), LRCLIB (letras): APIs públicas, con User-Agent propio y 1 petición/s | Solo cuando la persona lo pide; siempre con error claro |
| email / jobs / hosting | no aplica | Sin servidor. Las tareas en segundo plano corren en el teléfono |

## Schema

Tables: 14 (`replica/schema.sql`, validado en SQLite, 11 índices). Access rules: **ninguna en datos**. Es una base local de una sola persona. La autorización es el permiso de Android (`READ_MEDIA_AUDIO` en Android 13+, `READ_EXTERNAL_STORAGE` hasta Android 12) y las carpetas elegidas con SAF.

Desviaciones conscientes de las reglas por defecto de la skill:
- ids `integer` = `_ID` de MediaStore (no uuid), para que reescanear actualice en vez de duplicar;
- tiempos en milisegundos UTC como `integer` (SQLite no tiene `timestamptz`);
- sin columna de dueño (`user_id`), porque solo hay un usuario.

Restricciones que resuelven quejas en la base de datos, no en la interfaz:
- `playlist_items ... on delete cascade`: un archivo borrado desaparece de las listas (arreglo #2).
- `playlist_items_no_dupes`: no se puede meter la misma canción dos veces (pedido en una reseña).
- `artwork_overrides` por `album_key`: la carátula elegida a mano sobrevive a reescaneos y nunca cambia el orden (arreglo #1).
- `playback_state` con `check (id = 1)`: un solo estado de reproducción que retomar (arreglo #7).

## API

No hay servidor. La "API" son las funciones del módulo nativo y de la capa de datos en TypeScript.

**Módulo nativo `RetroLibrary` (Kotlin)**

| función | hace | input | output | flow |
| --- | --- | --- | --- | --- |
| `requestAudioPermission()` | pide `READ_MEDIA_AUDIO` o `READ_EXTERNAL_STORAGE` según la versión | — | `granted \| denied \| blocked` | F01 |
| `listVolumes()` | memoria interna y tarjetas SD | — | `{id, label, removable}[]` | F01 |
| `scanMediaStore(sinceGeneration, page)` | lee audio de MediaStore por páginas | generación previa, página | `TrackRow[]`, nueva generación | F01 |
| `readTags(uri)` | ID3/Vorbis/MP4: título, artista, álbum, pista, disco, año, ReplayGain, letra incrustada | content uri | `Tags` | F01, F03 |
| `extractArtwork(uri, maxPx)` | carátula incrustada o miniatura del sistema, guardada en caché | content uri, tamaño | ruta local o `null` + motivo | F03 |
| `findFolderArt(relativePath)` | busca `cover.jpg`, `folder.jpg` en la carpeta | ruta | ruta local o `null` | F03 |
| `pickFolder()` | selector de carpeta con permiso persistente | — | `tree_uri` | F01 |
| `listTree(treeUri)` | audio dentro de una carpeta elegida | tree uri | `DocRow[]` + motivos de omisión | F01 |
| `probe(uri)` | ¿existe y se puede abrir? | content uri | `ok \| missing \| unsupported \| unreadable` | F02 |

**Capa de datos (TypeScript, `mobile/src/db/`)**

| función | hace | flow |
| --- | --- | --- |
| `library.sync()` | escaneo incremental: alta, cambio, baja (`available=0` y luego borrado), registra `scan_runs` y `scan_issues` | F01 |
| `library.tracks/albums/artists/folders(query, sort)` | listas con orden por disco y pista, y alfabético con índice | F01, F02 |
| `art.resolve(albumKey)` | cadena: override > incrustada > carpeta > miniatura del sistema > online opcional > placeholder pixel | F03 |
| `art.setOverride(albumKey, source)` | guarda la elegida sin tocar el orden | F03 |
| `player.playSafe(trackId)` | `probe` antes de reproducir; si falla, aviso y salta a la siguiente | F02 |
| `queue.save()` / `queue.restore()` | persiste cola, índice y posición (cada 5 s, al pausar y al ir a segundo plano) | F04 |
| `playlists.*` | crear, renombrar, añadir, mover, borrar | — |
| `settings.get/set` | diseño, orden, sonido, normalización | — |
| `backup.export()` / `backup.import()` | JSON con listas, favoritas, overrides y ajustes | F05 |
| `billing.restore()` | consulta compras de Play y actualiza `entitlements` | F05 |

Webhooks in: ninguno. Webhooks out: ninguno.
Jobs (en el teléfono):
- `library.sync` al abrir y cuando cambia MediaStore (ContentObserver), con antirrebote de 5 s;
- guardado de la cola cada 5 s mientras suena;
- limpieza de la caché de carátulas por encima de 200 MB (LRU).

## The parts that bite

- **Expo Go deja de servir.** El módulo Kotlin exige una development build (`eas build --profile development`), que se instala una vez en el teléfono. Después, los cambios de JS siguen recargando al instante. Cambiar Kotlin implica otra build en la nube.
- **Permisos por versión de Android:** `READ_MEDIA_AUDIO` (13+) frente a `READ_EXTERNAL_STORAGE` (≤12). Hay que manejar "denegado para siempre" llevando a Ajustes del sistema.
- **Ids de MediaStore inestables:** un reindexado puede cambiar `_ID`. Mitigación: overrides por `album_key`; las listas se reconcilian por `relative_path + display_name` antes de borrar en cascada.
- **Tarjeta SD:** está en otro volumen de MediaStore y puede desmontarse. Se marca `available=0` en lugar de borrar mientras no esté montada.
- **Solo URIs `content://`:** nada de rutas de archivo; todas las lecturas pasan por ContentResolver.
- **Bibliotecas grandes (10 mil o más):** inserciones por lotes dentro de transacciones, índices ya definidos, FlashList y carátulas en miniatura de 256 px cacheadas en disco.
- **Carátulas:** decodificar imágenes grandes satura la memoria. Siempre se reduce con `inSampleSize` en Kotlin.
- **Errores de red de las carátulas online** ("chain validation", "unsupported uri" en las reseñas): solo HTTPS a APIs públicas, tiempo límite, y mensaje claro en español con la opción de elegir de la galería.
- **Idempotencia del escaneo:** dos escaneos a la vez corromperían los conteos. Se usa un único escaneo activo (`scan_runs.status='running'`) y el segundo se ignora.
- **Normalización:** `expo-audio` solo baja el volumen (máximo 1.0), así que ReplayGain se aplica atenuando, con un margen configurable.
- **Pantalla de bloqueo:** con `expo-audio` y un solo reproductor no hay siguiente/anterior. Queda pendiente para Media3.
- **Compras:** Play Billing exige reconocer (acknowledge) la compra en 3 días o se reembolsa. Sin servidor, la verificación se hace contra Play en el teléfono, que es suficiente para quitar anuncios o desbloquear temas.
- **Offline:** todo funciona sin conexión salvo la búsqueda opcional de carátulas y letras.
- **Privacidad:** no sale ningún dato del teléfono salvo las búsquedas online que la persona inicia. No hay cuentas, así que no hay datos personales en ningún servidor.

## Build order

1. **Vertical slice (feo pero real):** development build + `RetroLibrary.requestAudioPermission` + `scanMediaStore` + tablas `tracks` y `albums` + lista simple en **S07** + reproducir un archivo real en **S03** con su carátula incrustada.
2. **Must-haves:** cadena de carátulas y **S11** (`artwork_overrides`); `player.playSafe` y limpieza de listas (`playlist_items`); escaneo transparente con carpetas, SD y **S09** (`folders`, `scan_runs`, `scan_issues`); **S08** álbum/artista/carpeta con orden por disco.
3. **Should-haves:** ajustes que se guardan solos y backup en **S10** (`settings`, export/import); diseño a elegir (1, 2 o 3 columnas, lista, títulos que se desplazan, índice alfabético); **S12** listas de reproducción; compra con "Restaurar compra" (`entitlements`).
4. **Could-haves:** retomar cola y posición (`queue_items`, `playback_state`), ReplayGain, letras desde `.lrc` e incrustadas, búsqueda online opcional.
5. **Rediseño moderno-retro:** lo define `/replica-design` y se aplica a todas las pantallas nuevas desde el principio.

Los 11 temas de demostración se quedan como "Catálogo" de ejemplo hasta que haya música local; después pueden quitarse.
