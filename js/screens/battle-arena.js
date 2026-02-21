// ============================================
// MONSTER SMASH - Battle Arena
// Simultaneous drag-and-smash with sweet spot,
// guaranteed center collision, health bars,
// fire effects, stat-exaggerated visuals
// ============================================

import { createBattleCanvas, startGameLoop, stopGameLoop, destroyBattleCanvas } from '../engine/canvas-renderer.js';
import { TruckPhysics, calculateDamage, calculateKnockback } from '../engine/physics.js';
import { ParticleSystem } from '../engine/particles.js';
import { triggerShake, updateShake, resetShake } from '../engine/screen-shake.js';
import { updateTweens, clearTweens } from '../engine/animation.js';
import { drawTruck, renderTruckToImage } from '../trucks/truck-renderer.js';
import { clamp, randomRange } from '../utils/math-utils.js';
import { addPointerHandlers } from '../utils/touch-utils.js';
import { playCrash, playExplosion, playWhoosh, playPowerUp, playEngineRev } from '../audio/sound-effects.js';
import { getDifficulty } from '../difficulty.js';

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

// Sweet spot config — zone, not a single pixel!
const SWEET_SPOT_CENTER = 0.70;   // center of sweet spot zone
const OVERCLOCK_PENALTY = 0.45;   // power drops by this much at 100% drag

// Starting positions (closer together for more impact)
const PLAYER_START = 0.25;
const ENEMY_START = 0.75;

// Truck visual scale (bigger = more awesome)
const TRUCK_SCALE = 1.15;

// Center pull force during launch (guarantees collision)
const CENTER_PULL = 1500;

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

// AI simultaneous charge
let aiPower = 0;              // AI's chosen power for this smash
let aiChargeProgress = 0;     // AI's current visual charge (ramps up)
let aiChargeTarget = 0;       // AI's target visual charge amount
let enemyAbilityChecked = false;

// Stored launch powers (used for damage calc instead of collision speed)
let launchPlayerPower = 0;
let launchAiPower = 0;

// Per-truck sweet spot zone (calculated at charge start)
let sweetSpotLow = 0.60;
let sweetSpotHigh = 0.80;
let chargeTimer = 0;
let chargeTimerMax = 3.5;

let playerAbilityUsed = false;
let playerAbilityActive = null;
let enemyAbilityUsed = false;
let enemyAbilityActive = null;

let flashAlpha = 0;
let roundText = '';
let roundTextTimer = 0;
let damageNumbers = [];

// Previous round winners for pedestal display
let pastResults = [];
let pedestalTruckImages = []; // cached data URLs for pedestal trucks

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
// Zone-based: linear ramp up to sweetSpotLow, flat 100% through sweetSpotHigh, then overclock
function getSweetSpotPower(drag) {
  if (drag <= 0) return 0;
  if (drag <= sweetSpotLow) {
    return drag / sweetSpotLow; // linear 0 -> 1.0
  }
  if (drag <= sweetSpotHigh) {
    return 1.0; // in the sweet spot zone — full power!
  }
  // Overclock zone: drops from 1.0 down
  const over = (drag - sweetSpotHigh) / (1 - sweetSpotHigh);
  return 1.0 - over * OVERCLOCK_PENALTY;
}

