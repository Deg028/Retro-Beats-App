# Prueba de letras con Whisper (en el PC)

Experimento para ver si reconocer la letra con voz a texto sirve para las canciones sin letra. No forma parte de la app.

```bash
python -m venv venv
venv/Scripts/python.exe -m pip install faster-whisper     # en Linux/Mac: venv/bin/python
venv/Scripts/python.exe run.py <cancion.mp3> <base|small> [idioma] [novad]
# ejemplos: run.py cancion.mp3 base en     ·     run.py cancion.mp3 small ja     ·     run.py cancion.mp3 base "" novad
```

- Imprime cada frase con su tiempo `[mm:ss.cc]` y al final cuánto tardó.
- `idioma` (en, es, ja…) conviene darlo siempre: sin él Whisper adivina y, con instrumentales, inventa texto (con `src.mp3` detectó ruso al 31 % y escribió frases sin sentido).
- `novad` desactiva el filtro de voz.
- `run.py` decodifica el audio con PyAV a mano porque faster-whisper 1.2.1 falla con PyAV 19 (`metadata_errors`).
