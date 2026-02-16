// ============================================
// MONSTER SMASH - Results Screen
// Winner display, stats breakdown, play again
// ============================================

import { getState, setState, resetBattle } from '../game-state.js';
import { el } from '../utils/dom-utils.js';

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
      setState({ screen: 'team-select' });
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

function getResultsHTML(results, playerWins, computerWins, isVictory) {
  const totalPlayerDamage = results.reduce((sum, r) => sum + (r.computerDamage || 0), 0);
  const totalComputerDamage = results.reduce((sum, r) => sum + (r.playerDamage || 0), 0);

  const roundBreakdown = results.map((r, i) => {
    const won = r.winner === 'player';
    return `
      <div class="result-round ${won ? 'result-round--win' : 'result-round--lose'}">
        <span class="result-round__num">R${i + 1}</span>
        <span class="result-round__trucks">${r.playerTruck.name} vs ${r.computerTruck.name}</span>
        <span class="result-round__outcome">${won ? 'WIN' : 'LOSS'}</span>
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
        <div class="results-subtitle">
          ${isVictory ? 'Your monster trucks crushed the competition!' : 'The computer got lucky this time!'}
        </div>
      </div>

      <div class="results-stats">
        <div class="results-stat">
          <span class="results-stat__label">YOUR DAMAGE</span>
          <span class="results-stat__value results-stat__value--green">${totalPlayerDamage}</span>
        </div>
        <div class="results-stat">
          <span class="results-stat__label">DAMAGE TAKEN</span>
          <span class="results-stat__value results-stat__value--red">${totalComputerDamage}</span>
        </div>
        <div class="results-stat">
          <span class="results-stat__label">ROUNDS WON</span>
          <span class="results-stat__value">${playerWins}/5</span>
        </div>
      </div>

      <div class="results-rounds scroll-area">
        ${roundBreakdown}
      </div>

      <button class="btn btn-fire play-again-btn">
        <span>&#x1F504; PLAY AGAIN!</span>
      </button>
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
      padding: 16px 24px;
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

    /* Header */
    .results-header {
      text-align: center;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

    .results-verdict {
      font-family: var(--font-display);
      font-size: clamp(36px, 8vw, 72px);
      letter-spacing: 4px;
      line-height: 1;
    }

    .results-verdict--win {
      background: linear-gradient(135deg, var(--neon-green), #00ff88, #39ff14);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 4px 0 rgba(0, 80, 0, 0.5));
      animation: victoryBounce 1s ease 0.5s;
    }

    .results-verdict--lose {
      background: linear-gradient(135deg, var(--fire-red), var(--fire-orange), var(--fire-yellow));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 4px 0 rgba(100, 0, 0, 0.5));
    }

    .results-score {
      font-family: var(--font-heading);
      font-size: clamp(40px, 7vw, 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 8px 0;
    }

    .results-score-player { color: var(--neon-green); }
    .results-score-divider { color: var(--chrome-dark); font-size: 0.7em; }
    .results-score-computer { color: var(--fire-red); }

    .results-subtitle {
      font-family: var(--font-accent);
      font-size: clamp(12px, 2vw, 18px);
      color: var(--chrome);
      letter-spacing: 2px;
    }

    /* Stats */
    .results-stats {
      display: flex;
      gap: 20px;
      margin: 12px 0;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }

    .results-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 16px;
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
      border: 1px solid var(--steel);
      min-width: 100px;
    }

    .results-stat__label {
      font-family: var(--font-body);
      font-size: 9px;
      color: var(--chrome-dark);
      letter-spacing: 1px;
    }

    .results-stat__value {
      font-family: var(--font-heading);
      font-size: 28px;
      color: var(--chrome-bright);
    }

    .results-stat__value--green { color: var(--neon-green); }
    .results-stat__value--red { color: var(--fire-red); }

    /* Round breakdown */
    .results-rounds {
      flex: 1;
      min-height: 0;
      width: 100%;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 8px 0;
      position: relative;
      z-index: 1;
    }

    .result-round {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 12px;
      background: var(--bg-surface);
    }

    .result-round--win {
      border-left: 3px solid var(--neon-green);
    }

    .result-round--lose {
      border-left: 3px solid var(--fire-red);
    }

    .result-round__num {
      font-family: var(--font-heading);
      font-size: 14px;
      color: var(--chrome-dark);
      width: 30px;
    }

    .result-round__trucks {
      flex: 1;
      color: var(--chrome);
      letter-spacing: 0.5px;
    }

    .result-round__outcome {
      font-family: var(--font-heading);
      font-size: 14px;
      letter-spacing: 1px;
    }

    .result-round--win .result-round__outcome {
      color: var(--neon-green);
    }

    .result-round--lose .result-round__outcome {
      color: var(--fire-red);
    }

    /* Play again button */
    .play-again-btn {
      position: relative;
      z-index: 1;
      font-size: clamp(18px, 3vw, 26px);
      padding: 14px 40px;
      flex-shrink: 0;
      animation: buttonPulse 2s ease-in-out infinite;
    }

    .results-exit {
      animation: screenSlideOut 0.4s ease forwards;
      pointer-events: none;
    }

    /* Small screen */
    @media (max-height: 450px) {
      .results-content { padding: 8px 16px; }
      .results-verdict { font-size: 32px; }
      .results-score { font-size: 36px; margin: 4px 0; }
      .results-stats { gap: 10px; margin: 6px 0; }
      .results-stat { padding: 4px 10px; min-width: 80px; }
      .results-stat__value { font-size: 22px; }
      .play-again-btn { padding: 10px 30px; }
    }
  `;
  document.head.appendChild(style);
}
