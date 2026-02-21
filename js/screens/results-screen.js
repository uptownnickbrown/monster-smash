// ============================================
// MONSTER SMASH - Results Screen
// Podium showcase with 5 trucks, MVP flame,
// round results below, play again
// ============================================

import { getState, setState, resetBattle } from '../game-state.js';
import { el } from '../utils/dom-utils.js';
import { renderTruckToImage } from '../trucks/truck-renderer.js';

let screenEl = null;

export function createResultsScreen(container) {
  const state = getState();
  const results = state.roundResults;
  const playerWins = results.filter(r => r.winner === 'player').length;
  const computerWins = results.filter(r => r.winner === 'computer').length;
  const isVictory = playerWins > computerWins;

  screenEl = el('div', { className: 'screen results-screen active' });
  screenEl.innerHTML = getResultsHTML(results, playerWins, computerWins, isVictory);

  injectResultsStyles();
  container.appendChild(screenEl);

  // Bind play again button
  const playAgainBtn = screenEl.querySelector('.play-again-btn');
  playAgainBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    screenEl.classList.add('results-exit');
    resetBattle();
    setTimeout(() => {
      setState({ screen: 'title' });
    }, 400);
  });

  // Confetti for victory
  if (isVictory) {
    startConfetti();
  }

  return screenEl;
}

export function destroyResultsScreen() {
  if (screenEl) {
    screenEl.remove();
    screenEl = null;
  }
}

function findMVP(results) {
  let mvpIndex = -1;
  let bestDamage = 0;
  results.forEach((r, i) => {
    if (r.winner === 'player' && (r.computerDamage || 0) > bestDamage) {
      bestDamage = r.computerDamage;
      mvpIndex = i;
    }
  });
  return mvpIndex;
}

