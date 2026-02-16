// ============================================
// MONSTER SMASH - Battle Arena
// Drag-back slingshot with sweet spot,
// full-arena collisions, fire effects,
// stat-exaggerated visuals, ability effects
// ============================================

import { createBattleCanvas, startGameLoop, stopGameLoop, destroyBattleCanvas } from '../engine/canvas-renderer.js';
import { TruckPhysics, calculateDamage, calculateKnockback } from '../engine/physics.js';
import { ParticleSystem } from '../engine/particles.js';
import { triggerShake, updateShake, resetShake } from '../engine/screen-shake.js';
import { updateTweens, clearTweens } from '../engine/animation.js';
import { drawTruck } from '../trucks/truck-renderer.js';
import { clamp, randomRange } from '../utils/math-utils.js';
import { addPointerHandlers } from '../utils/touch-utils.js';
import { playCrash, playExplosion, playWhoosh, playPowerUp, playEngineRev } from '../audio/sound-effects.js';

// Polyfill for roundRect on older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    this.moveTo(x + r[0], y);
    this.lineTo(x + w - r[1], y);
    this.arcTo(x + w, y, x + w, y + r[1], r[1]);
    this.lineTo(x + w, y + h - r[2]);
    this.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
    this.lineTo(x + r[3], y + h);
    this.arcTo(x, y + h, x, y + h - r[3], r[3]);
    this.lineTo(x, y + r[0]);
    this.arcTo(x, y, x + r[0], y, r[0]);
    this.closePath();
  };
}

// Arena logical dimensions
const ARENA_W = 900;
const ARENA_H = 500;

// Sweet spot config
const SWEET_SPOT = 0.70;          // 70% drag = max power
const OVERCLOCK_PENALTY = 0.45;   // power drops by this much at 100% drag

// Battle state
let playerTruck = null;
let enemyTruck = null;
let playerPhysics = null;
let enemyPhysics = null;
let particles = null;
let cleanupPointer = null;

let playerHP = 0;
let enemyHP = 0;
let playerMaxHP = 0;
let enemyMaxHP = 0;

let phase = 'intro';
let phaseTimer = 0;
let smashCount = 0;
const MAX_SMASHES = 3;

// Drag-to-charge with sweet spot
let chargeAmount = 0;      // 0.0 to 1.0 raw drag distance
let isDragging = false;
let dragStartX = 0;

let playerAbilityUsed = false;
let playerAbilityActive = null;
let enemyAbilityUsed = false;
let enemyAbilityActive = null;

let flashAlpha = 0;
let roundText = '';
let roundTextTimer = 0;
let damageNumbers = [];

// Fire background effect
let bgEmbers = [];

// Ability effect floating texts
let abilityTexts = [];

let onRoundComplete = null;
let canvasWidth = 0;
let canvasHeight = 0;
let scaleX = 1;
let scaleY = 1;

// ---- Sweet Spot Power Curve ----
function getSweetSpotPower(drag) {
  if (drag <= 0) return 0;
  if (drag <= SWEET_SPOT) {
    return drag / SWEET_SPOT; // linear 0 -> 1.0
  }
  // Overclock zone: drops from 1.0 down
  const over = (drag - SWEET_SPOT) / (1 - SWEET_SPOT); // 0 -> 1
  return 1.0 - over * OVERCLOCK_PENALTY; // 1.0 -> 0.55
}

// ---- Ability Visual Helpers ----
function getAbilityColor(type) {
  const colors = {
    'damage-boost': '#ff2d2d',
    'direct-damage': '#ffd21a',
    'heal': '#39ff14',
    'shield-boost': '#4488ff',
    'speed-boost': '#ff6b1a',
    'stun': '#aa88ff',
    'burn': '#ff4400',
    'pierce': '#ffcc00',
    'multi-hit': '#ff44aa',
    'dodge': '#88ffff',
    'steal': '#44ff88',
    'random': '#ff88ff',
  };
  return colors[type] || '#ffffff';
}

function getAbilityLabel(type) {
  const labels = {
    'damage-boost': 'CRITICAL HIT!',
    'direct-damage': 'ZAP!',
    'heal': 'HEALED!',
    'shield-boost': 'SHIELDED!',
    'speed-boost': 'TURBO!',
    'stun': 'STUNNED!',
    'burn': 'BURN!',
    'pierce': 'ARMOR PIERCED!',
    'multi-hit': 'COMBO!',
    'dodge': 'DODGED!',
    'steal': 'LIFE DRAIN!',
    'random': 'WILD CARD!',
  };
  return labels[type] || 'POWER UP!';
}

// ---- Main API ----

export function startBattle(pTruck, eTruck, roundNum, onComplete) {
  playerTruck = pTruck;
  enemyTruck = eTruck;
  onRoundComplete = onComplete;

  playerMaxHP = 100 + playerTruck.stats.shield * 2;
  enemyMaxHP = 100 + enemyTruck.stats.shield * 2;
  playerHP = playerMaxHP;
  enemyHP = enemyMaxHP;

  playerAbilityUsed = false;
  playerAbilityActive = null;
  enemyAbilityUsed = false;
  enemyAbilityActive = null;
  smashCount = 0;
  damageNumbers = [];
  abilityTexts = [];
  chargeAmount = 0;
  isDragging = false;
  bgEmbers = [];

  // Initialize background embers
  for (let i = 0; i < 30; i++) {
    bgEmbers.push({
      x: Math.random() * ARENA_W,
      y: Math.random() * ARENA_H,
      vy: -(20 + Math.random() * 40),
      vx: (Math.random() - 0.5) * 15,
      size: 1 + Math.random() * 3,
      life: Math.random(),
      color: Math.random() > 0.5 ? '#ff6b1a' : '#ffd21a',
    });
  }

  const container = document.getElementById('battle-canvas-container');
  if (!container) return;

  const rect = container.getBoundingClientRect();
  canvasWidth = rect.width || window.innerWidth;
  canvasHeight = rect.height || window.innerHeight;
  scaleX = canvasWidth / ARENA_W;
  scaleY = canvasHeight / ARENA_H;

  const { canvas } = createBattleCanvas(container, canvasWidth, canvasHeight);

  const groundY = canvasHeight * 0.75;
  playerPhysics = new TruckPhysics(canvasWidth * 0.15, groundY, 1);
  enemyPhysics = new TruckPhysics(canvasWidth * 0.85, groundY, -1);

  particles = new ParticleSystem();
  resetShake();
  clearTweens();

  cleanupPointer = addPointerHandlers(canvas, {
    onDown: handlePointerDown,
    onMove: handlePointerMove,
    onUp: handlePointerUp,
  });

  phase = 'intro';
  phaseTimer = 0;
  roundText = `ROUND ${roundNum}`;
  roundTextTimer = 2;

  startGameLoop(update, render);
}

