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
  const mvpIndex = playerWins > 0 ? findMVP(results) : -1;

  // Build podium trucks — all 5 rounds, showing the winner of each
  const podiumTrucks = results.map((r, i) => {
    const won = r.winner === 'player';
    const winnerTruck = won ? r.playerTruck : r.computerTruck;
    const imgSrc = renderTruckToImage(winnerTruck, 160, 128);
    const isMVP = i === mvpIndex;

    return `
      <div class="podium-slot ${won ? 'podium-slot--win' : 'podium-slot--lose'} ${isMVP ? 'podium-slot--mvp' : ''}"
           style="animation-delay: ${i * 0.12}s">
        <div class="podium-truck ${isMVP ? 'podium-truck--mvp' : ''}">
          ${isMVP ? '<div class="mvp-fire"></div>' : ''}
          <img src="${imgSrc}" alt="${winnerTruck.name}" draggable="false" />
          ${isMVP ? '<div class="mvp-crown">&#x1F451;</div>' : ''}
        </div>
        <div class="podium-name">${winnerTruck.name}</div>
        <div class="podium-base">
          <span class="podium-round">R${i + 1}</span>
          <span class="podium-result">${won ? 'WIN' : 'LOSS'}</span>
        </div>
      </div>
    `;
  }).join('');

  // Compact round summary for the bottom
  const roundSummary = results.map((r, i) => {
    const won = r.winner === 'player';
    return `
      <div class="round-line ${won ? 'round-line--win' : 'round-line--lose'}">
        <span class="round-line__r">R${i + 1}</span>
        <span class="round-line__vs">${r.playerTruck.name} vs ${r.computerTruck.name}</span>
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
      padding: 8px 16px;
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

    /* Header — compact */
    .results-header {
      text-align: center;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

    .results-verdict {
      font-family: var(--font-display);
      font-size: clamp(28px, 6vw, 56px);
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
      font-size: clamp(28px, 5vw, 44px);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 2px 0;
    }

    .results-score-player { color: var(--neon-green); }
    .results-score-divider { color: var(--chrome-dark); font-size: 0.7em; }
    .results-score-computer { color: var(--fire-red); }

    /* ---- Podium Row ---- */
    .podium-row {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: clamp(6px, 1.5vw, 16px);
      flex: 1;
      min-height: 0;
      width: 100%;
      max-width: 900px;
      position: relative;
      z-index: 1;
      padding: 0 8px;
    }

    .podium-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      max-width: 160px;
      opacity: 0;
      animation: podiumReveal 0.5s ease forwards;
    }

    @keyframes podiumReveal {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    /* Truck image container */
    .podium-truck {
      position: relative;
      width: clamp(80px, 15vw, 140px);
      height: clamp(64px, 12vw, 112px);
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
      0% {
        opacity: 0.7;
        transform: scaleY(1) scaleX(1);
      }
      33% {
        opacity: 0.9;
        transform: scaleY(1.08) scaleX(0.96);
      }
      66% {
        opacity: 0.75;
        transform: scaleY(1.04) scaleX(1.02);
      }
      100% {
        opacity: 0.85;
        transform: scaleY(1.1) scaleX(0.98);
      }
    }

    /* Crown emoji above MVP */
    .mvp-crown {
      position: absolute;
      top: -18px;
      left: 50%;
      transform: translateX(-50%);
      font-size: clamp(20px, 3vw, 32px);
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
      margin-top: 2px;
    }

    .podium-slot--mvp .podium-name {
      color: #ffd21a;
      text-shadow: 0 0 8px rgba(255,170,0,0.5);
    }

    /* Pedestal base */
    .podium-base {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 0 6px;
      border-radius: 0 0 6px 6px;
      margin-top: 2px;
    }

    .podium-slot--win .podium-base {
      background: linear-gradient(180deg, #1a3a1a, #0d200d);
      border: 1px solid rgba(57,255,20,0.3);
      border-top: 2px solid rgba(57,255,20,0.5);
    }

    .podium-slot--lose .podium-base {
      background: linear-gradient(180deg, #3a1a1a, #200d0d);
      border: 1px solid rgba(255,45,45,0.3);
      border-top: 2px solid rgba(255,45,45,0.5);
    }

    .podium-slot--mvp .podium-base {
      background: linear-gradient(180deg, #3a2a0a, #201a05);
      border: 1px solid rgba(255,170,0,0.4);
      border-top: 2px solid rgba(255,210,26,0.6);
      box-shadow: 0 0 12px rgba(255,170,0,0.2);
    }

    .podium-round {
      font-family: var(--font-body);
      font-size: 9px;
      color: var(--chrome-dark);
      letter-spacing: 1px;
    }

    .podium-result {
      font-family: var(--font-heading);
      font-size: clamp(11px, 1.5vw, 14px);
      letter-spacing: 1px;
    }

    .podium-slot--win .podium-result { color: var(--neon-green); }
    .podium-slot--lose .podium-result { color: var(--fire-red); }
    .podium-slot--mvp .podium-result { color: #ffd21a; }

    /* ---- Bottom Area: round summary + play again ---- */
    .results-bottom {
      display: flex;
      align-items: center;
      gap: 16px;
      width: 100%;
      max-width: 900px;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
      padding-top: 4px;
    }

    .round-summary {
      flex: 1;
      display: flex;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
    }

    .round-line {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3px 4px;
      border-radius: 4px;
      background: var(--bg-surface);
      opacity: 0.6;
      min-width: 0;
    }

    .round-line--win { border-top: 2px solid var(--neon-green); }
    .round-line--lose { border-top: 2px solid var(--fire-red); }

    .round-line__r {
      font-family: var(--font-heading);
      font-size: 10px;
      color: var(--chrome-dark);
    }

    .round-line__vs {
      font-family: var(--font-body);
      font-size: 8px;
      color: var(--chrome-dark);
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      text-align: center;
    }

    .round-line__out {
      font-family: var(--font-heading);
      font-size: 10px;
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
      .results-content { padding: 4px 10px; }
      .results-verdict { font-size: 24px; }
      .results-score { font-size: 22px; margin: 0; }
      .podium-truck { width: 70px; height: 56px; }
      .mvp-crown { font-size: 16px; top: -14px; }
      .podium-name { font-size: 8px; }
      .play-again-btn { padding: 8px 20px; }
    }
  `;
  document.head.appendChild(style);
}
