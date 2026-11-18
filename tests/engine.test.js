import test from 'node:test'; import assert from 'node:assert/strict';
import { generateCode, evaluateGuess, validateGuess, createGame, submitGuess, useHint, attemptsLeft, hintsLeft } from '../src/game/engine.js';

/** Implémentation de référence indépendante (comptage par chiffre). */
function reference(secret, guess) {
  const exact = secret.filter((v, i) => v === guess[i]).length;
  let common = 0;
  for (let d = 0; d < 10; d++) common += Math.min(secret.filter(x => x === d).length, guess.filter(x => x === d).length);
  return { exact, misplaced: common - exact };
}
const seq = (len, base) => Array.from({ length: base ** len }, (_, n) =>
  Array.from({ length: len }, (_, i) => Math.floor(n / base ** (len - 1 - i)) % base));
const rules = (o = {}) => ({ codeLength: 4, digits: 10, allowRepeats: false, maxAttempts: 3, hints: 2, ...o });
const seeded = () => { let s = 42; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; };

test('évaluation : toutes les combinaisons (longueur 4, 4 symboles) = référence', () => {
  const all = seq(4, 4); let n = 0;
  for (const s of all) for (const g of all) { assert.deepEqual(evaluateGuess(s, g), reference(s, g), `${s}|${g}`); n++; }
  assert.equal(n, 65536);
});
test('évaluation : longueurs 5 et 6 (3 symboles) = référence', () => {
  for (const len of [5, 6]) { const all = seq(len, 3);
    for (const s of all) for (const g of all) assert.deepEqual(evaluateGuess(s, g), reference(s, g)); }
});
test('évaluation : cas de doublons connus', () => {
  assert.deepEqual(evaluateGuess([1,1,2,3],[1,2,1,1]), { exact: 1, misplaced: 2 });
  assert.deepEqual(evaluateGuess([1,1,1,1],[1,1,1,1]), { exact: 4, misplaced: 0 });
  assert.deepEqual(evaluateGuess([1,1,1,2],[2,2,2,1]), { exact: 0, misplaced: 2 });
  assert.deepEqual(evaluateGuess([1,2,3,4],[4,3,2,1]), { exact: 0, misplaced: 4 });
  assert.deepEqual(evaluateGuess([0,0,0,0],[1,2,3,4]), { exact: 0, misplaced: 0 });
});
test('génération : longueurs 4-6, chiffres 0-9, sans doublons => uniques', () => {
  const rng = seeded();
  for (const len of [4, 5, 6]) for (let i = 0; i < 500; i++) {
    const c = generateCode(rules({ codeLength: len }), rng);
    assert.equal(c.length, len); assert.equal(new Set(c).size, len);
    assert.ok(c.every(d => Number.isInteger(d) && d >= 0 && d <= 9));
  }
});
test('génération : avec doublons, les doublons apparaissent et restent valides', () => {
  const rng = seeded(); let dup = false;
  for (let i = 0; i < 500; i++) {
    const c = generateCode(rules({ allowRepeats: true, codeLength: 6 }), rng);
    assert.ok(c.every(d => d >= 0 && d <= 9)); if (new Set(c).size < 6) dup = true;
  }
  assert.ok(dup);
});
test('génération : impossible sans doublons si longueur > chiffres', () => {
  assert.throws(() => generateCode(rules({ codeLength: 5, digits: 4 })), RangeError);
});
test('validation : codes incorrects', () => {
  const r = rules();
  assert.deepEqual(validateGuess([1,2,3,4], r), { valid: true });
  assert.equal(validateGuess('1234', r).error, 'notArray');
  assert.equal(validateGuess(null, r).error, 'notArray');
  assert.equal(validateGuess([1,2,3], r).error, 'length');
  assert.equal(validateGuess([1,2,3,4,5], r).error, 'length');
  assert.equal(validateGuess([1,2,3,10], r).error, 'notDigit');
  assert.equal(validateGuess([1,2,3,-1], r).error, 'notDigit');
  assert.equal(validateGuess([1,2,3,1.5], r).error, 'notDigit');
  assert.equal(validateGuess([1,2,3,'4'], r).error, 'notDigit');
  assert.equal(validateGuess([1,2,3,NaN], r).error, 'notDigit');
  assert.equal(validateGuess([1,2,3,1], r).error, 'repeats');
  assert.deepEqual(validateGuess([1,2,3,1], rules({ allowRepeats: true })), { valid: true });
});
test('tentative invalide : état inchangé, pas de tentative consommée', () => {
  const g = createGame(rules(), seeded(), [1,2,3,4]);
  const r = submitGuess(g, [1,1,2,3]);
  assert.equal(r.error, 'repeats'); assert.equal(r.state, g); assert.equal(attemptsLeft(g), 3);
});
test('victoire : au premier coup et après erreurs', () => {
  let g = createGame(rules(), Math.random, [1,2,3,4]);
  g = submitGuess(g, [4,3,2,1]).state; assert.equal(g.status, 'playing');
  g = submitGuess(g, [1,2,3,4]).state;
  assert.equal(g.status, 'won'); assert.equal(g.guesses.length, 2);
  assert.equal(submitGuess(g, [1,2,3,4]).error, 'finished');
});
test('défaite : limite de tentatives exacte', () => {
  let g = createGame(rules({ maxAttempts: 3 }), Math.random, [1,2,3,4]);
  for (let i = 1; i <= 3; i++) {
    assert.equal(g.status, 'playing'); g = submitGuess(g, [5,6,7,8]).state; assert.equal(attemptsLeft(g), 3 - i);
  }
  assert.equal(g.status, 'lost'); assert.equal(g.guesses.length, 3);
  assert.equal(submitGuess(g, [1,2,3,4]).error, 'finished');
  assert.equal(g.guesses.length, 3);
});
test('victoire à la dernière tentative = victoire (pas défaite)', () => {
  let g = createGame(rules({ maxAttempts: 2 }), Math.random, [1,2,3,4]);
  g = submitGuess(g, [5,6,7,8]).state; g = submitGuess(g, [1,2,3,4]).state;
  assert.equal(g.status, 'won');
});
test('immutabilité de l\'état', () => {
  const g = createGame(rules(), Math.random, [1,2,3,4]);
  submitGuess(g, [5,6,7,8]); assert.equal(g.guesses.length, 0);
});
test('indices : révèle des positions distinctes, limités par les règles', () => {
  let g = createGame(rules({ hints: 2 }), Math.random, [1,2,3,4]);
  const a = useHint(g); g = a.state; const b = useHint(g); g = b.state;
  assert.notEqual(a.hint.pos, b.hint.pos);
  assert.equal(g.secret[a.hint.pos], a.hint.digit);
  assert.equal(hintsLeft(g), 0); assert.equal(useHint(g).error, 'noHints');
  assert.equal(useHint(createGame(rules({ hints: 0 }))).error, 'noHints');
});
test('indices : refusés si partie terminée', () => {
  let g = createGame(rules(), Math.random, [1,2,3,4]); g = submitGuess(g, [1,2,3,4]).state;
  assert.equal(useHint(g).error, 'finished');
});
