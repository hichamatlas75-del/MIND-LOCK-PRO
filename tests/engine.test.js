import test from 'node:test'; import assert from 'node:assert/strict';
import { evaluateGuess } from '../src/game/engine.js';
test('évaluation', () => {
  assert.deepEqual(evaluateGuess([1,2,3,4],[1,2,3,4]), {exact:4,misplaced:0});
  assert.deepEqual(evaluateGuess([1,2,3,4],[4,3,2,1]), {exact:0,misplaced:4});
  assert.deepEqual(evaluateGuess([1,1,2,3],[1,2,1,1]), {exact:1,misplaced:2});
});
