# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step, no package.json, no dependencies. Serve the root directory with any static file server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser. The game is landscape-only and mobile-first.

There are no tests or linters configured.

## Architecture

**Monster Smash** is a browser-based monster truck battle game built with vanilla JavaScript ES modules, HTML Canvas, and CSS — zero dependencies.

### Screen Router

`js/main.js` is the entry point. It manages 4 screens: `title` → `team-select` → `battle` → `results`. Screen transitions are driven by `setState({ screen: 'X' })` which triggers lazy dynamic imports. Each screen module exports `create*Screen(container)` and `destroy*Screen()`.

### Global State (js/game-state.js)

Single module-level state object with observer pattern. `setState(partial)` merges state and notifies listeners. Screens subscribe via `onStateChange()`. Never manipulate screens directly across modules — always go through state transitions.

### Truck Data Pipeline

- **44 truck JSON files** in `data/trucks/` define stats, visuals, abilities, and lore
- `js/trucks/truck-loader.js` fetches all in parallel via `Promise.allSettled`
- `js/trucks/truck-registry.js` indexes them for lookup by ID/rarity and weighted random selection
- `js/trucks/truck-renderer.js` draws trucks procedurally on Canvas from the JSON `visual` config (no sprite images)

### Battle System (js/screens/battle-arena.js)

The most complex file (~1,000 lines). Canvas game loop with phases: `intro` → `charge` → `launch` → `collision` → `bounce` → `settle` → `result`. Player drags to charge a slingshot — a sweet spot zone (width based on speed stat) gives full power, overshooting applies penalty. Up to 3 smashes per round, 5 rounds per match.

### Engine Layer (js/engine/)

- `canvas-renderer.js` — Canvas setup, DPR scaling, requestAnimationFrame loop
- `physics.js` — TruckPhysics class, damage/knockback calculations
- `particles.js` — Spark, fire, smoke, explosion, debris particle system
- `animation.js` — Tween engine with easing functions
- `screen-shake.js` — Camera shake with exponential decay

### Audio (js/audio/)

All sounds are synthesized in real-time via Web Audio API — no audio files. AudioContext is unlocked on first user tap (iOS requirement).

## Key Conventions

- **DOM creation**: Use the `el(tag, attrs, ...children)` factory from `js/utils/dom-utils.js`, not raw `document.createElement`
- **Style injection**: Components inject `<style>` tags guarded by ID check (`if (document.getElementById('X-styles')) return;`)
- **Cleanup**: Every screen/component tracks its own timeouts, intervals, and listeners and cleans them up in its destroy function
- **Pointer Events**: All interaction uses `pointerdown`/`pointermove`/`pointerup` (not mouse/touch separately)
- **DPR-aware canvas**: Always create with `width * dpr` physical pixels and `ctx.scale(dpr, dpr)`
- **Stats**: All truck stats are 0-100 scale. Stat budgets increase with rarity (common: 250-300, legendary: 380-425)
- **Rarity tiers**: common (gray), rare (blue), epic (purple), legendary (gold) — defined in `data/rarity-config.json`
- **Draft weights**: Legendary 3x, epic 2x, rare 1.2x, common 1x (in `truck-registry.js`)
