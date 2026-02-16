// ============================================
// MONSTER SMASH - Stat Bar Component
// Small horizontal bar showing a truck stat
// ============================================

import { el } from '../utils/dom-utils.js';

const STAT_COLORS = {
  smashDamage: '#ff2d2d',
  speed:       '#ffd21a',
  shield:      '#4488ff',
  weight:      '#8a8d96',
  airTime:     '#39ff14',
};

const STAT_LABELS = {
  smashDamage: 'DMG',
  speed:       'SPD',
  shield:      'DEF',
  weight:      'WGT',
  airTime:     'AIR',
};

const STAT_ICONS = {
  smashDamage: '💥',
  speed:       '⚡',
  shield:      '🛡',
  weight:      '🏋',
  airTime:     '🚀',
};

export function createStatBar(statName, value) {
  const color = STAT_COLORS[statName] || '#ffffff';
  const label = STAT_LABELS[statName] || statName;
  const icon = STAT_ICONS[statName] || '';

  const bar = el('div', { className: 'stat-bar' },
    el('span', { className: 'stat-label' }, `${icon} ${label}`),
    el('div', { className: 'stat-track' },
      el('div', {
        className: 'stat-fill',
        style: {
          width: value + '%',
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}40`,
        },
      })
    ),
  );

  return bar;
}

// Inject stat bar styles if not already present
export function injectStatBarStyles() {
  if (document.getElementById('stat-bar-styles')) return;

  const style = document.createElement('style');
  style.id = 'stat-bar-styles';
  style.textContent = `
    .stat-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 14px;
      font-size: 9px;
    }
    .stat-label {
      font-family: var(--font-body);
      color: var(--chrome);
      width: 42px;
      flex-shrink: 0;
      text-align: right;
      letter-spacing: 1px;
    }
    .stat-track {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
    }
    .stat-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.4s ease;
    }
  `;
  document.head.appendChild(style);
}
