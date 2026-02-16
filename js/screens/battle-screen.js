// ============================================
// MONSTER SMASH - Battle Screen
// Orchestrates 5 rounds of 1v1 battles
// ============================================

import { getState, setState } from '../game-state.js';
import { startBattle, stopBattle, activatePlayerAbility } from './battle-arena.js';
import { el, wait } from '../utils/dom-utils.js';

let screenEl = null;
let currentRound = 0;
let roundResults = [];
let playerTeam = [];
let computerTeam = [];

export function createBattleScreen(container) {
  const state = getState();
  playerTeam = state.playerTeam;
  computerTeam = state.computerTeam;
  currentRound = 0;
  roundResults = [];

  screenEl = el('div', { className: 'screen battle-screen active' });
  screenEl.innerHTML = getBattleScreenHTML();

  injectBattleScreenStyles();
  container.appendChild(screenEl);

  // Start first round (delay one frame so layout is computed)
  requestAnimationFrame(() => startNextRound());

  return screenEl;
}

async function startNextRound() {
  if (currentRound >= 5) {
    // All rounds done
    finishBattle();
    return;
  }

  const pTruck = playerTeam[currentRound];
  const eTruck = computerTeam[currentRound];

  // Update scoreboard
  updateScoreboard();

  // Update ability button
  updateAbilityButton(pTruck);

  // Start the battle arena
  startBattle(pTruck, eTruck, currentRound + 1, (result) => {
    // Round complete callback
    roundResults.push({
      winner: result.winner,
      playerTruck: pTruck,
      computerTruck: eTruck,
      playerDamage: result.playerDamage,
      computerDamage: result.computerDamage,
    });

    stopBattle();

    // Show round result overlay
    showRoundResult(result.winner, () => {
      currentRound++;
      if (currentRound >= 5) {
        finishBattle();
      } else {
        startNextRound();
      }
    });
  });
}

function showRoundResult(winner, onContinue) {
  const overlay = screenEl.querySelector('.round-result-overlay');
  if (!overlay) return;

  const isWin = winner === 'player';
  overlay.innerHTML = `
    <div class="round-result-text ${isWin ? 'round-result--win' : 'round-result--lose'}">
      ${isWin ? 'YOU WON THIS ROUND!' : 'YOU LOST THIS ROUND!'}
    </div>
    <div class="round-result-score">${getScoreText()}</div>
  `;
  overlay.classList.add('round-result-overlay--visible');

  setTimeout(() => {
    overlay.classList.remove('round-result-overlay--visible');
    setTimeout(onContinue, 300);
  }, 2000);
}

function getScoreText() {
  const playerWins = roundResults.filter(r => r.winner === 'player').length;
  const computerWins = roundResults.filter(r => r.winner === 'computer').length;
  return `YOU ${playerWins} - ${computerWins} COMPUTER`;
}

function updateScoreboard() {
  const scoreboard = screenEl.querySelector('.battle-scoreboard');
  if (!scoreboard) return;

  const playerWins = roundResults.filter(r => r.winner === 'player').length;
  const computerWins = roundResults.filter(r => r.winner === 'computer').length;

  scoreboard.innerHTML = `
    <div class="score-round">ROUND ${currentRound + 1} of 5</div>
    <div class="score-tally">
      <span class="score-player">YOU ${playerWins}</span>
      <span class="score-divider">-</span>
      <span class="score-computer">${computerWins} CPU</span>
    </div>
    <div class="score-dots">
      ${Array.from({ length: 5 }, (_, i) => {
        if (i < roundResults.length) {
          const won = roundResults[i].winner === 'player';
          return `<span class="score-dot ${won ? 'score-dot--win' : 'score-dot--lose'}"></span>`;
        }
        return `<span class="score-dot ${i === currentRound ? 'score-dot--current' : ''}"></span>`;
      }).join('')}
    </div>
  `;
}

function updateAbilityButton(truck) {
  const btn = screenEl.querySelector('.ability-btn');
  if (!btn || !truck.specialAbility) return;

  const ability = truck.specialAbility;
  const abilityIcon = getAbilityEmoji(ability.type);

  btn.innerHTML = `
    <span class="ability-btn__icon">${abilityIcon}</span>
    <span class="ability-btn__name">${ability.name}</span>
  `;
  btn.style.borderColor = truck.visual.glowColor || '#ffffff';
  btn.style.boxShadow = `0 0 15px ${truck.visual.glowColor || '#ffffff'}40`;
  btn.classList.remove('ability-btn--used');
  btn.disabled = false;

  // Remove old listener
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const success = activatePlayerAbility();
    if (success) {
      newBtn.classList.add('ability-btn--used');
      newBtn.disabled = true;
    }
  });
}

function finishBattle() {
  const playerWins = roundResults.filter(r => r.winner === 'player').length;

  setState({
    roundResults,
    currentRound: 5,
  });

  // Short delay then go to results
  setTimeout(() => {
    setState({ screen: 'results' });
  }, 500);
}

