// ============================================
// MONSTER SMASH - Title Screen
// Stadium lights, chrome title, truck showcase
// Tap any truck to see its stats & hear it rev!
// ============================================

import { setState, getState, onStateChange } from '../game-state.js';
import { renderTruckToImage } from '../trucks/truck-renderer.js';
import { playEngineRev, playClick, playPowerUp } from '../audio/sound-effects.js';

let screenEl = null;
let sparksInterval = null;
let stateCleanup = null;
let popupTimeout = null;

export function createTitleScreen(container) {
  if (screenEl) destroyTitleScreen();

  screenEl = document.createElement('div');
  screenEl.className = 'screen title-screen active';

  screenEl.innerHTML = `
    <div class="stadium-bg">
      <div class="ground-strip"></div>
      <div class="title-spotlights">
        <div class="spotlight spotlight-1"></div>
        <div class="spotlight spotlight-2"></div>
        <div class="spotlight spotlight-3"></div>
      </div>
    </div>

    <div class="title-truck-showcase" id="truck-showcase"></div>

    <div class="title-content">
      <div class="title-sparks" aria-hidden="true"></div>

      <div class="title-badge">
        <span class="title-badge-text">MONSTER TRUCK BATTLE ARENA</span>
      </div>

      <div class="title-words">
        <div class="title-word title-monster">MONSTER</div>
        <div class="title-word title-smash">SMASH!</div>
      </div>

      <div class="title-impact-flash"></div>

      <div class="title-tagline">PICK YOUR TEAM. CRUSH THE COMPETITION.</div>

      <button class="btn btn-fire title-play-btn" type="button">
        <span class="title-play-text">&#x25B6; PLAY</span>
      </button>

      <div class="title-tire-tracks" aria-hidden="true"></div>
    </div>

    <div class="truck-info-popup" id="truck-info-popup"></div>
  `;

  // Add styles
  if (!document.getElementById('title-screen-styles')) {
    const style = document.createElement('style');
    style.id = 'title-screen-styles';
    style.textContent = getTitleStyles();
    document.head.appendChild(style);
  }

  container.appendChild(screenEl);

  // Bind play button
  const playBtn = screenEl.querySelector('.title-play-btn');
  playBtn.addEventListener('pointerdown', handlePlay);

  // Dismiss popup on any tap outside trucks
  screenEl.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.showcase-truck') && !e.target.closest('.truck-info-popup')) {
      dismissPopup();
    }
  });

  // Start sparks effect after title animation
  setTimeout(() => startSparks(), 1500);

  // Check if trucks are already loaded
  const state = getState();
  if (state.allTrucks && state.allTrucks.length > 0) {
    setTimeout(() => populateShowcase(state.allTrucks), 200);
  }

  // Listen for truck load
  stateCleanup = onStateChange((s) => {
    if (s.allTrucks && s.allTrucks.length > 0) {
      const showcase = screenEl?.querySelector('#truck-showcase');
      if (showcase && showcase.children.length === 0) {
        populateShowcase(s.allTrucks);
      }
    }
  });

  return screenEl;
}

// ---- Truck Showcase ----

function populateShowcase(trucks) {
  const showcase = screenEl?.querySelector('#truck-showcase');
  if (!showcase) return;

  // Shuffle trucks for visual variety
  const shuffled = [...trucks].sort(() => Math.random() - 0.5);

  // Create 4 edge strips (top, right, bottom, left)
  const positions = ['top', 'right', 'bottom', 'left'];
  const strips = positions.map(pos => {
    const strip = document.createElement('div');
    strip.className = `showcase-strip showcase-strip--${pos}`;
    showcase.appendChild(strip);
    return strip;
  });

  // Distribute trucks: top ~30%, bottom ~30%, right ~20%, left ~20%
  const total = shuffled.length;
  const topCount = Math.ceil(total * 0.3);
  const bottomCount = Math.ceil(total * 0.3);
  const rightCount = Math.ceil(total * 0.2);
  // left gets the rest
  const allocations = [topCount, rightCount, bottomCount, total];

  let idx = 0;
  strips.forEach((strip, si) => {
    const end = Math.min(idx + allocations[si], total);
    for (let i = idx; i < end; i++) {
      const truck = shuffled[i];
      const imgSrc = renderTruckToImage(truck, 90, 72);
      const wrapper = document.createElement('div');
      wrapper.className = `showcase-truck showcase-truck--${truck.rarity}`;
      wrapper.style.setProperty('--float-delay', `${(i * 0.25) % 4}s`);

      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = truck.name;
      img.draggable = false;
      wrapper.appendChild(img);

      wrapper.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showTruckPopup(truck, wrapper);
        playTruckSound(truck.rarity);
      });

      strip.appendChild(wrapper);
    }
    idx = end;
  });
}

