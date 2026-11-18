import './helpers/mock-storage.js';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateKey,
  shiftDateKey,
  prevDateKey,
  recentDateKeys,
  getDailyCode,
  createDailyGame,
  defaultDailyStore,
  sanitizeDailyStore,
  loadDailyStore,
  saveDailyStore,
  canPlayDaily,
  recordDailyFinish,
  formatDailyShare,
  buildDailySubmissionPayload
} from '../src/game/daily.js';
import { submitGuess } from '../src/game/engine.js';
import { DAILY_RULES } from '../src/core/config.js';
import { summarizeDashboard, defaultStats } from '../src/game/stats.js';
import { defaultProgress } from '../src/game/progress.js';
import { getSettings, setSetting, getVolume, setVolume } from '../src/core/settings.js';
import { storage } from '../src/core/storage.js';
import { beep, unlockAudio, isAudioUnlocked, effectiveGain, sfx } from '../src/services/audio.js';

beforeEach(() => localStorage.clear());

test('formatDateKey et shiftDateKey normalisent et décalent les dates sans dérive DST', () => {
  assert.equal(formatDateKey('2026-04-17'), '2026-04-17');
  assert.equal(formatDateKey(new Date(2026, 3, 17)), '2026-04-17');
  assert.equal(prevDateKey('2026-04-01'), '2026-03-31');
  assert.equal(shiftDateKey('2026-04-17', 5), '2026-04-22');
  const rec = recentDateKeys('2026-04-17', 14);
  assert.equal(rec.length, 14);
  assert.equal(rec[0], '2026-04-04');
  assert.equal(rec[13], '2026-04-17');
});

test('Défi quotidien : code déterministe par date (5 chiffres distincts) et différent entre dates', () => {
  const c1 = getDailyCode('2026-04-17');
  const c2 = getDailyCode('2026-04-17');
  assert.deepEqual(c1, c2);
  assert.equal(c1.length, DAILY_RULES.codeLength);
  assert.equal(new Set(c1).size, DAILY_RULES.codeLength);
  const cNext = getDailyCode('2026-04-18');
  assert.notDeepEqual(c1, cNext);
});

test('Défi quotidien : 1 seule participation comptabilisée par jour + blocage recul horloge', () => {
  let store = defaultDailyStore();
  let g = createDailyGame('2026-04-17');
  g = submitGuess(g, g.secret).state;
  const r1 = recordDailyFinish(store, '2026-04-17', g, 42);
  assert.equal(r1.recorded, true);
  assert.equal(r1.store.streak, 1);
  assert.equal(r1.store.totalWins, 1);
  assert.equal(r1.store.totalPlayed, 1);

  // Tentative de rejouer le même jour : refusée
  assert.deepEqual(canPlayDaily(r1.store, '2026-04-17'), {
    allowed: false,
    reason: 'alreadyPlayed',
    entry: r1.entry
  });
  const r2 = recordDailyFinish(r1.store, '2026-04-17', g, 10);
  assert.equal(r2.recorded, false);
  assert.equal(r2.reason, 'alreadyPlayed');

  // Tentative de reculer l'horloge système au jour précédent : refusée
  assert.deepEqual(canPlayDaily(r1.store, '2026-04-16'), {
    allowed: false,
    reason: 'clockSkew'
  });
});

test('Défi quotidien : série quotidienne consécutive, saut de jour et défaite', () => {
  let store = defaultDailyStore();
  for (const [idx, day] of ['2026-04-10', '2026-04-11', '2026-04-12'].entries()) {
    let g = createDailyGame(day);
    g = submitGuess(g, g.secret).state;
    store = recordDailyFinish(store, day, g, 30).store;
    assert.equal(store.streak, idx + 1);
  }
  assert.equal(store.bestStreak, 3);

  // Jour sauté (2026-04-13 non joué) -> la victoire du 2026-04-14 redémarre la série à 1 mais garde bestStreak=3
  let g14 = createDailyGame('2026-04-14');
  g14 = submitGuess(g14, g14.secret).state;
  store = recordDailyFinish(store, '2026-04-14', g14, 35).store;
  assert.equal(store.streak, 1);
  assert.equal(store.bestStreak, 3);

  // Défaite le 2026-04-15 -> série retombe à 0
  let g15 = createDailyGame('2026-04-15');
  const wrong = [0, 1, 2, 3, 4].map(d => (d === g15.secret[0] ? (d + 5) % 10 : d));
  // Assurer que `wrong` a 5 chiffres distincts et diffère du secret
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => d !== g15.secret[0]);
  const wrongGuess = pool.slice(0, 5);
  for (let i = 0; i < DAILY_RULES.maxAttempts; i++) {
    g15 = submitGuess(g15, wrongGuess).state;
  }
  assert.equal(g15.status, 'lost');
  store = recordDailyFinish(store, '2026-04-15', g15, 90).store;
  assert.equal(store.streak, 0);
  assert.equal(store.bestStreak, 3);
  assert.equal(store.totalPlayed, 5);
  assert.equal(store.totalWins, 4);
  void wrong;
});

