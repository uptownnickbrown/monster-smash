// ============================================
// MONSTER SMASH - Draft-Style Team Selection
// Show 3 random trucks, pick 1, repeat 5 times
// ============================================

import { getState, setState } from '../game-state.js';
import { registerTrucks, getRandom, pickComputerTeam } from '../trucks/truck-registry.js';
import { createTruckCard } from '../components/truck-card.js';
import { el, clearElement, wait } from '../utils/dom-utils.js';

let screenEl = null;
let selectedTrucks = [];
let shownTruckIds = new Set();   // Track ALL trucks shown so far (no repeats)
let currentChoices = [];          // The 3 trucks currently offered
let draftRound = 0;
let pickLocked = false;         // Prevent double-picks during animation

const MAX_TEAM_SIZE = 5;
const CHOICES_PER_ROUND = 3;

export function createTeamSelectScreen(container) {
  const state = getState();
  selectedTrucks = [];
  shownTruckIds = new Set();
  currentChoices = [];
  draftRound = 0;
  pickLocked = false;

  // Register trucks if not yet done
  if (state.allTrucks.length > 0) {
    registerTrucks(state.allTrucks);
  }

  screenEl = el('div', { className: 'screen team-select-screen active' });
  screenEl.innerHTML = getTeamSelectHTML();

  injectTeamSelectStyles();
  container.appendChild(screenEl);

  // Start first draft round
  showDraftRound();

  return screenEl;
}

function showDraftRound() {
  if (draftRound >= MAX_TEAM_SIZE) {
    startBattle();
    return;
  }

  // Update header
  const title = screenEl.querySelector('.draft-title');
  const subtitle = screenEl.querySelector('.draft-subtitle');
  if (title) title.textContent = `PICK ${draftRound + 1} OF ${MAX_TEAM_SIZE}`;
  if (subtitle) subtitle.textContent = draftRound === 0
    ? 'Choose a monster truck for your team!'
    : `${MAX_TEAM_SIZE - draftRound} pick${MAX_TEAM_SIZE - draftRound > 1 ? 's' : ''} remaining!`;

  // Get 3 random trucks that haven't been shown yet
  const excludeList = [...shownTruckIds].map(id => id);
  currentChoices = getRandom(CHOICES_PER_ROUND, excludeList);

  // Track shown trucks
  currentChoices.forEach(t => shownTruckIds.add(t.id));

  // Populate the card area with 3 choices
  const grid = screenEl.querySelector('.draft-choices');
  clearElement(grid);

  currentChoices.forEach((truck, i) => {
    const card = createTruckCard(truck, {
      onSelect: () => handleDraftPick(truck),
      onDeselect: () => {},
      isSelected: false,
      dealDelay: i * 120,
    });
    card.classList.add('draft-card');
    grid.appendChild(card);
  });

  // Update the dock
  updateDock();
}

function handleDraftPick(truck) {
  if (pickLocked) return;
  pickLocked = true;
  selectedTrucks.push(truck);
  draftRound++;

  // Animate out current cards
  const cards = screenEl.querySelectorAll('.draft-card');
  cards.forEach((card, i) => {
    if (card._truck && card._truck.id === truck.id) {
      card.classList.add('draft-card--picked');
    } else {
      card.classList.add('draft-card--dismissed');
    }
  });

  updateDock();

  // Wait for animation, then show next round
  setTimeout(() => {
    pickLocked = false;
    if (draftRound >= MAX_TEAM_SIZE) {
      startBattle();
    } else {
      showDraftRound();
    }
  }, 600);
}

async function startBattle() {
  // Pick computer team
  const computerTeam = pickComputerTeam(selectedTrucks);

  setState({
    playerTeam: [...selectedTrucks],
    computerTeam,
    currentRound: 0,
    roundResults: [],
  });

  // Show "READY TO BATTLE!" briefly
  const title = screenEl.querySelector('.draft-title');
  if (title) {
    title.textContent = 'READY TO BATTLE!';
    title.style.color = 'var(--neon-green)';
  }

  screenEl.classList.add('team-select-exit');
  await wait(600);
  setState({ screen: 'battle' });
}

function updateDock() {
  const slots = screenEl.querySelectorAll('.dock-slot');
  slots.forEach((slot, i) => {
    if (i < selectedTrucks.length) {
      const truck = selectedTrucks[i];
      slot.className = 'dock-slot dock-slot--filled';
      slot.innerHTML = `
        <div class="dock-slot__name">${truck.name}</div>
        <div class="dock-slot__rarity" style="color: ${getRarityColor(truck.rarity)}">${truck.rarity.toUpperCase()}</div>
      `;
      slot.style.borderColor = getRarityColor(truck.rarity);
    } else if (i === selectedTrucks.length) {
      // Next pick slot - highlighted
      slot.className = 'dock-slot dock-slot--next';
      slot.innerHTML = '<span class="dock-slot__question">?</span>';
      slot.style.borderColor = 'var(--fire-orange)';
    } else {
      slot.className = 'dock-slot dock-slot--empty';
      slot.innerHTML = '<span class="dock-slot__question">?</span>';
      slot.style.borderColor = '';
    }
  });
}

function getRarityColor(rarity) {
  const colors = {
    common: '#8a8d96',
    rare: '#4488ff',
    epic: '#b44aff',
    legendary: '#ffaa00',
  };
  return colors[rarity] || '#ffffff';
}

