import './helpers/mock-storage.js';
import test from 'node:test'; import assert from 'node:assert/strict';
import { createGame, submitGuess, useHint } from '../src/game/engine.js';
import { getLevel } from '../src/game/levels.js';
import { needsReplaceConfirm } from '../src/game/progress.js';

const mk = (level, f) => { let s = createGame(getLevel(level), Math.random, [1, 2, 3, 4]); s = f ? f(s) : s; return { level, state: s, elapsed: 5, input: [] }; };
const withGuess = s => submitGuess(s, [5, 6, 7, 8]).state;

test('aucune partie active → jamais de confirmation', () => {
  assert.equal(needsReplaceConfirm(null, 3), false); assert.equal(needsReplaceConfirm(null, 3, true), false);
});
test('partie sans progression → pas de confirmation inutile', () => {
  const a = mk(1); assert.equal(needsReplaceConfirm(a, 2), false); assert.equal(needsReplaceConfirm(a, 1, true), false);
});
test('partie avec tentative → confirmation si autre niveau', () => {
  assert.equal(needsReplaceConfirm(mk(1, withGuess), 2), true);
});
test('partie avec indice seulement → confirmation', () => {
  assert.equal(needsReplaceConfirm(mk(1, s => useHint(s).state), 5), true);
});
test('saisie en cours seulement → confirmation', () => {
  const a = { ...mk(1), input: [4] }; assert.equal(needsReplaceConfirm(a, 2), true);
});
test('même niveau : reprise sans confirmation, nouvelle partie avec confirmation', () => {
  const a = mk(2, withGuess);
  assert.equal(needsReplaceConfirm(a, 2), false);
  assert.equal(needsReplaceConfirm(a, 2, true), true);
});