function showTruckPopup(truck, fromEl) {
  const popup = screenEl?.querySelector('#truck-info-popup');
  if (!popup) return;

  if (popupTimeout) clearTimeout(popupTimeout);

  const rarityColor = getRarityColor(truck.rarity);

  const statEntries = [
    ['smashDamage', 'SMASH', '#ff2d2d'],
    ['speed', 'SPEED', '#ffd21a'],
    ['shield', 'SHIELD', '#4488ff'],
    ['weight', 'WEIGHT', '#8a8d96'],
  ];

  const statsHTML = statEntries.map(([key, label, color]) => {
    const val = truck.stats?.[key] || 0;
    return `
      <div class="popup-stat">
        <span class="popup-stat__label">${label}</span>
        <div class="popup-stat__bar">
          <div class="popup-stat__fill" style="width:${Math.min(val, 100)}%;background:${color}"></div>
        </div>
        <span class="popup-stat__value">${val}</span>
      </div>
    `;
  }).join('');

  popup.innerHTML = `
    <div class="popup-rarity" style="color:${rarityColor}">${truck.rarity.toUpperCase()}</div>
    <div class="popup-name">${truck.name}</div>
    <div class="popup-tagline">${truck.tagline || ''}</div>
    <div class="popup-stats">${statsHTML}</div>
    <div class="popup-ability">
      <span class="popup-ability__icon">${getAbilityIcon(truck.specialAbility?.type)}</span>
      <span class="popup-ability__name">${truck.specialAbility?.name || 'None'}</span>
    </div>
    <div class="popup-desc">${truck.specialAbility?.description || ''}</div>
  `;

  popup.style.borderColor = rarityColor;
  popup.style.boxShadow = `0 0 25px ${rarityColor}50`;

  // Position near the tapped truck
  const rect = fromEl.getBoundingClientRect();
  const containerRect = screenEl.getBoundingClientRect();

  const popupW = 260;
  const popupH = 300;
  let left = rect.left - containerRect.left + rect.width / 2 - popupW / 2;
  let top = rect.top - containerRect.top - popupH - 10;

  // Keep on screen
  left = Math.max(10, Math.min(left, containerRect.width - popupW - 10));
  if (top < 10) top = rect.bottom - containerRect.top + 10;
  top = Math.max(10, Math.min(top, containerRect.height - popupH - 10));

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('truck-info-popup--visible');

  popupTimeout = setTimeout(() => dismissPopup(), 4000);
}

function dismissPopup() {
  const popup = screenEl?.querySelector('#truck-info-popup');
  if (popup) popup.classList.remove('truck-info-popup--visible');
  if (popupTimeout) { clearTimeout(popupTimeout); popupTimeout = null; }
}

function playTruckSound(rarity) {
  switch (rarity) {
    case 'legendary': playPowerUp(); break;
    case 'epic': playEngineRev(0.4); break;
    case 'rare': playEngineRev(0.25); break;
    default: playClick();
  }
}

function getRarityColor(rarity) {
  return { common: '#8a8d96', rare: '#4488ff', epic: '#b44aff', legendary: '#ffaa00' }[rarity] || '#fff';
}

