// Potato (1997) -> port web, motor fiel a la lógica original de GAME.C
// Tablas y constantes tomadas literal de la fuente original (jugar() en GAME.C)

const TILE = 16;

// Constantes de categoría de tile (K.C / GAME.C)
const COMIDA = 0, VACIO1 = 16, HORIZO = 140, VACIO2 = 190, ENTERO = 220, SALIDA = 250;

// Tabla de salto vertical (35 entradas, exacta del original)
const SALTO_TABLE = [0,0,0,0,0,16,16,8,8,4,4,4,2,2,2,2,
                      -2,-2,-2,-2,-4,-4,-4,-8,-8,-16,-16,0,0,0,0,0,0,0,0];
// Velocidad horizontal caminando por frame de animación (23 entradas)
const CAMIN_TABLE = [3,4,4,4,4,4,3,3,2,1,1,2,4,4,4,3,3,2,1,1,1,2,3];
// Velocidad horizontal corriendo (constante en el original)
const CORRID_TABLE = new Array(11).fill(14);

const ESTADO = { QUIETO: 0, CAMINA: 1, CORRIDA: 2, SALTO: 3 };
const LADO = { DERECHO: 0, REVES: 1 };

class Level {
  constructor(grid, tilesManifest, tileImages, backgroundImg) {
    this.grid = grid; // grid[x][y], x en 0..199 (10 paneles x 20), y en 0..119 (10 paneles x 12)
    this.tilesManifest = tilesManifest;
    this.tileImages = tileImages;
    this.background = backgroundImg;
  }
  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= 200 || ty >= 120) return 0;
    return this.grid[tx][ty];
  }
  isSolid(v) { return v >= VACIO2 && v < SALIDA; } // pisando[] en el original
  removeAt(tx, ty) { if (tx >= 0 && ty >= 0 && tx < 200 && ty < 120) this.grid[tx][ty] = 0; }
}

class Player {
  constructor(startX, startY) {
    this.x = startX; this.y = startY; // coordenadas de mundo (px), como x/y del original
    this.desX = 0; this.desY = 0;     // desplazamiento visual (DES_X/DES_Y del original)
    this.estado = ESTADO.QUIETO;
    this.animacion = 0;
    this.lado = LADO.DERECHO;
    this.sal = 0; // índice en SALTO_TABLE
    this.letras = [0,0,0,0,0]; // 4 letras + flag "completo"
    this.puntos = [0,0,0];
    this.vidas = 3;
  }
  get letrasCompletas() { return this.letras[4] === 1; }
}

const STATE_NAME = { [ESTADO.QUIETO]: 'quieto', [ESTADO.CAMINA]: 'camina', [ESTADO.CORRIDA]: 'corrida', [ESTADO.SALTO]: 'salto' };

class PotatoGame {
  // character = { partImages: {nombre: Image}, animations: {quieto:[...],camina:[...],salto:[...],corrida:[...]} }
  constructor(canvas, level, onExit, character, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.level = level;
    this.character = character;
    this.spawnX = 160; this.spawnY = 160;
    this.player = new Player(this.spawnX, this.spawnY);
    this.onGameOver = onGameOver;
    this.touchJump = false; // pulso de salto disparado por doble-tap en mobile
    this.keys = {};
    this.onExit = onExit;
    window.addEventListener('keydown', e => this.keys[e.code] = true);
    window.addEventListener('keyup', e => this.keys[e.code] = false);
  }

  probe(p) {
    // Los 6 puntos de sondeo del original: D_L,D_R (pies) y L_U,L_D,R_U,R_D (laterales cabeza/cintura)
    const x = p.x + p.desX, y = p.y + p.desY;
    const get = (px, py) => this.level.tileAt(Math.floor(px/TILE), Math.floor(py/TILE));
    return {
      D_L: get(x-10, y),      D_R: get(x+6, y),
      L_U: get(x-26, y-32),   L_D: get(x-26, y-16),
      R_U: get(x+22, y-32),   R_D: get(x+22, y-16),
    };
  }

