// ============================================
// MONSTER SMASH - Truck Renderer
// Procedural canvas drawing of monster trucks
// 6 body types, 10 patterns, 12 decal types
// PROPER monster truck proportions: huge wheels,
// body sitting LOW, beefy suspension
// ============================================

import { lightenColor, darkenColor, hexToRgb } from '../utils/math-utils.js';

// Reference dimensions for truck drawing (logical pixels)
const REF_W = 200;
const REF_H = 160;

// Monster truck proportions - wheels are ~45% of total height
const WHEEL_R = 30;           // Wheel radius - BIG
const WHEEL_CY = -WHEEL_R;   // Wheel center Y (bottoms touch y=0, ground level)
const REAR_WX = -46;          // Rear wheel X
const FRONT_WX = 46;          // Front wheel X

// Body sits LOW - just above the wheel tops with short suspension
// Wheel tops at -(WHEEL_R*2) = -60
// Body bottom at -50 (overlapping top 10px of wheel zone)
// Body center reference for patterns/decals
const BODY_REF = -72;

/**
 * Draw a complete monster truck onto a canvas context
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} truck - truck data object with visual config
 * @param {number} x - center x position
 * @param {number} y - center y (bottom of truck, ground level)
 * @param {number} scale - scale multiplier (1.0 = reference size)
 * @param {Object} options - { flip: false, damageLevel: 0, glowing: false }
 */
export function drawTruck(ctx, truck, x, y, scale = 1, options = {}) {
  const { flip = false, damageLevel = 0, glowing = false } = options;
  const v = truck.visual;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * (flip ? -1 : 1), scale);

  const ty = BODY_REF;

  // Layer 1: Shadow on ground
  drawShadow(ctx);

  // Layer 2: Rarity glow (behind everything)
  if (glowing || truck.rarity === 'legendary' || truck.rarity === 'epic') {
    drawRarityGlow(ctx, v, truck.rarity, ty);
  }

  // Layer 3: Rear wheel (behind body)
  drawWheel(ctx, REAR_WX, WHEEL_CY, WHEEL_R, v);

  // Layer 4: Suspension / axle structure
  drawSuspension(ctx, v, ty);

  // Layer 5: Truck body
  drawBody(ctx, v, ty);

  // Layer 6: Pattern overlay
  drawPattern(ctx, v, ty);

  // Layer 7: Decals
  drawDecals(ctx, v, ty);

  // Layer 8: Front wheel (in front of body)
  drawWheel(ctx, FRONT_WX, WHEEL_CY, WHEEL_R, v);

  // Layer 9: Windshield / details
  drawDetails(ctx, v, ty);

  // Layer 10: Damage effects
  if (damageLevel > 0) {
    drawDamageOverlay(ctx, damageLevel, ty);
  }

  ctx.restore();
}

/**
 * Render a truck to an offscreen canvas and return it as an image URL
 */
export function renderTruckToImage(truck, width = 200, height = 160) {
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const scale = Math.min(width / REF_W, height / REF_H) * 0.82;
  drawTruck(ctx, truck, width / 2, height * 0.82, scale, { glowing: true });

  return canvas.toDataURL();
}

/**
 * Render truck onto a provided canvas (for cards)
 */
export function renderTruckToCanvas(ctx, truck, width, height) {
  const scale = Math.min(width / REF_W, height / REF_H) * 0.82;
  drawTruck(ctx, truck, width / 2, height * 0.82, scale, { glowing: true });
}

// ---- Layer Drawing Functions ----

