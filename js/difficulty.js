// ============================================
// MONSTER SMASH - Difficulty Configuration
// Easy / Medium / Hard tuning for all game systems
// ============================================

const CONFIGS = {
  easy: {
    label: 'EASY',
    sweetSpotScale: 1.0,
    chargeTimeout: 3.5,
    aiPowerMin: 0.5,
    aiPowerMax: 0.8,
    aiAbilityChance: 0.3,
    aiCritBonus: 0,
    computerTeamNoise: 1.5,
  },
  medium: {
    label: 'MEDIUM',
    sweetSpotScale: 0.75,
    chargeTimeout: 2.8,
    aiPowerMin: 0.65,
    aiPowerMax: 0.92,
    aiAbilityChance: 0.55,
    aiCritBonus: 0.05,
    computerTeamNoise: 1.0,
  },
  hard: {
    label: 'HARD',
    sweetSpotScale: 0.55,
    chargeTimeout: 2.2,
    aiPowerMin: 0.75,
    aiPowerMax: 1.0,
    aiAbilityChance: 0.8,
    aiCritBonus: 0.10,
    computerTeamNoise: 0.5,
  },
};

let currentDifficulty = 'easy';

export function setDifficulty(level) {
  if (CONFIGS[level]) {
    currentDifficulty = level;
  }
}

export function getDifficulty() {
  return CONFIGS[currentDifficulty];
}

export function getDifficultyLevel() {
  return currentDifficulty;
}