// Calculate sweet spot zone width based on truck speed and difficulty
function calcSweetSpotZone(truck) {
  const speedFactor = (truck.stats.speed || 50) / 100;
  const baseHalfWidth = 0.04 + speedFactor * 0.08; // 0.04 to 0.12 half-width
  const halfWidth = baseHalfWidth * getDifficulty().sweetSpotScale;
  return {
    low: SWEET_SPOT_CENTER - halfWidth,
    high: SWEET_SPOT_CENTER + halfWidth,
  };
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

export function startBattle(pTruck, eTruck, roundNum, onComplete, previousResults = []) {
  playerTruck = pTruck;
  enemyTruck = eTruck;
  onRoundComplete = onComplete;
  pastResults = previousResults;

  // Pre-render pedestal truck images (large source for crisp display)
  pedestalTruckImages = pastResults.map(r => {
    const truck = r.winner === 'player' ? r.playerTruck : r.computerTruck;
    return {
      img: renderTruckToImage(truck, 140, 112),
      isPlayer: r.winner === 'player',
      name: truck.name,
    };
  });

  playerMaxHP = 100 + playerTruck.stats.shield * 2;
  enemyMaxHP = 100 + enemyTruck.stats.shield * 2;
  playerHP = playerMaxHP;
  enemyHP = enemyMaxHP;

  playerAbilityUsed = false;
  playerAbilityActive = null;
  enemyAbilityUsed = false;
  enemyAbilityActive = null;
  enemyAbilityChecked = false;
  smashCount = 0;
  damageNumbers = [];
  abilityTexts = [];
  chargeAmount = 0;
  isDragging = false;
  aiPower = 0;
  aiChargeProgress = 0;
  aiChargeTarget = 0;
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
  playerPhysics = new TruckPhysics(canvasWidth * PLAYER_START, groundY, 1);
  enemyPhysics = new TruckPhysics(canvasWidth * ENEMY_START, groundY, -1);

  // Bigger collision boxes to match bigger truck visuals
  playerPhysics.width = 170;
  playerPhysics.height = 110;
  enemyPhysics.width = 170;
  enemyPhysics.height = 110;

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
  if (playerAbilityUsed || phase !== 'charge') return false;
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
  if (phase === 'charge') {
    const diff = getDifficulty();
    isDragging = true;
    dragStartX = e.clientX;
    chargeAmount = 0;
    chargeTimerMax = diff.chargeTimeout;
    chargeTimer = chargeTimerMax;
    playEngineRev(0.2);

    // Calculate sweet spot zone for this truck's speed
    const zone = calcSweetSpotZone(playerTruck);
    sweetSpotLow = zone.low;
    sweetSpotHigh = zone.high;

    // AI decides its power and starts charging simultaneously
    aiPower = randomRange(diff.aiPowerMin, diff.aiPowerMax);
    aiChargeTarget = aiPower * SWEET_SPOT_CENTER; // visual charge amount
    aiChargeProgress = 0;
  }
}

function handlePointerMove(e) {
  if (!isDragging || phase !== 'charge') return;

  // Drag LEFT to charge (positive dx = more charge)
  const dx = dragStartX - e.clientX;
  const maxDragPx = canvasWidth * 0.35; // wider zone so sweet spot isn't at edge
  chargeAmount = clamp(dx / maxDragPx, 0, 1);

  // Pull player truck back visually
  const pullbackPx = chargeAmount * canvasWidth * 0.12;
  playerPhysics.x = playerPhysics.restX - pullbackPx;
  playerPhysics.rotation = chargeAmount * 0.15 * -1;

  // Overclock effects - truck shakes and smokes
  if (chargeAmount > sweetSpotHigh) {
    const overIntensity = (chargeAmount - sweetSpotHigh) / (1 - sweetSpotHigh);
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
  if (!isDragging || phase !== 'charge') return;

  if (chargeAmount < 0.05) {
    // Barely dragged - just reset
    isDragging = false;
    chargeAmount = 0;
    chargeTimer = 0;
    playerPhysics.x = playerPhysics.restX;
    playerPhysics.rotation = 0;
    enemyPhysics.x = enemyPhysics.restX;
    enemyPhysics.rotation = 0;
    aiChargeProgress = 0;
    return;
  }

  executeLaunch();
}

// Shared launch logic — called by pointer release or timer expiry
function executeLaunch() {
  isDragging = false;
  chargeTimer = 0;

  // If barely charged (e.g. timer expired with no drag), give minimum
  if (chargeAmount < 0.05) chargeAmount = 0.15;

  const playerPower = getSweetSpotPower(chargeAmount);
  const isPerfect = chargeAmount >= sweetSpotLow && chargeAmount <= sweetSpotHigh;

  // Store powers for damage calculation (not collision speed, which gets
  // compressed by the center-pull force)
  launchPlayerPower = playerPower;
  launchAiPower = aiPower;

  phase = 'launch';
  phaseTimer = 0;

  // ---- Launch BOTH trucks simultaneously ----
  const arenaDistance = Math.abs(enemyPhysics.restX - playerPhysics.restX);

  // Player launch
  const playerSpeedFactor = (playerTruck.stats.speed / 100) * 0.7 + 0.3;
  const playerLaunchVx = arenaDistance * 2.0 * playerPower * playerSpeedFactor * playerPhysics.facing;
  const playerAirTime = (playerTruck.stats.airTime || 50) / 100;
  const playerLaunchVy = -150 * playerPower * (0.5 + playerAirTime * 0.6);

  playerPhysics.vx = playerLaunchVx;
  playerPhysics.vy = playerLaunchVy;
  playerPhysics.grounded = false;
  playerPhysics.rotation = -0.12 * playerPhysics.facing * playerPower;
  playerPhysics.rotationVelocity = 0.6 * playerPhysics.facing;

  // Enemy launch (uses its own random AI power)
  const enemySpeedFactor = (enemyTruck.stats.speed / 100) * 0.7 + 0.3;
  const enemyLaunchVx = arenaDistance * 2.0 * aiPower * enemySpeedFactor * enemyPhysics.facing;
  const enemyAirTime = (enemyTruck.stats.airTime || 50) / 100;
  const enemyLaunchVy = -150 * aiPower * (0.5 + enemyAirTime * 0.6);

  enemyPhysics.vx = enemyLaunchVx;
  enemyPhysics.vy = enemyLaunchVy;
  enemyPhysics.grounded = false;
  enemyPhysics.rotation = -0.12 * enemyPhysics.facing * aiPower;
  enemyPhysics.rotationVelocity = 0.6 * enemyPhysics.facing;

  // Sound + visual effects for both
  playWhoosh();
  if (particles) {
    particles.emitDust(playerPhysics.x, playerPhysics.y + 20);
    particles.emitDust(enemyPhysics.x, enemyPhysics.y + 20);
    if (playerTruck.stats.weight > 70) {
      particles.emitDust(playerPhysics.x - 20, playerPhysics.y + 20);
      particles.emitDust(playerPhysics.x + 20, playerPhysics.y + 20);
    }
    if (enemyTruck.stats.weight > 70) {
      particles.emitDust(enemyPhysics.x - 20, enemyPhysics.y + 20);
      particles.emitDust(enemyPhysics.x + 20, enemyPhysics.y + 20);
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
  aiChargeProgress = 0;
}

// ---- Game Loop ----

function update(dt) {
  phaseTimer += dt;
  updateTweens(dt);

  // Update damage numbers (slower float, longer linger)
  damageNumbers = damageNumbers.filter(d => {
    d.y -= 30 * dt;
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
    case 'charge':
      updateCharge(dt);
      break;
    case 'launch':
      updateLaunch(dt);
      break;
    case 'hit':
      updateHit(dt);
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
    playerPhysics.x = -80 + (canvasWidth * PLAYER_START + 80) * ease;
    enemyPhysics.x = canvasWidth + 80 - (canvasWidth * (1 - ENEMY_START) + 80) * ease;

    // Dust trail during entrance
    if (phaseTimer > 0.1 && Math.random() < 0.3 && particles) {
      particles.emitDust(playerPhysics.x - 30, playerPhysics.y + 20);
      particles.emitDust(enemyPhysics.x + 30, enemyPhysics.y + 20);
    }
  } else {
    playerPhysics.x = canvasWidth * PLAYER_START;
    enemyPhysics.x = canvasWidth * ENEMY_START;
    phase = 'charge';
    phaseTimer = 0;
    chargeAmount = 0;
    isDragging = false;
  }
}

function updateCharge(dt) {
  // Player idle bounce when NOT dragging
  if (!isDragging) {
    playerPhysics.x = playerPhysics.restX + Math.sin(phaseTimer * 12) * 2;
    enemyPhysics.x = enemyPhysics.restX + Math.sin(phaseTimer * 12 + 1) * 2;
  }

  // Charge timer countdown — auto-launch when time runs out
  if (isDragging && chargeTimer > 0) {
    chargeTimer -= dt;
    if (chargeTimer <= 0) {
      chargeTimer = 0;
      executeLaunch();
      return;
    }
  }

  // AI charge ramp-up (when player is dragging)
  if (isDragging && aiChargeTarget > 0) {
    aiChargeProgress = Math.min(aiChargeProgress + dt * 2.5, aiChargeTarget);
    const pullbackPx = aiChargeProgress * canvasWidth * 0.12;
    enemyPhysics.x = enemyPhysics.restX + pullbackPx; // pulls back to the right
    enemyPhysics.rotation = -aiChargeProgress * 0.15 * enemyPhysics.facing;

    // AI rev effects at high charge
    if (aiChargeProgress > SWEET_SPOT_CENTER * 0.6) {
      enemyPhysics.x += (Math.random() - 0.5) * 3;
      if (particles && Math.random() < 0.2) {
        particles.emitFireTrail(
          enemyPhysics.x - 20,
          enemyPhysics.y - 30,
          enemyTruck.visual.glowColor || '#ff2200'
        );
      }
    }
  }

  // AI ability check (once per charge phase)
  if (isDragging && !enemyAbilityChecked && phaseTimer > 0.3) {
    enemyAbilityChecked = true;
    if (!enemyAbilityUsed && Math.random() < getDifficulty().aiAbilityChance) {
      activateEnemyAbility();
    }
  }

  updateDamageEffects(dt);
}

function updateLaunch(dt) {
  const centerX = canvasWidth / 2;

  // Center pull force - guarantees trucks always converge and collide
  if (playerPhysics.x < centerX) {
    playerPhysics.vx += CENTER_PULL * dt;
  }
  if (enemyPhysics.x > centerX) {
    enemyPhysics.vx -= CENTER_PULL * dt;
  }

  // Check collision
  if (playerPhysics.collidesWith(enemyPhysics)) {
    handleSimultaneousCollision();
    phase = 'hit';
    phaseTimer = 0;
    return;
  }

  // Player fire trail
  if (Math.abs(playerPhysics.vx) > 80 && particles) {
    particles.emitFireTrail(
      playerPhysics.x - 40 * scaleX,
      playerPhysics.y - 10,
      playerTruck.visual.glowColor || '#ff6b1a'
    );
    if (playerTruck.stats.speed > 70 && Math.random() < 0.6) {
      particles.emitFireTrail(
        playerPhysics.x - 50 * scaleX,
        playerPhysics.y - 20 + randomRange(-10, 10),
        '#ffd21a'
      );
    }
    if (playerAbilityActive) {
      particles.emitFireTrail(
        playerPhysics.x - 30 * scaleX,
        playerPhysics.y - 25,
        getAbilityColor(playerAbilityActive.type)
      );
    }
  }

  // Enemy fire trail
  if (Math.abs(enemyPhysics.vx) > 80 && particles) {
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

  // Timeout safety - force collision if stalled
  if (phaseTimer > 3) {
    playerPhysics.x = centerX - 50;
    enemyPhysics.x = centerX + 50;
    handleSimultaneousCollision();
    phase = 'hit';
    phaseTimer = 0;
  }
}

function updateHit(dt) {
  playerPhysics.returnToRest(0.06);
  enemyPhysics.returnToRest(0.06);

  // Check for KO
  if (playerHP <= 0 || enemyHP <= 0) {
    phase = 'resolve';
    phaseTimer = 0;
    if (playerHP <= 0 && particles) {
      particles.emitExplosion(playerPhysics.x, playerPhysics.y - 20, playerTruck.visual.primaryColor);
    }
    if (enemyHP <= 0 && particles) {
      particles.emitExplosion(enemyPhysics.x, enemyPhysics.y - 20, enemyTruck.visual.primaryColor);
    }
    playExplosion();
    triggerShake(25, 0.7);
    flashAlpha = 1;
    return;
  }

  if (phaseTimer > 1.2) {
    phase = 'next-smash';
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

  phase = 'charge';
  phaseTimer = 0;
  chargeAmount = 0;
  isDragging = false;
  chargeTimer = 0;
  aiPower = 0;
  aiChargeProgress = 0;
  aiChargeTarget = 0;
  enemyAbilityChecked = false;
}

function updateResolve(dt) {
  playerPhysics.returnToRest(0.04);
  enemyPhysics.returnToRest(0.04);

  if (phaseTimer > 2.5) {
    phase = 'done';
    let winner;
    if (playerHP <= 0 && enemyHP <= 0) {
      winner = 'player'; // tie goes to player
    } else {
      winner = enemyHP <= 0 ? 'player' : 'computer';
    }
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

// ---- Collision Handling (Simultaneous) ----

function handleSimultaneousCollision() {
  // Use stored launch power — NOT collision speed, which gets compressed
  // by the center-pull force. This gives a much wider damage range.
  const power1 = launchPlayerPower;
  const power2 = launchAiPower;

  // Player damages enemy, enemy damages player
  const playerResult = calculateDamage(playerTruck, power1, enemyTruck, playerAbilityActive);
  const enemyResult = calculateDamage(enemyTruck, power2, playerTruck, enemyAbilityActive, getDifficulty().aiCritBonus);
  const playerDmg = playerResult.damage;
  const enemyDmg = enemyResult.damage;

  enemyHP = Math.max(0, enemyHP - playerDmg);
  playerHP = Math.max(0, playerHP - enemyDmg);

  // Handle ability effects (pass bonus info for display)
  if (playerAbilityActive) {
    applyAbilityEffects(playerAbilityActive, true, playerDmg, playerResult.abilityBonus);
    playerAbilityActive = null;
  }
  if (enemyAbilityActive) {
    applyAbilityEffects(enemyAbilityActive, false, enemyDmg, enemyResult.abilityBonus);
    enemyAbilityActive = null;
  }

  // Mutual knockback
  const playerWeightFactor = (enemyTruck.stats.weight / 100) * 0.5 + 0.5;
  const enemyWeightFactor = (playerTruck.stats.weight / 100) * 0.5 + 0.5;
  const playerKnockback = calculateKnockback(enemyTruck, playerTruck);
  const enemyKnockback = calculateKnockback(playerTruck, enemyTruck);

  playerPhysics.vx *= -0.4;
  enemyPhysics.vx *= -0.4;
  playerPhysics.knockback((playerKnockback + 0.5) * playerWeightFactor);
  enemyPhysics.knockback((enemyKnockback + 0.5) * enemyWeightFactor);

  // Collision visual effects
  const collisionX = (playerPhysics.x + enemyPhysics.x) / 2;
  const collisionY = (playerPhysics.y + enemyPhysics.y) / 2 - 20;
  const combinedPower = (power1 + power2) / 2;

  if (particles) {
    const sparkIntensity = combinedPower *
      Math.max(playerTruck.stats.smashDamage, enemyTruck.stats.smashDamage) / 100 * 1.5;
    particles.emitCollisionSparks(collisionX, collisionY,
      playerTruck.visual.primaryColor, enemyTruck.visual.primaryColor, sparkIntensity);
    if (playerDmg + enemyDmg > 60) {
      particles.emitCollisionSparks(collisionX, collisionY - 10, '#ffd21a', '#ff6b1a', sparkIntensity * 0.8);
    }
  }

  playCrash(Math.min(combinedPower, 1));

  // Screen shake
  const totalDmg = playerDmg + enemyDmg;
  const shakeIntensity = 10 + totalDmg * 0.1 +
    Math.max(playerTruck.stats.weight, enemyTruck.stats.weight) / 100 * 8;
  triggerShake(shakeIntensity, 0.5);

  if (totalDmg > 60) flashAlpha = Math.max(flashAlpha, 0.6);
  if (totalDmg > 100) flashAlpha = Math.max(flashAlpha, 0.9);

  // Lucky critical floating text
  if (playerResult.critical) {
    abilityTexts.push({
      text: 'LUCKY HIT!',
      x: enemyPhysics.x + randomRange(-30, 30),
      y: enemyPhysics.y - 110,
      color: '#ffd21a',
      life: 1.2,
      maxLife: 1.2,
    });
  }
  if (enemyResult.critical) {
    abilityTexts.push({
      text: 'LUCKY HIT!',
      x: playerPhysics.x + randomRange(-30, 30),
      y: playerPhysics.y - 110,
      color: '#ff6b1a',
      life: 1.2,
      maxLife: 1.2,
    });
  }

  // Floating damage numbers — spread apart so they don't overlap
  // Player's damage dealt to enemy (green - good for player)
  damageNumbers.push({
    value: playerDmg,
    x: collisionX + 60,
    y: collisionY - 30,
    life: 2.5,
    maxLife: 2.5,
    alpha: 1,
    scale: 1,
    isPlayer: false,
    isCritical: playerResult.critical,
    isPerfect: power1 > 0.9,
  });
  // Enemy's damage dealt to player (red - bad for player)
  damageNumbers.push({
    value: enemyDmg,
    x: collisionX - 60,
    y: collisionY + 10,
    life: 2.5,
    maxLife: 2.5,
    alpha: 1,
    scale: 1,
    isPlayer: true,
    isCritical: enemyResult.critical,
    isPerfect: power2 > 0.9,
  });
}

function applyAbilityEffects(ability, isPlayer, damage, abilityBonus) {
  const abilityColor = getAbilityColor(ability.type);
  const label = getAbilityLabel(ability.type);
  const targetPhys = isPlayer ? enemyPhysics : playerPhysics;
  const selfPhys = isPlayer ? playerPhysics : enemyPhysics;

  // Track extra damage/healing for display
  let extraDmgTotal = 0;
  let extraHealTotal = 0;

  // Ability-colored sparks
  if (particles) {
    particles.emitCollisionSparks(
      (playerPhysics.x + enemyPhysics.x) / 2,
      (playerPhysics.y + enemyPhysics.y) / 2 - 20,
      abilityColor, abilityColor, 0.8
    );
  }

  switch (ability.type) {
    case 'damage-boost':
    case 'speed-boost':
    case 'pierce':
      // These modify the base damage calc — bonus already included in main damage number
      extraDmgTotal = abilityBonus;
      if (ability.type === 'speed-boost' && particles) {
        particles.emitFireTrail(selfPhys.x - 20 * selfPhys.facing, selfPhys.y - 15, '#ff6b1a');
        particles.emitFireTrail(selfPhys.x - 30 * selfPhys.facing, selfPhys.y - 10, '#ffd21a');
      }
      break;
    case 'heal': {
      const healAmt = 30;
      if (isPlayer) playerHP = Math.min(playerMaxHP, playerHP + healAmt);
      else enemyHP = Math.min(enemyMaxHP, enemyHP + healAmt);
      extraHealTotal = healAmt;
      if (particles) particles.emitAbilitySparkle(selfPhys.x, selfPhys.y - 20, '#39ff14');
      break;
    }
    case 'steal': {
      const amt = 15;
      if (isPlayer) {
        enemyHP = Math.max(0, enemyHP - amt);
        playerHP = Math.min(playerMaxHP, playerHP + amt);
      } else {
        playerHP = Math.max(0, playerHP - amt);
        enemyHP = Math.min(enemyMaxHP, enemyHP + amt);
      }
      extraDmgTotal = amt;
      extraHealTotal = amt;
      if (particles) {
        particles.emitAbilitySparkle(targetPhys.x, targetPhys.y - 20, '#44ff88');
        particles.emitAbilitySparkle(selfPhys.x, selfPhys.y - 20, '#44ff88');
      }
      break;
    }
    case 'direct-damage': {
      const directDmg = ability.multiplier ? Math.round(ability.multiplier) : 30;
      if (isPlayer) enemyHP = Math.max(0, enemyHP - directDmg);
      else playerHP = Math.max(0, playerHP - directDmg);
      extraDmgTotal = directDmg;
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
      extraHealTotal = shieldAmount;
      if (particles) particles.emitAbilitySparkle(selfPhys.x, selfPhys.y - 20, '#4488ff');
      break;
    }
    case 'burn': {
      const burnDmg = 15;
      if (isPlayer) enemyHP = Math.max(0, enemyHP - burnDmg);
      else playerHP = Math.max(0, playerHP - burnDmg);
      extraDmgTotal = burnDmg;
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
      extraDmgTotal = stunDmg;
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
      extraDmgTotal = extraDmg * extraHits;
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
    case 'dodge': {
      const dodgeHeal = Math.round(damage * 0.5);
      if (isPlayer) playerHP = Math.min(playerMaxHP, playerHP + dodgeHeal);
      else enemyHP = Math.min(enemyMaxHP, enemyHP + dodgeHeal);
      extraHealTotal = dodgeHeal;
      if (particles) particles.emitAbilitySparkle(selfPhys.x, selfPhys.y - 20, '#88ffff');
      break;
    }
    case 'random': {
      const randomDmg = Math.round(randomRange(5, 60));
      if (isPlayer) enemyHP = Math.max(0, enemyHP - randomDmg);
      else playerHP = Math.max(0, playerHP - randomDmg);
      extraDmgTotal = randomDmg;
      if (particles) {
        particles.emitCollisionSparks(targetPhys.x, targetPhys.y - 20, '#ff88ff', '#88ffff', 1.0);
      }
      break;
    }
  }

  // Build the ability label with numbers so the player sees how much it did
  let displayText = label;
  if (extraDmgTotal > 0 && extraHealTotal > 0) {
    displayText = `${label} -${extraDmgTotal} / +${extraHealTotal}`;
  } else if (extraDmgTotal > 0) {
    displayText = `${label} -${extraDmgTotal}`;
  } else if (extraHealTotal > 0) {
    displayText = `${label} +${extraHealTotal}`;
  }

  abilityTexts.push({
    text: displayText,
    x: targetPhys.x,
    y: targetPhys.y - 90,
    color: abilityColor,
    life: 1.8,
    maxLife: 1.8,
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

  // Draw pedestals for previous round winners
  drawPedestals(ctx, w, h);

  // Draw ground with fire edges
  drawGround(ctx, w, h);

  // Draw trucks (BIGGER!)
  const playerDamageRatio = 1 - (playerHP / playerMaxHP);
  const enemyDamageRatio = 1 - (enemyHP / enemyMaxHP);

  if (playerHP > 0 || phase !== 'resolve') {
    ctx.save();
    if (playerPhysics.rotation) {
      ctx.translate(playerPhysics.x, playerPhysics.y);
      ctx.rotate(playerPhysics.rotation);
      ctx.translate(-playerPhysics.x, -playerPhysics.y);
    }
    drawTruck(ctx, playerTruck, playerPhysics.x, playerPhysics.y, scaleX * TRUCK_SCALE, {
      flip: false,
      damageLevel: playerDamageRatio,
      glowing: playerAbilityActive !== null,
    });
    if (playerTruck.stats.shield > 60 && phase === 'charge') {
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
    drawTruck(ctx, enemyTruck, enemyPhysics.x, enemyPhysics.y, scaleX * TRUCK_SCALE, {
      flip: true,
      damageLevel: enemyDamageRatio,
      glowing: enemyAbilityActive !== null,
    });
    if (enemyTruck.stats.shield > 60 && phase === 'charge') {
      drawShieldGlow(ctx, enemyPhysics.x, enemyPhysics.y, enemyTruck.stats.shield, '#4488ff');
    }
    ctx.restore();
  }

  // Speed lines during launch (both trucks simultaneously)
  if (phase === 'launch') {
    if (Math.abs(playerPhysics.vx) > 200) {
      drawSpeedLines(ctx, playerPhysics, playerTruck);
    }
    if (Math.abs(enemyPhysics.vx) > 200) {
      drawSpeedLines(ctx, enemyPhysics, enemyTruck);
    }
  }

  // Background embers
  drawEmbers(ctx);

  // Particles
  if (particles) particles.draw(ctx);

  // Damage numbers
  drawDamageNumbers(ctx);

  // Ability floating texts
  drawAbilityTexts(ctx);

  // Health bars
  drawHealthBars(ctx, w, h);

  // Power meter during charge phase
  if (phase === 'charge') {
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

function drawHealthBars(ctx, w, h) {
  if (!playerTruck || !enemyTruck) return;

  const barW = w * 0.3;
  const barH = 12;
  const barY = h * 0.06;

  // Player health bar (left side, above player area)
  const playerBarX = playerPhysics.restX - barW / 2;
  drawSingleHealthBar(ctx, playerBarX, barY, barW, barH,
    playerHP, playerMaxHP, playerTruck.name, playerTruck.visual.primaryColor, false);

  // Enemy health bar (right side, above enemy area)
  const enemyBarX = enemyPhysics.restX - barW / 2;
  drawSingleHealthBar(ctx, enemyBarX, barY, barW, barH,
    enemyHP, enemyMaxHP, enemyTruck.name, enemyTruck.visual.primaryColor, true);
}

function drawSingleHealthBar(ctx, x, y, w, h, hp, maxHP, name, truckColor, isEnemy) {
  const hpPercent = clamp(hp / maxHP, 0, 1);

  // Name label
  ctx.save();
  ctx.font = `bold ${10 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = isEnemy ? 'right' : 'left';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  const nameX = isEnemy ? x + w : x;
  ctx.strokeText(name.toUpperCase(), nameX, y - 4);
  ctx.fillText(name.toUpperCase(), nameX, y - 4);
  ctx.restore();

  // Background
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();

  // Clipped fill area
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 5);
  ctx.clip();

  const fillW = (w - 2) * hpPercent;
  let fillColor;
  if (hpPercent > 0.5) {
    fillColor = '#39ff14';
  } else if (hpPercent > 0.25) {
    fillColor = '#ffd21a';
  } else {
    fillColor = '#ff2d2d';
  }

  // Fill from the correct side
  const fillX = isEnemy ? x + 1 + (w - 2) - fillW : x + 1;

  // Gradient fill
  const grad = ctx.createLinearGradient(fillX, y, fillX + fillW, y);
  grad.addColorStop(0, fillColor);
  grad.addColorStop(1, fillColor + 'aa');
  ctx.fillStyle = grad;
  ctx.fillRect(fillX, y + 1, fillW, h - 2);

  // Shine
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 1, y + 1, w - 2, (h - 2) / 2);

  // Damage flash when HP is low
  if (hpPercent < 0.3 && hpPercent > 0) {
    const pulse = Math.sin(performance.now() / 200) * 0.15 + 0.1;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  }

  ctx.restore();

  // HP text
  ctx.save();
  ctx.font = `bold ${9 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  const hpText = `${Math.ceil(hp)} / ${maxHP}`;
  ctx.strokeText(hpText, x + w / 2, y + h - 1);
  ctx.fillText(hpText, x + w / 2, y + h - 1);
  ctx.restore();
}

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

function drawPedestals(ctx, w, h) {
  // 5 pedestals evenly spaced across the upper background
  const pedestalW = 80;
  const pedestalH = 36;
  const gap = 16;
  const totalWidth = 5 * pedestalW + 4 * gap;
  const startX = (w - totalWidth) / 2;
  const baseY = h * 0.53;

  // Pre-load images for pedestals with results
  const imgCache = [];
  pedestalTruckImages.forEach((pt, i) => {
    if (!pt._imgEl) {
      pt._imgEl = new Image();
      pt._imgEl.src = pt.img;
    }
    imgCache[i] = pt._imgEl;
  });

  for (let i = 0; i < 5; i++) {
    const x = startX + i * (pedestalW + gap);
    const hasResult = i < pastResults.length;

    ctx.save();

    // Pedestal base
    ctx.globalAlpha = hasResult ? 0.5 : 0.15;
    const pedestalColor = hasResult
      ? (pedestalTruckImages[i].isPlayer ? '#1a4a1a' : '#4a1a1a')
      : '#1a1a2a';
    ctx.fillStyle = pedestalColor;
    ctx.beginPath();
    ctx.roundRect(x, baseY, pedestalW, pedestalH, [0, 0, 6, 6]);
    ctx.fill();

    // Pedestal top surface
    ctx.fillStyle = hasResult
      ? (pedestalTruckImages[i].isPlayer ? '#2a6a2a' : '#6a2a2a')
      : '#2a2a3a';
    ctx.fillRect(x - 3, baseY - 3, pedestalW + 6, 5);

    // Pedestal glow for completed rounds
    if (hasResult) {
      ctx.globalAlpha = 0.5;
      ctx.shadowColor = pedestalTruckImages[i].isPlayer ? '#39ff14' : '#ff2d2d';
      ctx.shadowBlur = 14;
      const glowColor = pedestalTruckImages[i].isPlayer
        ? 'rgba(57, 255, 20, 0.2)'
        : 'rgba(255, 45, 45, 0.2)';
      ctx.fillStyle = glowColor;
      ctx.fillRect(x - 3, baseY - 3, pedestalW + 6, 5);
      ctx.shadowBlur = 0;
    }

    // Round number on pedestal
    ctx.globalAlpha = hasResult ? 0.8 : 0.3;
    ctx.font = `bold ${11}px "Bangers", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = hasResult
      ? (pedestalTruckImages[i].isPlayer ? '#39ff14' : '#ff2d2d')
      : '#555';
    ctx.fillText(`R${i + 1}`, x + pedestalW / 2, baseY + pedestalH - 8);

    // Draw winning truck on pedestal — big and proud
    if (hasResult && imgCache[i] && imgCache[i].complete) {
      ctx.globalAlpha = 0.75;
      const imgW = 90;
      const imgH = 72;
      ctx.drawImage(imgCache[i], x + (pedestalW - imgW) / 2, baseY - imgH, imgW, imgH);
    }

    ctx.restore();
  }
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
  const meterY = h * 0.85;

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
  const ssLowPx = innerW * sweetSpotLow;
  const ssHighPx = innerW * sweetSpotHigh;

  // Green zone (0 -> sweet spot start)
  const greenGrad = ctx.createLinearGradient(meterX + 2, 0, meterX + 2 + ssLowPx, 0);
  greenGrad.addColorStop(0, '#115511');
  greenGrad.addColorStop(0.7, '#22aa22');
  greenGrad.addColorStop(1, '#33dd33');
  ctx.fillStyle = greenGrad;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(meterX + 2, meterY + 2, ssLowPx, meterH - 4);

  // Gold zone (sweet spot range) — the target!
  const goldGrad = ctx.createLinearGradient(meterX + 2 + ssLowPx, 0, meterX + 2 + ssHighPx, 0);
  goldGrad.addColorStop(0, '#886600');
  goldGrad.addColorStop(0.5, '#ccaa00');
  goldGrad.addColorStop(1, '#886600');
  ctx.fillStyle = goldGrad;
  ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 300) * 0.15;
  ctx.fillRect(meterX + 2 + ssLowPx, meterY + 2, ssHighPx - ssLowPx, meterH - 4);

  // Red zone (sweet spot end -> overclock)
  const redGrad = ctx.createLinearGradient(meterX + 2 + ssHighPx, 0, meterX + 2 + innerW, 0);
  redGrad.addColorStop(0, '#dd4400');
  redGrad.addColorStop(1, '#cc0000');
  ctx.fillStyle = redGrad;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(meterX + 2 + ssHighPx, meterY + 2, innerW - ssHighPx, meterH - 4);

  // Fill indicator showing current charge
  const fillW = innerW * chargeAmount;
  const isOverclock = chargeAmount > sweetSpotHigh;
  const inSweetSpot = chargeAmount >= sweetSpotLow && chargeAmount <= sweetSpotHigh;
  const power = getSweetSpotPower(chargeAmount);

  ctx.globalAlpha = 0.85;
  if (isOverclock) {
    const pulse = Math.sin(performance.now() / 80) * 55;
    ctx.fillStyle = `rgb(${200 + pulse}, ${Math.max(0, 100 - (chargeAmount - sweetSpotHigh) * 300)}, 0)`;
  } else if (inSweetSpot) {
    ctx.fillStyle = '#ffd21a';
  } else {
    const g = Math.floor(100 + power * 155);
    ctx.fillStyle = `rgb(30, ${g}, 30)`;
  }
  ctx.fillRect(meterX + 2, meterY + 2, fillW, meterH - 4);

  // Sweet spot zone borders (gold lines)
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffd21a';
  ctx.fillRect(meterX + 2 + ssLowPx - 1, meterY + 2, 2, meterH - 4);
  ctx.fillRect(meterX + 2 + ssHighPx - 1, meterY + 2, 2, meterH - 4);

  ctx.restore();

  // Labels above meter
  ctx.save();
  ctx.font = `bold ${9 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = 'center';

  // "SWEET SPOT" centered over the gold zone
  const ssCenter = meterX + 2 + (ssLowPx + ssHighPx) / 2;
  ctx.fillStyle = '#ffd21a';
  ctx.globalAlpha = 0.8;
  ctx.fillText('SWEET SPOT', ssCenter, meterY - 3);

  // "OVERCLOCK" in the red zone
  ctx.fillStyle = '#ff4400';
  ctx.globalAlpha = 0.5;
  const overclockCenterX = meterX + 2 + ssHighPx + (innerW - ssHighPx) / 2;
  ctx.fillText('OVERCLOCK', overclockCenterX, meterY - 3);
  ctx.restore();

  // Power percentage
  const pct = Math.round(power * 100);
  ctx.font = `bold ${18 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = 'center';
  if (isOverclock) {
    ctx.fillStyle = '#ff4400';
  } else if (inSweetSpot) {
    ctx.fillStyle = '#ffd21a';
  } else if (power > 0.6) {
    ctx.fillStyle = '#39ff14';
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillText(`${pct}% POWER`, w / 2, meterY + meterH + 20);

  // Charge timer countdown
  if (isDragging && chargeTimer > 0) {
    const timerPct = chargeTimer / chargeTimerMax;
    const timerColor = timerPct > 0.4 ? '#ffffff' : timerPct > 0.2 ? '#ffd21a' : '#ff2200';
    const timerPulse = timerPct < 0.3 ? 0.5 + Math.sin(performance.now() / 100) * 0.5 : 1;

    // Timer bar above power meter
    ctx.save();
    ctx.globalAlpha = 0.7 * timerPulse;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(meterX, meterY - 14, meterW, 6);
    ctx.fillStyle = timerColor;
    ctx.fillRect(meterX, meterY - 14, meterW * timerPct, 6);
    ctx.restore();

    // Timer text
    ctx.save();
    ctx.font = `bold ${12 * scaleX}px "Bangers", sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = timerColor;
    ctx.globalAlpha = timerPulse;
    ctx.fillText(`${chargeTimer.toFixed(1)}s`, meterX + meterW, meterY - 18);
    ctx.restore();
  }

  // Status text below
  ctx.font = `bold ${11 * scaleX}px "Bangers", sans-serif`;
  ctx.textAlign = 'center';
  if (isOverclock) {
    ctx.fillStyle = '#ff2200';
    ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 100) * 0.4;
    ctx.fillText('ENGINE OVERCLOCKED!', w / 2, meterY + meterH + 36);
    ctx.globalAlpha = 1;
  } else if (inSweetSpot) {
    ctx.fillStyle = '#ffd21a';
    ctx.globalAlpha = 0.8 + Math.sin(performance.now() / 150) * 0.2;
    ctx.fillText('PERFECT ZONE! RELEASE NOW!', w / 2, meterY + meterH + 36);
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
    // Bigger numbers for bigger damage — really sells the difference
    const fontSize = (24 + d.value * 0.2) * d.scale;
    ctx.font = `bold ${fontSize}px "Bangers", sans-serif`;
    ctx.textAlign = 'center';

    if (d.isCritical) {
      // Lucky crits get gold treatment
      ctx.fillStyle = '#ffd21a';
      ctx.strokeStyle = '#aa4400';
    } else if (d.isPerfect) {
      ctx.fillStyle = '#ffd21a';
      ctx.strokeStyle = '#aa6600';
    } else {
      ctx.fillStyle = d.isPlayer ? '#ff2d2d' : '#39ff14';
      ctx.strokeStyle = '#000';
    }
    ctx.lineWidth = 3;
    let text = `-${d.value}`;
    if (d.isPerfect) text = `PERFECT! -${d.value}`;
    else if (d.isCritical) text = `CRIT! -${d.value}`;
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
    case 'resolve':
      if (playerHP <= 0 && enemyHP <= 0) {
        text = 'MUTUAL DESTRUCTION!';
        color = '#ffd21a';
      } else {
        text = playerHP <= 0 ? 'DESTROYED!' : 'CRUSHED IT!';
        color = playerHP <= 0 ? '#ff2d2d' : '#39ff14';
      }
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