function drawShadow(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 62, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRarityGlow(ctx, v, rarity, ty) {
  const glowColor = v.glowColor || '#ffffff';
  const { r, g, b } = hexToRgb(glowColor);
  const intensity = rarity === 'legendary' ? 0.35 : rarity === 'epic' ? 0.25 : 0.15;

  ctx.save();
  ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${intensity})`;
  ctx.shadowBlur = rarity === 'legendary' ? 30 : 18;
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.beginPath();
  ctx.ellipse(0, ty + 15, 65, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWheel(ctx, x, y, radius, v) {
  const wheelColor = v.wheelColor || '#333333';

  ctx.save();
  ctx.translate(x, y);

  // Outer tire - thick rubber
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();

  // Tire sidewall ring
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
  ctx.fillStyle = darkenColor(wheelColor, 0.4);
  ctx.fill();

  // Chunky tread blocks (not thin lines)
  ctx.fillStyle = '#111111';
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const nextAngle = ((i + 0.4) / 16) * Math.PI * 2;
    const innerR = radius * 0.82;
    const outerR = radius * 1.0;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    ctx.lineTo(Math.cos(nextAngle) * outerR, Math.sin(nextAngle) * outerR);
    ctx.lineTo(Math.cos(nextAngle) * innerR, Math.sin(nextAngle) * innerR);
    ctx.closePath();
    ctx.fill();
  }

  // Inner rim disc
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = lightenColor(wheelColor, 0.2);
  ctx.fill();

  // Rim accent ring
  const accent = v.accentColor || v.secondaryColor || '#666';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  // Rim spokes (5-spoke pattern)
  ctx.strokeStyle = lightenColor(wheelColor, 0.35);
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * radius * 0.15, Math.sin(a) * radius * 0.15);
    ctx.lineTo(Math.cos(a) * radius * 0.42, Math.sin(a) * radius * 0.42);
    ctx.stroke();
  }

  // Center hub cap
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = lightenColor(wheelColor, 0.5);
  ctx.fill();

  // Hub bolt
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = darkenColor(wheelColor, 0.1);
  ctx.fill();

  // Tire shine highlight (top-left)
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.arc(-radius * 0.2, -radius * 0.25, radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawSuspension(ctx, v, ty) {
  const metalColor = '#555555';
  const shockColor = v.accentColor || '#cc4400';
  const bodyBottom = ty + 26;

  // Rear axle tube (thick)
  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(REAR_WX, WHEEL_CY);
  ctx.lineTo(REAR_WX + 6, bodyBottom);
  ctx.stroke();

  // Rear shock absorber
  ctx.strokeStyle = shockColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(REAR_WX + 10, WHEEL_CY + 2);
  ctx.lineTo(REAR_WX + 14, bodyBottom - 2);
  ctx.stroke();
  // Shock spring coils
  ctx.strokeStyle = lightenColor(metalColor, 0.2);
  ctx.lineWidth = 1.5;
  const rShockLen = bodyBottom - WHEEL_CY - 4;
  for (let i = 0; i < 4; i++) {
    const sy = WHEEL_CY + 4 + (i / 4) * rShockLen;
    ctx.beginPath();
    ctx.moveTo(REAR_WX + 7, sy);
    ctx.lineTo(REAR_WX + 17, sy + rShockLen / 8);
    ctx.stroke();
  }

  // Front axle tube (thick)
  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(FRONT_WX, WHEEL_CY);
  ctx.lineTo(FRONT_WX - 6, bodyBottom);
  ctx.stroke();

  // Front shock absorber
  ctx.strokeStyle = shockColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(FRONT_WX - 10, WHEEL_CY + 2);
  ctx.lineTo(FRONT_WX - 14, bodyBottom - 2);
  ctx.stroke();
  // Spring coils
  ctx.strokeStyle = lightenColor(metalColor, 0.2);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const sy = WHEEL_CY + 4 + (i / 4) * rShockLen;
    ctx.beginPath();
    ctx.moveTo(FRONT_WX - 7, sy);
    ctx.lineTo(FRONT_WX - 17, sy + rShockLen / 8);
    ctx.stroke();
  }

  // Cross-member / chassis rail
  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(REAR_WX + 12, bodyBottom - 1);
  ctx.lineTo(FRONT_WX - 12, bodyBottom - 1);
  ctx.stroke();
}

function drawBody(ctx, v, ty) {
  const bodyFn = bodyTypes[v.bodyType] || bodyTypes['muscle'];
  bodyFn(ctx, v, ty);
}

// ---- Body Type Shapes ----
// All body shapes roughly span from ty-30 (top) to ty+26 (bottom)
// Body center is at ty. Width spans roughly -55 to 55.

const bodyTypes = {
  'panel-truck': function(ctx, v, ty) {
    // Tall, boxy 1950s van (Grave Digger style) - iconic and menacing
    const primary = v.primaryColor;
    const grad = ctx.createLinearGradient(0, ty - 32, 0, ty + 26);
    grad.addColorStop(0, lightenColor(primary, 0.2));
    grad.addColorStop(0.4, primary);
    grad.addColorStop(1, darkenColor(primary, 0.25));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-52, ty + 26);       // bottom left
    ctx.lineTo(-55, ty + 8);        // left lower panel
    ctx.lineTo(-54, ty - 12);       // left upper panel
    ctx.lineTo(-48, ty - 26);       // roof corner left
    ctx.quadraticCurveTo(-20, ty - 34, 0, ty - 32);   // roof peak
    ctx.quadraticCurveTo(20, ty - 34, 38, ty - 24);   // roof right
    ctx.lineTo(52, ty - 4);         // windshield slope (aggressive)
    ctx.lineTo(56, ty + 10);        // front bumper upper
    ctx.lineTo(54, ty + 26);        // front bumper lower
    ctx.closePath();
    ctx.fill();

    // Body outline - thick for punch
    ctx.strokeStyle = darkenColor(primary, 0.45);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Panel line detail
    ctx.strokeStyle = darkenColor(primary, 0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-20, ty - 30);
    ctx.lineTo(-18, ty + 24);
    ctx.stroke();

    // Front bumper bar
    ctx.fillStyle = '#444';
    ctx.fillRect(50, ty + 16, 6, 8);
  },

  'suv': function(ctx, v, ty) {
    // Low aggressive wedge (Max-D style) - angular and fast-looking
    const primary = v.primaryColor;
    const grad = ctx.createLinearGradient(0, ty - 22, 0, ty + 26);
    grad.addColorStop(0, lightenColor(primary, 0.25));
    grad.addColorStop(0.4, primary);
    grad.addColorStop(1, darkenColor(primary, 0.2));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-54, ty + 26);       // bottom left
    ctx.lineTo(-56, ty + 6);        // left rear
    ctx.lineTo(-52, ty - 6);        // left mid
    ctx.lineTo(-40, ty - 18);       // rear roof
    ctx.lineTo(-15, ty - 24);       // roof left
    ctx.lineTo(12, ty - 24);        // roof top
    ctx.lineTo(38, ty - 16);        // windshield top
    ctx.lineTo(56, ty + 2);         // nose wedge
    ctx.lineTo(58, ty + 16);        // front lower
    ctx.lineTo(54, ty + 26);        // bottom right
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(primary, 0.45);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Aggressive front air dam
    ctx.fillStyle = darkenColor(primary, 0.35);
    ctx.beginPath();
    ctx.moveTo(48, ty + 20);
    ctx.lineTo(58, ty + 16);
    ctx.lineTo(58, ty + 26);
    ctx.lineTo(48, ty + 26);
    ctx.closePath();
    ctx.fill();
  },

  'pickup': function(ctx, v, ty) {
    // Classic pickup with cab + bed (Blue Thunder style) - brawny
    const primary = v.primaryColor;
    const grad = ctx.createLinearGradient(0, ty - 24, 0, ty + 26);
    grad.addColorStop(0, lightenColor(primary, 0.15));
    grad.addColorStop(1, darkenColor(primary, 0.2));

    ctx.fillStyle = grad;

    // Bed (rear section)
    ctx.beginPath();
    ctx.moveTo(-55, ty + 26);
    ctx.lineTo(-56, ty);
    ctx.lineTo(-52, ty - 4);
    ctx.lineTo(-12, ty - 4);
    ctx.lineTo(-12, ty + 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkenColor(primary, 0.45);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cab (front section) - taller
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-15, ty + 26);
    ctx.lineTo(-15, ty - 4);
    ctx.lineTo(-12, ty - 24);       // roof rear
    ctx.lineTo(14, ty - 26);        // roof top
    ctx.lineTo(34, ty - 14);        // windshield
    ctx.lineTo(50, ty + 2);         // hood slope
    ctx.lineTo(55, ty + 12);        // front
    ctx.lineTo(54, ty + 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkenColor(primary, 0.45);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Bed rail cap
    ctx.fillStyle = lightenColor(primary, 0.15);
    ctx.fillRect(-55, ty - 6, 43, 3);

    // Front bumper
    ctx.fillStyle = '#444';
    ctx.fillRect(50, ty + 18, 5, 7);
  },

  'beast': function(ctx, v, ty) {
    // Organic creature shape with jaw (Megalodon style) - fearsome
    const primary = v.primaryColor;
    const grad = ctx.createLinearGradient(0, ty - 26, 0, ty + 26);
    grad.addColorStop(0, lightenColor(primary, 0.25));
    grad.addColorStop(0.4, primary);
    grad.addColorStop(1, darkenColor(primary, 0.25));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-52, ty + 26);
    ctx.quadraticCurveTo(-60, ty + 8, -56, ty - 6);
    ctx.quadraticCurveTo(-48, ty - 26, -18, ty - 30);    // head curve up
    ctx.quadraticCurveTo(5, ty - 32, 22, ty - 26);       // dome
    ctx.quadraticCurveTo(42, ty - 18, 56, ty - 2);       // snout
    ctx.quadraticCurveTo(62, ty + 8, 58, ty + 18);       // jaw front
    ctx.lineTo(54, ty + 26);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(primary, 0.4);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Jaw line (menacing)
    ctx.beginPath();
    ctx.moveTo(5, ty + 20);
    ctx.quadraticCurveTo(30, ty + 14, 58, ty + 18);
    ctx.strokeStyle = darkenColor(primary, 0.55);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Nostril slits
    ctx.fillStyle = darkenColor(primary, 0.6);
    ctx.beginPath();
    ctx.ellipse(46, ty - 4, 3, 1.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(44, ty - 1, 3, 1.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
  },

  'muscle': function(ctx, v, ty) {
    // Wide aggressive muscle car (Avenger style) - MEAN
    const primary = v.primaryColor;
    const grad = ctx.createLinearGradient(0, ty - 22, 0, ty + 26);
    grad.addColorStop(0, lightenColor(primary, 0.2));
    grad.addColorStop(0.4, primary);
    grad.addColorStop(1, darkenColor(primary, 0.25));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-52, ty + 26);
    ctx.lineTo(-55, ty + 8);        // left rear quarter
    ctx.lineTo(-50, ty - 5);        // left quarter panel
    ctx.lineTo(-34, ty - 18);       // roof back
    ctx.lineTo(-12, ty - 22);       // roof peak
    ctx.lineTo(12, ty - 22);        // roof top
    ctx.lineTo(30, ty - 16);        // windshield top
    ctx.lineTo(48, ty - 2);         // hood
    ctx.lineTo(56, ty + 6);         // front bumper top
    ctx.lineTo(58, ty + 18);        // front bumper
    ctx.lineTo(54, ty + 26);        // bottom right
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(primary, 0.45);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Big hood scoop
    ctx.fillStyle = darkenColor(primary, 0.35);
    ctx.beginPath();
    ctx.moveTo(16, ty - 14);
    ctx.lineTo(36, ty - 12);
    ctx.lineTo(34, ty - 5);
    ctx.lineTo(18, ty - 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkenColor(primary, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rear fender bulge
    ctx.fillStyle = lightenColor(primary, 0.06);
    ctx.beginPath();
    ctx.ellipse(-42, ty + 10, 12, 14, 0, Math.PI * 0.8, Math.PI * 1.8);
    ctx.fill();
  },

  'buggy': function(ctx, v, ty) {
    // Open frame with roll cage (Monster Mutt style) - wild and exposed
    const primary = v.primaryColor;
    const secondary = v.secondaryColor || lightenColor(primary, 0.3);

    // Frame base / body pan
    const grad = ctx.createLinearGradient(0, ty + 5, 0, ty + 26);
    grad.addColorStop(0, lightenColor(primary, 0.15));
    grad.addColorStop(1, darkenColor(primary, 0.25));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-50, ty + 26);
    ctx.lineTo(-54, ty + 12);
    ctx.lineTo(-48, ty + 2);
    ctx.lineTo(48, ty + 2);
    ctx.lineTo(54, ty + 12);
    ctx.lineTo(50, ty + 26);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(primary, 0.45);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Roll cage (thick tubular frame)
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Left cage post
    ctx.beginPath();
    ctx.moveTo(-34, ty + 6);
    ctx.lineTo(-28, ty - 20);
    ctx.stroke();

    // Right cage post
    ctx.beginPath();
    ctx.moveTo(28, ty + 6);
    ctx.lineTo(22, ty - 20);
    ctx.stroke();

    // Top bar
    ctx.beginPath();
    ctx.moveTo(-28, ty - 20);
    ctx.lineTo(22, ty - 20);
    ctx.stroke();

    // Cross braces
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = lightenColor(secondary, 0.1);
    ctx.beginPath();
    ctx.moveTo(-28, ty - 20);
    ctx.lineTo(28, ty + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, ty - 20);
    ctx.lineTo(-34, ty + 6);
    ctx.stroke();

    // Front cage extension
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, ty - 20);
    ctx.lineTo(42, ty + 2);
    ctx.stroke();

    // Rear cage extension
    ctx.beginPath();
    ctx.moveTo(-28, ty - 20);
    ctx.lineTo(-44, ty + 2);
    ctx.stroke();
  },
};

// ---- Pattern Overlay Drawing ----

function drawPattern(ctx, v, ty) {
  const patternFn = patterns[v.pattern];
  if (patternFn) {
    ctx.save();
    patternFn(ctx, v, ty);
    ctx.restore();
  }
}

const patterns = {
  'flames': function(ctx, v, ty) {
    const color = v.patternColor || v.secondaryColor;
    ctx.fillStyle = color;

    // Big flame tongues sweeping from rear to front
    for (let i = 0; i < 6; i++) {
      const bx = -45 + i * 16;
      const h = 18 + Math.sin(i * 1.3) * 10;
      ctx.beginPath();
      ctx.moveTo(bx, ty + 24);
      ctx.quadraticCurveTo(bx + 4, ty + 24 - h * 0.6, bx + 6, ty + 24 - h);
      ctx.quadraticCurveTo(bx + 8, ty + 24 - h * 0.65, bx + 10, ty + 24 - h * 0.4);
      ctx.quadraticCurveTo(bx + 12, ty + 24 - h * 0.75, bx + 14, ty + 24 - h * 0.2);
      ctx.quadraticCurveTo(bx + 16, ty + 24 - h * 0.05, bx + 18, ty + 24);
      ctx.closePath();
      ctx.fill();
    }

    // Hot inner flames (lighter)
    ctx.fillStyle = lightenColor(color, 0.35);
    for (let i = 0; i < 4; i++) {
      const bx = -38 + i * 20;
      const h = 12 + i * 2;
      ctx.beginPath();
      ctx.moveTo(bx, ty + 24);
      ctx.quadraticCurveTo(bx + 3, ty + 24 - h * 0.5, bx + 5, ty + 24 - h);
      ctx.quadraticCurveTo(bx + 7, ty + 24 - h * 0.3, bx + 10, ty + 24);
      ctx.closePath();
      ctx.fill();
    }
  },

  'lightning': function(ctx, v, ty) {
    const color = v.patternColor || v.secondaryColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Two bold lightning bolts across the body
    for (let bolt = 0; bolt < 2; bolt++) {
      const startX = -38 + bolt * 28;
      const startY = ty - 14 + bolt * 6;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + 14, startY + 7);
      ctx.lineTo(startX + 9, startY + 12);
      ctx.lineTo(startX + 25, startY + 22);
      ctx.stroke();
    }

    // Glow aura
    ctx.strokeStyle = lightenColor(color, 0.4);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    const sx = -22;
    ctx.beginPath();
    ctx.moveTo(sx, ty - 8);
    ctx.lineTo(sx + 12, ty + 2);
    ctx.lineTo(sx + 7, ty + 6);
    ctx.lineTo(sx + 20, ty + 16);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  'stripes': function(ctx, v, ty) {
    const color = v.patternColor || v.secondaryColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.7;

    // Bold diagonal racing stripes
    for (let i = 0; i < 3; i++) {
      const x = -22 + i * 16;
      ctx.beginPath();
      ctx.moveTo(x, ty - 26);
      ctx.lineTo(x + 22, ty + 26);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  'scales': function(ctx, v, ty) {
    const color = v.patternColor || v.secondaryColor;
    ctx.globalAlpha = 0.6;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        const x = -48 + col * 13 + (row % 2) * 6;
        const y = ty - 12 + row * 9;
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI, false);
        ctx.fillStyle = (row + col) % 2 === 0 ? color : lightenColor(color, 0.2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  'camo': function(ctx, v, ty) {
    const color = v.patternColor || v.secondaryColor;
    ctx.globalAlpha = 0.5;

    const blobs = [
      [-32, ty - 10, 13], [-8, ty + 6, 11], [18, ty - 8, 15],
      [34, ty + 10, 9], [-22, ty + 16, 10], [6, ty - 16, 12],
      [38, ty - 2, 11], [-44, ty + 8, 8],
    ];

    blobs.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.65, x * 0.02, 0, Math.PI * 2);
      ctx.fillStyle = darkenColor(color, (x + 50) / 200 * 0.3);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  },

  'stars': function(ctx, v, ty) {
    const color = v.patternColor || v.secondaryColor;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;

    const starPositions = [
      [-28, ty - 12, 6], [8, ty - 4, 7], [28, ty - 14, 5],
      [-12, ty + 10, 6], [38, ty + 6, 5], [-40, ty + 3, 4],
    ];

    starPositions.forEach(([x, y, size]) => {
      drawStar(ctx, x, y, size);
    });
    ctx.globalAlpha = 1;
  },

  'bones': function(ctx, v, ty) {
    const color = v.patternColor || '#ffffff';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.65;

    for (let i = 0; i < 3; i++) {
      const x = -28 + i * 28;
      const y = ty + 5;
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 7);
      ctx.lineTo(x + 7, y + 7);
      ctx.moveTo(x + 7, y - 7);
      ctx.lineTo(x - 7, y + 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 7, y - 7, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 7, y + 7, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 7, y - 7, 2.5, 0, Math.PI * 2);
      ctx.arc(x - 7, y + 7, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  'tribal': function(ctx, v, ty) {
    const color = v.patternColor || v.secondaryColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.7;

    ctx.beginPath();
    ctx.moveTo(-44, ty + 12);
    ctx.lineTo(-32, ty - 4);
    ctx.lineTo(-20, ty + 6);
    ctx.lineTo(-8, ty - 14);
    ctx.lineTo(4, ty + 2);
    ctx.lineTo(14, ty - 10);
    ctx.lineTo(24, ty + 6);
    ctx.lineTo(34, ty - 6);
    ctx.lineTo(44, ty + 6);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-38, ty + 20);
    ctx.lineTo(-26, ty + 6);
    ctx.lineTo(-14, ty + 14);
    ctx.lineTo(2, ty + 4);
    ctx.lineTo(18, ty + 16);
    ctx.lineTo(28, ty + 6);
    ctx.lineTo(40, ty + 14);
    ctx.stroke();

    ctx.globalAlpha = 1;
  },

  'splatter': function(ctx, v, ty) {
    const color = v.patternColor || v.secondaryColor;
    ctx.globalAlpha = 0.6;

    const splats = [
      [-28, ty - 4, 9], [12, ty + 4, 11], [32, ty - 10, 8],
      [-10, ty + 14, 7], [-38, ty + 10, 6], [22, ty + 12, 6],
      [2, ty - 16, 5], [42, ty + 3, 7],
    ];

    splats.forEach(([x, y, r]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      for (let d = 0; d < 5; d++) {
        const angle = (d / 5) * Math.PI * 2 + x * 0.1;
        const dist = r + 3 + (d * 1.5);
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(angle) * dist,
          y + Math.sin(angle) * dist,
          1 + d * 0.4,
          0, Math.PI * 2
        );
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  },

  'none': function() {},
};

// ---- Decal Drawing ----

function drawDecals(ctx, v, ty) {
  const decals = v.decals || [];
  decals.forEach(decalName => {
    const decalFn = decalTypes[decalName];
    if (decalFn) {
      ctx.save();
      decalFn(ctx, v, ty);
      ctx.restore();
    }
  });
}

const decalTypes = {
  'skull': function(ctx, v, ty) {
    const color = v.patternColor || '#ffffff';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;

    const cx = -8, cy = ty - 2;
    // Cranium
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Jaw
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 6, 4, 0, 0, Math.PI);
    ctx.fill();
    // Eye sockets
    ctx.fillStyle = darkenColor(v.primaryColor, 0.5);
    ctx.beginPath();
    ctx.ellipse(cx - 3.5, cy - 4, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 3.5, cy - 4, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nose
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy + 1);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx + 1, cy + 1);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  'horns': function(ctx, v, ty) {
    const color = v.accentColor || v.secondaryColor || '#ffcc00';
    ctx.fillStyle = color;

    // Left horn (bigger, more aggressive)
    ctx.beginPath();
    ctx.moveTo(-18, ty - 26);
    ctx.quadraticCurveTo(-30, ty - 48, -36, ty - 44);
    ctx.quadraticCurveTo(-32, ty - 38, -14, ty - 22);
    ctx.closePath();
    ctx.fill();

    // Right horn
    ctx.beginPath();
    ctx.moveTo(12, ty - 26);
    ctx.quadraticCurveTo(24, ty - 48, 30, ty - 44);
    ctx.quadraticCurveTo(26, ty - 38, 9, ty - 22);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(color, 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, ty - 26);
    ctx.quadraticCurveTo(-30, ty - 48, -36, ty - 44);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, ty - 26);
    ctx.quadraticCurveTo(24, ty - 48, 30, ty - 44);
    ctx.stroke();
  },

  'fin': function(ctx, v, ty) {
    const color = v.secondaryColor || v.primaryColor;
    ctx.fillStyle = color;

    // Dorsal fin - taller and more dramatic
    ctx.beginPath();
    ctx.moveTo(-8, ty - 28);
    ctx.lineTo(4, ty - 50);
    ctx.lineTo(20, ty - 26);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(color, 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  'wings': function(ctx, v, ty) {
    const color = v.secondaryColor || v.accentColor || '#ff6600';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;

    // Left wing
    ctx.beginPath();
    ctx.moveTo(-44, ty - 8);
    ctx.quadraticCurveTo(-66, ty - 32, -60, ty - 38);
    ctx.quadraticCurveTo(-54, ty - 32, -42, ty - 14);
    ctx.closePath();
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(38, ty - 8);
    ctx.quadraticCurveTo(60, ty - 32, 54, ty - 38);
    ctx.quadraticCurveTo(48, ty - 32, 36, ty - 14);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
  },

  'teeth': function(ctx, v, ty) {
    ctx.fillStyle = '#ffffff';

    // Bigger, more menacing teeth
    for (let i = 0; i < 7; i++) {
      const x = 18 + i * 5.5;
      const baseY = ty + 20;
      const h = 6 + (i % 2) * 3;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + 2.5, baseY + h);
      ctx.lineTo(x + 5, baseY);
      ctx.closePath();
      ctx.fill();
    }
  },

  'eye': function(ctx, v, ty) {
    const cx = 16, cy = ty - 6;

    // Eye white - larger
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil - slit for menace
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Bold outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  'tombstone': function(ctx, v, ty) {
    ctx.fillStyle = '#888888';
    const tx = 22, tty = ty - 3;

    ctx.beginPath();
    ctx.moveTo(tx - 5, tty + 10);
    ctx.lineTo(tx - 5, tty - 2);
    ctx.arc(tx, tty - 2, 5, Math.PI, 0);
    ctx.lineTo(tx + 5, tty + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#444444';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RIP', tx, tty + 4);
  },

  'flag': function(ctx, v, ty) {
    const color = v.accentColor || v.secondaryColor || '#ff0000';

    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ty - 24);
    ctx.lineTo(0, ty - 44);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, ty - 44);
    ctx.lineTo(14, ty - 39);
    ctx.lineTo(0, ty - 34);
    ctx.closePath();
    ctx.fill();
  },

  'exhaust': function(ctx, v, ty) {
    const metalColor = '#777777';

    // Dual exhaust pipes - bigger
    ctx.fillStyle = metalColor;
    ctx.fillRect(-50, ty - 6, 6, 14);
    ctx.fillRect(-48, ty - 9, 4, 4);

    ctx.fillStyle = '#555';
    ctx.fillRect(-50, ty + 2, 6, 14);
    ctx.fillRect(-48, ty + 10, 4, 4);

    // Exhaust tips
    ctx.fillStyle = darkenColor(metalColor, 0.4);
    ctx.beginPath();
    ctx.ellipse(-47, ty - 9, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-47, ty + 12, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  'spoiler': function(ctx, v, ty) {
    const color = v.secondaryColor || v.accentColor || '#cccccc';

    // Spoiler posts
    ctx.fillStyle = darkenColor(color, 0.3);
    ctx.fillRect(-38, ty - 26, 3, 12);
    ctx.fillRect(-26, ty - 26, 3, 12);

    // Spoiler wing - wider
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-42, ty - 30);
    ctx.lineTo(-22, ty - 30);
    ctx.lineTo(-20, ty - 25);
    ctx.lineTo(-44, ty - 25);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(color, 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  'mohawk': function(ctx, v, ty) {
    const color = v.secondaryColor || v.accentColor || '#ff3366';
    ctx.fillStyle = color;

    // Bigger mohawk spikes
    for (let i = 0; i < 6; i++) {
      const x = -22 + i * 9;
      const h = 12 + Math.sin(i * 0.8) * 5;
      ctx.beginPath();
      ctx.moveTo(x - 4, ty - 22);
      ctx.lineTo(x, ty - 22 - h);
      ctx.lineTo(x + 4, ty - 22);
      ctx.closePath();
      ctx.fill();
    }
  },

  'ears': function(ctx, v, ty) {
    const color = v.secondaryColor || v.primaryColor;
    ctx.fillStyle = color;

    // Floppy ears
    ctx.beginPath();
    ctx.moveTo(-22, ty - 26);
    ctx.quadraticCurveTo(-38, ty - 34, -42, ty - 16);
    ctx.quadraticCurveTo(-38, ty - 20, -20, ty - 22);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(12, ty - 23);
    ctx.quadraticCurveTo(28, ty - 34, 32, ty - 16);
    ctx.quadraticCurveTo(28, ty - 20, 14, ty - 20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath();
    ctx.ellipse(-30, ty - 22, 5, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
  },
};

// ---- Detail Drawing (windshield, headlights, bumper) ----

function drawDetails(ctx, v, ty) {
  // Windshield
  ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
  ctx.strokeStyle = 'rgba(100, 180, 255, 0.45)';
  ctx.lineWidth = 1.5;

  if (v.bodyType === 'panel-truck') {
    ctx.beginPath();
    ctx.moveTo(38, ty - 22);
    ctx.lineTo(52, ty - 2);
    ctx.lineTo(50, ty + 8);
    ctx.lineTo(34, ty - 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (v.bodyType === 'pickup') {
    ctx.beginPath();
    ctx.moveTo(12, ty - 22);
    ctx.lineTo(32, ty - 12);
    ctx.lineTo(30, ty - 2);
    ctx.lineTo(8, ty - 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (v.bodyType !== 'buggy' && v.bodyType !== 'beast') {
    ctx.beginPath();
    ctx.moveTo(16, ty - 20);
    ctx.lineTo(36, ty - 12);
    ctx.lineTo(34, ty - 2);
    ctx.lineTo(14, ty - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Headlights - brighter, with glow
  ctx.fillStyle = 'rgba(255, 255, 180, 0.9)';
  ctx.beginPath();
  ctx.arc(54, ty + 10, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Headlight glow
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffffaa';
  ctx.beginPath();
  ctx.arc(54, ty + 10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Second headlight (lower)
  ctx.fillStyle = 'rgba(255, 255, 180, 0.7)';
  ctx.beginPath();
  ctx.arc(54, ty + 18, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Damage Overlay ----

function drawDamageOverlay(ctx, level, ty) {
  ctx.globalAlpha = level * 0.6;

  // Scratches
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < Math.floor(level * 6); i++) {
    const x1 = -35 + i * 14;
    const y1 = ty - 18 + (i * 7 % 36);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + 12 + i * 2, y1 + (i % 3) * 4 - 4);
    ctx.stroke();
  }

  // Dents
  if (level > 0.3) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let i = 0; i < Math.floor(level * 4); i++) {
      ctx.beginPath();
      ctx.ellipse(
        -24 + i * 16,
        ty + (i * 11 % 28) - 8,
        5 + i * 1.5,
        4 + i,
        i * 0.5,
        0, Math.PI * 2
      );
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

// ---- Helper: Draw a 5-pointed star ----

function drawStar(ctx, cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 72 - 90) * Math.PI / 180;
    const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
    const outerX = cx + Math.cos(outerAngle) * size;
    const outerY = cy + Math.sin(outerAngle) * size;
    const innerX = cx + Math.cos(innerAngle) * size * 0.4;
    const innerY = cy + Math.sin(innerAngle) * size * 0.4;

    if (i === 0) {
      ctx.moveTo(outerX, outerY);
    } else {
      ctx.lineTo(outerX, outerY);
    }
    ctx.lineTo(innerX, innerY);
  }
  ctx.closePath();
  ctx.fill();
}
