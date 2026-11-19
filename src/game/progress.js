import { storage } from '../core/storage.js';
import { TOTAL_LEVELS } from '../core/config.js';
import { getLevel } from './levels.js';
import { validateGuess, evaluateGuess } from './engine.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Progression : { unlocked:number, completed:{[niveau]:{attempts,time}} } */
export const defaultProgress = () => ({ unlocked: 1, completed: {} });

/**
 * Charge la progression en la nettoyant : toute donnée invalide (corrompue, modifiée, ancienne version)
 * est ignorée au lieu de faire planter le jeu. Les anciennes entrées sans étoiles restent valides.
 */
export function sanitizeProgress(p) {
  if (!isObj(p)) return defaultProgress();
  const completed = {};
  let maxDone = 0;
  if (isObj(p.completed)) {
    for (const [k, v] of Object.entries(p.completed)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 1 || n > TOTAL_LEVELS || !isObj(v)) continue;
      if (!Number.isFinite(v.time) || v.time < 0 || !Number.isFinite(v.attempts) || v.attempts < 1) continue;
      const stars = Number.isInteger(v.stars) ? Math.min(3, Math.max(0, v.stars)) : 0;
      const entry = { attempts: v.attempts, time: v.time, stars };
      if (v.clean === true) entry.clean = true;
      completed[n] = entry;
      maxDone = Math.max(maxDone, n);
    }
  }
  const declared = Number.isInteger(p.unlocked) ? Math.min(TOTAL_LEVELS, Math.max(1, p.unlocked)) : 1;
  return { unlocked: Math.max(declared, Math.min(TOTAL_LEVELS, maxDone + 1)), completed };
}
export const loadProgress = () => sanitizeProgress(storage.get('progress', null));
export const saveProgress = p => storage.set('progress', p);
export const isUnlocked = (p, n) => n >= 1 && n <= p.unlocked;

/** Enregistre une victoire (garde le meilleur temps et le maximum d'étoiles) et débloque le niveau suivant. Pur. */
export function recordWin(p, n, { attempts, time, stars = 0, clean }) {
  const prev = p.completed[n];
  const bestTime = prev && prev.time <= time ? prev.time : time;
  const bestAttempts = prev ? Math.min(prev.attempts, attempts) : attempts;
  const best = { attempts: bestAttempts, time: bestTime, stars: Math.max(prev?.stars ?? 0, stars) };
  if (clean || prev?.clean) best.clean = true;
  return {
    unlocked: Math.min(TOTAL_LEVELS, Math.max(p.unlocked, n + 1)),
    completed: { ...p.completed, [n]: best }
  };
}

/**
 * Partie en cours (sauvegarde automatique) : { level, state, elapsed, input, eliminated }.
 * `input` = chiffres saisis mais pas encore validés (absent des anciennes sauvegardes → []).
 * `eliminated` = chiffres éliminés manuellement par le joueur (absent des anciennes sauvegardes → []).
 */
export const saveActive = a => storage.set('active', a);
export const clearActive = () => storage.remove('active');

/** Nettoie et trie une liste de chiffres éliminés manuellement (entiers uniques 0..digits-1). Pur. */
export function sanitizeEliminated(list, digits = 10) {
  if (!Array.isArray(list)) return [];
  const out = new Set();
  for (const d of list) {
    if (Number.isInteger(d) && d >= 0 && d < digits) out.add(d);
  }
  return [...out].sort((a, b) => a - b);
}

/** Bascule l'élimination manuelle du chiffre `d` dans la liste `eliminated`. Pur. */
export function toggleEliminated(list, d, digits = 10) {
  const clean = sanitizeEliminated(list, digits);
  if (!Number.isInteger(d) || d < 0 || d >= digits) return clean;
  return clean.includes(d) ? clean.filter(x => x !== d) : [...clean, d].sort((a, b) => a - b);
}