function getAbilityIcon(type) {
  return {
    'damage-boost': '\u{1F4A5}', 'direct-damage': '\u26A1', 'heal': '\u{1F49A}',
    'shield-boost': '\u{1F6E1}\uFE0F', 'speed-boost': '\u{1F680}', 'stun': '\u26A1',
    'burn': '\u{1F525}', 'pierce': '\u{1F5E1}\uFE0F', 'multi-hit': '\u{1F4AB}',
    'dodge': '\u{1F47B}', 'steal': '\u{1F9B7}', 'random': '\u{1F3B2}',
  }[type] || '\u2728';
}

// ---- Play / Sparks / Destroy ----

function handlePlay(e) {
  e.preventDefault();
  dismissPopup();
  const btn = e.currentTarget;
  btn.classList.add('title-play-pressed');
  screenEl.classList.add('title-exit');
  setTimeout(() => setState({ screen: 'team-select' }), 400);
}

function startSparks() {
  const container = screenEl?.querySelector('.title-sparks');
  if (!container) return;

  sparksInterval = setInterval(() => {
    if (!container.isConnected) { clearInterval(sparksInterval); return; }

    const spark = document.createElement('div');
    spark.className = 'spark';
    const x = 30 + Math.random() * 40;
    const startY = 35 + Math.random() * 15;
    spark.style.left = x + '%';
    spark.style.top = startY + '%';
    spark.style.setProperty('--sx', (Math.random() - 0.5) * 120 + 'px');
    spark.style.setProperty('--sy', -(30 + Math.random() * 80) + 'px');
    const hue = Math.random() > 0.5 ? 30 + Math.random() * 20 : 10 + Math.random() * 10;
    spark.style.background = `hsl(${hue}, 100%, ${60 + Math.random() * 30}%)`;
    spark.style.width = spark.style.height = (2 + Math.random() * 3) + 'px';
    container.appendChild(spark);
    setTimeout(() => spark.remove(), 800);
  }, 100);
}

export function destroyTitleScreen() {
  if (sparksInterval) { clearInterval(sparksInterval); sparksInterval = null; }
  if (stateCleanup) { stateCleanup(); stateCleanup = null; }
  if (popupTimeout) { clearTimeout(popupTimeout); popupTimeout = null; }
  if (screenEl) { screenEl.remove(); screenEl = null; }
}

// ---- Styles ----

