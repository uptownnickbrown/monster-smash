// ============================================
// MONSTER SMASH - Canvas Renderer
// Setup, DPR scaling, game loop
// ============================================

let canvas = null;
let ctx = null;
let animFrameId = null;
let lastTime = 0;
let updateFn = null;
let renderFn = null;

export function createBattleCanvas(container, width, height) {
  canvas = document.createElement('canvas');
  canvas.className = 'battle-canvas';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.style.touchAction = 'none';

  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  container.appendChild(canvas);

  return { canvas, ctx, width, height };
}

export function resizeBattleCanvas(width, height) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);
}

export function startGameLoop(update, render) {
  updateFn = update;
  renderFn = render;
  lastTime = performance.now();
  loop(lastTime);
}

export function stopGameLoop() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  updateFn = null;
  renderFn = null;
}

function loop(now) {
  animFrameId = requestAnimationFrame(loop);

  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = now;

  if (updateFn) updateFn(dt);
  if (renderFn && ctx) {
    ctx.save();
    renderFn(ctx, canvas.style.width ? parseInt(canvas.style.width) : canvas.width, canvas.style.height ? parseInt(canvas.style.height) : canvas.height, dt);
    ctx.restore();
  }
}

export function getCanvas() {
  return canvas;
}

export function getCtx() {
  return ctx;
}

export function destroyBattleCanvas() {
  stopGameLoop();
  if (canvas) {
    canvas.remove();
    canvas = null;
    ctx = null;
  }
}