export function stopBattle() {
  stopGameLoop();
  if (cleanupPointer) {
    cleanupPointer();
    cleanupPointer = null;
  }
  destroyBattleCanvas();
  particles = null;
}

export function activatePlayerAbility() {
  if (playerAbilityUsed || phase !== 'player-charge') return false;
  playerAbilityUsed = true;
  playerAbilityActive = playerTruck.specialAbility;

  playPowerUp();
  if (particles) {
    const center = playerPhysics.getCenter();
    const color = getAbilityColor(playerAbilityActive.type);
    particles.emitAbilitySparkle(center.x, center.y, color);
  }

  // Show ability activation text
  abilityTexts.push({
    text: playerAbilityActive.name.toUpperCase() + '!',
    x: playerPhysics.x,
    y: playerPhysics.y - 80,
    color: getAbilityColor(playerAbilityActive.type),
    life: 1.5,
    maxLife: 1.5,
  });

  flashAlpha = 0.25;
  return true;
}

export function activateEnemyAbility() {
  if (enemyAbilityUsed) return;
  enemyAbilityUsed = true;
  enemyAbilityActive = enemyTruck.specialAbility;

  if (particles) {
    const center = enemyPhysics.getCenter();
    const color = getAbilityColor(enemyAbilityActive.type);
    particles.emitAbilitySparkle(center.x, center.y, color);
  }

  abilityTexts.push({
    text: enemyAbilityActive.name.toUpperCase() + '!',
    x: enemyPhysics.x,
    y: enemyPhysics.y - 80,
    color: getAbilityColor(enemyAbilityActive.type),
    life: 1.5,
    maxLife: 1.5,
  });
}

export function getPlayerHP() { return playerHP; }
export function getEnemyHP() { return enemyHP; }
export function getPhase() { return phase; }

// ---- Input Handlers ----

function handlePointerDown(e) {
  if (phase === 'player-charge') {
    isDragging = true;
    dragStartX = e.clientX;
    chargeAmount = 0;
    playEngineRev(0.2);
  }
}

function handlePointerMove(e) {
  if (!isDragging || phase !== 'player-charge') return;

  // Drag LEFT to charge (positive dx = more charge)
  const dx = dragStartX - e.clientX;
  const maxDragPx = canvasWidth * 0.22;
  chargeAmount = clamp(dx / maxDragPx, 0, 1);

  // Pull truck back visually
  const pullbackPx = chargeAmount * canvasWidth * 0.12;
  playerPhysics.x = playerPhysics.restX - pullbackPx;
  playerPhysics.rotation = chargeAmount * 0.15 * -1;

  // Overclock effects - truck shakes and smokes
  if (chargeAmount > SWEET_SPOT) {
    const overIntensity = (chargeAmount - SWEET_SPOT) / (1 - SWEET_SPOT);
    playerPhysics.x += (Math.random() - 0.5) * 6 * overIntensity;
    // Red smoke from engine
    if (particles && Math.random() < 0.4) {
      particles.emitFireTrail(
        playerPhysics.x + 20,
        playerPhysics.y - 30,
        '#ff2200'
      );
    }
  }
}

function handlePointerUp(e) {
  if (!isDragging || phase !== 'player-charge') return;
  isDragging = false;

  if (chargeAmount < 0.05) {
    // Barely dragged - just reset
    chargeAmount = 0;
    playerPhysics.x = playerPhysics.restX;
    playerPhysics.rotation = 0;
    return;
  }

  const power = getSweetSpotPower(chargeAmount);
  const isPerfect = chargeAmount >= 0.65 && chargeAmount <= 0.75;

  phase = 'player-launch';
  phaseTimer = 0;

  // Launch velocity scales with arena distance and speed stat
  const arenaDistance = Math.abs(enemyPhysics.restX - playerPhysics.restX);
  const speedFactor = (playerTruck.stats.speed / 100) * 0.7 + 0.3; // 0.3 -> 1.0
  const baseVelocity = arenaDistance * 2.5;
  const launchVx = baseVelocity * power * speedFactor * playerPhysics.facing;

  // AirTime stat affects launch arc
  const airTimeFactor = (playerTruck.stats.airTime || 50) / 100;
  const launchVy = -180 * power * (0.5 + airTimeFactor * 0.8);

  playerPhysics.vx = launchVx;
  playerPhysics.vy = launchVy;
  playerPhysics.grounded = false;
  playerPhysics.rotation = -0.12 * playerPhysics.facing * power;
  playerPhysics.rotationVelocity = 0.6 * playerPhysics.facing;

  playWhoosh();
  if (particles) {
    particles.emitDust(playerPhysics.x, playerPhysics.y + 20);
    // Extra dust for heavy trucks
    if (playerTruck.stats.weight > 70) {
      particles.emitDust(playerPhysics.x - 20, playerPhysics.y + 20);
      particles.emitDust(playerPhysics.x + 20, playerPhysics.y + 20);
    }
  }

  if (isPerfect) {
    flashAlpha = 0.3;
    abilityTexts.push({
      text: 'PERFECT!',
      x: playerPhysics.x + 50,
      y: playerPhysics.y - 60,
      color: '#ffd21a',
      life: 1.2,
      maxLife: 1.2,
    });
  }

  chargeAmount = 0;
}