function getAbilityEmoji(type) {
  const icons = {
    'damage-boost': '💥', 'direct-damage': '⚡', 'heal': '💚',
    'shield-boost': '🛡️', 'speed-boost': '🚀', 'stun': '⚡',
    'burn': '🔥', 'pierce': '🗡️', 'multi-hit': '💫',
    'dodge': '👻', 'steal': '🦷', 'random': '🎲',
  };
  return icons[type] || '✨';
}

export function destroyBattleScreen() {
  stopBattle();
  if (screenEl) {
    screenEl.remove();
    screenEl = null;
  }
}

function getBattleScreenHTML() {
  return `
    <div class="battle-hud">
      <div class="battle-scoreboard"></div>
    </div>

    <div id="battle-canvas-container" class="battle-canvas-container"></div>

    <div class="battle-controls">
      <button class="ability-btn" type="button">
        <span class="ability-btn__icon">✨</span>
        <span class="ability-btn__name">ABILITY</span>
      </button>
    </div>

    <div class="round-result-overlay"></div>
  `;
}

function injectBattleScreenStyles() {
  if (document.getElementById('battle-screen-styles')) return;

  const style = document.createElement('style');
  style.id = 'battle-screen-styles';
  style.textContent = `
    .battle-screen {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      background: #0a0a0f;
    }

    .battle-hud {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      padding: 8px 16px;
      pointer-events: none;
    }

    .battle-scoreboard {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .score-round {
      font-family: var(--font-body);
      font-size: 12px;
      color: var(--chrome-dark);
      letter-spacing: 2px;
    }

    .score-tally {
      font-family: var(--font-heading);
      font-size: 20px;
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .score-player { color: var(--neon-green); }
    .score-divider { color: var(--chrome-dark); }
    .score-computer { color: var(--fire-red); }

    .score-dots {
      display: flex;
      gap: 6px;
      margin-top: 2px;
    }

    .score-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--steel);
      border: 1px solid var(--chrome-dark);
    }

    .score-dot--win {
      background: var(--neon-green);
      border-color: var(--neon-green);
      box-shadow: 0 0 6px var(--neon-green);
    }

    .score-dot--lose {
      background: var(--fire-red);
      border-color: var(--fire-red);
      box-shadow: 0 0 6px var(--fire-red);
    }

    .score-dot--current {
      border-color: var(--fire-yellow);
      animation: buttonPulse 1.5s ease-in-out infinite;
    }

    /* Canvas container */
    .battle-canvas-container {
      flex: 1;
      width: 100%;
      position: relative;
      overflow: hidden;
      min-height: 0;
    }

    /* Controls */
    .battle-controls {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
    }

    .ability-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 32px;
      background: linear-gradient(180deg, rgba(40, 40, 60, 0.95), rgba(20, 20, 35, 0.95));
      border: 3px solid var(--fire-orange);
      border-radius: 16px;
      color: var(--chrome-bright);
      font-family: var(--font-heading);
      font-size: 20px;
      letter-spacing: 2px;
      cursor: pointer;
      touch-action: manipulation;
      min-height: 60px;
      min-width: 180px;
      transition: all 0.2s ease;
      box-shadow: 0 0 20px rgba(255, 107, 26, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      animation: abilityPulse 2s ease-in-out infinite;
    }

    @keyframes abilityPulse {
      0%, 100% { box-shadow: 0 0 20px rgba(255, 107, 26, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1); }
      50% { box-shadow: 0 0 35px rgba(255, 107, 26, 0.7), 0 0 60px rgba(255, 107, 26, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1); }
    }

    .ability-btn:active {
      transform: scale(0.92);
      filter: brightness(1.4);
    }

    .ability-btn__icon {
      font-size: 28px;
    }

    .ability-btn--used {
      opacity: 0.3;
      pointer-events: none;
      filter: grayscale(1);
      animation: none;
      box-shadow: none;
    }

    /* Round result overlay */
    .round-result-overlay {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .round-result-overlay--visible {
      opacity: 1;
    }

    .round-result-text {
      font-family: var(--font-heading);
      font-size: clamp(28px, 5vw, 48px);
      letter-spacing: 3px;
      text-shadow: 0 4px 0 rgba(0, 0, 0, 0.5);
    }

    .round-result--win {
      color: var(--neon-green);
      text-shadow: 0 0 20px var(--neon-green), 0 4px 0 rgba(0, 0, 0, 0.5);
    }

    .round-result--lose {
      color: var(--fire-red);
      text-shadow: 0 0 20px var(--fire-red), 0 4px 0 rgba(0, 0, 0, 0.5);
    }

    .round-result-score {
      font-family: var(--font-body);
      font-size: clamp(14px, 2vw, 20px);
      color: var(--chrome);
      letter-spacing: 2px;
      margin-top: 10px;
    }
  `;
  document.head.appendChild(style);
}