/** Vérifie si la saisie `input` contient au moins un chiffre marqué comme éliminé. Pur. */
export function hasEliminatedInInput(input = [], eliminated = []) {
  if (!Array.isArray(input) || !Array.isArray(eliminated) || !input.length || !eliminated.length) return false;
  const set = new Set(eliminated);
  return input.some(d => set.has(d));
}

/**
 * Valide et reconstruit une sauvegarde de partie. Retourne null si elle est invalide :
 * niveau hors bornes, règles différentes, code ou tentatives incohérents, indices faux, partie déjà terminée…
 * Les évaluations sont recalculées par le moteur (une sauvegarde modifiée à la main est rejetée).
 */
export function validateActive(a) {
  try {
    if (!isObj(a) || !Number.isInteger(a.level) || a.level < 1 || a.level > TOTAL_LEVELS || !isObj(a.state)) return null;
    const rules = getLevel(a.level), s = a.state, r = s.rules;
    if (!isObj(r) || ['codeLength', 'digits', 'maxAttempts', 'hints'].some(k => r[k] !== rules[k]) || r.allowRepeats !== rules.allowRepeats) return null;
    if (s.status !== 'playing' || !validateGuess(s.secret, rules).valid) return null;
    if (!Array.isArray(s.guesses) || s.guesses.length >= rules.maxAttempts) return null;
    const guesses = [];
    for (const g of s.guesses) {
      if (!isObj(g) || !validateGuess(g.guess, rules).valid) return null;
      const ev = evaluateGuess(s.secret, g.guess);
      if (g.exact !== ev.exact || g.misplaced !== ev.misplaced || ev.exact === rules.codeLength) return null;
      guesses.push({ guess: [...g.guess], ...ev });
    }
    const hintsUsed = Array.isArray(s.hintsUsed) ? s.hintsUsed : [];
    if (hintsUsed.length > rules.hints) return null;
    const seen = new Set();
    for (const h of hintsUsed) {
      if (!isObj(h) || !Number.isInteger(h.pos) || h.pos < 0 || h.pos >= rules.codeLength || seen.has(h.pos) || s.secret[h.pos] !== h.digit) return null;
      seen.add(h.pos);
    }
    if (!Number.isFinite(a.elapsed) || a.elapsed < 0) return null;
    let input = Array.isArray(a.input) ? a.input : [];
    const okInput = input.length < rules.codeLength + 1 && input.every(d => Number.isInteger(d) && d >= 0 && d < rules.digits)
      && (rules.allowRepeats || new Set(input).size === input.length);
    if (!okInput || input.length > rules.codeLength) input = []; // saisie invalide : on l'ignore, la partie reste valide
    const eliminated = sanitizeEliminated(a.eliminated, rules.digits);
    return {
      level: a.level, elapsed: Math.min(Math.floor(a.elapsed), 86400), input: [...input], eliminated,
      state: { rules, secret: [...s.secret], guesses, hintsUsed: hintsUsed.map(h => ({ pos: h.pos, digit: h.digit })), status: 'playing' }
    };
  } catch { return null; }
}

/** Charge la partie en cours ; une sauvegarde invalide est supprimée et ignorée. */
export function loadActive() {
  const v = validateActive(storage.get('active', null));
  if (!v) clearActive();
  return v;
}

/** Une partie contient-elle une progression à protéger (tentative, indice, saisie ou éliminations en cours) ? */
export const hasProgress = a => !!a && (
  a.state.guesses.length > 0 ||
  a.state.hintsUsed.length > 0 ||
  (a.input?.length ?? 0) > 0 ||
  (a.eliminated?.length ?? 0) > 0
);

/**
 * Faut-il demander confirmation avant d'ouvrir le niveau n ? Oui si une partie avec progression existe
 * et qu'elle serait remplacée : autre niveau, ou même niveau en « nouvelle partie » (fresh).
 */
export const needsReplaceConfirm = (active, n, fresh = false) => hasProgress(active) && (active.level !== n || fresh);
