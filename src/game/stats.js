import { storage } from '../core/storage.js';
import { TOTAL_LEVELS, LEVELS_PER_TIER } from '../core/config.js';

/** Statistiques globales : { played, wins, losses, streak, bestStreak } */
export const defaultStats = () => ({ played: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0 });

export function loadStats() {
  const s = storage.get('stats', null);
  const ok = s && ['played', 'wins', 'losses', 'streak', 'bestStreak'].every(k => Number.isInteger(s[k]) && s[k] >= 0);
  return ok ? s : defaultStats();
}
export const saveStats = s => storage.set('stats', s);

/** Enregistre le résultat d'une partie terminée (victoire/défaite). Pur. */
export function recordResult(s, won) {
  const streak = won ? s.streak + 1 : 0;
  return {
    played: s.played + 1, wins: s.wins + (won ? 1 : 0), losses: s.losses + (won ? 0 : 1),
    streak, bestStreak: Math.max(s.bestStreak, streak)
  };
}
/** Taux de réussite en % (0 si aucune partie). */
export const successRate = s => (s.played ? Math.round((s.wins / s.played) * 100) : 0);

/**
 * Étoiles (1 à 3) selon la performance réelle :
 * - Seuils du niveau `thresholds: [s3, s2]` (ou ≤50 % = 3★, ≤75 % = 2★ par défaut).
 * - Intégrité des indices : 1 indice plafonne à 2★, ≥2 indices plafonnent à 1★ (3★ exige 0 indice).
 */
export function starsFor(attempts, maxAttempts, opts = {}) {
  const [s3, s2] = opts.thresholds || [Math.ceil(maxAttempts * 0.5), Math.ceil(maxAttempts * 0.75)];
  const raw = attempts <= s3 ? 3 : attempts <= s2 ? 2 : 1;
  const hintsUsed = opts.hintsUsed ?? 0;
  const cap = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
  return Math.min(raw, cap);
}

/** Données principales du tableau de bord. */
export function summarize(progress, stats) {
  const times = Object.values(progress.completed).map(c => c.time);
  const completed = times.length;
  return {
    completed,
    percent: Math.round((completed / TOTAL_LEVELS) * 100),
    bestTime: times.length ? Math.min(...times) : null,
    rate: successRate(stats),
    streak: stats.streak,
    currentLevel: Math.min(TOTAL_LEVELS, progress.unlocked)
  };
}

/** Synthèse détaillée des récompenses (étoiles totales, par palier, victoires 3★ et sans indice). */
export function summarizeRewards(progress) {
  const tierStars = [0, 0, 0, 0];
  let totalStars = 0, perfectLevels = 0, cleanLevels = 0;
  for (const [k, v] of Object.entries(progress.completed || {})) {
    const n = Number(k), st = Number.isInteger(v?.stars) ? v.stars : 0;
    if (n >= 1 && n <= TOTAL_LEVELS) {
      totalStars += st;
      tierStars[Math.floor((n - 1) / LEVELS_PER_TIER)] += st;
      if (st === 3) perfectLevels++;
      if (v?.clean) cleanLevels++;
    }
  }
  return { totalStars, maxStars: TOTAL_LEVELS * 3, perfectLevels, cleanLevels, tierStars };
}
