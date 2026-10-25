# Stellio Player: qué odian sus usuarios y cómo lo arregla Retro Beats

Investigación hecha el 2026-10-25 con `/replica-entrepreneur`. Objetivo: una versión mejor dentro de Retro Beats, no una copia de Stellio.

## Muestra y límites (leer primero)

- **51 reseñas reales de 1 sola fuente (Google Play)**, en 13 idiomas, de 2020-04-20 a 2026-10-16. Estrellas: 28 de 5, 10 de 4, 6 de 3, 3 de 2, 4 de 1.
- Google Play solo muestra 3 reseñas "más relevantes" por idioma sin usar su API interna (no la usamos: sería scraping). Esas reseñas **tienden a ser positivas**, así que los problemas probablemente están **subrepresentados**.
- **Fuentes no alcanzables:** Reddit (su API exige OAuth), AlternativeTo (bloqueo de Cloudflare). Hacker News: 0 menciones reales de Stellio. No hay G2/Capterra/Trustpilot para un reproductor local.
- Contexto público de la ficha: 4,5 estrellas, ~66 mil valoraciones, 1M+ descargas, contiene anuncios y compras dentro de la app. En la ficha en inglés, 4.611 valoraciones son de 1 estrella (~7 %); en la turca, 6.418 (~10 %).
- **Menos de 100 reseñas y una sola fuente:** esto marca una **dirección**, no un ranking. Todos los temas son "thin" según la herramienta.
- Último cambio publicado (2026-09-20): "Huge update. Improved scanning and hardened stability, smashing over 20 bugs. Improved audio quality." Parte de los fallos de escaneo y estabilidad podrían estar ya corregidos.

Conteos verificados a mano (solo menciones negativas; `feedback.md` cuenta también menciones neutras o positivas).

## 1. Lo que odian

