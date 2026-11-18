import { storage } from '../core/storage.js';
import { DAILY_RULES } from '../core/config.js';
import { generateCode, createGame } from './engine.js';
import { starsFor } from './stats.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalise une Date ou une chaîne YYYY-MM-DD en clé canonique locale YYYY-MM-DD. */
export function formatDateKey(date = new Date()) {
  if (typeof date === 'string' && DATE_RE.test(date)) return date;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new RangeError('Date invalide');
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Décalage de `deltaDays` jours sur une clé YYYY-MM-DD (calcul à midi UTC, insensible aux changements d'heure DST). */
export function shiftDateKey(dateKey, deltaDays) {
  if (!DATE_RE.test(dateKey)) throw new RangeError('Clé de date invalide');
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
export const prevDateKey = k => shiftDateKey(k, -1);

/** Liste les `count` derniers jours jusqu'à `todayKey` inclus (ordre chronologique). */
export const recentDateKeys = (todayKey, count = 14) =>
  Array.from({ length: count }, (_, i) => shiftDateKey(todayKey, -(count - 1 - i)));

/** PRNG déterministe Mulberry32 initialisé par hachage FNV-1a 32 bits de la date. */
export function seededRng(dateKey) {
  const key = 'MIND-LOCK-PRO-DAILY-v1:' + formatDateKey(dateKey);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Génère le code secret quotidien (identique pour tous les joueurs à la même date). */
export const getDailyCode = dateKey => generateCode(DAILY_RULES, seededRng(dateKey));

/** Crée une partie du Défi Quotidien pour `dateKey`. */
export const createDailyGame = dateKey => createGame(DAILY_RULES, seededRng(dateKey));

export const defaultDailyStore = () => ({
  lastSeenDate: null,
  streak: 0,
  bestStreak: 0,
  totalWins: 0,
  totalPlayed: 0,
  active: null,
  history: {}
});

export function sanitizeDailyStore(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultDailyStore();
  const history = {};
  if (raw.history && typeof raw.history === 'object' && !Array.isArray(raw.history)) {
    for (const [k, v] of Object.entries(raw.history)) {
      if (!DATE_RE.test(k) || !v || typeof v !== 'object') continue;
      if (v.status !== 'won' && v.status !== 'lost') continue;
      if (!Number.isInteger(v.attempts) || v.attempts < 1 || v.attempts > DAILY_RULES.maxAttempts) continue;
      history[k] = {
        status: v.status,
        attempts: v.attempts,
        maxAttempts: DAILY_RULES.maxAttempts,
        time: Number.isFinite(v.time) && v.time >= 0 ? Math.floor(v.time) : 0,
        hintsUsed: Number.isInteger(v.hintsUsed) && v.hintsUsed >= 0 ? v.hintsUsed : 0,
        stars: Number.isInteger(v.stars) ? Math.min(3, Math.max(0, v.stars)) : 0,
        grid: Array.isArray(v.grid) ? v.grid.map(g => ({
          exact: Number(g?.exact) || 0,
          misplaced: Number(g?.misplaced) || 0,
          absent: Number(g?.absent) || 0
        })) : []
      };
    }
  }
  const streak = Number.isInteger(raw.streak) && raw.streak >= 0 ? raw.streak : 0;
  const bestStreak = Number.isInteger(raw.bestStreak) && raw.bestStreak >= streak ? raw.bestStreak : streak;
  const totalPlayed = Object.keys(history).length;
  const totalWins = Object.values(history).filter(e => e.status === 'won').length;
  const lastSeenDate = typeof raw.lastSeenDate === 'string' && DATE_RE.test(raw.lastSeenDate) ? raw.lastSeenDate : null;
  const active = raw.active && typeof raw.active === 'object' && DATE_RE.test(raw.active.dateKey) && !history[raw.active.dateKey]
    ? raw.active : null;
  return { lastSeenDate, streak, bestStreak, totalWins, totalPlayed, active, history };
}

export const loadDailyStore = () => sanitizeDailyStore(storage.get('daily', null));
export const saveDailyStore = store => storage.set('daily', sanitizeDailyStore(store));

/**
 * Vérifie si le joueur peut participer au défi de `dateKey`.
 * Bloque toute participation multiple le même jour ainsi que le recul d'horloge système.
 */
export function canPlayDaily(store, dateKey) {
  const key = formatDateKey(dateKey);
  const s = sanitizeDailyStore(store);
  if (s.history[key]) return { allowed: false, reason: 'alreadyPlayed', entry: s.history[key] };
  if (s.lastSeenDate && key < s.lastSeenDate) return { allowed: false, reason: 'clockSkew' };
  return { allowed: true };
}

/** Enregistre la fin (victoire ou défaite) du défi quotidien de `dateKey`. Pur. */
export function recordDailyFinish(store, dateKey, gameState, elapsed = 0) {
  const key = formatDateKey(dateKey);
  const s = sanitizeDailyStore(store);
  const check = canPlayDaily(s, key);
  if (!check.allowed || !gameState || (gameState.status !== 'won' && gameState.status !== 'lost')) {
    return { store: s, recorded: false, reason: check.reason || 'notFinished' };
  }
  const won = gameState.status === 'won';
  const attempts = gameState.guesses.length;
  const hintsUsed = gameState.hintsUsed?.length ?? 0;
  const stars = won ? starsFor(attempts, DAILY_RULES.maxAttempts, { hintsUsed, thresholds: DAILY_RULES.starThresholds }) : 0;
  const grid = gameState.guesses.map(g => ({
    exact: g.exact,
    misplaced: g.misplaced,
    absent: DAILY_RULES.codeLength - g.exact - g.misplaced
  }));
  const entry = { status: gameState.status, attempts, maxAttempts: DAILY_RULES.maxAttempts, time: Math.max(0, Math.floor(elapsed)), hintsUsed, stars, grid };
  const prevWon = s.history[prevDateKey(key)]?.status === 'won';
  // Si le dernier défi gagné était hier, la série continue ; sinon une victoire démarre une série à 1.
  const streak = !won ? 0 : prevWon ? s.streak + 1 : 1;
  const bestStreak = Math.max(s.bestStreak, streak);
  const history = { ...s.history, [key]: entry };
  const lastSeenDate = !s.lastSeenDate || key > s.lastSeenDate ? key : s.lastSeenDate;
  const next = sanitizeDailyStore({ ...s, lastSeenDate, streak, bestStreak, active: null, history });
  return { store: next, recorded: true, entry };
}

/**
 * Génère le texte de partage du défi quotidien SANS jamais révéler les chiffres du code secret.
 * Chaque tentative est représentée par 🟢 (bien placés), 🔵 (mal placés) et ⚪ (absents).
 */
export function formatDailyShare(dateKey, entry, appName = 'MIND LOCK PRO') {
  const key = formatDateKey(dateKey);
  const score = entry.status === 'won' ? `${entry.attempts}/${entry.maxAttempts}` : `X/${entry.maxAttempts}`;
  const mins = String(Math.floor((entry.time || 0) / 60)).padStart(2, '0');
  const secs = String((entry.time || 0) % 60).padStart(2, '0');
  const starsTxt = entry.stars ? ' ' + '⭐'.repeat(entry.stars) : '';
  const rows = (entry.grid || []).map(r => '🟢'.repeat(r.exact) + '🔵'.repeat(r.misplaced) + '⚪'.repeat(r.absent));
  return [`🔐 ${appName} — Daily ${key}`, `${score}${starsTxt} · ⏱ ${mins}:${secs}`, ...rows].join('\n');
}

/** Contrat de données standardisé prêt pour une future API de classement mondial (sans backend requis en local). */
export function buildDailySubmissionPayload(dateKey, entry) {
  return {
    schemaVersion: 1,
    mode: 'daily',
    dateKey: formatDateKey(dateKey),
    status: entry.status,
    attempts: entry.attempts,
    maxAttempts: entry.maxAttempts,
    timeSeconds: entry.time,
    hintsUsed: entry.hintsUsed,
    stars: entry.stars
  };
}
