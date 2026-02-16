// ============================================
// MONSTER SMASH - Truck Card Component
// DOM card for team selection grid
// ============================================

import { el } from '../utils/dom-utils.js';
import { createStatBar, injectStatBarStyles } from './stat-bar.js';
import { renderTruckToCanvas } from '../trucks/truck-renderer.js';

const RARITY_CONFIG = {
  common:    { color: '#8a8d96', label: 'COMMON',    glow: 'none' },
  rare:      { color: '#4488ff', label: 'RARE',      glow: '0 0 10px rgba(68, 136, 255, 0.3)' },
  epic:      { color: '#b44aff', label: 'EPIC',      glow: '0 0 15px rgba(180, 74, 255, 0.4)' },
  legendary: { color: '#ffaa00', label: 'LEGENDARY',  glow: '0 0 20px rgba(255, 170, 0, 0.5)' },
};

export function createTruckCard(truck, { onSelect, onDeselect, isSelected = false, dealDelay = 0 }) {
  injectStatBarStyles();
  injectCardStyles();

  const rarity = RARITY_CONFIG[truck.rarity] || RARITY_CONFIG.common;

  const card = el('div', {
    className: `truck-card truck-card--${truck.rarity}${isSelected ? ' truck-card--selected' : ''}`,
    dataset: { truckId: truck.id },
    style: {
      animationDelay: dealDelay + 'ms',
      '--rarity-color': rarity.color,
      '--rarity-glow': rarity.glow,
    },
  });

  // Card inner content
  card.innerHTML = `
    <div class="truck-card__preview">
      <canvas class="truck-card__canvas" width="200" height="130"></canvas>
      <div class="truck-card__rarity-badge" style="background: ${rarity.color}">${rarity.label}</div>
      ${truck.id === 'henrys-hammer' ? '<div class="truck-card__special-badge">HENRY\'S PICK!</div>' : ''}
      <div class="truck-card__selected-check">&#x2713;</div>
    </div>
    <div class="truck-card__info">
      <div class="truck-card__name">${truck.name}</div>
      <div class="truck-card__tagline">${truck.tagline || ''}</div>
      <div class="truck-card__stats"></div>
      <div class="truck-card__ability">
        <span class="truck-card__ability-icon">${getAbilityIcon(truck.specialAbility?.type)}</span>
        <span class="truck-card__ability-name">${truck.specialAbility?.name || 'None'}</span>
      </div>
    </div>
  `;

  // Render truck onto the canvas
  const canvas = card.querySelector('.truck-card__canvas');
  const ctx = canvas.getContext('2d');
  try {
    renderTruckToCanvas(ctx, truck, 200, 130);
  } catch (e) {
    // Fallback if renderer errors
    ctx.fillStyle = truck.visual?.primaryColor || '#666';
    ctx.fillRect(40, 30, 120, 60);
  }

  // Add stat bars (4 core stats — airTime is hidden, it's just a physics modifier)
  const statsContainer = card.querySelector('.truck-card__stats');
  const statOrder = ['smashDamage', 'speed', 'shield', 'weight'];
  statOrder.forEach(stat => {
    const value = truck.stats?.[stat] || 0;
    statsContainer.appendChild(createStatBar(stat, value));
  });

  // Click handler
  let selected = isSelected;
  card.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (selected) {
      selected = false;
      card.classList.remove('truck-card--selected');
      if (onDeselect) onDeselect(truck);
    } else {
      selected = true;
      card.classList.add('truck-card--selected');
      card.classList.add('truck-card--bounce');
      setTimeout(() => card.classList.remove('truck-card--bounce'), 300);
      if (onSelect) onSelect(truck);
    }
  });

  // Public API
  card._truck = truck;
  card._setSelected = (val) => {
    selected = val;
    card.classList.toggle('truck-card--selected', val);
  };

  return card;
}

function getAbilityIcon(type) {
  const icons = {
    'damage-boost': '💥',
    'direct-damage': '⚡',
    'heal': '💚',
    'shield-boost': '🛡️',
    'speed-boost': '🚀',
    'stun': '⚡',
    'burn': '🔥',
    'pierce': '🗡️',
    'multi-hit': '💫',
    'dodge': '👻',
    'steal': '🦷',
    'random': '🎲',
  };
  return icons[type] || '✨';
}

function injectCardStyles() {
  if (document.getElementById('truck-card-styles')) return;

  const style = document.createElement('style');
  style.id = 'truck-card-styles';
  style.textContent = `
    .truck-card {
      position: relative;
      width: 100%;
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
      border: 2px solid var(--steel);
      overflow: hidden;
      cursor: pointer;
      touch-action: manipulation;
      opacity: 0;
      animation: cardDeal 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: var(--deal-delay, 0ms);
      transition: transform 0.15s ease, border-color 0.2s ease;
    }

    .truck-card:active {
      transform: scale(0.97);
    }

    .truck-card--rare {
      border-color: rgba(68, 136, 255, 0.4);
    }
    .truck-card--epic {
      border-color: rgba(180, 74, 255, 0.4);
      animation: cardDeal 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards,
                 epicPulse 3s ease-in-out 0.5s infinite;
    }
    .truck-card--legendary {
      border-color: rgba(255, 170, 0, 0.5);
      animation: cardDeal 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards,
                 legendaryPulse 2s ease-in-out 0.5s infinite;
    }

    .truck-card--selected {
      border-color: var(--neon-green) !important;
      box-shadow: 0 0 15px rgba(57, 255, 20, 0.3) !important;
    }

    .truck-card--bounce {
      animation: cardSelect 0.3s ease !important;
    }

    /* Preview area */
    .truck-card__preview {
      position: relative;
      height: 130px;
      background: linear-gradient(135deg, var(--bg-dark) 0%, var(--bg-surface) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .truck-card__canvas {
      width: 200px;
      height: 130px;
    }

    .truck-card__rarity-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      font-family: var(--font-body);
      font-size: 10px;
      letter-spacing: 1px;
      color: #fff;
      padding: 3px 8px;
      border-radius: 4px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }

    .truck-card__special-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      font-family: var(--font-accent);
      font-size: 11px;
      color: var(--fire-yellow);
      background: rgba(0, 0, 0, 0.6);
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid var(--fire-yellow);
      text-shadow: 0 0 8px var(--fire-yellow);
      animation: legendaryPulse 2s ease-in-out infinite;
    }

    .truck-card__selected-check {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--neon-green);
      color: #000;
      font-size: 20px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 0 20px rgba(57, 255, 20, 0.5);
    }

    .truck-card--selected .truck-card__selected-check {
      transform: translate(-50%, -50%) scale(1);
    }

    /* Info area */
    .truck-card__info {
      padding: 10px 14px;
    }

    .truck-card__name {
      font-family: var(--font-heading);
      font-size: 20px;
      color: var(--chrome-bright);
      letter-spacing: 1px;
      line-height: 1.1;
    }

    .truck-card__tagline {
      font-family: var(--font-accent);
      font-size: 13px;
      color: var(--rarity-color, var(--chrome-dark));
      margin-top: 2px;
      opacity: 0.8;
    }

    .truck-card__stats {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .truck-card__ability {
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--chrome);
      padding: 5px 8px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 6px;
    }

    .truck-card__ability-icon {
      font-size: 16px;
    }

    .truck-card__ability-name {
      font-family: var(--font-body);
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(style);
}
