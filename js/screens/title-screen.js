// ============================================
// MONSTER SMASH - Title Screen
// Stadium lights, chrome title, dirt & fire
// ============================================

import { setState } from '../game-state.js';

let screenEl = null;
let sparksInterval = null;

export function createTitleScreen(container) {
  // Clean up any previous instance
  if (screenEl) {
    destroyTitleScreen();
  }

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

      <div class="title-trucks" aria-hidden="true">
        <div class="title-truck title-truck-left">&#x1F69B;</div>
        <div class="title-truck title-truck-right">&#x1F69B;</div>
      </div>

      <button class="btn btn-fire title-play-btn" type="button">
        <span class="title-play-text">&#x25B6; PLAY</span>
      </button>

      <div class="title-tire-tracks" aria-hidden="true"></div>
    </div>
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

  // Start sparks effect after title animation
  setTimeout(() => {
    startSparks();
  }, 1500);

  return screenEl;
}

function handlePlay(e) {
  e.preventDefault();
  const btn = e.currentTarget;
  btn.classList.add('title-play-pressed');

  // Transition out
  screenEl.classList.add('title-exit');

  setTimeout(() => {
    setState({ screen: 'team-select' });
  }, 400);
}

function startSparks() {
  const container = screenEl?.querySelector('.title-sparks');
  if (!container) return;

  sparksInterval = setInterval(() => {
    if (!container.isConnected) {
      clearInterval(sparksInterval);
      return;
    }

    const spark = document.createElement('div');
    spark.className = 'spark';

    const x = 30 + Math.random() * 40; // center area
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
  if (sparksInterval) {
    clearInterval(sparksInterval);
    sparksInterval = null;
  }
  if (screenEl) {
    screenEl.remove();
    screenEl = null;
  }
}

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

    /* ---- Decorative trucks ---- */
    .title-trucks {
      position: absolute;
      width: 100%;
      top: 50%;
      pointer-events: none;
    }

    .title-truck {
      position: absolute;
      font-size: clamp(40px, 6vw, 70px);
      opacity: 0;
      filter: grayscale(0.3) brightness(0.7);
    }

    .title-truck-left {
      left: 5%;
      transform: scaleX(-1);
      animation: truckRumbleLeft 0.6s ease 0.8s forwards, truckIdle 0.3s ease-in-out 1.4s infinite alternate;
    }

    .title-truck-right {
      right: 5%;
      animation: truckRumbleRight 0.6s ease 0.9s forwards, truckIdle 0.3s ease-in-out 1.5s infinite alternate;
    }

    @keyframes truckRumbleLeft {
      0% { transform: scaleX(-1) translateX(-100px); opacity: 0; }
      60% { transform: scaleX(-1) translateX(10px); opacity: 1; }
      100% { transform: scaleX(-1) translateX(0); opacity: 0.7; }
    }

    @keyframes truckRumbleRight {
      0% { transform: translateX(100px); opacity: 0; }
      60% { transform: translateX(-10px); opacity: 1; }
      100% { transform: translateX(0); opacity: 0.7; }
    }

    @keyframes truckIdle {
      0% { transform: translateY(0); }
      100% { transform: translateY(-2px); }
    }

    .title-truck-left {
      animation: truckRumbleLeft 0.6s ease 0.8s forwards;
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
      .title-badge {
        margin-bottom: 4px;
      }
      .title-tagline {
        margin-top: 8px;
      }
      .title-play-btn {
        margin-top: 16px;
        padding: 14px 48px;
      }
    }
  `;
}
