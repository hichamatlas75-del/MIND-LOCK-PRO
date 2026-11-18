import { getSettings, getVolume } from '../core/settings.js';

let ctx;
let interacted = false;

/** Active l'autorisation audio après une interaction utilisateur explicite (aucun son automatique avant). */
export function unlockAudio() { interacted = true; }
export const isAudioUnlocked = () => interacted;

if (typeof window !== 'undefined') {
  const onFirst = () => { interacted = true; };
  window.addEventListener('pointerdown', onFirst, { capture: true, passive: true });
  window.addEventListener('keydown', onFirst, { capture: true, passive: true });
  window.addEventListener('click', onFirst, { capture: true, passive: true });
}

/** Gain effectif (0..1) tenant compte de l'interrupteur `sound` et du volume `0..100`. */
export function effectiveGain(baseVol = 0.06) {
  if (!getSettings().sound) return 0;
  const pct = getVolume();
  if (pct <= 0) return 0;
  return baseVol * (pct / 100);
}

/** Joue une note synthétisée (sans fichier externe ni droits d'auteur). */
export function beep(freq = 440, ms = 120, type = 'sine', vol = 0.06, delay = 0) {
  if (!interacted) return false;
  const gainVal = effectiveGain(vol);
  if (gainVal <= 0) return false;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + delay / 1000;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gainVal, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + ms / 1000);
    return true;
  } catch { return false; }
}

/**
 * 8 effets sonores distincts (Axe 3) + alias rétrocompatibles :
 * click (bouton), digit/tap (chiffre), submit/neutral (validation), hint/good (indice/exact),
 * invalid/error (mauvaise combinaison), win (victoire), lose (défaite), unlock (déblocage de niveau).
 */
export const sfx = {
  click:   () => beep(460, 35, 'triangle', 0.035),
  digit:   () => beep(540, 48, 'sine', 0.045),
  tap:     () => beep(540, 48, 'sine', 0.045),
  submit:  () => { beep(420, 75, 'sine', 0.05); beep(560, 85, 'sine', 0.05, 65); },
  neutral: () => beep(420, 110, 'sine', 0.05),
  good:    () => { beep(620, 90, 'sine', 0.06); beep(820, 120, 'sine', 0.06, 90); },
  hint:    () => { beep(720, 80, 'sine', 0.055); beep(1040, 140, 'sine', 0.055, 80); },
  invalid: () => { beep(190, 120, 'square', 0.04); beep(155, 130, 'square', 0.04, 100); },
  error:   () => { beep(190, 120, 'square', 0.04); beep(155, 130, 'square', 0.04, 100); },
  unlock:  () => [587, 784, 988, 1175].forEach((f, i) => beep(f, 150, 'triangle', 0.055, i * 75)),
  win:     () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 220, 'sine', 0.065, i * 110)),
  lose:    () => [330, 262, 196].forEach((f, i) => beep(f, 260, 'triangle', 0.06, i * 140))
};