export function destroyTeamSelectScreen() {
  if (screenEl) {
    screenEl.remove();
    screenEl = null;
  }
  selectedTrucks = [];
  shownTruckIds = new Set();
  currentChoices = [];
}

function getTeamSelectHTML() {
  return `
    <div class="stadium-bg">
      <div class="ground-strip"></div>
    </div>

    <div class="team-select-content">
      <div class="draft-header">
        <h1 class="draft-title">PICK 1 OF ${MAX_TEAM_SIZE}</h1>
        <p class="draft-subtitle">Choose a monster truck for your team!</p>
      </div>

      <div class="draft-choices"></div>

      <div class="team-dock">
        <div class="dock-label">YOUR TEAM</div>
        <div class="dock-slots">
          <div class="dock-slot dock-slot--next"><span class="dock-slot__question">?</span></div>
          <div class="dock-slot dock-slot--empty"><span class="dock-slot__question">?</span></div>
          <div class="dock-slot dock-slot--empty"><span class="dock-slot__question">?</span></div>
          <div class="dock-slot dock-slot--empty"><span class="dock-slot__question">?</span></div>
          <div class="dock-slot dock-slot--empty"><span class="dock-slot__question">?</span></div>
        </div>
      </div>
    </div>
  `;
}

function injectTeamSelectStyles() {
  if (document.getElementById('team-select-styles')) return;

  const style = document.createElement('style');
  style.id = 'team-select-styles';
  style.textContent = `
    .team-select-screen {
      background: var(--bg-abyss);
    }

    .team-select-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 10px 16px;
    }

    /* Header */
    .draft-header {
      text-align: center;
      flex-shrink: 0;
      padding-bottom: 10px;
    }

    .draft-title {
      font-family: var(--font-heading);
      font-size: clamp(28px, 5vw, 42px);
      background: linear-gradient(135deg, var(--fire-yellow), var(--fire-orange), var(--fire-red));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 3px;
      text-shadow: none;
      transition: all 0.3s ease;
    }

    .draft-subtitle {
      font-family: var(--font-body);
      font-size: clamp(12px, 1.8vw, 16px);
      color: var(--chrome);
      letter-spacing: 2px;
      margin-top: 2px;
    }

    /* Draft choices - 3 cards in a row */
    .draft-choices {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: clamp(12px, 3vw, 24px);
      padding: 8px 0;
      min-height: 0;
    }

    .draft-card {
      flex: 0 1 280px;
      max-width: 280px;
      transition: all 0.4s ease;
      cursor: pointer;
    }

    .draft-card:hover {
      transform: translateY(-6px) scale(1.03);
      filter: brightness(1.15);
    }

    .draft-card:active {
      transform: scale(0.97);
    }

    .draft-card--picked {
      animation: draftPick 0.5s ease forwards;
    }

    .draft-card--dismissed {
      animation: draftDismiss 0.4s ease forwards;
    }

    @keyframes draftPick {
      0% { transform: scale(1); opacity: 1; }
      30% { transform: scale(1.1); opacity: 1; filter: brightness(1.5); }
      100% { transform: scale(0.8) translateY(30px); opacity: 0; }
    }

    @keyframes draftDismiss {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(0.7) translateY(20px); opacity: 0; filter: grayscale(1); }
    }

    /* Team dock */
    .team-dock {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: var(--bg-elevated);
      border-radius: var(--radius-lg);
      border: 1px solid var(--steel);
      margin-top: 4px;
    }

    .dock-label {
      font-family: var(--font-heading);
      font-size: 14px;
      color: var(--fire-orange);
      letter-spacing: 2px;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      flex-shrink: 0;
    }

    .dock-slots {
      display: flex;
      gap: 10px;
      flex: 1;
      justify-content: center;
    }

    .dock-slot {
      width: 90px;
      height: 55px;
      border-radius: var(--radius-sm);
      border: 2px dashed var(--steel);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .dock-slot--empty {
      background: rgba(255, 255, 255, 0.02);
    }

    .dock-slot--next {
      background: rgba(255, 107, 26, 0.08);
      border-style: dashed;
      border-color: var(--fire-orange);
      animation: buttonPulse 1.5s ease-in-out infinite;
    }

    .dock-slot__question {
      font-family: var(--font-heading);
      font-size: 24px;
      color: var(--steel);
    }

    .dock-slot--next .dock-slot__question {
      color: var(--fire-orange);
    }

    .dock-slot--filled {
      background: var(--bg-surface);
      border-style: solid;
      animation: cardSelect 0.3s ease;
    }

    .dock-slot__name {
      font-family: var(--font-heading);
      font-size: 10px;
      color: var(--chrome-bright);
      letter-spacing: 1px;
      text-align: center;
      line-height: 1.1;
      padding: 0 4px;
    }

    .dock-slot__rarity {
      font-family: var(--font-body);
      font-size: 7px;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    /* Exit */
    .team-select-exit {
      animation: screenSlideOut 0.4s ease forwards;
      pointer-events: none;
    }

    /* Responsive */
    @media (max-height: 450px) {
      .draft-header { padding-bottom: 4px; }
      .draft-title { font-size: 24px; }
      .draft-choices { gap: 10px; padding: 4px 0; }
      .draft-card { flex: 0 1 220px; max-width: 220px; }
      .team-dock { padding: 6px 10px; gap: 8px; }
      .dock-slot { width: 70px; height: 42px; }
    }
  `;
  document.head.appendChild(style);
}