function getResultsHTML(results, playerWins, computerWins, isVictory) {
  const totalPlayerDamage = results.reduce((sum, r) => sum + (r.computerDamage || 0), 0);
  const totalComputerDamage = results.reduce((sum, r) => sum + (r.playerDamage || 0), 0);
  const mvpIndex = playerWins > 0 ? findMVP(results) : -1;

  // Build podium trucks — all 5 rounds, showing the winner of each
  const podiumTrucks = results.map((r, i) => {
    const won = r.winner === 'player';
    const winnerTruck = won ? r.playerTruck : r.computerTruck;
    const imgSrc = renderTruckToImage(winnerTruck, 200, 160);
    const isMVP = i === mvpIndex;

    return `
      <div class="podium-slot ${won ? 'podium-slot--win' : 'podium-slot--lose'} ${isMVP ? 'podium-slot--mvp' : ''}"
           style="animation-delay: ${i * 0.12}s">
        <div class="podium-dot ${won ? 'podium-dot--win' : 'podium-dot--lose'}"></div>
        <div class="podium-truck ${isMVP ? 'podium-truck--mvp' : ''}">
          ${isMVP ? '<div class="mvp-fire"></div>' : ''}
          <img src="${imgSrc}" alt="${winnerTruck.name}" draggable="false" />
          ${isMVP ? '<div class="mvp-crown">&#x1F451;</div>' : ''}
        </div>
        <div class="podium-name">${winnerTruck.name}</div>
        <div class="podium-base">
          <span class="podium-round">R${i + 1}</span>
        </div>
      </div>
    `;
  }).join('');

  // Round summary with damage stats
  const roundSummary = results.map((r, i) => {
    const won = r.winner === 'player';
    const playerDmg = r.computerDamage || 0;
    const cpuDmg = r.playerDamage || 0;
    return `
      <div class="round-line ${won ? 'round-line--win' : 'round-line--lose'}">
        <span class="round-line__r">R${i + 1}</span>
        <span class="round-line__vs">${r.playerTruck.name} vs ${r.computerTruck.name}</span>
        <span class="round-line__dmg">
          <span class="round-line__dealt">${playerDmg}</span>
          <span class="round-line__sep">/</span>
          <span class="round-line__taken">${cpuDmg}</span>
        </span>
        <span class="round-line__out">${won ? 'WIN' : 'LOSS'}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="stadium-bg">
      <div class="ground-strip"></div>
    </div>

    <div class="results-content">
      <div class="confetti-container" id="confetti"></div>

      <div class="results-header">
        <div class="results-verdict ${isVictory ? 'results-verdict--win' : 'results-verdict--lose'}">
          ${isVictory ? 'YOU WIN!' : 'NICE TRY!'}
        </div>
        <div class="results-score">
          <span class="results-score-player">${playerWins}</span>
          <span class="results-score-divider">-</span>
          <span class="results-score-computer">${computerWins}</span>
        </div>
      </div>

      <div class="podium-row">
        ${podiumTrucks}
      </div>

      <div class="results-bottom">
        <div class="results-totals">
          <div class="results-total results-total--green">
            <span class="results-total__label">DEALT</span>
            <span class="results-total__value">${totalPlayerDamage}</span>
          </div>
          <div class="results-total results-total--red">
            <span class="results-total__label">TAKEN</span>
            <span class="results-total__value">${totalComputerDamage}</span>
          </div>
        </div>
        <div class="round-summary">
          ${roundSummary}
        </div>
        <button class="btn btn-fire play-again-btn">
          <span>&#x1F504; PLAY AGAIN</span>
        </button>
      </div>
    </div>
  `;
}

function startConfetti() {
  const container = document.getElementById('confetti');
  if (!container) return;

  const colors = ['#ff2d2d', '#ff6b1a', '#ffd21a', '#39ff14', '#00d4ff', '#b44aff', '#ff2d8a'];

  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 3 + 's';
    confetti.style.animationDuration = (2 + Math.random() * 3) + 's';
    confetti.style.width = (4 + Math.random() * 8) + 'px';
    confetti.style.height = (4 + Math.random() * 8) + 'px';
    container.appendChild(confetti);
  }
}

function injectResultsStyles() {
  if (document.getElementById('results-styles')) return;

  const style = document.createElement('style');
  style.id = 'results-styles';
  style.textContent = `
    .results-screen {
      background: var(--bg-abyss);
    }

    .results-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 4px 12px;
      overflow: hidden;
    }

    /* Confetti */
    .confetti-container {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 0;
    }

    .confetti-piece {
      position: absolute;
      top: -20px;
      border-radius: 2px;
      opacity: 0.8;
      animation: confettiDrop linear infinite;
    }

    /* Header — very compact */
    .results-header {
      text-align: center;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

    .results-verdict {
      font-family: var(--font-display);
      font-size: clamp(24px, 5vw, 48px);
      letter-spacing: 4px;
      line-height: 1;
    }

    .results-verdict--win {
      background: linear-gradient(135deg, var(--neon-green), #00ff88, #39ff14);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 3px 0 rgba(0, 80, 0, 0.5));
      animation: victoryBounce 1s ease 0.5s;
    }

    .results-verdict--lose {
      background: linear-gradient(135deg, var(--fire-red), var(--fire-orange), var(--fire-yellow));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 3px 0 rgba(100, 0, 0, 0.5));
    }

    .results-score {
      font-family: var(--font-heading);
      font-size: clamp(22px, 4vw, 36px);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0;
      line-height: 1.1;
    }

    .results-score-player { color: var(--neon-green); }
    .results-score-divider { color: var(--chrome-dark); font-size: 0.7em; }
    .results-score-computer { color: var(--fire-red); }

    /* ---- Podium Row — centered, big trucks ---- */
    .podium-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: clamp(4px, 1vw, 12px);
      flex: 1;
      min-height: 0;
      width: 100%;
      max-width: 960px;
      position: relative;
      z-index: 1;
      padding: 0 4px;
    }

    .podium-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      max-width: 180px;
      opacity: 0;
      animation: podiumReveal 0.5s ease forwards;
    }

    @keyframes podiumReveal {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    /* Win/loss dot above truck */
    .podium-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-bottom: 4px;
      flex-shrink: 0;
    }

    .podium-dot--win {
      background: var(--neon-green);
      box-shadow: 0 0 8px var(--neon-green), 0 0 16px rgba(57,255,20,0.4);
    }

    .podium-dot--lose {
      background: var(--fire-red);
      box-shadow: 0 0 8px var(--fire-red), 0 0 16px rgba(255,45,45,0.4);
    }

    /* Truck image container — BIG */
    .podium-truck {
      position: relative;
      width: clamp(100px, 17vw, 160px);
      height: clamp(80px, 13.6vw, 128px);
    }

    .podium-truck img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    /* Win/loss coloring on truck */
    .podium-slot--lose .podium-truck img {
      filter: brightness(0.5) saturate(0.4);
    }

    .podium-slot--win .podium-truck img {
      filter: drop-shadow(0 2px 8px rgba(57, 255, 20, 0.3));
    }

    /* ---- MVP Effects ---- */
    .podium-truck--mvp img {
      filter: drop-shadow(0 0 10px rgba(255,170,0,0.8))
              drop-shadow(0 0 20px rgba(255,68,0,0.5))
              drop-shadow(0 -4px 15px rgba(255,210,26,0.4)) !important;
      animation: mvpPulse 1.8s ease-in-out infinite;
    }

    @keyframes mvpPulse {
      0%, 100% {
        filter: drop-shadow(0 0 10px rgba(255,170,0,0.8))
                drop-shadow(0 0 20px rgba(255,68,0,0.5))
                drop-shadow(0 -4px 15px rgba(255,210,26,0.4));
      }
      50% {
        filter: drop-shadow(0 0 16px rgba(255,210,26,1))
                drop-shadow(0 0 30px rgba(255,68,0,0.7))
                drop-shadow(0 -8px 25px rgba(255,210,26,0.6));
      }
    }

    /* Fire effect behind MVP truck */
    .mvp-fire {
      position: absolute;
      inset: -20% -15% -10% -15%;
      background:
        radial-gradient(ellipse at 50% 80%, rgba(255,68,0,0.4) 0%, transparent 60%),
        radial-gradient(ellipse at 40% 70%, rgba(255,210,26,0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 60% 75%, rgba(255,107,26,0.35) 0%, transparent 55%);
      animation: fireFlicker 1.2s ease-in-out infinite alternate;
      pointer-events: none;
      border-radius: 50%;
    }

    @keyframes fireFlicker {
      0% { opacity: 0.7; transform: scaleY(1) scaleX(1); }
      33% { opacity: 0.9; transform: scaleY(1.08) scaleX(0.96); }
      66% { opacity: 0.75; transform: scaleY(1.04) scaleX(1.02); }
      100% { opacity: 0.85; transform: scaleY(1.1) scaleX(0.98); }
    }

    /* Crown emoji above MVP */
    .mvp-crown {
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      font-size: clamp(22px, 3.5vw, 36px);
      animation: crownBob 2s ease-in-out infinite;
      filter: drop-shadow(0 2px 6px rgba(255,170,0,0.8));
    }

    @keyframes crownBob {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-5px); }
    }

    /* Truck name below image */
    .podium-name {
      font-family: var(--font-heading);
      font-size: clamp(9px, 1.3vw, 13px);
      color: var(--chrome);
      letter-spacing: 0.5px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin-top: 1px;
    }

    .podium-slot--mvp .podium-name {
      color: #ffd21a;
      text-shadow: 0 0 8px rgba(255,170,0,0.5);
    }

    /* Pedestal base — minimal */
    .podium-base {
      width: 100%;
      display: flex;
      justify-content: center;
      padding: 2px 0;
    }

    .podium-round {
      font-family: var(--font-body);
      font-size: 9px;
      color: var(--chrome-dark);
      letter-spacing: 1px;
    }

    /* ---- Bottom Area ---- */
    .results-bottom {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      max-width: 960px;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
      padding-top: 2px;
    }

    /* Damage totals */
    .results-totals {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-shrink: 0;
    }

    .results-total {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--bg-surface);
    }

    .results-total__label {
      font-family: var(--font-body);
      font-size: 8px;
      color: var(--chrome-dark);
      letter-spacing: 1px;
    }

    .results-total__value {
      font-family: var(--font-heading);
      font-size: 14px;
    }

    .results-total--green .results-total__value { color: var(--neon-green); }
    .results-total--red .results-total__value { color: var(--fire-red); }

    /* Round summary */
    .round-summary {
      flex: 1;
      display: flex;
      gap: 3px;
      min-width: 0;
      overflow: hidden;
    }

    .round-line {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2px 3px;
      border-radius: 4px;
      background: var(--bg-surface);
      opacity: 0.6;
      min-width: 0;
    }

    .round-line--win { border-top: 2px solid var(--neon-green); }
    .round-line--lose { border-top: 2px solid var(--fire-red); }

    .round-line__r {
      font-family: var(--font-heading);
      font-size: 9px;
      color: var(--chrome-dark);
    }

    .round-line__vs {
      font-family: var(--font-body);
      font-size: 7px;
      color: var(--chrome-dark);
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      text-align: center;
    }

    .round-line__dmg {
      font-family: var(--font-heading);
      font-size: 9px;
      display: flex;
      gap: 2px;
      align-items: center;
    }

    .round-line__dealt { color: var(--neon-green); }
    .round-line__sep { color: var(--chrome-dark); font-size: 7px; }
    .round-line__taken { color: var(--fire-red); }

    .round-line__out {
      font-family: var(--font-heading);
      font-size: 9px;
    }

    .round-line--win .round-line__out { color: var(--neon-green); }
    .round-line--lose .round-line__out { color: var(--fire-red); }

    /* Play again button */
    .play-again-btn {
      position: relative;
      z-index: 1;
      font-size: clamp(14px, 2.5vw, 22px);
      padding: 10px 28px;
      flex-shrink: 0;
      animation: buttonPulse 2s ease-in-out infinite;
    }

    .results-exit {
      animation: screenSlideOut 0.4s ease forwards;
      pointer-events: none;
    }

    /* Small screen */
    @media (max-height: 400px) {
      .results-content { padding: 2px 8px; }
      .results-verdict { font-size: 22px; }
      .results-score { font-size: 20px; }
      .podium-truck { width: 80px; height: 64px; }
      .mvp-crown { font-size: 16px; top: -14px; }
      .podium-name { font-size: 8px; }
      .play-again-btn { padding: 8px 20px; }
      .podium-dot { width: 8px; height: 8px; }
    }
  `;
  document.head.appendChild(style);
}
