import { TOTAL_LEVELS, LEVELS_PER_TIER, DIFFICULTIES, DIFFICULTY_ORDER, DIGITS } from '../core/config.js';

/**
 * Règles du niveau n (1..100). 4 paliers de 25 niveaux ; au sein d'un palier,
 * le nombre de tentatives diminue et les doublons apparaissent progressivement.
 * @returns {{number:number,difficulty:string,codeLength:number,digits:number,
 *   allowRepeats:boolean,maxAttempts:number,hints:number}}
 */
export function getLevel(n) {
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_LEVELS) throw new RangeError('Niveau invalide');
  const tier = Math.floor((n - 1) / LEVELS_PER_TIER);
  const idx = (n - 1) % LEVELS_PER_TIER;
  const difficulty = DIFFICULTY_ORDER[tier];
  const d = DIFFICULTIES[difficulty];
  return {
    number: n,
    difficulty,
    codeLength: d.codeLength,
    digits: DIGITS,
    allowRepeats: idx >= d.repeatsFrom,
    maxAttempts: Math.max(d.minAttempts, d.baseAttempts - Math.floor(idx / 6)),
    hints: d.hints
  };
}
