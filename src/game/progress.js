import { storage } from '../core/storage.js';
import { TOTAL_LEVELS } from '../core/config.js';

/** Progression : { unlocked:number, completed:{[niveau]:{attempts,time}} } */
export const defaultProgress = () => ({ unlocked: 1, completed: {} });

export function loadProgress() {
  const p = storage.get('progress', null);
  if (!p || typeof p.unlocked !== 'number' || typeof p.completed !== 'object') return defaultProgress();
  return p;
}
export const saveProgress = p => storage.set('progress', p);
export const isUnlocked = (p, n) => n >= 1 && n <= p.unlocked;

/** Enregistre une victoire (garde le meilleur temps) et débloque le niveau suivant. Pur. */
export function recordWin(p, n, { attempts, time }) {
  const prev = p.completed[n];
  const best = prev && prev.time <= time ? prev : { attempts, time };
  return {
    unlocked: Math.min(TOTAL_LEVELS, Math.max(p.unlocked, n + 1)),
    completed: { ...p.completed, [n]: best }
  };
}

/** Partie en cours (sauvegarde automatique, reprise après fermeture). */
export const saveActive = a => storage.set('active', a);
export const loadActive = () => storage.get('active', null);
export const clearActive = () => storage.remove('active');
