import test from 'node:test'; import assert from 'node:assert/strict';
import { defaultStats, recordResult, successRate, starsFor, summarize } from '../src/game/stats.js';
import { defaultProgress, recordWin } from '../src/game/progress.js';

test('série de victoires, record et défaite', () => {
  let s = defaultStats();
  s = recordResult(s, true); s = recordResult(s, true); s = recordResult(s, true);
  assert.deepEqual(s, { played: 3, wins: 3, losses: 0, streak: 3, bestStreak: 3 });
  s = recordResult(s, false);
  assert.deepEqual(s, { played: 4, wins: 3, losses: 1, streak: 0, bestStreak: 3 });
  assert.equal(successRate(s), 75); assert.equal(successRate(defaultStats()), 0);
});
test('étoiles selon les tentatives', () => {
  assert.equal(starsFor(1, 12), 3); assert.equal(starsFor(6, 12), 3);
  assert.equal(starsFor(7, 12), 2); assert.equal(starsFor(9, 12), 2);
  assert.equal(starsFor(10, 12), 1); assert.equal(starsFor(12, 12), 1);
  assert.equal(starsFor(7, 7), 1); assert.equal(starsFor(4, 7), 3);
});
test('summarize : tableau de bord', () => {
  const empty = summarize(defaultProgress(), defaultStats());
  assert.deepEqual(empty, { completed: 0, percent: 0, bestTime: null, rate: 0, streak: 0, currentLevel: 1 });
  let p = recordWin(defaultProgress(), 1, { attempts: 3, time: 50, stars: 3 });
  p = recordWin(p, 2, { attempts: 5, time: 30, stars: 2 });
  const s = summarize(p, { played: 4, wins: 2, losses: 2, streak: 2, bestStreak: 2 });
  assert.deepEqual(s, { completed: 2, percent: 2, bestTime: 30, rate: 50, streak: 2, currentLevel: 3 });
});

import { summarizeRewards } from '../src/game/stats.js';

test('étoiles : plafonnement honnête selon les indices utilisés et seuils personnalisés', () => {
  assert.equal(starsFor(4, 12, { hintsUsed: 0, thresholds: [6, 9] }), 3);
  assert.equal(starsFor(4, 12, { hintsUsed: 1, thresholds: [6, 9] }), 2); // 1 indice -> plafonné à 2★
  assert.equal(starsFor(4, 12, { hintsUsed: 2, thresholds: [6, 9] }), 1); // ≥2 indices -> plafonné à 1★
  assert.equal(starsFor(8, 12, { hintsUsed: 0, thresholds: [6, 9] }), 2);
  assert.equal(starsFor(10, 12, { hintsUsed: 0, thresholds: [6, 9] }), 1);
});

test('summarizeRewards : total d\'étoiles, niveaux 3★, victoires sans indice et répartition par palier', () => {
  let p = defaultProgress();
  p = recordWin(p, 1, { attempts: 4, time: 30, stars: 3, clean: true });
  p = recordWin(p, 26, { attempts: 7, time: 50, stars: 2, clean: false });
  p = recordWin(p, 76, { attempts: 6, time: 90, stars: 3, clean: true });
  const r = summarizeRewards(p);
  assert.deepEqual(r, { totalStars: 8, maxStars: 300, perfectLevels: 2, cleanLevels: 2, tierStars: [3, 2, 0, 3] });
});