test('Partage du résultat quotidien : grille emoji sans jamais révéler le code secret + payload API futur', () => {
  let g = createDailyGame('2026-04-17');
  g = submitGuess(g, g.secret).state;
  const { entry } = recordDailyFinish(defaultDailyStore(), '2026-04-17', g, 75);
  const text = formatDailyShare('2026-04-17', entry);
  assert.ok(text.includes('MIND LOCK PRO — Daily 2026-04-17'));
  assert.ok(text.includes('1/9'));
  assert.ok(text.includes('01:15'));
  assert.ok(text.includes('🟢🟢🟢🟢🟢'));
  // Aucun chiffre consécutif du code secret ne doit apparaître dans le partage
  assert.equal(text.includes(g.secret.join('')), false);
  assert.equal(text.includes(g.secret.join(' ')), false);

  const payload = buildDailySubmissionPayload('2026-04-17', entry);
  assert.deepEqual(payload, {
    schemaVersion: 1,
    mode: 'daily',
    dateKey: '2026-04-17',
    status: 'won',
    attempts: 1,
    maxAttempts: 9,
    timeSeconds: 75,
    hintsUsed: 0,
    stars: 3
  });
});

test('Persistance quotidienne & tolérance aux données corrompues', () => {
  storage.remove('daily');
  assert.deepEqual(loadDailyStore(), defaultDailyStore());
  const sanitized = sanitizeDailyStore({
    lastSeenDate: 'bad-date',
    streak: -5,
    history: {
      '2026-04-17': { status: 'won', attempts: 3, time: 55, stars: 3, grid: [{ exact: 5, misplaced: 0, absent: 0 }] },
      'invalid': { status: 'won', attempts: 1 }
    }
  });
  assert.equal(sanitized.lastSeenDate, null);
  assert.equal(sanitized.streak, 0);
  assert.equal(sanitized.totalPlayed, 1);
  assert.equal(sanitized.totalWins, 1);
  saveDailyStore(sanitized);
  assert.equal(loadDailyStore().totalWins, 1);
});

test('Système audio : garde interaction utilisateur, volume (0..100) et 8 effets sonores', () => {
  storage.remove('volume');
  storage.remove('settings');
  assert.equal(getVolume(), 80);
  setVolume(50);
  assert.equal(getVolume(), 50);
  setVolume(150);
  assert.equal(getVolume(), 100);
  setVolume(-20);
  assert.equal(getVolume(), 0);
  assert.equal(effectiveGain(0.1), 0);

  setVolume(50);
  assert.ok(Math.abs(effectiveGain(0.1) - 0.05) < 1e-9);
  setSetting('sound', false);
  assert.equal(effectiveGain(0.1), 0);
  // getSettings() conserve strictement ses 3 clés historiques
  assert.deepEqual(getSettings(), { sound: false, vibration: true, name: '' });

  // Tant que unlockAudio() n'a pas été appelé ou en environnement sans AudioContext, beep ne lève aucune erreur
  setSetting('sound', true);
  unlockAudio();
  assert.equal(isAudioUnlocked(), true);
  for (const k of ['click', 'digit', 'submit', 'hint', 'invalid', 'win', 'lose', 'unlock']) {
    assert.equal(typeof sfx[k], 'function');
    assert.doesNotThrow(() => sfx[k]());
  }
  assert.doesNotThrow(() => beep(440, 50));
});

test('summarizeDashboard : calcule les 9 indicateurs et la progression des 4 catégories', () => {
  const prog = defaultProgress();
  prog.unlocked = 27;
  prog.completed[1] = { stars: 3, bestAttempts: 2, time: 20, clean: true };
  prog.completed[2] = { stars: 2, bestAttempts: 4, time: 40, clean: false };
  prog.completed[26] = { stars: 3, bestAttempts: 3, time: 30, clean: true };
  const stats = { ...defaultStats(), played: 4, wins: 3, losses: 1, streak: 2, bestStreak: 3 };
  const daily = { ...defaultDailyStore(), totalWins: 2, totalPlayed: 2, streak: 2, bestStreak: 2 };

  const dash = summarizeDashboard(prog, stats, daily);
  assert.equal(dash.totalGames, 6);
  assert.equal(dash.rate, 83); // 5 victoires / 6 parties
  assert.equal(dash.avgTime, 30); // (20+40+30)/3
  assert.equal(dash.bestTime, 20);
  assert.equal(dash.totalStars, 8);
  assert.equal(dash.maxStars, 300);
  assert.equal(dash.completedLevels, 3);
  assert.equal(dash.winStreak, 2);
  assert.equal(dash.dailyWins, 2);
  assert.equal(dash.categories.length, 4);
  assert.equal(dash.categories[0].completed, 2);
  assert.equal(dash.categories[0].percent, 8);
  assert.equal(dash.categories[1].completed, 1);
  assert.equal(dash.categories[2].completed, 0);
  assert.equal(dash.categories[3].completed, 0);
});