1. **Las carátulas fallan: errores al descargarlas, carátulas equivocadas, no se guardan, desordenan la lista.** 9 reseñas, 1 fuente.
   - "las caratulas por internet, da contínuos errores, por lo tanto no se puede ver las caratulas en la lista de las canciones" (1★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=es&reviewId=25d3a586-414a-4ce9-a16b-4822e6f13455
   - "Não consigo mais colocar capa nas músicas (Erro: chain validation error)" (3★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=pt&reviewId=34c34b6f-74b6-4dcf-a26e-1aaf54530897
2. **Canciones que no suenan, cuelgues y pausas solas.** 9 reseñas.
   - "Quando seleciono uma música ela simplesmente não toca." (2★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=pt&reviewId=06bbcadd-20fb-43df-a702-25141c14f5b1
   - "Через пару секунд после включения появляется сообщение о том, что приложение не отвечает, и из плеера выкидывает" (1★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=ru&reviewId=014cb24e-cbd5-4896-9306-54bc71ef3961
3. **Las actualizaciones rompen cosas que funcionaban.** 8 reseñas.
   - "as últimas atualizações mais atrapalharam do que ajudaram" (3★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=pt&reviewId=34c34b6f-74b6-4dcf-a26e-1aaf54530897
4. **El escaneo no encuentra archivos, carpetas o la tarjeta SD.** 4 reseñas (una resuelta).
   - "Se faccio uno scan completo non trova nulla." (1★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=it&reviewId=4c891289-d909-4df6-a1c2-ed8c56dcbca7
5. **Letras que desaparecen, salen como símbolos o detienen la reproducción.** 4 reseñas.
6. **No guarda la configuración y pide restaurar una copia de seguridad cada vez que abre.** 3 reseñas, todas recientes.
   - "toda vez que inicio aparece a tela para restaurar backup (recusar ou aceitar não faz diferença)" (3★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=pt&reviewId=a28884f1-66c4-43a1-98b1-b14ab84d5076
7. **Ruido o chasquidos con el ecualizador.** 3 reseñas.
8. **Pierdes la compra (sin anuncios o la clave) al cambiar de teléfono.** 2 reseñas, poca evidencia pero muy grave (1★ y 2★).
   - "En su día pagué por no tener anuncios y ahora me vuelven a salir en este nuevo dispositivo móvil." (2★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=es&reviewId=d390d28d-8d78-4fe0-aa5c-305a6938c795
   - "змінив пристрій ,а ключ не зберіг. Написав у підтримку, відповіді немає." (1★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=uk&reviewId=deb6eaba-fbe8-4bf6-8b89-aedcdaf4a1a0

## 2. Lo que falta

1. **Diseño flexible:** tamaño de la cuadrícula de álbumes (solo 3x3), vista de lista, pestañas, fondo propio, interfaz que no se estire en pantallas anchas. 6 reseñas.
   - "Y los álbumes solo se pueden ordenar en casillas de 3x3." (3★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=es&reviewId=c883a98b-72a3-4128-a7b5-0f4cbd94e5a4
2. **Títulos largos que se desplacen en vez de cortarse.** 2 reseñas (poca evidencia).
   - "Having info (title, album name, artist name, etc.) scroll on the play screen when it's too long to fit on at once" (5★) https://play.google.com/store/apps/details?id=io.stellio.music&hl=en&reviewId=14473c6b-9d70-4718-9178-606a7a9ba121
3. **Ordenar bien:** álbumes de varios discos e índice alfabético al desplazarse. 2 reseñas (poca evidencia).
4. **Pedidos sueltos** (1 reseña cada uno, poca evidencia):
   - Android Auto.
   - Volumen igualado entre canciones.
   - Retomar un aleatorio largo donde quedó.
   - Mantener la pantalla encendida.
   - Avisar si una canción ya está en la lista.
   - Pestañas de carpetas.

## 3. Lo que nadie les resuelve (posicionamiento)

- **Fiabilidad a largo plazo.** Muchas reseñas empiezan con "lo uso hace años" y terminan con "desde la última actualización…". El usuario fiel de un reproductor local quiere que **nada se rompa**, más que funciones nuevas.
- **Biblioteca que se entiende:** por qué un archivo no aparece, por qué una carátula falla. Hoy solo ven "error" o "no encuentra nada".
- **Compra que viaja contigo:** cambiar de teléfono no debería costarte lo que ya pagaste.

## 4. Plan de arreglos para Retro Beats

| # | Qué construir | Tamaño | Skill | Evidencia |
| --- | --- | --- | --- | --- |
| 1 | Carátulas que nunca fallan: primero la incrustada en el archivo (ID3/FLAC), luego `folder.jpg`, luego elegir de la galería; búsqueda en internet opcional con error claro; editar una carátula nunca reordena la biblioteca | M | replica-build | Odian #1, 9 reseñas |
| 2 | Reproducción robusta: si un archivo no se puede reproducir, se salta con aviso y no deja el reproductor vacío; quitar de las listas los archivos borrados | M | replica-build + replica-test | Odian #2, 9 reseñas |
| 3 | Escaneo transparente: biblioteca del sistema + carpetas elegidas + tarjeta SD, con pantalla de "archivos omitidos y por qué" | M | replica-build | Odian #4, 4 reseñas |
| 4 | Ajustes que se guardan solos; copia de seguridad exportable en un archivo, sin preguntar al abrir | S | replica-build | Odian #6, 3 reseñas |
| 5 | Diseño a elección: cuadrícula de 1, 2 o 3 columnas o lista, títulos largos que se desplazan, índice alfabético | S | replica-design + replica-build | Falta #1 y #2, 8 reseñas |
| 6 | Compra o donación ligada a la cuenta de Google Play, con botón "Restaurar compra" (o app sin licencias) | S | replica-backend / replica-launch | Odian #8, 2 reseñas, muy grave |
| 7 | Retomar la cola y la posición exacta al volver a abrir (incluido el aleatorio) | S | replica-build | Falta #4, 1 reseña |
| 8 | Volumen igualado entre canciones (ReplayGain) | M | replica-build | Falta #4, 1 reseña |

No incluido por ahora: **Android Auto** (1 reseña; tamaño L; con Expo requiere módulo nativo, encaja mejor si se migra a Kotlin + Media3).

## 5. Ángulos de posicionamiento

**A. Fiable**
> Para quienes llevan años con su reproductor y odian que cada actualización les rompa las carátulas o la reproducción, Retro Beats es el reproductor local que simplemente funciona: tus carátulas, tu orden y tu música, siempre.
> Evidencia: carátulas (9), reproducción (9) y regresiones tras actualizar (8), sobre 51 reseñas en 1 fuente.

**B. Transparente**
> Para quienes abren su reproductor y no encuentran sus canciones sin saber por qué, Retro Beats te muestra qué encontró, qué omitió y cómo arreglarlo.
> Evidencia: escaneo (4) y carátulas (9), sobre 51 reseñas en 1 fuente.

**C. Tuyo de verdad**
> Para quienes pagaron y lo perdieron al cambiar de teléfono, Retro Beats guarda tu compra y tus ajustes en tu cuenta.
> Evidencia: licencia perdida (2, muy grave) y ajustes perdidos (3), sobre 51 reseñas en 1 fuente.

**Recomendado: A (Fiable), con la estética retro como identidad.** Es el tema con más evidencia, y "simplemente funciona" combina bien con la nostalgia de los reproductores de antes. No usar el nombre "Stellio" en el nombre, los anuncios ni la ficha de la tienda. Las citas de esta página son investigación, no testimonios para la web.

## Avisos de línea roja

- El rasgo más conocido de Stellio es que **el color de la interfaz cambia según la carátula**, y la opción B del reproductor de Retro Beats ya hace algo parecido. Es un patrón funcional común (Material You hace lo mismo), así que se puede usar. Lo que no se puede usar es su camaleón, su nombre, sus temas visuales concretos ni sus textos.
