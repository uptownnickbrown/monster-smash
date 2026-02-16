// ============================================
// MONSTER SMASH - Main Entry Point
// Screen management and initialization
// ============================================

import { getState, setState, onStateChange } from './game-state.js';
import { createTitleScreen, destroyTitleScreen } from './screens/title-screen.js';
import { initAudio, unlockAudio } from './audio/sound-manager.js';

const gameContainer = document.getElementById('game');
let currentScreen = null;

// Screen factory map - screens are lazily loaded
const screenFactories = {
  'title': {
    create: (container) => createTitleScreen(container),
    destroy: () => destroyTitleScreen(),
  },
  'team-select': {
    create: async (container) => {
      const { createTeamSelectScreen } = await import('./screens/team-select.js');
      return createTeamSelectScreen(container);
    },
    destroy: async () => {
      const { destroyTeamSelectScreen } = await import('./screens/team-select.js');
      destroyTeamSelectScreen();
    },
  },
  'battle': {
    create: async (container) => {
      const { createBattleScreen } = await import('./screens/battle-screen.js');
      return createBattleScreen(container);
    },
    destroy: async () => {
      const { destroyBattleScreen } = await import('./screens/battle-screen.js');
      destroyBattleScreen();
    },
  },
  'results': {
    create: async (container) => {
      const { createResultsScreen } = await import('./screens/results-screen.js');
      return createResultsScreen(container);
    },
    destroy: async () => {
      const { destroyResultsScreen } = await import('./screens/results-screen.js');
      destroyResultsScreen();
    },
  },
};

// Switch between screens
async function switchScreen(newScreen) {
  // Destroy current screen
  if (currentScreen && screenFactories[currentScreen]) {
    await screenFactories[currentScreen].destroy();
  }

  // Clear container
  gameContainer.innerHTML = '';

  // Create new screen
  currentScreen = newScreen;
  if (screenFactories[newScreen]) {
    await screenFactories[newScreen].create(gameContainer);
  }
}

// Listen for state changes
onStateChange((state) => {
  if (state.screen !== currentScreen) {
    switchScreen(state.screen);
  }
});

// ---- Initialization ----
async function init() {
  console.log('%c MONSTER SMASH! %c Game initializing...',
    'background: #ff6b1a; color: #fff; font-size: 16px; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
    'color: #ff6b1a; font-size: 12px;'
  );

  // Initialize audio (will be unlocked on first tap)
  initAudio();
  document.addEventListener('pointerdown', () => {
    unlockAudio();
  }, { once: false });

  // Show title screen immediately
  switchScreen('title');

  // Load truck data in the background
  try {
    const { loadAllTrucks } = await import('./trucks/truck-loader.js');
    const trucks = await loadAllTrucks();
    setState({ allTrucks: trucks, isLoading: false });
    console.log(`%c Loaded ${trucks.length} monster trucks!`, 'color: #39ff14; font-size: 12px;');
  } catch (err) {
    console.warn('Truck data not loaded yet (Phase 2):', err.message);
    setState({ isLoading: false });
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
