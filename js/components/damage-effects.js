// ============================================
// MONSTER SMASH - Damage Visual Effects
// Smoke, sparks, wobble hints + explosion
// (These are drawn by the battle arena renderer)
// ============================================

// This module provides damage level calculations
// The actual rendering is done in battle-arena.js and particles.js

/**
 * Calculate the visual damage level (0-1) from HP
 * Used by the truck renderer to show damage overlay
 */
export function getDamageLevel(currentHP, maxHP) {
  if (maxHP <= 0) return 0;
  return 1 - (currentHP / maxHP);
}

/**
 * Should this truck be showing smoke particles?
 * Trucks start smoking below 50% HP
 */
export function shouldSmoke(currentHP, maxHP) {
  return currentHP / maxHP < 0.5;
}

/**
 * Should this truck be wobbling/sparking?
 * Trucks wobble below 25% HP
 */
export function shouldWobble(currentHP, maxHP) {
  return currentHP / maxHP < 0.25;
}

/**
 * Get the wobble rotation amount
 */
export function getWobbleRotation(time) {
  return Math.sin(time * 15) * 0.05;
}
