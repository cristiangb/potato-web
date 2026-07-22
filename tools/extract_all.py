#!/usr/bin/env python3
"""
Extractor completo de assets de Potato (DOS, 1997) -> PNG/JSON web-friendly.

Uso:
    python3 extract_all.py /ruta/a/potato_descomprimido /ruta/salida

Espera encontrar dentro de la carpeta fuente:
    LOGO, LOGO.PAL, NAME, POTATO
    DATA/PAL/{FA,FB,FC,T,ALGO.PAL,CONG.PAL,ENEMY1.PAL,...}
    DATA/LEVELS/{FA.ESC,FB.ESC,FC.ESC,NIVELA,NIVELB,NIVELC}
    DATA/PLTFRM/{PRO00-09, DLTxB.., DLTxH.., PLTxB.., PLTxL.., FINx0-5}
    DATA/PRNCPL/{CUERPO1-3, PIE1-8, MI1-5, MD1-5, CAMINA, SALTO, CORRIDA}
    DATA/AUXILIO/{0-9, A-Z}

Formato (deducido de GAME.C / K.C / INICIO.C):
  - *.PAL / archivos de paleta (768 B): 256 x RGB de 6 bits (VGA DAC).
  - assets con header (tiles, letras, logo, cuerpo): 5 bytes
        [flag, x1, y1, x2, y2] -> w=x2-x1+1, h=y2-y1+1, luego w*h bytes crudos.
  - *.ESC (fondos): 320*200 = 64000 bytes crudos, sin header.
  - NIVEL?/NIVA1/etc: grilla de 10x10 paneles de 20x12 tiles (24000 bytes),
        indexada [panel_x][panel_y][tile_x][tile_y].

Índices de tile (constantes de K.C):
  COMIDA=0 (0-9: 0=vacío, 1-4=letras, 5-9=comida/puntos)
  VACIO1=16   (decorativo, no sólido)
  HORIZO=140  (plataforma "one-way" / especial, no sólido en el sentido pleno)
  VACIO2=190  (sólido)
  ENTERO=220  (sólido, bloque entero)
  SALIDA=250  (portal de salida de nivel)
"""
import os, sys, json
from PIL import Image

COMIDA, VACIO1, HORIZO, VACIO2, ENTERO, SALIDA = 0, 16, 140, 190, 220, 250

