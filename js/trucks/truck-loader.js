// ============================================
// MONSTER SMASH - Truck Data Loader
// Fetches all truck JSON files
// ============================================

// Manifest of all truck file IDs
const TRUCK_IDS = [
  // Legendary (4)
  'grave-digger',
  'max-d',
  'henrys-hammer',
  'dark-matter',
  // Epic (10)
  'el-toro-loco',
  'megalodon',
  'zombie',
  'sparkle-smash',
  'dragons-breath',
  'earthshaker',
  'son-uva-digger',
  'cosmic-crusher',
  'shadow-phantom',
  // Rare (14)
  'blue-thunder',
  'monster-mutt',
  'avenger',
  'whiplash',
  'soldier-fortune',
  'jurassic-attack',
  'mohawk-warrior',
  'bakugan-dragonoid',
  'pirates-curse',
  'alien-invasion',
  'iron-titan',
  'lava-lord',
  'gold-rush',
  'arctic-wolf',
  'rocket-racer',
  // Common (12)
  'ice-cream-man',
  'scooby-doo',
  'crushstation',
  'thunder-fang',
  'nitro-blaze',
  'venom-strike',
  'storm-chaser',
  'frost-bite',
  'neon-nightmare',
  'wrecking-ball',
  'turbo-rex',
  'magma-core',
  'pixel-puncher',
  'chomper',
];

export async function loadAllTrucks() {
  const basePath = 'data/trucks/';

  const results = await Promise.allSettled(
    TRUCK_IDS.map(async (id) => {
      const response = await fetch(`${basePath}${id}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load truck: ${id} (${response.status})`);
      }
      return response.json();
    })
  );

  const trucks = [];
  const errors = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      trucks.push(result.value);
    } else {
      errors.push({ id: TRUCK_IDS[i], error: result.reason.message });
    }
  });

  if (errors.length > 0) {
    console.warn(`Failed to load ${errors.length} trucks:`, errors);
  }

  return trucks;
}

export async function loadRarityConfig() {
  const response = await fetch('data/rarity-config.json');
  return response.json();
}

export async function loadAbilitiesConfig() {
  const response = await fetch('data/abilities.json');
  return response.json();
}

export { TRUCK_IDS };
