import { getSettings } from '../core/settings.js';
let ctx;
/** Joue une note (respecte le réglage « Sons »). */
export function beep(freq = 440, ms = 120, type = 'sine', vol = 0.06, delay = 0) {
  if (!getSettings().sound) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + delay / 1000;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + ms / 1000);
  } catch {}
}
/** Effets sonores nommés. */
export const sfx = {
  tap: () => beep(520, 50, 'sine', 0.04),
  error: () => { beep(180, 140, 'square', 0.04); },
  good: () => { beep(620, 90); beep(820, 120, 'sine', 0.06, 90); },
  neutral: () => beep(420, 110),
  hint: () => { beep(700, 80); beep(990, 140, 'sine', 0.05, 80); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 220, 'sine', 0.06, i * 110)),
  lose: () => [330, 262, 196].forEach((f, i) => beep(f, 260, 'triangle', 0.06, i * 140))
};
