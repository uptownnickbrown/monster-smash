// ============================================
// MONSTER SMASH - Animation / Tween Engine
// ============================================

const activeTweens = [];

export class Tween {
  constructor(target, props, duration, easing = easeOutQuad, onComplete = null) {
    this.target = target;
    this.startValues = {};
    this.endValues = props;
    this.duration = duration;
    this.easing = easing;
    this.elapsed = 0;
    this.onComplete = onComplete;
    this.done = false;

    // Capture start values
    for (const key of Object.keys(props)) {
      this.startValues[key] = target[key] ?? 0;
    }
  }

  update(dt) {
    if (this.done) return;

    this.elapsed += dt;
    const t = Math.min(this.elapsed / this.duration, 1);
    const easedT = this.easing(t);

    for (const key of Object.keys(this.endValues)) {
      this.target[key] = this.startValues[key] + (this.endValues[key] - this.startValues[key]) * easedT;
    }

    if (t >= 1) {
      this.done = true;
      if (this.onComplete) this.onComplete();
    }
  }
}

export function addTween(target, props, duration, easing, onComplete) {
  const tween = new Tween(target, props, duration, easing, onComplete);
  activeTweens.push(tween);
  return tween;
}

export function updateTweens(dt) {
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    activeTweens[i].update(dt);
    if (activeTweens[i].done) {
      activeTweens.splice(i, 1);
    }
  }
}

export function clearTweens() {
  activeTweens.length = 0;
}

// Easing functions
export function easeOutQuad(t) {
  return t * (2 - t);
}

export function easeInQuad(t) {
  return t * t;
}

export function easeOutBounce(t) {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  } else if (t < 2.5 / 2.75) {
    return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  } else {
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  }
}

export function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function linear(t) {
  return t;
}
