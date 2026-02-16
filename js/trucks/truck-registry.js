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

  // Weight higher rarities so they show up more often in draft picks.
  // Without this, legendaries (4 trucks) almost never appear vs commons (14).
  const rarityWeight = { legendary: 5, epic: 3, rare: 1.5, common: 1 };
  const weighted = available.map(t => ({
    truck: t,
    weight: rarityWeight[t.rarity] || 1,
  }));

  const picked = [];
  for (let i = 0; i < count && weighted.length > 0; i++) {
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    let idx = 0;
    for (idx = 0; idx < weighted.length; idx++) {
      roll -= weighted[idx].weight;
      if (roll <= 0) break;
    }
    picked.push(weighted[idx].truck);
    weighted.splice(idx, 1);
  }
  return picked;
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