  update() {
    const p = this.player, k = this.keys, lvl = this.level;
    const pa = this.probe(p);
    const solid = v => lvl.isSolid(v);
    const pisandoAbajo = solid(pa.D_L) || solid(pa.D_R);

    switch (p.estado) {
      case ESTADO.QUIETO:
        p.animacion = 0;
        if (k['ArrowRight'] || k['ArrowLeft']) p.estado = ESTADO.CAMINA;
        if (k['ArrowDown'] && (k['ArrowRight'] || k['ArrowLeft'])) p.estado = ESTADO.CORRIDA;
        if (k['ArrowUp'] || this.touchJump) { p.sal = 0; p.estado = ESTADO.SALTO; }
        if (!pisandoAbajo) { p.sal = 26; p.animacion = 15; p.estado = ESTADO.SALTO; }
        break;
      case ESTADO.CAMINA:
        if (k['ArrowUp'] || this.touchJump) { p.sal = 0; p.estado = ESTADO.SALTO; p.animacion = 0; break; }
        if (k['ArrowRight'] && !solid(pa.R_U)) {
          p.lado = LADO.DERECHO;
          p.animacion = (p.animacion + 1) % CAMIN_TABLE.length;
          p.x += CAMIN_TABLE[p.animacion];
        } else if (k['ArrowLeft'] && !solid(pa.L_U)) {
          p.lado = LADO.REVES;
          p.animacion = (p.animacion + 1) % CAMIN_TABLE.length;
          p.x -= CAMIN_TABLE[p.animacion];
        } else { p.animacion = 0; p.estado = ESTADO.QUIETO; }
        if (!pisandoAbajo) { p.sal = 25; p.animacion = 15; p.estado = ESTADO.SALTO; }
        break;
      case ESTADO.CORRIDA:
        if (k['ArrowUp'] || this.touchJump) { p.sal = 0; p.estado = ESTADO.SALTO; p.animacion = 0; break; }
        if (k['ArrowRight'] && !solid(pa.R_U)) {
          p.lado = LADO.DERECHO;
          p.animacion = (p.animacion + 1) % CORRID_TABLE.length;
          p.x += CORRID_TABLE[p.animacion];
        } else if (k['ArrowLeft'] && !solid(pa.L_U)) {
          p.lado = LADO.REVES;
          p.animacion = (p.animacion + 1) % CORRID_TABLE.length;
          p.x -= CORRID_TABLE[p.animacion];
        } else { p.animacion = 0; p.estado = ESTADO.QUIETO; }
        if (!pisandoAbajo) { p.sal = 25; p.animacion = 15; p.estado = ESTADO.SALTO; }
        break;
      case ESTADO.SALTO:
        p.sal++;
        if (p.sal % 2 === 1 || SALTO_TABLE[p.sal] === 0) p.animacion++;
        if (p.sal === 27 && !pisandoAbajo) { p.sal = 26; p.animacion = 15; }
        if (pisandoAbajo && p.sal > 5 && p.sal < 27) { p.sal = 27; p.animacion = 16; p.y = Math.floor(p.y/TILE)*TILE; }
        if (p.sal === 27) p.y = Math.floor(p.y/TILE)*TILE;
        p.y -= SALTO_TABLE[p.sal] || 0;
        if (k['ArrowRight'] && SALTO_TABLE[p.sal] !== 0 && !solid(pa.R_U) && !solid(pa.R_D)) p.x += 6;
        if (k['ArrowLeft'] && SALTO_TABLE[p.sal] !== 0 && !solid(pa.L_U) && !solid(pa.L_D)) p.x -= 6;
        if (p.animacion >= 23) { p.animacion = 0; p.estado = ESTADO.QUIETO; }
        break;
    }

    // Recolección de letras/comida: dos tiles arriba de la cabeza (C_L/C_R del original)
    const tx1 = Math.floor((p.x - 10) / TILE), tx2 = Math.floor((p.x + 6) / TILE);
    const ty = Math.floor(p.y / TILE) - 2;
    for (const tx of [tx1, tx2]) {
      const v = lvl.tileAt(tx, ty);
      if (v >= 1 && v <= 4) {
        lvl.removeAt(tx, ty);
        p.letras[v-1] = v;
        if (p.letras[0]===1 && p.letras[1]===2 && p.letras[2]===3 && p.letras[3]===4) p.letras[4] = 1;
      } else if (v >= 5 && v <= 9) {
        lvl.removeAt(tx, ty);
        p.puntos[2] += 1; // simplificado; el original tenía tablas come/come2 de incremento variable
        if (p.puntos[2] > 9) { p.puntos[2] -= 10; p.puntos[1]++; }
      }
    }

    // Salida de nivel: parado sobre tile SALIDA con las 4 letras juntadas.
    // Se dispara una sola vez (si no, cada frame parado ahi vuelve a llamar onExit).
    if (p.letrasCompletas && !this.exited) {
      const exitTile = lvl.tileAt(Math.floor(p.x/TILE), Math.floor(p.y/TILE)+1);
      if (exitTile >= SALIDA && this.onExit) {
        this.exited = true;
        this.onExit();
      }
    }

    // Caída al vacío (sin piso debajo, cae fuera de la grilla del nivel): pierde una vida.
    const FALL_LIMIT = 130 * TILE; // margen debajo de la grilla de 120 filas
    if (p.y > FALL_LIMIT && !this.exited) {
      p.vidas--;
      if (p.vidas > 0) {
        p.x = this.spawnX; p.y = this.spawnY;
        p.desX = 0; p.desY = 0;
        p.estado = ESTADO.QUIETO;
        p.animacion = 0; p.sal = 0;
        p.letras = [0,0,0,0,0];
      } else {
        this.exited = true;
        this.stop();
        if (this.onGameOver) this.onGameOver();
      }
    }

    this.touchJump = false; // el pulso de doble-tap dura un solo tick de lógica
  }

