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

import { deduceEliminatedDigits } from '../src/game/levels.js';

test('équilibrage : parTime, starThresholds cohérents et progression monotone sans inversion 1-18 -> 26-32', () => {
  for (let n = 1; n <= 100; n++) {
    const l = getLevel(n);
    assert.ok(Number.isInteger(l.parTime) && l.parTime >= 60 && l.parTime <= 300);
    const [s3, s2] = l.starThresholds;
    assert.ok(s3 >= l.codeLength && s3 < s2 && s2 < l.maxAttempts, `seuils niveau ${n}: ${s3}/${s2}/${l.maxAttempts}`);
  }
  // Niveaux 26-32 (Normal sans doublons, 9 tentatives) plus exigeants que Débutant 1-18 (sans doublons, 12->10 tentatives)
  assert.ok(getLevel(26).maxAttempts < getLevel(18).maxAttempts);
  // Maître (6 chiffres avec doublons) garantit au moins 9 tentatives pour éviter les parties jouées au hasard
  for (let n = 76; n <= 100; n++) assert.ok(getLevel(n).maxAttempts >= 9);
});

test('deduceEliminatedDigits : identifie uniquement les chiffres des tentatives à 0 bien placé et 0 mal placé', () => {
  const elim = deduceEliminatedDigits([
    { guess: [1, 2, 3, 4], exact: 1, misplaced: 0 },
    { guess: [5, 6, 7, 8], exact: 0, misplaced: 0 },
    { guess: [7, 8, 9, 0], exact: 0, misplaced: 1 }
  ]);
  assert.deepEqual([...elim].sort(), [5, 6, 7, 8]);
});
