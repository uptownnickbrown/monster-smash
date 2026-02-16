// ============================================
// MONSTER SMASH - Touch/Pointer Utilities
// Unified mouse + touch via Pointer Events
// ============================================

/**
 * Get normalized pointer position from a pointer event
 * Returns { x, y } relative to the target element
 */
export function getPointerPos(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

/**
 * Calculate swipe velocity from pointer events
 */
export class SwipeTracker {
  constructor() {
    this.points = [];
    this.maxPoints = 10;
  }

  addPoint(x, y, time) {
    this.points.push({ x, y, time });
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
  }

  getVelocity() {
    if (this.points.length < 2) return { vx: 0, vy: 0 };

    const last = this.points[this.points.length - 1];
    const first = this.points[0];
    const dt = (last.time - first.time) / 1000; // seconds

    if (dt === 0) return { vx: 0, vy: 0 };

    return {
      vx: (last.x - first.x) / dt,
      vy: (last.y - first.y) / dt,
    };
  }

  reset() {
    this.points = [];
  }
}

/**
 * Attach unified pointer handlers to an element
 */
export function addPointerHandlers(element, { onDown, onMove, onUp }) {
  const handlers = {
    down: (e) => {
      e.preventDefault();
      if (onDown) onDown(e);
    },
    move: (e) => {
      e.preventDefault();
      if (onMove) onMove(e);
    },
    up: (e) => {
      e.preventDefault();
      if (onUp) onUp(e);
    },
  };

  element.addEventListener('pointerdown', handlers.down);
  element.addEventListener('pointermove', handlers.move);
  element.addEventListener('pointerup', handlers.up);
  element.addEventListener('pointercancel', handlers.up);

  // Return cleanup function
  return () => {
    element.removeEventListener('pointerdown', handlers.down);
    element.removeEventListener('pointermove', handlers.move);
    element.removeEventListener('pointerup', handlers.up);
    element.removeEventListener('pointercancel', handlers.up);
  };
}
