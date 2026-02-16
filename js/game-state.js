// ============================================
// MONSTER SMASH - Game State Manager
// Simple observer pattern for screen transitions
// ============================================

const state = {
  screen: 'title',          // 'title' | 'team-select' | 'battle' | 'results'
  allTrucks: [],             // loaded from JSON
  playerTeam: [],            // 5 selected trucks
  computerTeam: [],          // 5 randomly selected trucks
  currentRound: 0,           // 0-4
  roundResults: [],          // [{winner, playerTruck, computerTruck, playerDamage, computerDamage}]
  battleState: null,         // sub-state for active battle
  isLoading: true,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(partial) {
  Object.assign(state, partial);
  listeners.forEach(fn => fn(state));
}

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetBattle() {
  setState({
    playerTeam: [],
    computerTeam: [],
    currentRound: 0,
    roundResults: [],
    battleState: null,
  });
}

export function resetGame() {
  setState({
    screen: 'title',
    playerTeam: [],
    computerTeam: [],
    currentRound: 0,
    roundResults: [],
    battleState: null,
  });
}
