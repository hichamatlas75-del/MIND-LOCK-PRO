import { TOTAL_LEVELS, LEVELS_PER_TIER, DIFFICULTIES, DIFFICULTY_ORDER, DIGITS } from '../core/config.js';

/**
 * Règles et métriques d'équilibrage du niveau n (1..100).
 * @returns {{number:number,difficulty:string,codeLength:number,digits:number,
 *   allowRepeats:boolean,maxAttempts:number,hints:number,parTime:number,starThresholds:[number,number]}}
 */
export function getLevel(n) {
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_LEVELS) throw new RangeError('Niveau invalide');
  const tier = Math.floor((n - 1) / LEVELS_PER_TIER);
  const idx = (n - 1) % LEVELS_PER_TIER;
  const difficulty = DIFFICULTY_ORDER[tier];
  const d = DIFFICULTIES[difficulty];
  const allowRepeats = idx >= d.repeatsFrom;
  const maxAttempts = Math.max(d.minAttempts, d.baseAttempts - Math.floor(idx / d.stepEvery));
  const hints = idx < d.hintsDropAt ? d.hints : d.lateHints;
  const parTime = d.basePar + idx * d.parStep + (allowRepeats ? 15 : 0);
  // Seuils [3★, 2★] en nombre de tentatives, adaptés à la longueur du code et aux doublons.
  const ratio3 = d.codeLength === 6 ? 0.6 : d.codeLength === 5 ? 0.58 : allowRepeats ? 0.55 : 0.5;
  const ratio2 = d.codeLength >= 5 ? 0.8 : 0.75;
  const s3 = Math.min(maxAttempts - 2, Math.max(d.codeLength, Math.ceil(maxAttempts * ratio3)));
  const s2 = Math.min(maxAttempts - 1, Math.max(s3 + 1, Math.ceil(maxAttempts * ratio2)));
  return {
    number: n,
    difficulty,
    codeLength: d.codeLength,
    digits: DIGITS,
    allowRepeats,
    maxAttempts,
    hints,
    parTime,
    starThresholds: [s3, s2]
  };
}

/**
 * Déduit des tentatives précédentes l'ensemble des chiffres mathématiquement absents du code secret
 * (toute tentative ayant 0 bien placé et 0 mal placé élimine tous ses chiffres). Pur, sans accès au secret.
 */
export function deduceEliminatedDigits(guesses = []) {
  const out = new Set();
  for (const g of guesses) if (g && g.exact === 0 && g.misplaced === 0 && Array.isArray(g.guess))
    for (const d of g.guess) out.add(d);
  return out;
}
