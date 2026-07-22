# Potato (1997) → Web

Remake en Canvas/JS del juego de plataformas DOS "Potato" (Turbo/Borland C, 1997),
rescatado de `C:\TestLab\potato`.

## Pipeline

1. `tools/extract_all.py <carpeta_original> assets/` — decodifica los formatos
   binarios custom (paletas VGA de 6 bits, sprites con header de bounding box,
   fondos raw 320x200) a PNG + JSON, para los 3 niveles (A, B, C).
2. `index.html` + `src/game.js` + `src/loader.js` — motor Canvas 2D que replica
   la física y colisión del `jugar()` original (tablas de salto/caminata exactas
   del código fuente).
3. Deploy estático directo a Netlify (no hay build step, es HTML/JS plano).

## Estado actual

- [x] Formato de paleta, sprites y fondos decodificado y verificado
- [x] Extractor genérico para los 3 niveles
- [x] Motor: estados QUIETO/CAMINA/CORRIDA/SALTO, colisión con 6 puntos de sondeo,
      recolección de letras/comida, salida de nivel — fiel a GAME.C
- [ ] Animación del personaje (falta decodificar el formato de CAMINA/SALTO/CORRIDA,
      que son descriptores de frame -> partes del cuerpo, no sprites directos).
      Por ahora se dibuja un placeholder.
- [ ] Enemigos (había paletas ENEMY1/ENEMYA/ENEMYB pero no se identificó aún el
      código que los gobierna — puede estar en EDF.EXE/PNIMA.EXE, sin fuente .C)
- [ ] Sonido (no se identificó código de audio en las fuentes disponibles)
- [ ] Deploy a Netlify + repo en GitHub

## Notas de formato (para no tener que re-derivarlas)

- Paleta: 768 bytes, 256 x RGB de 6 bits (0-63) — escalar a 0-255 con `*255/63`.
- Sprite/tile/letra: header 5 bytes `[flag, x1, y1, x2, y2]`, bbox inclusive,
  luego `w*h` bytes crudos indexados (sin compresión).
- Fondo `.ESC`: 320*200 bytes crudos, sin header.
- Nivel `NIVEL?`: grilla de 10x10 paneles de 20x12 tiles = 24000 bytes.
- Índices de tile: `COMIDA=0` (0=vacío, 1-4=letras, 5-9=comida),
  `VACIO1=16` (decorativo), `HORIZO=140` (plataforma especial),
  `VACIO2=190` (sólido), `ENTERO=220` (sólido), `SALIDA=250` (portal).
- Transparencia: índice 2 para tiles/texto, índice 0 para el personaje.
