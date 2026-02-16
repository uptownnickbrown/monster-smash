// ============================================
// MONSTER SMASH - Sound Manager
// Web Audio API wrapper
// ============================================

let audioCtx = null;
let masterGain = null;
let initialized = false;

export function initAudio() {
  if (initialized) return;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
    initialized = true;
  } catch (e) {
    console.warn('Web Audio API not available:', e);
  }
}

// Must be called from a user gesture (tap/click) to unlock audio on iOS
export function unlockAudio() {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function getAudioContext() {
  if (!initialized) initAudio();
  return audioCtx;
}

export function getMasterGain() {
  return masterGain;
}

export function setVolume(vol) {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, Math.min(1, vol));
  }
}

export function isReady() {
  if (!initialized || !audioCtx) return false;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx.state === 'running';
}

// Create a noise buffer for crash/explosion sounds
export function createNoiseBuffer(duration) {
  if (!audioCtx) return null;
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}
