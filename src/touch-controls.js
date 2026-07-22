// Controles táctiles para mobile: se activan solo si el dispositivo es táctil.
// Zona izquierda = caminar izquierda, zona derecha = caminar derecha (mientras se sostiene).
// Doble-tap en cualquiera de las dos zonas = saltar (sin soltar el movimiento).
(function () {
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (!isTouch) return;

  const overlay = document.getElementById('touch-overlay');
  const leftZone = document.getElementById('touch-left');
  const rightZone = document.getElementById('touch-right');
  if (!overlay || !leftZone || !rightZone) return;

  overlay.classList.add('active');

  const DOUBLE_TAP_MS = 300;
  const lastTap = { left: 0, right: 0 };
  const activePointers = {}; // pointerId -> 'left' | 'right'

  function setKey(side, value) {
    const game = window.currentGame;
    if (!game) return;
    game.keys[side === 'left' ? 'ArrowLeft' : 'ArrowRight'] = value;
  }

  function triggerJump() {
    const game = window.currentGame;
    if (game) game.touchJump = true;
  }

  function onDown(side, e) {
    e.preventDefault();
    const now = performance.now();
    activePointers[e.pointerId] = side;
    setKey(side, true);
    if (now - lastTap[side] < DOUBLE_TAP_MS) {
      triggerJump();
      lastTap[side] = 0; // evita que un tercer toque rápido dispare otro salto
    } else {
      lastTap[side] = now;
    }
  }

  function onUp(e) {
    const side = activePointers[e.pointerId];
    if (!side) return;
    delete activePointers[e.pointerId];
    // si queda otro dedo tocando el mismo lado, no soltar el movimiento todavía
    const stillActive = Object.values(activePointers).includes(side);
    if (!stillActive) setKey(side, false);
  }

  leftZone.addEventListener('pointerdown', e => onDown('left', e));
  rightZone.addEventListener('pointerdown', e => onDown('right', e));
  overlay.addEventListener('pointerup', onUp);
  overlay.addEventListener('pointercancel', onUp);
  overlay.addEventListener('pointerleave', onUp);
})();