def load_palette(path):
    with open(path, "rb") as f:
        raw = f.read()
    pal = []
    for i in range(256):
        r, g, b = raw[i*3], raw[i*3+1], raw[i*3+2]
        pal += [min(255, r*255//63), min(255, g*255//63), min(255, b*255//63)]
    return pal

def load_composite_palette(src, level_letter):
    """Replica exacto cargar() de GAME.C:
       base = FA/FB/FC (256 colores)
       colores 0-15  <- primeros 16 colores de DATA/PAL/T
       colores 16-63 <- primeros 48 colores de DATA/PAL/ENEMY1.PAL
       Esta es la ÚNICA paleta activa en pantalla en todo momento para ese nivel:
       la usan por igual fondo, tiles, personaje y fuente."""
    base_path = find_ci(f"{src}/DATA/PAL", f"F{level_letter}")
    t_path = find_ci(f"{src}/DATA/PAL", "T")
    enemy_path = find_ci(f"{src}/DATA/PAL", "ENEMY1.PAL")
    with open(base_path, "rb") as f:
        raw = bytearray(f.read())
    if t_path:
        with open(t_path, "rb") as f:
            t_raw = f.read()
        raw[0:48] = t_raw[0:48]
    if enemy_path:
        with open(enemy_path, "rb") as f:
            e_raw = f.read()
        raw[48:48+144] = e_raw[0:144]
    pal = []
    for i in range(256):
        r, g, b = raw[i*3], raw[i*3+1], raw[i*3+2]
        pal += [min(255, r*255//63), min(255, g*255//63), min(255, b*255//63)]
    return pal

def load_sprite_bytes(path):
    with open(path, "rb") as f:
        raw = f.read()
    flag, x1, y1, x2, y2 = raw[0], raw[1], raw[2], raw[3], raw[4]
    w, h = x2 - x1 + 1, y2 - y1 + 1
    data = raw[5:5+w*h]
    if len(data) < w*h:
        data += bytes(w*h - len(data))
    return w, h, data

def sprite_png(path, pal, out_png, transparent_index=None):
    w, h, data = load_sprite_bytes(path)
    img = Image.new("P", (w, h))
    img.putpalette(pal)
    img.putdata(data)
    rgba = img.convert("RGBA")
    if transparent_index is not None:
        px = rgba.load()
        for i, v in enumerate(data):
            if v == transparent_index:
                px[i % w, i // w] = (0, 0, 0, 0)
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    rgba.save(out_png)
    return w, h

def background_png(path, pal, out_png, w=320, h=200):
    with open(path, "rb") as f:
        data = f.read()
    img = Image.new("P", (w, h))
    img.putpalette(pal)
    img.putdata(data[:w*h])
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    img.convert("RGB").save(out_png)

def load_level_grid(path):
    """Devuelve conte[panel_x*20+tile_x][panel_y*12+tile_y] como matriz 200x120."""
    with open(path, "rb") as f:
        data = f.read()
    assert len(data) == 24000
    grid = [[0]*120 for _ in range(200)]
    i = 0
    for px in range(10):
        for py in range(10):
            for tx in range(20):
                for ty in range(12):
                    grid[px*20+tx][py*12+ty] = data[i]
                    i += 1
    return grid

def find_ci(dirpath, name):
    """Busca un archivo case-insensitive dentro de dirpath (Windows -> Linux)."""
    if not os.path.isdir(dirpath):
        return None
    target = name.lower()
    for f in os.listdir(dirpath):
        if f.lower() == target:
            return os.path.join(dirpath, f)
    return None

def extract_level(src, out, level_letter, level_index, tile_counts):
    """level_letter: 'A'/'B'/'C', tile_counts: (vacio1,horizo,vacio2,entero) para ese nivel."""
    esc_path = find_ci(f"{src}/DATA/LEVELS", f"F{level_letter}.ESC")
    niv_path = find_ci(f"{src}/DATA/LEVELS", f"NIVEL{level_letter}")
    if not (esc_path and niv_path):
        print(f"  [nivel {level_letter}] faltan archivos base, salteo")
        return None
    pal = load_composite_palette(src, level_letter)
    background_png(esc_path, pal, f"{out}/assets/levels/{level_letter}/background.png")
    grid = load_level_grid(niv_path)
    json.dump(grid, open(f"{out}/assets/levels/{level_letter}/grid.json", "w"))

    tiles_manifest = {}
    pltfrm = f"{src}/DATA/PLTFRM"
    groups = [
        ("comida", "PRO", "%02d", 10, COMIDA, None),
        ("vacio1", f"DLT{level_letter}B", "%02d", tile_counts[0], VACIO1, None),
        ("horizo", f"DLT{level_letter}H", "%02d", tile_counts[1], HORIZO, None),
        ("vacio2", f"PLT{level_letter}B", "%02d", tile_counts[2], VACIO2, None),
        ("entero", f"PLT{level_letter}L", "%02d", tile_counts[3], ENTERO, None),
        ("salida", f"FIN{level_letter}", "%d", 6, SALIDA, None),
    ]
    for group_name, prefix, numfmt, count, base_index, _ in groups:
        for h in range(count):
            fname = prefix + (numfmt % h)
            fpath = find_ci(pltfrm, fname)
            if not fpath:
                continue
            idx = base_index + h
            outp = f"{out}/assets/levels/{level_letter}/tiles/{idx}.png"
            sprite_png(fpath, pal, outp, transparent_index=2)
            tiles_manifest[idx] = f"tiles/{idx}.png"
    json.dump(tiles_manifest, open(f"{out}/assets/levels/{level_letter}/tiles_manifest.json", "w"))
    print(f"  [nivel {level_letter}] OK -> {len(tiles_manifest)} tiles")
    return pal

PART_ORDER = ["cuerpo1","cuerpo2","cuerpo3",
              "pie1","pie2","pie3","pie4","pie5","pie6","pie7","pie8",
              "mi1","mi2","mi3","mi4","mi5",
              "md1","md2","md3","md4","md5"]

def decode_anim(path):
    """CAMINA/SALTO/CORRIDA: 1 byte CUADRO (nro de frames - 1), luego
    (CUADRO+1) frames x 5 partes x 3 bytes [indice_parte+1, offsetX, offsetY]."""
    with open(path, "rb") as f:
        data = f.read()
    cuadro = data[0]
    n_frames = cuadro + 1
    frames = []
    p = 1
    for _ in range(n_frames):
        parts = []
        for _ in range(5):
            idx1, ox, oy = data[p], data[p+1], data[p+2]
            p += 3
            part_i = idx1 - 1
            parts.append({
                "part": PART_ORDER[part_i] if 0 <= part_i < len(PART_ORDER) else None,
                "ox": ox, "oy": oy,
            })
        frames.append(parts)
    return frames

def extract_animations(src, out):
    prncpl = f"{src}/DATA/PRNCPL"
    result = {}
    for name in ["CAMINA", "SALTO", "CORRIDA"]:
        fpath = find_ci(prncpl, name)
        if not fpath:
            print(f"  [animacion] falta {name}")
            continue
        result[name.lower()] = decode_anim(fpath)
    # QUIETO = un solo frame, copia del frame 0 de CAMINA (así lo hace GAME.C)
    if "camina" in result:
        result["quieto"] = [result["camina"][0]]
    os.makedirs(f"{out}/assets/character", exist_ok=True)
    json.dump(result, open(f"{out}/assets/character/animations.json", "w"))
    print(f"  [animacion] OK -> {list(result.keys())}")

def extract_character(src, out, pal):
    prncpl = f"{src}/DATA/PRNCPL"
    parts = ["cuerpo1","cuerpo2","cuerpo3",
             "pie1","pie2","pie3","pie4","pie5","pie6","pie7","pie8",
             "mi1","mi2","mi3","mi4","mi5",
             "md1","md2","md3","md4","md5"]
    manifest = {}
    for i, p in enumerate(parts):
        fpath = find_ci(prncpl, p)
        if not fpath:
            print(f"  [personaje] falta {p}")
            continue
        outp = f"{out}/assets/character/{p}.png"
        w, h = sprite_png(fpath, pal, outp, transparent_index=0)
        manifest[p] = {"file": f"{p}.png", "index": i, "w": w, "h": h}
    json.dump(manifest, open(f"{out}/assets/character/parts_manifest.json", "w"))
    print(f"  [personaje] OK -> {len(manifest)} partes")

def extract_font(src, out, pal):
    aux = f"{src}/DATA/AUXILIO"
    chars = list("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    for c in chars:
        fpath = find_ci(aux, c)
        if not fpath:
            continue
        sprite_png(fpath, pal, f"{out}/assets/font/{c}.png", transparent_index=2)
    print(f"  [fuente] OK -> {len(chars)} glifos")

def extract_intro(src, out):
    pal = load_palette(find_ci(src, "LOGO.PAL"))
    sprite_png(find_ci(src, "LOGO"), pal, f"{out}/assets/intro/logo.png")
    sprite_png(find_ci(src, "NAME"), pal, f"{out}/assets/intro/name.png")
    sprite_png(find_ci(src, "POTATO"), pal, f"{out}/assets/intro/potato.png")
    print("  [intro] OK")

CANTIDADES = {  # de K.C: cts[nivel][0..3] = vacio1,horizo,vacio2,entero
    "A": (12, 9, 6, 3),
    "B": (26, 9, 6, 3),
    "C": (14, 4, 0, 2),
}

def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    extract_intro(src, out)
    last_pal = None
    for letter in ["A", "B", "C"]:
        pal = extract_level(src, out, letter, ord(letter)-65, CANTIDADES[letter])
        if letter == "A":
            last_pal = pal  # los colores 0-63 (T + ENEMY1.PAL) son iguales en los 3 niveles
    if last_pal:
        extract_character(src, out, last_pal)
        extract_font(src, out, last_pal)
        extract_animations(src, out)
    print("Listo.")

if __name__ == "__main__":
    main()
