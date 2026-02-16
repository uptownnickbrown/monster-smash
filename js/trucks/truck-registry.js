// ============================================
// MONSTER SMASH - Truck Registry
// Indexes loaded trucks, provides lookup/filter
// ============================================

let allTrucks = [];
const trucksById = new Map();

export function registerTrucks(trucks) {
  allTrucks = [...trucks];
  trucksById.clear();
  trucks.forEach(truck => trucksById.set(truck.id, truck));
}

export function getAll() {
  return allTrucks;
}

export function getById(id) {
  return trucksById.get(id);
}

export function getByRarity(rarity) {
  return allTrucks.filter(t => t.rarity === rarity);
}

export function getRandom(count, exclude = []) {
  const excludeSet = new Set(exclude.map(t => typeof t === 'string' ? t : t.id));
  const available = allTrucks.filter(t => !excludeSet.has(t.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Pick computer team that roughly matches the player's team rarity
export function pickComputerTeam(playerTeam) {
  const excludeIds = new Set(playerTeam.map(t => t.id));
  const available = allTrucks.filter(t => !excludeIds.has(t.id));

  // Calculate player team's average rarity level
  const rarityValues = { common: 1, rare: 2, epic: 3, legendary: 4 };
  const playerAvgRarity = playerTeam.reduce(
    (sum, t) => sum + (rarityValues[t.rarity] || 1), 0
  ) / playerTeam.length;

  // Sort available trucks by how close their rarity is to player average
  // Add some randomness so it's not always the same
  const scored = available.map(t => ({
    truck: t,
    score: Math.abs((rarityValues[t.rarity] || 1) - playerAvgRarity) + Math.random() * 1.5,
  }));

  scored.sort((a, b) => a.score - b.score);

  // Take the best 5 matches, then shuffle their order
  const team = scored.slice(0, 5).map(s => s.truck);
  return team.sort(() => Math.random() - 0.5);
}

export function getTruckCount() {
  return allTrucks.length;
}

export function getSortedByRarity() {
  const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
  return [...allTrucks].sort((a, b) => {
    const diff = (order[a.rarity] ?? 4) - (order[b.rarity] ?? 4);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}
