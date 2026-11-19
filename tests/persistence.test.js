import { raw, read } from './helpers/mock-storage.js';
import test, { beforeEach } from 'node:test'; import assert from 'node:assert/strict';
import { createGame, submitGuess, useHint } from '../src/game/engine.js';
import { getLevel } from '../src/game/levels.js';
import { saveActive, loadActive, validateActive, loadProgress, sanitizeProgress, recordWin, defaultProgress, hasProgress, sanitizeEliminated, toggleEliminated, hasEliminatedInInput, needsReplaceConfirm } from '../src/game/progress.js';
import { loadStats } from '../src/game/stats.js';
import { getSettings } from '../src/core/settings.js';
import { session } from '../src/game/session.js';

beforeEach(() => localStorage.clear());
const clone = o => JSON.parse(JSON.stringify(o));
/** Partie valide au niveau 1 (4 chiffres sans doublons), secret connu. */
function game(level = 1, secret = [1, 2, 3, 4]) { return createGame(getLevel(level), Math.random, secret); }
function snap(state, extra = {}) { return { level: state.rules.number, state, elapsed: 42, input: [], ...extra }; }

test('sauvegarde complète : niveau, code, tentatives, restantes, indices, chrono, saisie, état', () => {
  let g = game(); g = submitGuess(g, [5, 6, 7, 8]).state; g = submitGuess(g, [4, 3, 2, 1]).state; g = useHint(g).state;
  saveActive(snap(g, { elapsed: 77, input: [9, 0] }));
  const a = loadActive();
  assert.equal(a.level, 1); assert.deepEqual(a.state.secret, [1, 2, 3, 4]);
  assert.equal(a.state.guesses.length, 2); assert.deepEqual(a.state.guesses[1], { guess: [4, 3, 2, 1], exact: 0, misplaced: 4 });
  assert.equal(a.state.rules.maxAttempts - a.state.guesses.length, 10); // tentatives restantes
  assert.equal(a.state.hintsUsed.length, 1); assert.equal(a.state.status, 'playing');
  assert.equal(a.elapsed, 77); assert.deepEqual(a.input, [9, 0]);
});
test('saisie temporaire : restaurée ; invalide → ignorée sans perdre la partie', () => {
  const g = game();
  for (const bad of [[1, 1], [1, 2, 3, 4, 5], [10], ['a'], 'abc', { 0: 1 }]) {
    raw('active', snap(g, { input: bad }));
    const a = loadActive(); assert.ok(a, JSON.stringify(bad)); assert.deepEqual(a.input, []);
  }
  raw('active', snap(g, { input: [7, 8, 9] })); assert.deepEqual(loadActive().input, [7, 8, 9]);
});
test('compatibilité : sauvegarde Phase 2 (sans champ input) acceptée', () => {
  const legacy = { level: 3, state: { rules: getLevel(3), secret: [4, 5, 6, 7], guesses: [{ guess: [1, 2, 3, 4], exact: 0, misplaced: 1 }], hintsUsed: [], status: 'playing' }, elapsed: 12 };
  raw('active', legacy); const a = loadActive();
  assert.ok(a); assert.deepEqual(a.input, []); assert.deepEqual(a.eliminated, []); assert.equal(a.state.guesses.length, 1);
});
test('données corrompues : JSON invalide, types inattendus, valeurs nulles', () => {
  for (const bad of ['{not json', '"texte"', '42', 'null', '[]', '[1,2]', 'true', '{}']) {
    raw('active', bad); assert.equal(loadActive(), null, bad); assert.equal(read('active'), null, 'nettoyée : ' + bad);
    raw('progress', bad); const p = loadProgress(); assert.equal(p.unlocked, 1); assert.deepEqual(p.completed, {});
    raw('stats', bad); assert.equal(loadStats().played, 0);
    raw('settings', bad); assert.deepEqual(getSettings(), { sound: true, vibration: true, name: '' });
  }
});
test('sauvegarde falsifiée : rejetée', () => {
  const ok = snap((() => { let g = game(); return submitGuess(g, [5, 6, 7, 8]).state; })());
  assert.ok(validateActive(clone(ok)));
  const mut = fn => { const c = clone(ok); fn(c); return validateActive(c); };
  assert.equal(mut(c => { c.level = 0; }), null);
  assert.equal(mut(c => { c.level = 101; }), null);
  assert.equal(mut(c => { c.level = 2.5; }), null);
  assert.equal(mut(c => { c.state.status = 'won'; }), null);
  assert.equal(mut(c => { c.state.secret = [1, 1, 2, 3]; }), null);            // doublon interdit au niveau 1
  assert.equal(mut(c => { c.state.secret = [1, 2, 3]; }), null);                // mauvaise longueur
  assert.equal(mut(c => { c.state.guesses[0].exact = 3; }), null);              // évaluation incohérente
  assert.equal(mut(c => { c.state.guesses[0].guess = [9, 9, 9, 9]; }), null);
  assert.equal(mut(c => { c.state.rules.maxAttempts = 99; }), null);            // règles différentes
  assert.equal(mut(c => { c.state.guesses = Array(12).fill(c.state.guesses[0]); }), null); // tentatives épuisées
  assert.equal(mut(c => { c.state.hintsUsed = [{ pos: 0, digit: 9 }]; }), null);  // indice faux
  assert.equal(mut(c => { c.state.hintsUsed = [{ pos: 9, digit: 1 }]; }), null);
  assert.equal(mut(c => { c.state.hintsUsed = Array(5).fill({ pos: 0, digit: 1 }); }), null);
  assert.equal(mut(c => { c.elapsed = -5; }), null);
  assert.equal(mut(c => { c.elapsed = 'x'; }), null);
  assert.equal(mut(c => { c.elapsed = null; }), null);
  assert.equal(mut(c => { c.state.guesses[0] = null; }), null);
  assert.equal(validateActive(undefined), null);
  assert.equal(validateActive({ level: 1 }), null);
});
test('un code gagnant déjà joué dans les tentatives est rejeté (partie déjà terminée)', () => {
  const g = game(); const s = snap(g); s.state = { ...g, guesses: [{ guess: [1, 2, 3, 4], exact: 4, misplaced: 0 }] };
  assert.equal(validateActive(clone(s)), null);
});
test('progression : nettoyage des entrées invalides, ancien format accepté', () => {
  const p = sanitizeProgress({ unlocked: 3, completed: { 1: { attempts: 4, time: 30 }, 2: { attempts: 5, time: 40, stars: 2 }, 3: 'x', 999: { attempts: 1, time: 1 }, abc: { attempts: 1, time: 1 }, 4: { attempts: 0, time: 5 }, 5: { attempts: 2, time: -1 } } });
  assert.deepEqual(Object.keys(p.completed), ['1', '2']); assert.equal(p.completed[1].stars, 0); assert.equal(p.completed[2].stars, 2);
  assert.equal(p.unlocked, 3);
  assert.equal(sanitizeProgress({ unlocked: 'x', completed: {} }).unlocked, 1);
  assert.equal(sanitizeProgress({ unlocked: 5000, completed: {} }).unlocked, 100);
  assert.equal(sanitizeProgress({ unlocked: -3, completed: null }).unlocked, 1);
  assert.equal(sanitizeProgress({ unlocked: 1, completed: { 7: { attempts: 2, time: 9, stars: 99 } } }).unlocked, 8); // cohérence : niveau suivant débloqué
  assert.equal(sanitizeProgress({ unlocked: 1, completed: { 7: { attempts: 2, time: 9, stars: 99 } } }).completed[7].stars, 3);
});
test('meilleurs temps et déblocage persistés via la session', () => {
  session.reset();
  let r = session.win(1, { attempts: 3, time: 50, maxAttempts: 12 });
  assert.equal(r.stars, 3); assert.equal(r.newBest, false);
  r = session.win(1, { attempts: 8, time: 20, maxAttempts: 12 });
  assert.equal(r.newBest, true);
  const p = loadProgress(); assert.equal(p.completed[1].time, 20); assert.equal(p.completed[1].stars, 3); assert.equal(p.unlocked, 2);
  assert.equal(loadStats().wins, 2);
  session.reset(); assert.equal(loadProgress().unlocked, 1); assert.equal(loadStats().played, 0); assert.equal(read('active'), null);
});
test('hasProgress : tentative, indice, saisie ou chiffre éliminé', () => {
  const g = game();
  assert.equal(hasProgress(snap(g)), false);
  assert.equal(hasProgress(snap(g, { input: [1] })), true);
  assert.equal(hasProgress(snap(g, { eliminated: [9] })), true);
  assert.equal(hasProgress(snap(submitGuess(g, [5, 6, 7, 8]).state)), true);
  assert.equal(hasProgress(snap(useHint(g).state)), true);
  assert.equal(hasProgress(null), false);
});
test('élimination des chiffres : éliminer, restaurer, réinitialiser, sauvegarder et valider tentative avec ou sans doublons', () => {
  // 1. Éliminer et restaurer
  let elim = toggleEliminated([], 7);
  assert.deepEqual(elim, [7]);
  elim = toggleEliminated(elim, 2);
  assert.deepEqual(elim, [2, 7]);
  elim = toggleEliminated(elim, 7); // restaurer 7
  assert.deepEqual(elim, [2]);
  elim = []; // réinitialiser
  assert.deepEqual(elim, []);

  // 2. Nettoyage des valeurs invalides
  assert.deepEqual(sanitizeEliminated([9, 3, 9, -1, 10, 'x', null, 0]), [0, 3, 9]);
  assert.deepEqual(sanitizeEliminated('invalid'), []);

  // 3. Détection de chiffre éliminé dans la saisie + validation autorisée (niveau sans doublons et avec doublons)
  assert.equal(hasEliminatedInInput([1, 5, 8], [0, 5, 9]), true);
  assert.equal(hasEliminatedInInput([1, 2, 8], [0, 5, 9]), false);
  const gNoRepeat = game(1, [1, 2, 3, 4]);
  const res1 = submitGuess(gNoRepeat, [5, 6, 7, 8]); // 5 est éliminé par le joueur mais le moteur autorise la tentative
  assert.equal(res1.error, undefined);
  assert.equal(res1.state.guesses.length, 1);
  const gRepeat = createGame(getLevel(20), Math.random, [1, 1, 2, 3]);
  assert.equal(gRepeat.rules.allowRepeats, true);
  const res2 = submitGuess(gRepeat, [9, 9, 1, 2]);
  assert.equal(res2.error, undefined);
  assert.equal(res2.state.guesses.length, 1);

  // 4. Sauvegarde et restauration dans mlp:active
  saveActive(snap(gNoRepeat, { eliminated: [9, 0, 5], input: [5, 2] }));
  const restored = loadActive();
  assert.deepEqual(restored.eliminated, [0, 5, 9]);
  assert.deepEqual(restored.input, [5, 2]);
  assert.equal(needsReplaceConfirm(restored, 2), true);
});