function getTitleStyles() {
  return `
    /* ---- Title Screen Layout ---- */
    .title-screen {
      background: var(--bg-abyss);
    }

    .title-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 20px;
      pointer-events: none;
    }

    /* ---- Truck Showcase (border layout) ---- */
    .title-truck-showcase {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      pointer-events: none;
    }

    .showcase-strip {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 2px;
      pointer-events: none;
    }

    .showcase-strip--top {
      top: 0; left: 0; right: 0;
      flex-direction: row;
      justify-content: center;
      padding: 4px 6px;
    }

    .showcase-strip--bottom {
      bottom: 0; left: 0; right: 0;
      flex-direction: row;
      justify-content: center;
      padding: 4px 6px;
    }

    .showcase-strip--left {
      top: 62px; bottom: 62px; left: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0px;
      padding: 4px;
    }

    .showcase-strip--right {
      top: 62px; bottom: 62px; right: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0px;
      padding: 4px;
    }

    .showcase-truck {
      flex-shrink: 0;
      cursor: pointer;
      pointer-events: auto;
      opacity: 0;
      animation: showcaseFadeIn 0.5s ease forwards;
      animation-delay: var(--float-delay, 0s);
      transition: transform 0.2s ease;
    }

    .showcase-truck:active {
      transform: scale(1.25);
    }

    .showcase-truck img {
      width: 70px;
      height: 56px;
      object-fit: contain;
      filter: brightness(0.65);
      transition: filter 0.2s;
    }

    .showcase-truck:active img {
      filter: brightness(1.3);
    }

    .showcase-truck--legendary img {
      filter: brightness(0.85) drop-shadow(0 0 5px rgba(255,170,0,0.5));
    }

    .showcase-truck--epic img {
      filter: brightness(0.8) drop-shadow(0 0 4px rgba(180,74,255,0.4));
    }

    @keyframes showcaseFadeIn {
      0% { opacity: 0; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* ---- Truck Info Popup ---- */
    .truck-info-popup {
      position: absolute;
      z-index: 20;
      width: 260px;
      background: linear-gradient(135deg, rgba(20,20,35,0.97), rgba(30,30,50,0.97));
      border: 2px solid #fff;
      border-radius: 14px;
      padding: 14px 18px;
      pointer-events: none;
      opacity: 0;
      transform: scale(0.85) translateY(10px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .truck-info-popup--visible {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    .popup-rarity {
      font-family: var(--font-body);
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .popup-name {
      font-family: var(--font-heading);
      font-size: 22px;
      color: var(--chrome-bright);
      letter-spacing: 1px;
      margin-top: 2px;
    }

    .popup-tagline {
      font-family: var(--font-accent);
      font-size: 12px;
      color: var(--chrome-dark);
      margin-top: 1px;
    }

    .popup-stats {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .popup-stat {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
    }

    .popup-stat__label {
      font-family: var(--font-body);
      color: var(--chrome);
      width: 45px;
      text-align: right;
      letter-spacing: 1px;
      flex-shrink: 0;
    }

    .popup-stat__bar {
      flex: 1;
      height: 7px;
      background: rgba(255,255,255,0.08);
      border-radius: 4px;
      overflow: hidden;
    }

    .popup-stat__fill {
      height: 100%;
      border-radius: 4px;
    }

    .popup-stat__value {
      font-family: var(--font-body);
      color: var(--chrome-bright);
      width: 24px;
      text-align: right;
      font-size: 11px;
    }

    .popup-ability {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--chrome);
      padding: 5px 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 6px;
    }

    .popup-ability__icon { font-size: 16px; }
    .popup-ability__name {
      font-family: var(--font-heading);
      letter-spacing: 0.5px;
    }

    .popup-desc {
      font-family: var(--font-body);
      font-size: 10px;
      color: var(--chrome-dark);
      margin-top: 6px;
      line-height: 1.4;
      opacity: 0.7;
    }

    /* ---- Spotlights ---- */
    .title-spotlights {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .spotlight {
      position: absolute;
      top: -20%;
      width: 200px;
      height: 120%;
      background: linear-gradient(
        180deg,
        rgba(255, 210, 26, 0.12) 0%,
        rgba(255, 210, 26, 0.03) 60%,
        transparent 100%
      );
      clip-path: polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%);
    }

    .spotlight-1 {
      left: 8%;
      animation: spotlightSway1 6s ease-in-out infinite;
    }

    .spotlight-2 {
      left: 42%;
      animation: spotlightSway2 8s ease-in-out infinite;
      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.08) 0%,
        rgba(255, 255, 255, 0.02) 60%,
        transparent 100%
      );
    }

    .spotlight-3 {
      right: 8%;
      animation: spotlightSway3 7s ease-in-out infinite;
    }

    @keyframes spotlightSway1 {
      0%, 100% { transform: rotate(-5deg); }
      50% { transform: rotate(5deg); }
    }
    @keyframes spotlightSway2 {
      0%, 100% { transform: rotate(3deg); }
      50% { transform: rotate(-3deg); }
    }
    @keyframes spotlightSway3 {
      0%, 100% { transform: rotate(5deg); }
      50% { transform: rotate(-8deg); }
    }

    /* ---- Badge above title ---- */
    .title-badge {
      opacity: 0;
      animation: subtitleFade 0.6s ease 0.2s forwards;
      margin-bottom: 8px;
    }

    .title-badge-text {
      font-family: var(--font-body);
      font-size: clamp(10px, 1.8vw, 16px);
      letter-spacing: 6px;
      color: var(--chrome);
      text-transform: uppercase;
      padding: 4px 16px;
      border: 1px solid var(--steel);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.03);
    }

    /* ---- Title Words ---- */
    .title-words {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      line-height: 0.9;
    }

    .title-word {
      font-family: var(--font-display);
      font-weight: 400;
      opacity: 0;
      position: relative;
    }

    .title-monster {
      font-size: clamp(48px, 10vw, 100px);
      color: var(--chrome-bright);
      animation:
        wordSlideLeft 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
      text-shadow:
        0 0 20px rgba(200, 202, 208, 0.3),
        0 3px 0 var(--chrome-dark),
        0 6px 0 rgba(0, 0, 0, 0.4);
      letter-spacing: 4px;
    }

    .title-smash {
      font-size: clamp(64px, 13vw, 130px);
      animation:
        wordSlideRight 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.5s forwards,
        fireGlow 2s ease-in-out 1.2s infinite;
      background: linear-gradient(
        180deg,
        var(--fire-yellow) 0%,
        var(--fire-orange) 40%,
        var(--fire-red) 100%
      );
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 4px 0 rgba(139, 37, 0, 0.8));
      letter-spacing: 6px;
      margin-top: -5px;
    }

    /* ---- Impact flash ---- */
    .title-impact-flash {
      position: absolute;
      top: 35%;
      left: 50%;
      width: 100px;
      height: 100px;
      margin-left: -50px;
      margin-top: -50px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(255, 210, 26, 0.8) 0%,
        rgba(255, 107, 26, 0.4) 40%,
        transparent 70%
      );
      opacity: 0;
      animation: impactFlash 0.6s ease-out 1s forwards;
      pointer-events: none;
    }

    /* ---- Tagline ---- */
    .title-tagline {
      font-family: var(--font-accent);
      font-size: clamp(12px, 2.2vw, 20px);
      color: var(--fire-orange);
      letter-spacing: 4px;
      margin-top: 16px;
      opacity: 0;
      animation: subtitleFade 0.8s ease 1s forwards;
      text-shadow: 0 0 15px rgba(255, 107, 26, 0.4);
    }

    /* ---- Play Button ---- */
    .title-play-btn {
      margin-top: 32px;
      padding: 18px 64px;
      font-size: clamp(22px, 3.5vw, 34px);
      opacity: 0;
      animation:
        buttonReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) 1.3s forwards,
        buttonPulse 2s ease-in-out 1.8s infinite;
      border-radius: var(--radius-xl);
      position: relative;
      z-index: 5;
      pointer-events: auto;
    }

    .title-play-text {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .title-play-pressed {
      animation: none !important;
      transform: scale(0.92);
      filter: brightness(1.3);
      transition: all 0.15s ease;
    }

    /* ---- Sparks container ---- */
    .title-sparks {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 3;
    }

    .spark {
      position: absolute;
      border-radius: 50%;
      animation: sparkBurst 0.8s ease-out forwards;
      pointer-events: none;
    }

    /* ---- Tire tracks at bottom ---- */
    .title-tire-tracks {
      position: absolute;
      bottom: 12%;
      left: 0;
      right: 0;
      height: 20px;
      opacity: 0.15;
      background:
        repeating-linear-gradient(
          90deg,
          transparent 0px,
          var(--dirt-light) 2px,
          transparent 4px,
          transparent 8px
        );
      animation: tireTrack 4s linear infinite;
    }

    /* ---- Exit animation ---- */
    .title-exit {
      animation: screenSlideOut 0.4s ease forwards;
      pointer-events: none;
    }

    /* ---- Responsive adjustments ---- */
    @media (max-height: 500px) {
      .title-badge { margin-bottom: 4px; }
      .title-tagline { margin-top: 8px; }
      .title-play-btn { margin-top: 16px; padding: 14px 48px; }
      .showcase-truck img { width: 55px; height: 44px; }
      .showcase-strip--left, .showcase-strip--right {
        top: 48px; bottom: 48px;
      }
    }
  `;
}