// ---- Game Loop ----

function update(dt) {
  phaseTimer += dt;
  updateTweens(dt);

  // Update damage numbers
  damageNumbers = damageNumbers.filter(d => {
    d.y -= 50 * dt;
    d.life -= dt;
    d.alpha = Math.max(0, d.life / d.maxLife);
    d.scale = 1 + (1 - d.life / d.maxLife) * 0.3;
    return d.life > 0;
  });

  // Update ability texts
  abilityTexts = abilityTexts.filter(t => {
    t.y -= 30 * dt;
    t.life -= dt;
    return t.life > 0;
  });

  // Flash decay
  if (flashAlpha > 0) flashAlpha -= dt * 3;

  // Round text decay
  if (roundTextTimer > 0) roundTextTimer -= dt;

  // Update background embers
  updateEmbers(dt);

  switch (phase) {
    case 'intro':
      updateIntro(dt);
      break;
    case 'player-charge':
      updatePlayerCharge(dt);
      break;
    case 'player-launch':
      updatePlayerLaunch(dt);
      break;
    case 'player-hit':
      updateAfterHit(dt, 'ai-charge');
      break;
    case 'ai-charge':
      updateAICharge(dt);
      break;
    case 'ai-launch':
      updateAILaunch(dt);
      break;
    case 'ai-hit':
      updateAfterHit(dt, 'next-smash');
      break;
    case 'next-smash':
      updateNextSmash(dt);
      break;
    case 'resolve':
      updateResolve(dt);
      break;
  }

  if (particles) particles.update(dt);
  if (playerPhysics) playerPhysics.update(dt);
  if (enemyPhysics) enemyPhysics.update(dt);
}

function updateEmbers(dt) {
  bgEmbers.forEach(e => {
    e.y += e.vy * dt;
    e.x += e.vx * dt;
    e.life -= dt * 0.3;
    if (e.life <= 0 || e.y < -20) {
      e.y = canvasHeight + 10;
      e.x = Math.random() * canvasWidth;
      e.life = 0.5 + Math.random() * 0.5;
      e.vy = -(20 + Math.random() * 40);
    }
  });
}

