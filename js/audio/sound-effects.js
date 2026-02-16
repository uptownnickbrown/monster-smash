// ============================================
// MONSTER SMASH - Programmatic Sound Effects
// No audio files needed - all generated via Web Audio
// ============================================

import { getAudioContext, getMasterGain, createNoiseBuffer, isReady } from './sound-manager.js';

// Engine rev sound (low frequency oscillator)
export function playEngineRev(duration = 0.5) {
  if (!isReady()) return;
  const ctx = getAudioContext();
  const master = getMasterGain();

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(60, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + duration * 0.7);
  osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + duration * 0.5);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  // Add some distortion feel with a second oscillator
  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(30, ctx.currentTime);
  osc2.frequency.linearRampToValueAtTime(60, ctx.currentTime + duration);

  const gain2 = ctx.createGain();
  gain2.gain.value = 0.05;

  osc.connect(gain).connect(master);
  osc2.connect(gain2).connect(master);

  osc.start();
  osc2.start();
  osc.stop(ctx.currentTime + duration);
  osc2.stop(ctx.currentTime + duration);
}

// Collision crash sound (noise burst + low thump)
export function playCrash(intensity = 0.7) {
  if (!isReady()) return;
  const ctx = getAudioContext();
  const master = getMasterGain();

  // White noise burst
  const noiseBuffer = createNoiseBuffer(0.2);
  if (!noiseBuffer) return;

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(intensity * 0.4, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

  // Band-pass filter for metallic sound
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 0.5;

  noiseSource.connect(filter).connect(noiseGain).connect(master);
  noiseSource.start();

  // Low thump
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.25);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(intensity * 0.6, ctx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

  osc.connect(oscGain).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
}

// Explosion sound (big boom)
export function playExplosion() {
  if (!isReady()) return;
  const ctx = getAudioContext();
  const master = getMasterGain();

  // Massive noise burst
  const noiseBuffer = createNoiseBuffer(0.5);
  if (!noiseBuffer) return;

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.5);

  noiseSource.connect(filter).connect(noiseGain).connect(master);
  noiseSource.start();

  // Deep boom
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(15, ctx.currentTime + 0.5);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.8, ctx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

  osc.connect(oscGain).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

// Power-up activation (ascending tone sweep)
export function playPowerUp() {
  if (!isReady()) return;
  const ctx = getAudioContext();
  const master = getMasterGain();

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

  osc.connect(gain).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);

  // Sparkle overlay
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
  osc2.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.3);

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, ctx.currentTime);
  gain2.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

  osc2.connect(gain2).connect(master);
  osc2.start();
  osc2.stop(ctx.currentTime + 0.4);
}

// Victory fanfare (simple ascending melody)
export function playVictoryFanfare() {
  if (!isReady()) return;
  const ctx = getAudioContext();
  const master = getMasterGain();

  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  const durations = [0.15, 0.15, 0.15, 0.4];

  let t = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0.15, t + durations[i] * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durations[i]);

    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + durations[i]);
    t += durations[i];
  });
}

// Defeat sound (descending tones)
export function playDefeat() {
  if (!isReady()) return;
  const ctx = getAudioContext();
  const master = getMasterGain();

  const notes = [400, 350, 300, 200];
  let t = ctx.currentTime;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.25);
    t += 0.2;
  });
}

// UI click/select sound
export function playClick() {
  if (!isReady()) return;
  const ctx = getAudioContext();
  const master = getMasterGain();

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  osc.connect(gain).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

// Whoosh sound (for truck launch)
export function playWhoosh() {
  if (!isReady()) return;
  const ctx = getAudioContext();
  const master = getMasterGain();

  const noiseBuffer = createNoiseBuffer(0.3);
  if (!noiseBuffer) return;

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(500, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.15);
  filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.3);
  filter.Q.value = 2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

  source.connect(filter).connect(gain).connect(master);
  source.start();
}
