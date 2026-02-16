// ============================================
// MONSTER SMASH - Particle System
// Sparks, fire, smoke, explosions, debris
// ============================================

import { randomRange, hexToRgb } from '../utils/math-utils.js';

const MAX_PARTICLES = 250;

class Particle {
  constructor(x, y, vx, vy, color, size, life, type = 'square') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.type = type; // 'square', 'circle', 'spark'
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 10;
    this.gravity = 400;
    this.alpha = 1;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
    this.rotation += this.rotationSpeed * dt;
    // Shrink over time
    this.size *= 0.995;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.type === 'circle') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'spark') {
      // Elongated spark
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -1, this.size, 2);
    } else {
      // Square debris
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    }

    ctx.restore();
  }

  get isDead() {
    return this.life <= 0;
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].isDead) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
  }

  // Burst of sparks at a collision point
  emitCollisionSparks(x, y, color1, color2, intensity = 1) {
    const count = Math.floor(30 * intensity);
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(100, 400) * intensity;
      const color = Math.random() > 0.5 ? color1 : color2;
      const { r, g, b } = hexToRgb(color);
      // Make some particles brighter
      const bright = Math.random() > 0.5;
      const c = bright
        ? `rgb(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)})`
        : `rgb(${r}, ${g}, ${b})`;

      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 100,
        c,
        randomRange(2, 6),
        randomRange(0.3, 0.8),
        Math.random() > 0.5 ? 'spark' : 'square'
      ));
    }

    // Add some white/yellow hot sparks
    for (let i = 0; i < 10 && this.particles.length < MAX_PARTICLES; i++) {
      const angle = randomRange(-Math.PI * 0.8, -Math.PI * 0.2);
      const speed = randomRange(200, 500);
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        Math.random() > 0.5 ? '#ffffff' : '#ffd21a',
        randomRange(1, 3),
        randomRange(0.2, 0.5),
        'spark'
      ));
    }
  }

  // Fire trail behind a moving truck
  emitFireTrail(x, y, color) {
    if (this.particles.length >= MAX_PARTICLES) return;

    const { r, g, b } = hexToRgb(color);
    this.particles.push(new Particle(
      x + randomRange(-10, 10),
      y + randomRange(-5, 5),
      randomRange(-30, 30),
      randomRange(-50, -20),
      `rgb(${r}, ${g}, ${b})`,
      randomRange(3, 8),
      randomRange(0.2, 0.4),
      'circle'
    ));
  }

  // Smoke puff
  emitSmoke(x, y, amount = 3) {
    for (let i = 0; i < amount && this.particles.length < MAX_PARTICLES; i++) {
      this.particles.push(new Particle(
        x + randomRange(-15, 15),
        y + randomRange(-10, 0),
        randomRange(-20, 20),
        randomRange(-40, -15),
        `rgba(100, 100, 100, 0.5)`,
        randomRange(6, 14),
        randomRange(0.5, 1.2),
        'circle'
      ));
      // Override gravity for smoke (floats up)
      this.particles[this.particles.length - 1].gravity = -50;
    }
  }

  // MASSIVE explosion when a truck is destroyed
  emitExplosion(x, y, truckColor) {
    // Ring of fire
    for (let i = 0; i < 50 && this.particles.length < MAX_PARTICLES; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(200, 600);
      const fireColors = ['#ff2d2d', '#ff6b1a', '#ffd21a', '#fff8e0'];
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 150,
        fireColors[Math.floor(Math.random() * fireColors.length)],
        randomRange(4, 12),
        randomRange(0.5, 1.2),
        'circle'
      ));
    }

    // Debris (truck colored chunks)
    for (let i = 0; i < 25 && this.particles.length < MAX_PARTICLES; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(150, 400);
      this.particles.push(new Particle(
        x + randomRange(-20, 20),
        y + randomRange(-20, 10),
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 200,
        truckColor,
        randomRange(4, 10),
        randomRange(0.8, 1.5),
        'square'
      ));
    }

    // Smoke cloud
    for (let i = 0; i < 15 && this.particles.length < MAX_PARTICLES; i++) {
      const p = new Particle(
        x + randomRange(-30, 30),
        y + randomRange(-20, 10),
        randomRange(-40, 40),
        randomRange(-60, -20),
        '#444444',
        randomRange(15, 30),
        randomRange(1.0, 2.0),
        'circle'
      );
      p.gravity = -30; // smoke rises
      this.particles.push(p);
    }
  }

  // Ability activation sparkle
  emitAbilitySparkle(x, y, color) {
    for (let i = 0; i < 20 && this.particles.length < MAX_PARTICLES; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(50, 150);
      this.particles.push(new Particle(
        x + randomRange(-20, 20),
        y + randomRange(-30, 10),
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 80,
        color,
        randomRange(2, 5),
        randomRange(0.3, 0.7),
        'circle'
      ));
    }
  }

  // Dust cloud from landing
  emitDust(x, y) {
    for (let i = 0; i < 8 && this.particles.length < MAX_PARTICLES; i++) {
      const p = new Particle(
        x + randomRange(-20, 20),
        y,
        randomRange(-60, 60),
        randomRange(-20, -5),
        '#8b6538',
        randomRange(4, 10),
        randomRange(0.3, 0.6),
        'circle'
      );
      p.gravity = 50;
      this.particles.push(p);
    }
  }

  clear() {
    this.particles = [];
  }

  get count() {
    return this.particles.length;
  }
}
