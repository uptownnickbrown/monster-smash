// ============================================
// MONSTER SMASH - Physics Engine
// Truck movement, collision detection, bounce
// ============================================

import { clamp, lerp } from '../utils/math-utils.js';

export class TruckPhysics {
  constructor(x, y, facing) {
    this.x = x;
    this.y = y;
    this.restX = x;
    this.restY = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotationVelocity = 0;
    this.facing = facing; // 1 = right, -1 = left
    this.width = 120;
    this.height = 80;
    this.grounded = true;
    this.friction = 0.97;
    this.gravity = 1200;
    this.groundY = y;
    this.bouncing = false;
  }

  update(dt) {
    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Gravity when airborne
    if (!this.grounded) {
      this.vy += this.gravity * dt;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = -this.vy * 0.3; // bounce
        this.grounded = Math.abs(this.vy) < 30;
        if (this.grounded) {
          this.vy = 0;
          this.y = this.groundY;
        }
      }
    }

    // Friction
    this.vx *= this.friction;
    if (Math.abs(this.vx) < 5) this.vx = 0;

    // Rotation from movement
    this.rotation += this.rotationVelocity * dt;
    this.rotationVelocity *= 0.95;
    // Settle rotation back to 0
    if (Math.abs(this.vx) < 10) {
      this.rotation = lerp(this.rotation, 0, 0.1);
    }
  }

  // Launch the truck with given power and speed stat
  launch(power, speedStat) {
    const baseSpeed = 800;
    const speed = baseSpeed * power * (speedStat / 100) * this.facing;
    this.vx = speed;
    // Add a slight upward arc based on power
    this.vy = -120 * power;
    this.grounded = false;
    this.rotation = -0.1 * this.facing * power;
    this.rotationVelocity = 0.5 * this.facing;
  }

  // Apply knockback from collision
  knockback(force) {
    this.vx = -force * this.facing * 200;
    this.vy = -80;
    this.grounded = false;
    this.rotationVelocity = -force * this.facing * 2;
  }

  // Return to rest position
  returnToRest(speed = 0.05) {
    this.x = lerp(this.x, this.restX, speed);
    this.y = lerp(this.y, this.restY, speed);
    this.rotation = lerp(this.rotation, 0, speed);
    this.vx *= 0.9;
    this.vy *= 0.9;
  }

  // Check AABB collision with another truck
  collidesWith(other) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const oHalfW = other.width / 2;
    const oHalfH = other.height / 2;

    return (
      this.x - halfW < other.x + oHalfW &&
      this.x + halfW > other.x - oHalfW &&
      this.y - halfH < other.y + oHalfH &&
      this.y + halfH > other.y - oHalfH
    );
  }

  // Get bounding box center
  getCenter() {
    return { x: this.x, y: this.y - this.height * 0.3 };
  }

  // Set pull-back position (slingshot charge)
  setPullBack(amount) {
    // amount: 0-1, where 1 is fully pulled back
    this.x = this.restX - amount * 120 * this.facing;
    this.rotation = amount * 0.15 * -this.facing;
  }
}

// Calculate damage from collision
// Returns { damage, critical, abilityBonus } for richer display
export function calculateDamage(attackerTruck, power, defenderTruck, abilityActive = null, critBonus = 0) {
  const baseDamage = attackerTruck.stats.smashDamage;
  const speedMultiplier = 1.0 + (attackerTruck.stats.speed / 100) * 0.5;
  const baseDefense = defenderTruck.stats.shield / 200;

  // Random variance: ±30% — makes every hit feel different
  const variance = 0.7 + Math.random() * 0.6; // 0.7 to 1.3

  // Lucky critical: 10% base chance + difficulty bonus, 1.8x multiplier
  const isCritical = Math.random() < (0.10 + critBonus);
  const criticalMult = isCritical ? 1.8 : 1.0;

  // Calculate base damage (without ability)
  const rawBase = baseDamage * power * speedMultiplier * variance * criticalMult;
  const baseResult = Math.round(rawBase * (1 - baseDefense));

  if (!abilityActive) {
    return { damage: Math.max(baseResult, 5), critical: isCritical, abilityBonus: 0 };
  }

  // Calculate with ability modifiers applied
  let abilitySmash = baseDamage;
  let abilitySpeedMult = speedMultiplier;
  let abilityDefense = baseDefense;

  switch (abilityActive.type) {
    case 'damage-boost':
      abilitySmash *= abilityActive.multiplier || 2;
      break;
    case 'speed-boost':
      abilitySpeedMult *= abilityActive.multiplier || 1.5;
      break;
    case 'pierce':
      abilityDefense *= 0.5; // ignore half of shield
      break;
  }

  const rawAbility = abilitySmash * power * abilitySpeedMult * variance * criticalMult;
  const abilityResult = Math.round(rawAbility * (1 - abilityDefense));
  const bonus = abilityResult - baseResult;

  return {
    damage: Math.max(abilityResult, 5),
    critical: isCritical,
    abilityBonus: Math.max(bonus, 0),
  };
}

// Calculate weight-based knockback
export function calculateKnockback(attackerTruck, defenderTruck) {
  const weightDiff = attackerTruck.stats.weight - defenderTruck.stats.weight;
  return clamp(weightDiff / 100, -0.5, 0.8);
}