function updateIntro(dt) {
  if (phaseTimer < 1.2) {
    const t = Math.min(phaseTimer / 0.9, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    playerPhysics.x = -80 + (canvasWidth * 0.15 + 80) * ease;
    enemyPhysics.x = canvasWidth + 80 - (canvasWidth * 0.15 + 80) * ease;

    // Dust trail during entrance
    if (phaseTimer > 0.1 && Math.random() < 0.3 && particles) {
      particles.emitDust(playerPhysics.x - 30, playerPhysics.y + 20);
      particles.emitDust(enemyPhysics.x + 30, enemyPhysics.y + 20);
    }
  } else {
    playerPhysics.x = canvasWidth * 0.15;
    enemyPhysics.x = canvasWidth * 0.85;
    phase = 'player-charge';
    phaseTimer = 0;
    chargeAmount = 0;
    isDragging = false;
  }
}

function updatePlayerCharge(dt) {
  // Idle truck bounce when NOT dragging
  if (!isDragging) {
    playerPhysics.x = playerPhysics.restX + Math.sin(phaseTimer * 12) * 2;
  }

  updateDamageEffects(dt);
}

function updatePlayerLaunch(dt) {
  // Check collision
  if (playerPhysics.collidesWith(enemyPhysics)) {
    handleCollision(playerTruck, enemyTruck, playerPhysics, enemyPhysics, playerAbilityActive, true);
    playerAbilityActive = null;
    phase = 'player-hit';
    phaseTimer = 0;
    return;
  }

  // Fire trail while moving fast - more intense for fast trucks
  const speed = Math.abs(playerPhysics.vx);
  if (speed > 100 && particles) {
    particles.emitFireTrail(
      playerPhysics.x - 40 * scaleX,
      playerPhysics.y - 10,
      playerTruck.visual.glowColor || '#ff6b1a'
    );
    // Extra trail for fast trucks
    if (playerTruck.stats.speed > 70 && Math.random() < 0.6) {
      particles.emitFireTrail(
        playerPhysics.x - 50 * scaleX,
        playerPhysics.y - 20 + randomRange(-10, 10),
        '#ffd21a'
      );
    }
    // Ability-colored trail if ability active
    if (playerAbilityActive) {
      particles.emitFireTrail(
        playerPhysics.x - 30 * scaleX,
        playerPhysics.y - 25,
        getAbilityColor(playerAbilityActive.type)
      );
    }
  }

  // Miss timeout
  if (phaseTimer > 3 || (phaseTimer > 0.8 && Math.abs(playerPhysics.vx) < 30)) {
    phase = 'ai-charge';
    phaseTimer = 0;
    playerPhysics.returnToRest(1);
    playerPhysics.x = playerPhysics.restX;
    playerPhysics.y = playerPhysics.restY;
  }
}

function updateAICharge(dt) {
  const chargeTime = randomRange(0.6, 1.2);

  if (phaseTimer < 0.3) {
    // Brief "ENEMY TURN" pause
  } else if (phaseTimer < 0.3 + chargeTime) {
    // AI truck revs (idle animation)
    enemyPhysics.x = enemyPhysics.restX + Math.sin((phaseTimer - 0.3) * 15) * 2;

    // Maybe use ability (30% chance)
    if (!enemyAbilityUsed && phaseTimer > 0.5 && phaseTimer < 0.55 && Math.random() < 0.3) {
      activateEnemyAbility();
    }
  } else {
    // AI launches with 50-80% power (easy difficulty)
    const aiPower = randomRange(0.5, 0.8);
    const arenaDistance = Math.abs(playerPhysics.restX - enemyPhysics.restX);
    const speedFactor = (enemyTruck.stats.speed / 100) * 0.7 + 0.3;
    const launchVx = arenaDistance * 2.5 * aiPower * speedFactor * enemyPhysics.facing;
    const airTimeFactor = (enemyTruck.stats.airTime || 50) / 100;
    const launchVy = -180 * aiPower * (0.5 + airTimeFactor * 0.8);

    enemyPhysics.vx = launchVx;
    enemyPhysics.vy = launchVy;
    enemyPhysics.grounded = false;
    enemyPhysics.rotation = -0.12 * enemyPhysics.facing * aiPower;
    enemyPhysics.rotationVelocity = 0.6 * enemyPhysics.facing;

    phase = 'ai-launch';
    phaseTimer = 0;

    if (particles) {
      particles.emitDust(enemyPhysics.x, enemyPhysics.y + 20);
    }
  }
}

function updateAILaunch(dt) {
  if (enemyPhysics.collidesWith(playerPhysics)) {
    handleCollision(enemyTruck, playerTruck, enemyPhysics, playerPhysics, enemyAbilityActive, false);
    enemyAbilityActive = null;
    phase = 'ai-hit';
    phaseTimer = 0;
    return;
  }

  // Fire trail
  const speed = Math.abs(enemyPhysics.vx);
  if (speed > 100 && particles) {
    particles.emitFireTrail(
      enemyPhysics.x + 40 * scaleX,
      enemyPhysics.y - 10,
      enemyTruck.visual.glowColor || '#ff2d2d'
    );
    if (enemyTruck.stats.speed > 70 && Math.random() < 0.6) {
      particles.emitFireTrail(
        enemyPhysics.x + 50 * scaleX,
        enemyPhysics.y - 20 + randomRange(-10, 10),
        '#ffd21a'
      );
    }
    if (enemyAbilityActive) {
      particles.emitFireTrail(
        enemyPhysics.x + 30 * scaleX,
        enemyPhysics.y - 25,
        getAbilityColor(enemyAbilityActive.type)
      );
    }
  }

  // Timeout
  if (phaseTimer > 3 || (phaseTimer > 0.8 && Math.abs(enemyPhysics.vx) < 30)) {
    phase = 'ai-hit';
    phaseTimer = 0;
    enemyPhysics.returnToRest(1);
    enemyPhysics.x = enemyPhysics.restX;
    enemyPhysics.y = enemyPhysics.restY;
  }
}

function updateAfterHit(dt, nextPhase) {
  playerPhysics.returnToRest(0.06);
  enemyPhysics.returnToRest(0.06);

  // Check for KO
  if (playerHP <= 0) {
    phase = 'resolve';
    phaseTimer = 0;
    if (particles) {
      particles.emitExplosion(playerPhysics.x, playerPhysics.y - 20, playerTruck.visual.primaryColor);
    }
    playExplosion();
    triggerShake(25, 0.7);
    flashAlpha = 1;
    return;
  }

  if (enemyHP <= 0) {
    phase = 'resolve';
    phaseTimer = 0;
    if (particles) {
      particles.emitExplosion(enemyPhysics.x, enemyPhysics.y - 20, enemyTruck.visual.primaryColor);
    }
    playExplosion();
    triggerShake(25, 0.7);
    flashAlpha = 1;
    return;
  }

  if (phaseTimer > 1.2) {
    phase = nextPhase;
    phaseTimer = 0;
  }
}

function updateNextSmash(dt) {
  smashCount++;

  if (smashCount >= MAX_SMASHES) {
    phase = 'resolve';
    phaseTimer = 0;
    const playerPercent = playerHP / playerMaxHP;
    const enemyPercent = enemyHP / enemyMaxHP;
    if (playerPercent <= enemyPercent) {
      playerHP = 0;
      if (particles) particles.emitExplosion(playerPhysics.x, playerPhysics.y - 20, playerTruck.visual.primaryColor);
    } else {
      enemyHP = 0;
      if (particles) particles.emitExplosion(enemyPhysics.x, enemyPhysics.y - 20, enemyTruck.visual.primaryColor);
    }
    playExplosion();
    triggerShake(18, 0.5);
    flashAlpha = 0.8;
    return;
  }

  phase = 'player-charge';
  phaseTimer = 0;
  chargeAmount = 0;
  isDragging = false;
}

function updateResolve(dt) {
  playerPhysics.returnToRest(0.04);
  enemyPhysics.returnToRest(0.04);

  if (phaseTimer > 2.5) {
    phase = 'done';
    const winner = enemyHP <= 0 ? 'player' : 'computer';
    if (onRoundComplete) {
      onRoundComplete({
        winner,
        playerDamage: playerMaxHP - playerHP,
        computerDamage: enemyMaxHP - enemyHP,
      });
    }
  }
}

function updateDamageEffects(dt) {
  if (particles) {
    const playerDamageRatio = 1 - (playerHP / playerMaxHP);
    const enemyDamageRatio = 1 - (enemyHP / enemyMaxHP);

    if (playerDamageRatio > 0.5 && Math.random() < 0.12) {
      particles.emitSmoke(playerPhysics.x, playerPhysics.y - 40, 1);
    }
    if (enemyDamageRatio > 0.5 && Math.random() < 0.12) {
      particles.emitSmoke(enemyPhysics.x, enemyPhysics.y - 40, 1);
    }
  }
}

// ---- Collision Handling ----

function handleCollision(attacker, defender, attackerPhys, defenderPhys, ability, isPlayer) {
  const speed = Math.abs(attackerPhys.vx);
  const power = clamp(speed / 1200, 0.3, 1.2);
  const damage = calculateDamage(attacker, power, defender, ability);
  const knockback = calculateKnockback(attacker, defender);

  if (isPlayer) {
    enemyHP = Math.max(0, enemyHP - damage);
  } else {
    playerHP = Math.max(0, playerHP - damage);
  }

  // Handle ability effects with distinct visuals
  if (ability) {
    const abilityColor = getAbilityColor(ability.type);
    const label = getAbilityLabel(ability.type);
    const targetPhys = isPlayer ? defenderPhys : attackerPhys;
    const selfPhys = isPlayer ? attackerPhys : defenderPhys;

    // Show ability label floating text
    abilityTexts.push({
      text: label,
      x: targetPhys.x,
      y: targetPhys.y - 90,
      color: abilityColor,
      life: 1.5,
      maxLife: 1.5,
    });

    // Ability-colored sparks at collision point
    if (particles) {
      particles.emitCollisionSparks(
        (attackerPhys.x + defenderPhys.x) / 2,
        (attackerPhys.y + defenderPhys.y) / 2 - 20,
        abilityColor, abilityColor, power * 0.8
      );
    }

    switch (ability.type) {
      case 'heal':
        if (isPlayer) playerHP = Math.min(playerMaxHP, playerHP + 30);
        else enemyHP = Math.min(enemyMaxHP, enemyHP + 30);
        if (particles) particles.emitAbilitySparkle(selfPhys.x, selfPhys.y - 20, '#39ff14');
        break;
      case 'steal': {
        const amt = 15;
        if (isPlayer) {
          enemyHP = Math.max(0, enemyHP - amt);
          playerHP = Math.min(playerMaxHP, playerHP + amt);
        } else {
          playerHP = Math.max(0, playerHP - amt);
          enemyHP = Math.min(enemyMaxHP, enemyHP + amt);
        }
        if (particles) {
          particles.emitAbilitySparkle(targetPhys.x, targetPhys.y - 20, '#44ff88');
          particles.emitAbilitySparkle(selfPhys.x, selfPhys.y - 20, '#44ff88');
        }
        break;
      }
      case 'direct-damage': {
        const directDmg = ability.multiplier ? ability.multiplier : 30;
        if (isPlayer) enemyHP = Math.max(0, enemyHP - directDmg);
        else playerHP = Math.max(0, playerHP - directDmg);
        if (particles) {
          particles.emitCollisionSparks(targetPhys.x, targetPhys.y - 30, '#ffd21a', '#ffffff', 1.0);
        }
        flashAlpha = Math.max(flashAlpha, 0.5);
        break;
      }
      case 'shield-boost': {
        const shieldAmount = Math.round(damage * 0.3);
        if (isPlayer) playerHP = Math.min(playerMaxHP, playerHP + shieldAmount);
        else enemyHP = Math.min(enemyMaxHP, enemyHP + shieldAmount);
        if (particles) particles.emitAbilitySparkle(selfPhys.x, selfPhys.y - 20, '#4488ff');
        break;
      }
      case 'burn': {
        const burnDmg = 15;
        if (isPlayer) enemyHP = Math.max(0, enemyHP - burnDmg);
        else playerHP = Math.max(0, playerHP - burnDmg);
        if (particles) {
          particles.emitFireTrail(targetPhys.x, targetPhys.y - 20, '#ff4400');
          particles.emitFireTrail(targetPhys.x + 10, targetPhys.y - 30, '#ff6600');
          particles.emitFireTrail(targetPhys.x - 10, targetPhys.y - 25, '#ff2200');
        }
        break;
      }
      case 'stun': {
        const stunDmg = 10;
        if (isPlayer) enemyHP = Math.max(0, enemyHP - stunDmg);
        else playerHP = Math.max(0, playerHP - stunDmg);
        if (particles) particles.emitAbilitySparkle(targetPhys.x, targetPhys.y - 30, '#aa88ff');
        break;
      }
      case 'multi-hit': {
        const extraHits = 2;
        const extraDmg = Math.round(damage * 0.3);
        for (let i = 0; i < extraHits; i++) {
          if (isPlayer) enemyHP = Math.max(0, enemyHP - extraDmg);
          else playerHP = Math.max(0, playerHP - extraDmg);
        }
        // Staggered spark bursts
        if (particles) {
          for (let i = 0; i < extraHits; i++) {
            setTimeout(() => {
              if (particles) {
                particles.emitCollisionSparks(
                  targetPhys.x + randomRange(-30, 30),
                  targetPhys.y + randomRange(-40, 0),
                  '#ff44aa', '#ffffff', 0.6
                );
              }
            }, i * 150);
          }
        }
        break;
      }
      case 'speed-boost': {
        // Already handled by calculateDamage multiplier
        if (particles) {
          particles.emitFireTrail(selfPhys.x - 20 * selfPhys.facing, selfPhys.y - 15, '#ff6b1a');
          particles.emitFireTrail(selfPhys.x - 30 * selfPhys.facing, selfPhys.y - 10, '#ffd21a');
        }
        break;
      }
      case 'dodge': {
        // Reduce damage taken by healing back some
        const dodgeHeal = Math.round(damage * 0.5);
        if (isPlayer) playerHP = Math.min(playerMaxHP, playerHP + dodgeHeal);
        else enemyHP = Math.min(enemyMaxHP, enemyHP + dodgeHeal);
        if (particles) particles.emitAbilitySparkle(selfPhys.x, selfPhys.y - 20, '#88ffff');
        break;
      }
      case 'random': {
        const randomDmg = Math.round(randomRange(5, 60));
        if (isPlayer) enemyHP = Math.max(0, enemyHP - randomDmg);
        else playerHP = Math.max(0, playerHP - randomDmg);
        if (particles) {
          particles.emitCollisionSparks(targetPhys.x, targetPhys.y - 20, '#ff88ff', '#88ffff', 1.0);
        }
        break;
      }
    }
  }

  // Physics response - knockback scaled by weight stat
  const weightFactor = (attacker.stats.weight / 100) * 0.5 + 0.5;
  attackerPhys.vx *= -0.4;
  defenderPhys.knockback((knockback + 0.5) * weightFactor);

  // Collision visual effects - spark intensity scaled by smashDamage stat
  const collisionX = (attackerPhys.x + defenderPhys.x) / 2;
  const collisionY = (attackerPhys.y + defenderPhys.y) / 2 - 20;

  if (particles) {
    const sparkIntensity = power * (attacker.stats.smashDamage / 100) * 1.5;
    particles.emitCollisionSparks(collisionX, collisionY, attacker.visual.primaryColor, defender.visual.primaryColor, sparkIntensity);
    if (damage > 40) {
      particles.emitCollisionSparks(collisionX, collisionY - 10, '#ffd21a', '#ff6b1a', sparkIntensity * 0.8);
    }
  }

  playCrash(Math.min(power, 1));

  // Screen shake scaled by weight + damage
  const shakeIntensity = 8 + damage * 0.15 + (attacker.stats.weight / 100) * 8;
  triggerShake(shakeIntensity, 0.4 + power * 0.2);

  if (damage > 40) flashAlpha = Math.max(flashAlpha, 0.6);
  if (damage > 70) flashAlpha = Math.max(flashAlpha, 0.9);

  // Floating damage number
  damageNumbers.push({
    value: damage,
    x: defenderPhys.x,
    y: defenderPhys.y - 70,
    life: 1.5,
    maxLife: 1.5,
    alpha: 1,
    scale: 1,
    isPlayer: !isPlayer,
    isPerfect: power > 0.9,
    isAbility: !!ability,
    abilityColor: ability ? getAbilityColor(ability.type) : null,
  });
}

// ---- Rendering ----

function render(ctx, w, h, dt) {
  const shake = updateShake(dt);

  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Clear
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(-5, -5, w + 10, h + 10);

  // Draw fire background
  drawFireBackground(ctx, w, h);

  // Draw stadium background
  drawStadiumBg(ctx, w, h);

  // Draw ground with fire edges
  drawGround(ctx, w, h);

  // Draw trucks
  const playerDamageRatio = 1 - (playerHP / playerMaxHP);
  const enemyDamageRatio = 1 - (enemyHP / enemyMaxHP);

  if (playerHP > 0 || phase !== 'resolve') {
    ctx.save();
    if (playerPhysics.rotation) {
      ctx.translate(playerPhysics.x, playerPhysics.y);
      ctx.rotate(playerPhysics.rotation);
      ctx.translate(-playerPhysics.x, -playerPhysics.y);
    }
    drawTruck(ctx, playerTruck, playerPhysics.x, playerPhysics.y, scaleX * 0.7, {
      flip: false,
      damageLevel: playerDamageRatio,
      glowing: playerAbilityActive !== null,
    });
    // Shield glow for high-shield trucks
    if (playerTruck.stats.shield > 60 && phase === 'player-charge') {
      drawShieldGlow(ctx, playerPhysics.x, playerPhysics.y, playerTruck.stats.shield, '#4488ff');
    }
    ctx.restore();
  }

  if (enemyHP > 0 || phase !== 'resolve') {
    ctx.save();
    if (enemyPhysics.rotation) {
      ctx.translate(enemyPhysics.x, enemyPhysics.y);
      ctx.rotate(enemyPhysics.rotation);
      ctx.translate(-enemyPhysics.x, -enemyPhysics.y);
    }
    drawTruck(ctx, enemyTruck, enemyPhysics.x, enemyPhysics.y, scaleX * 0.7, {
      flip: true,
      damageLevel: enemyDamageRatio,
      glowing: enemyAbilityActive !== null,
    });
    if (enemyTruck.stats.shield > 60 && (phase === 'ai-charge' || phase === 'player-charge')) {
      drawShieldGlow(ctx, enemyPhysics.x, enemyPhysics.y, enemyTruck.stats.shield, '#4488ff');
    }
    ctx.restore();
  }

  // Speed lines during launches
  if (phase === 'player-launch' && Math.abs(playerPhysics.vx) > 200) {
    drawSpeedLines(ctx, playerPhysics, playerTruck);
  }
  if (phase === 'ai-launch' && Math.abs(enemyPhysics.vx) > 200) {
    drawSpeedLines(ctx, enemyPhysics, enemyTruck);
  }

  // Background embers
  drawEmbers(ctx);

  // Particles
  if (particles) particles.draw(ctx);

  // Damage numbers
  drawDamageNumbers(ctx);

  // Ability floating texts
  drawAbilityTexts(ctx);

  // Power meter during charge phase
  if (phase === 'player-charge') {
    drawPowerMeter(ctx, w, h);
  }

  // Flash overlay
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${clamp(flashAlpha, 0, 1)})`;
    ctx.fillRect(-5, -5, w + 10, h + 10);
  }

  // Round text overlay
  if (roundTextTimer > 0) {
    drawRoundText(ctx, w, h);
  }

  // Phase instruction text
  drawPhaseText(ctx, w, h);

  ctx.restore();
}

// ---- Drawing Helpers ----

function drawShieldGlow(ctx, x, y, shieldStat, color) {
  const intensity = (shieldStat - 60) / 40;
  const time = performance.now() / 1000;
  ctx.save();
  ctx.globalAlpha = 0.08 + Math.sin(time * 3) * 0.04 * intensity;
  const radius = 55 * scaleX;
  const grad = ctx.createRadialGradient(x, y - 25, 5, x, y - 25, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y - 25, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpeedLines(ctx, physics, truck) {
  const speed = Math.abs(physics.vx);
  const intensity = clamp(speed / 1500, 0, 1);
  const numLines = Math.floor(5 + intensity * 15);
  const direction = Math.sign(physics.vx);

  ctx.save();
  ctx.globalAlpha = intensity * 0.4;
  for (let i = 0; i < numLines; i++) {
    const lineY = physics.y - 40 + Math.random() * 60;
    const lineX = physics.x - direction * (20 + Math.random() * 60);
    const lineLen = 30 + Math.random() * 80 * intensity;

    ctx.strokeStyle = truck.visual.glowColor || '#ffffff';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(lineX, lineY);
    ctx.lineTo(lineX - direction * lineLen, lineY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFireBackground(ctx, w, h) {
  const time = performance.now() / 1000;

  // Left fire wall
  const leftGrad = ctx.createLinearGradient(0, 0, w * 0.12, 0);
  leftGrad.addColorStop(0, `rgba(255, 60, 0, ${0.15 + Math.sin(time * 3) * 0.05})`);
  leftGrad.addColorStop(0.5, `rgba(255, 100, 0, ${0.08 + Math.sin(time * 2.5) * 0.03})`);
  leftGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, w * 0.12, h);

  // Right fire wall
  const rightGrad = ctx.createLinearGradient(w, 0, w * 0.88, 0);
  rightGrad.addColorStop(0, `rgba(255, 60, 0, ${0.15 + Math.sin(time * 3.2) * 0.05})`);
  rightGrad.addColorStop(0.5, `rgba(255, 100, 0, ${0.08 + Math.sin(time * 2.8) * 0.03})`);
  rightGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(w * 0.88, 0, w * 0.12, h);

  // Bottom fire glow
  const bottomGrad = ctx.createLinearGradient(0, h, 0, h * 0.75);
  bottomGrad.addColorStop(0, `rgba(255, 80, 0, ${0.2 + Math.sin(time * 4) * 0.08})`);
  bottomGrad.addColorStop(0.5, 'rgba(255, 40, 0, 0.05)');
  bottomGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);
}

function drawStadiumBg(ctx, w, h) {
  // Dark gradient sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
  skyGrad.addColorStop(0, '#0a0a1a');
  skyGrad.addColorStop(1, '#12121d');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h * 0.65);

  // Stadium lights
  ctx.save();
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 3; i++) {
    const lx = w * (0.2 + i * 0.3);
    ctx.fillStyle = '#ffd21a';
    ctx.beginPath();
    ctx.moveTo(lx - 10, 0);
    ctx.lineTo(lx + 10, 0);
    ctx.lineTo(lx + 100, h * 0.65);
    ctx.lineTo(lx - 100, h * 0.65);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Crowd silhouette
  ctx.fillStyle = '#1a1a24';
  for (let x = 0; x < w; x += 7) {
    const crowdH = 18 + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.13) * 4;
    ctx.fillRect(x, h * 0.55 - crowdH, 6, crowdH);
  }

  // VS divider line
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#ff6b1a';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 12]);
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.2);
  ctx.lineTo(w / 2, h * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawGround(ctx, w, h) {
  const groundY = h * 0.72;

  // Dirt gradient
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
  groundGrad.addColorStop(0, '#5c3d1a');
  groundGrad.addColorStop(0.3, '#3d2810');
  groundGrad.addColorStop(1, '#1a1208');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Ground line
  ctx.strokeStyle = '#aa6530';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();

  // Fire glow along ground line
  ctx.save();
  const time = performance.now() / 1000;
  ctx.globalAlpha = 0.15 + Math.sin(time * 5) * 0.05;
  ctx.strokeStyle = '#ff6b1a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
  ctx.restore();

  // Tire marks
  ctx.strokeStyle = 'rgba(40, 30, 15, 0.5)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 5; i++) {
    const tx = 50 + i * 180;
    ctx.beginPath();
    ctx.moveTo(tx, groundY + 5);
    ctx.lineTo(tx + 90, groundY + 5);
    ctx.stroke();
  }
}

function drawEmbers(ctx) {
  bgEmbers.forEach(e => {
    ctx.save();
    ctx.globalAlpha = e.life * 0.7;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPowerMeter(ctx, w, h) {
  if (!isDragging && chargeAmount <= 0) {
    // Show drag prompt when not charging
    drawDragPrompt(ctx, w, h);
    return;
  }

  const meterW = w * 0.55;
  const meterH = 28;
  const meterX = (w - meterW) / 2;
  const meterY = h * 0.87;

  // Background bar
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(meterX, meterY, meterW, meterH, 6);
  ctx.fill();
  ctx.stroke();

  // Clipped inner area
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(meterX + 2, meterY + 2, meterW - 4, meterH - 4, 4);
  ctx.clip();

  const innerW = meterW - 4;
  const sweetSpotPx = innerW * SWEET_SPOT;

  // Green zone (0 -> sweet spot)
  const greenGrad = ctx.createLinearGradient(meterX + 2, 0, meterX + 2 + sweetSpotPx, 0);
  greenGrad.addColorStop(0, '#115511');
  greenGrad.addColorStop(0.7, '#22aa22');
  greenGrad.addColorStop(1, '#33dd33');
  ctx.fillStyle = greenGrad;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(meterX + 2, meterY + 2, sweetSpotPx, meterH - 4);

  // Red zone (sweet spot -> end)
  const redGrad = ctx.createLinearGradient(meterX + 2 + sweetSpotPx, 0, meterX + 2 + innerW, 0);
  redGrad.addColorStop(0, '#dd4400');
  redGrad.addColorStop(1, '#cc0000');
  ctx.fillStyle = redGrad;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(meterX + 2 + sweetSpotPx, meterY + 2, innerW - sweetSpotPx, meterH - 4);

  // Fill indicator showing current charge
  const fillW = innerW * chargeAmount;
  const isOverclock = chargeAmount > SWEET_SPOT;
  const power = getSweetSpotPower(chargeAmount);

  ctx.globalAlpha = 0.85;
  if (isOverclock) {
    const pulse = Math.sin(performance.now() / 80) * 55;
    ctx.fillStyle = `rgb(${200 + pulse}, ${Math.max(0, 100 - (chargeAmount - SWEET_SPOT) * 300)}, 0)`;
  } else {
    const g = Math.floor(100 + power * 155);
    ctx.fillStyle = `rgb(30, ${g}, 30)`;
  }
  ctx.fillRect(meterX + 2, meterY + 2, fillW, meterH - 4);

  // Sweet spot gold line
  ctx.globalAlpha = 0.9 + Math.sin(performance.now() / 200) * 0.1;
  ctx.fillStyle = '#ffd21a';
  ctx.fillRect(meterX + 2 + sweetSpotPx - 2, meterY + 2, 4, meterH - 4);

  ctx.restore();

  // Labels above meter
  ctx.save();
  ctx.font = `bold ${9 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = 'center';

  // "SWEET SPOT" at the gold line
  ctx.fillStyle = '#ffd21a';
  ctx.globalAlpha = 0.7;
  ctx.fillText('SWEET SPOT', meterX + 2 + sweetSpotPx, meterY - 3);

  // "OVERCLOCK" in the red zone
  ctx.fillStyle = '#ff4400';
  ctx.globalAlpha = 0.5;
  const overclockCenterX = meterX + 2 + sweetSpotPx + (innerW - sweetSpotPx) / 2;
  ctx.fillText('OVERCLOCK', overclockCenterX, meterY - 3);
  ctx.restore();

  // Power percentage
  const pct = Math.round(power * 100);
  ctx.font = `bold ${18 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = 'center';
  if (isOverclock) {
    ctx.fillStyle = '#ff4400';
  } else if (power > 0.9) {
    ctx.fillStyle = '#ffd21a';
  } else if (power > 0.6) {
    ctx.fillStyle = '#39ff14';
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillText(`${pct}% POWER`, w / 2, meterY + meterH + 20);

  // Status text below
  ctx.font = `bold ${11 * scaleX}px "Bangers", sans-serif`;
  if (isOverclock) {
    ctx.fillStyle = '#ff2200';
    ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 100) * 0.4;
    ctx.fillText('ENGINE OVERCLOCKED!', w / 2, meterY + meterH + 36);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#ffd21a';
    ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 300) * 0.3;
    ctx.fillText('RELEASE TO SMASH!', w / 2, meterY + meterH + 36);
    ctx.globalAlpha = 1;
  }
}

function drawDragPrompt(ctx, w, h) {
  const time = performance.now() / 1000;
  const bobX = Math.sin(time * 4) * 12;

  ctx.save();
  ctx.globalAlpha = 0.6 + Math.sin(time * 3) * 0.3;
  ctx.font = `bold ${16 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd21a';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  const textY = h * 0.88;
  const text = 'DRAG LEFT TO CHARGE!';
  ctx.strokeText(text, w * 0.3 + bobX, textY);
  ctx.fillText(text, w * 0.3 + bobX, textY);

  // Arrow indicator
  ctx.font = `bold ${24 * scaleX}px "Bangers", sans-serif`;
  ctx.strokeText('\u25C4', w * 0.15 + bobX, textY);
  ctx.fillText('\u25C4', w * 0.15 + bobX, textY);
  ctx.restore();
}

function drawDamageNumbers(ctx) {
  damageNumbers.forEach(d => {
    ctx.save();
    ctx.globalAlpha = d.alpha;
    const fontSize = (28 + d.value * 0.12) * d.scale;
    ctx.font = `bold ${fontSize}px "Bangers", sans-serif`;
    ctx.textAlign = 'center';

    if (d.isAbility && d.abilityColor) {
      ctx.fillStyle = d.abilityColor;
      ctx.strokeStyle = '#000';
    } else if (d.isPerfect) {
      ctx.fillStyle = '#ffd21a';
      ctx.strokeStyle = '#aa6600';
    } else {
      ctx.fillStyle = d.isPlayer ? '#ff2d2d' : '#39ff14';
      ctx.strokeStyle = '#000';
    }
    ctx.lineWidth = 3;
    const text = d.isPerfect ? `PERFECT! -${d.value}` : `-${d.value}`;
    ctx.strokeText(text, d.x, d.y);
    ctx.fillText(text, d.x, d.y);
    ctx.restore();
  });
}

function drawAbilityTexts(ctx) {
  abilityTexts.forEach(t => {
    const alpha = Math.min(1, t.life / (t.maxLife * 0.3));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${22 * scaleX}px "Bangers", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = t.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  });
}

function drawRoundText(ctx, w, h) {
  const alpha = roundTextTimer > 1.5 ? (2 - roundTextTimer) * 2 : Math.min(1, roundTextTimer / 0.3);
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.font = `bold ${48 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd21a';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeText(roundText, w / 2, h * 0.32);
  ctx.fillText(roundText, w / 2, h * 0.32);

  if (playerTruck && enemyTruck) {
    ctx.font = `bold ${24 * scaleX}px "Bangers", sans-serif`;
    ctx.fillStyle = '#ffffff';
    const vs = `${playerTruck.name}  VS  ${enemyTruck.name}`;
    ctx.strokeText(vs, w / 2, h * 0.43);
    ctx.fillText(vs, w / 2, h * 0.43);
  }

  ctx.restore();
}

function drawPhaseText(ctx, w, h) {
  let text = '';
  let color = '#ffffff';

  switch (phase) {
    case 'ai-charge':
    case 'ai-launch':
      text = 'ENEMY TURN!';
      color = '#ff6b1a';
      break;
    case 'resolve':
      text = playerHP <= 0 ? 'DESTROYED!' : 'CRUSHED IT!';
      color = playerHP <= 0 ? '#ff2d2d' : '#39ff14';
      break;
  }

  if (text && roundTextTimer <= 0) {
    ctx.save();
    ctx.font = `bold ${20 * scaleX}px "Bangers", sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.strokeText(text, w / 2, h * 0.14);
    ctx.fillText(text, w / 2, h * 0.14);
    ctx.restore();
  }
}
