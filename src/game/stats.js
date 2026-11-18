import { storage } from '../core/storage.js';
import { TOTAL_LEVELS } from '../core/config.js';

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

/** Étoiles (1 à 3) selon l'efficacité : ≤50 % des tentatives = 3, ≤75 % = 2, sinon 1. */
export function starsFor(attempts, maxAttempts) {
  if (attempts <= Math.ceil(maxAttempts * 0.5)) return 3;
  if (attempts <= Math.ceil(maxAttempts * 0.75)) return 2;
  return 1;
}

/** Données du tableau de bord à partir de la progression et des stats. */
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
