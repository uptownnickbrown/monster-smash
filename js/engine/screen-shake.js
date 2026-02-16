// ============================================
// MONSTER SMASH - Screen Shake
// Camera shake with exponential decay
// ============================================

let shakeIntensity = 0;
let shakeDuration = 0;
let shakeTimer = 0;

export function triggerShake(intensity, duration = 0.4) {
  // Stack shakes but cap the intensity
  shakeIntensity = Math.min(intensity + shakeIntensity * 0.3, 30);
  shakeDuration = duration;
  shakeTimer = 0;
}

export function updateShake(dt) {
  if (shakeTimer >= shakeDuration) {
    shakeIntensity = 0;
    return { x: 0, y: 0 };
  }

  shakeTimer += dt;
  const progress = shakeTimer / shakeDuration;
  const decay = 1 - progress;
  const currentIntensity = shakeIntensity * decay * decay; // exponential decay

  return {
    x: (Math.random() * 2 - 1) * currentIntensity,
    y: (Math.random() * 2 - 1) * currentIntensity,
  };
}

export function isShaking() {
  return shakeTimer < shakeDuration && shakeIntensity > 0;
}

export function resetShake() {
  shakeIntensity = 0;
  shakeDuration = 0;
  shakeTimer = 0;
}
