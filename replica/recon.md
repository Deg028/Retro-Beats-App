# Recon map: Retro Beats (Android, Expo)

Scope: la app propia, como base para aplicar los arreglos de `fixes.md`. **No es un recon de Stellio**: no se mapearon sus pantallas ni sus flujos.
For: personas que escuchan su propia música guardada en el teléfono y quieren un reproductor retro que no falle.
Date: 2026-10-25

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | código de Retro Beats | `mobile/` | App.tsx, src/usePlayer.ts, src/screens/*, src/components/* |
| 2 | reseñas de Stellio | `replica/reviews.csv` | solo para saber qué falla en la categoría |

## Core loop

Abrir la app, encontrar tu música y que suene con su carátula, sin errores.

## Screens

| ID | screen | how to reach | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Splash | al abrir | marca, carga de fuentes | logo, ecualizador, barra de carga | cargando |
| S02 | Inicio | pestaña Inicio | biblioteca guardada: agregadas, favoritas, top, recientes, mix | stats, chips, lista | vacío, lleno |
| S03 | Reproductor | pestaña Canción, mini player, tocar canción | reproducir y controlar | portada, barra de progreso, controles, letra | sin canción, sonando, en pausa, cargando |
| S04 | Catálogo | pestaña Catálogo | explorar todas las canciones, guardar en biblioteca | cuadrícula de 2 columnas | lleno |
| S05 | Cola (hoja) | botón cola | ver, saltar y quitar de la cola | lista | vacía, llena |
| S06 | Temporizador (hoja) | botón luna | dormir en N min o al acabar | opciones | activo, apagado |
| S07 | Biblioteca local | **nueva** | canciones del teléfono por canciones, álbumes, artistas, carpetas | pestañas, lista o cuadrícula | sin permiso, escaneando, vacía, llena |
| S08 | Álbum / artista / carpeta | **nueva**, desde S07 | detalle con sus canciones | cabecera con carátula, lista | lleno |
| S09 | Archivos omitidos | **nueva**, desde S07 o S10 | qué no se importó y por qué | lista de motivos | vacío, lleno |
| S10 | Ajustes | **nueva** | carpetas, diseño, sonido, copia de seguridad, compra | secciones | — |
| S11 | Editor de carátula (hoja) | **nueva**, mantener pulsada una carátula | elegir carátula: incrustada, carpeta, galería, internet | vista previa, fuentes | cargando, error claro |
| S12 | Listas de reproducción | **nueva** | crear y editar listas | lista, reordenar | vacía, llena |

Hoy existen S01 a S06 con 11 canciones de demostración. S07 a S12 son nuevas.

## Flows

```
F01 Primera vez: ver mi música
    S01 -> permiso de audio -> S07 (escaneando) -> S07 (lleno)
    edge: permiso denegado, 0 archivos, tarjeta SD, archivos omitidos -> S09

F02 Reproducir
    S07/S08 -> tocar canción -> S03
    edge: archivo borrado, formato no soportado -> aviso y salta a la siguiente

F03 Arreglar una carátula
    S03/S08 -> mantener pulsada la carátula -> S11 -> elegir fuente -> se guarda; el orden no cambia
    edge: sin internet, error de descarga (mensaje claro), carátula equivocada

F04 Volver mañana
    cerrar app -> abrir -> misma cola, misma canción, misma posición (también en aleatorio)

F05 Cambiar de teléfono
    S10 -> exportar copia -> teléfono nuevo -> S10 -> importar
    S10 -> "Restaurar compra"
```

## Inferred data model

Ver `schema.sql`. Confianza alta: es la app propia.

## Feature matrix

Ver `features.csv`.

## Out of scope

- Streaming o música con licencia, cuentas en servidor y redes sociales.
- Android Auto (1 reseña; requiere Media3 nativo; después de la migración a Kotlin).

## Size

Screens 12 (6 nuevas), flows 5, tablas 14. Hard parts: módulo nativo de biblioteca, carátulas, bibliotecas grandes. Size: L.
