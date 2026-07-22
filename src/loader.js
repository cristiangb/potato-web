async function loadLevel(letter) {
  const base = `assets/levels/${letter}`;
  const [grid, tilesManifest] = await Promise.all([
    fetch(`${base}/grid.json`).then(r => r.json()),
    fetch(`${base}/tiles_manifest.json`).then(r => r.json()),
  ]);
  const tileImages = {};
  await Promise.all(Object.entries(tilesManifest).map(([idx, file]) =>
    new Promise(res => {
      const img = new Image();
      img.onload = () => { tileImages[idx] = img; res(); };
      img.onerror = res;
      img.src = `${base}/${file}`;
    })
  ));
  const background = await new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = `${base}/background.png`;
  });
  return new Level(grid, tilesManifest, tileImages, background);
}

async function loadCharacter() {
  const [partsManifest, animations] = await Promise.all([
    fetch('assets/character/parts_manifest.json').then(r => r.json()),
    fetch('assets/character/animations.json').then(r => r.json()),
  ]);
  const partImages = {};
  await Promise.all(Object.entries(partsManifest).map(([name, info]) =>
    new Promise(res => {
      const img = new Image();
      img.onload = () => { partImages[name] = img; res(); };
      img.onerror = res;
      img.src = `assets/character/${info.file}`;
    })
  ));
  return { partImages, animations };
}

async function boot() {
  const canvas = document.getElementById('screen');
  const status = document.getElementById('status');
  try {
    const [level, character] = await Promise.all([loadLevel('A'), loadCharacter()]);
    status.style.display = 'none';
    const levels = ['A', 'B', 'C'];
    let idx = 0;
    let currentGame = null;
    const startLevel = (lvl) => {
      if (currentGame) currentGame.stop(); // frenar el loop del nivel anterior
      currentGame = new PotatoGame(canvas, lvl, async () => {
        idx++;
        if (idx < levels.length) {
          const next = await loadLevel(levels[idx]);
          startLevel(next);
        } else {
          currentGame.stop();
          alert('¡Ganaste! (placeholder de pantalla final)');
        }
      }, character, async () => {
        alert('Game Over — te quedaste sin vidas. Arrancamos de nuevo desde el nivel A.');
        idx = 0;
        const first = await loadLevel(levels[0]);
        startLevel(first);
      });
      window.currentGame = currentGame;
      currentGame.start();
    };
    startLevel(level);
  } catch (e) {
    status.textContent = 'No se encontraron los assets extraídos todavía. Corré tools/extract_all.py primero. (' + e + ')';
    console.error(e);
  }
}

window.addEventListener('DOMContentLoaded', boot);
