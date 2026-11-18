import test from 'node:test'; import assert from 'node:assert/strict';
import { getLevel } from '../src/game/levels.js';
import { validateGuess, generateCode } from '../src/game/engine.js';

test('100 niveaux valides, codes de 4 à 6, tentatives décroissantes dans un palier', () => {
  for (let n = 1; n <= 100; n++) {
    const l = getLevel(n);
    assert.ok(l.codeLength >= 4 && l.codeLength <= 6); assert.ok(l.maxAttempts >= 7);
    assert.ok(l.allowRepeats || l.codeLength <= l.digits);
    const c = generateCode(l); assert.ok(validateGuess(c, l).valid, `niveau ${n}`);
    if (n % 25 !== 1) assert.ok(getLevel(n).maxAttempts <= getLevel(n - 1).maxAttempts);
  }
});
test('4 paliers : débutant, normal, expert, maître', () => {
  assert.deepEqual([1, 26, 51, 76, 100].map(n => getLevel(n).difficulty), ['beginner', 'normal', 'expert', 'master', 'master']);
  assert.deepEqual([1, 26, 51, 76].map(n => getLevel(n).codeLength), [4, 4, 5, 6]);
});
test('difficulté croissante : doublons de plus en plus tôt, maître toujours avec doublons', () => {
  assert.equal(getLevel(1).allowRepeats, false); assert.equal(getLevel(25).allowRepeats, true);
  assert.equal(getLevel(76).allowRepeats, true);
});
test('niveau invalide', () => {
  for (const n of [0, 101, -1, 1.5, '3', NaN]) assert.throws(() => getLevel(n), RangeError);
});
