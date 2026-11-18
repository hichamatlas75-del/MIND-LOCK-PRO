import { TOTAL_LEVELS } from '../core/config.js';
/** Progression : 100 niveaux, paramètres dérivés du numéro de niveau. */
export function getLevel(n) {
  if (n < 1 || n > TOTAL_LEVELS) throw new RangeError('Niveau invalide');
  const tier = Math.min(3, Math.floor((n - 1) / 25));
  const keys = ['easy', 'normal', 'hard', 'expert'];
  return { number: n, difficulty: keys[tier] };
}