  render() {
    const ctx = this.ctx, p = this.player, lvl = this.level;
    const camX = p.x - 160, camY = p.y - 100;
    ctx.imageSmoothingEnabled = false;
    if (lvl.background) {
      ctx.drawImage(lvl.background, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    // Tiles visibles en pantalla
    const x0 = Math.floor((camX) / TILE) - 1, x1 = Math.floor((camX + 320) / TILE) + 1;
    const y0 = Math.floor((camY) / TILE) - 1, y1 = Math.floor((camY + 200) / TILE) + 1;
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        const v = lvl.tileAt(tx, ty);
        if (v === 0) continue;
        const img = lvl.tileImages[v];
        if (img) ctx.drawImage(img, tx*TILE - camX, ty*TILE - camY);
      }
    }
    // Personaje: compuesto de partes reales según el frame de animación actual,
    // siguiendo exactamente la fórmula de pone_pers()/jugar() del original.
    if (this.character) {
      const stateName = STATE_NAME[p.estado] || 'quieto';
      const frames = this.character.animations[stateName] || this.character.animations['quieto'];
      const frame = frames[p.animacion % frames.length];
      if (frame) {
        const pieses = Math.max(frame[1] ? frame[1].oy : 0, frame[3] ? frame[3].oy : 0);
        // El torso (slot 2) no se desplaza horizontalmente en el ciclo: es el eje de espejado.
        const torsoOx = frame[2] ? frame[2].ox : 0;
        for (const part of frame) {
          if (!part.part) continue;
          const img = this.character.partImages[part.part];
          if (!img) continue;
          const w = img.width, h = img.height;
          const y = 100 + p.desY + part.oy - h - pieses;
          if (p.lado === LADO.DERECHO) {
            const x = p.desX + part.ox - w;
            ctx.drawImage(img, x, y);
          } else {
            // Reflejar la posición de la parte alrededor del torso, además de sus píxeles,
            // para que la disposición de piernas/brazos también se invierta (si no, moonwalk).
            const mirroredOx = 2 * torsoOx - part.ox;
            const x = p.desX + mirroredOx - w;
            ctx.save();
            ctx.translate(x + w, y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0);
            ctx.restore();
          }
        }
      }
    } else {
      ctx.fillStyle = '#e8630a';
      ctx.fillRect(160 - 8, 100 - 32, 16, 32);
    }

    // HUD simple
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`letras: ${p.letras.slice(0,4).join('')} vidas:${p.vidas}`, 4, 12);
  }

  loop(timestamp) {
    if (!this.running) return;
    if (this.lastTime === undefined) this.lastTime = timestamp;
    let delta = timestamp - this.lastTime;
    this.lastTime = timestamp;
    // Si la pestaña estuvo en segundo plano, el navegador puede entregar un delta
    // gigante de golpe: lo recortamos para no "correr" muchos pasos de una.
    delta = Math.min(delta, 250);
    this.accumulator = (this.accumulator || 0) + delta;
    const STEP = 1000 / 60; // lógica del juego fija a 60 pasos/seg reales
    let steps = 0;
    while (this.accumulator >= STEP && steps < 5) {
      this.update();
      this.accumulator -= STEP;
      steps++;
    }
    this.render();
    requestAnimationFrame(t => this.loop(t));
  }

  start() {
    if (this.running) return; // evita arrancar dos loops sobre la misma instancia
    this.running = true;
    this.lastTime = undefined;
    this.accumulator = 0;
    requestAnimationFrame(t => this.loop(t));
  }

  stop() {
    this.running = false;
  }
}

window.PotatoGame = PotatoGame;
window.Level = Level;
