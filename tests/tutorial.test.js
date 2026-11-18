import { raw, read } from './helpers/mock-storage.js';
import test, { beforeEach } from 'node:test'; import assert from 'node:assert/strict';
import {
  TUTORIAL_TOTAL_STEPS, TUTORIAL_STEPS, TUTORIAL_SECRET, FINAL_SECRET,
  defaultTutorial, sanitizeTutorial, loadTutorial, saveTutorial,
  getTutorialStep, validateTutorialStep, submitTutorialStep, skipTutorial, restartTutorial
} from '../src/game/tutorial.js';
import { createGame, submitGuess } from '../src/game/engine.js';
import { getLevel } from '../src/game/levels.js';
import { saveActive, loadActive } from '../src/game/progress.js';

beforeEach(() => localStorage.clear());

test('tutoriel : 8 étapes progressives couvrant tous les concepts demandés', () => {
  assert.equal(TUTORIAL_TOTAL_STEPS, 8);
  assert.equal(TUTORIAL_STEPS.length, 8);
  assert.deepEqual(TUTORIAL_STEPS.map(s => s.key), ['principle', 'secret', 'attempt', 'exact', 'misplaced', 'absent', 'guided', 'final']);
  assert.throws(() => getTutorialStep(0), RangeError);
  assert.throws(() => getTutorialStep(9), RangeError);
});

test('tutoriel : parcours complet des 8 étapes et rejet des réponses erronées', () => {
  let st = defaultTutorial();
  // Étape 1 : principe
  assert.equal(submitTutorialStep(st, 'wrong').ok, false);
  let r = submitTutorialStep(st, 'unlock'); assert.ok(r.ok); st = r.state; assert.equal(st.step, 2);
  // Étape 2 : code secret sans doublons
  assert.equal(submitTutorialStep(st, '4471').ok, false);
  assert.equal(submitTutorialStep(st, '427').ok, false);
  r = submitTutorialStep(st, '4271'); assert.ok(r.ok); st = r.state; assert.equal(st.step, 3);
  // Étape 3 : démonstration d'une tentative (4 7 9 0)
  assert.equal(submitTutorialStep(st, [1, 2, 3]).error, 'length');
  assert.equal(submitTutorialStep(st, [4, 4, 9, 0]).error, 'repeats');
  assert.equal(submitTutorialStep(st, [1, 2, 3, 4]).error, 'tutEnterDemo');
  r = submitTutorialStep(st, [4, 7, 9, 0]);
  assert.ok(r.ok); assert.deepEqual(r.evaluation, { exact: 1, misplaced: 1, absent: 2 });
  st = r.state; assert.equal(st.step, 4);
  // Étape 4 : bien placés
  assert.equal(submitTutorialStep(st, '7').ok, false);
  r = submitTutorialStep(st, '4'); assert.ok(r.ok); st = r.state; assert.equal(st.step, 5);
  // Étape 5 : mal placés
  assert.equal(submitTutorialStep(st, '4').ok, false);
  r = submitTutorialStep(st, '7'); assert.ok(r.ok); st = r.state; assert.equal(st.step, 6);
  // Étape 6 : absents
  assert.equal(submitTutorialStep(st, 'all').ok, false);
  r = submitTutorialStep(st, 'none'); assert.ok(r.ok); st = r.state; assert.equal(st.step, 7);
  // Étape 7 : résolution guidée ([4, 2, 7, 1])
  assert.equal(submitTutorialStep(st, [4, 2, 7, 3]).error, 'tutNotSolved');
  r = submitTutorialStep(st, [...TUTORIAL_SECRET]);
  assert.ok(r.ok); assert.equal(r.evaluation.exact, 4); st = r.state; assert.equal(st.step, 8); assert.equal(st.completed, false);
  // Étape 8 : validation finale ([8, 3, 5, 2])
  assert.equal(submitTutorialStep(st, [8, 3, 2, 5]).error, 'tutNotSolved');
  r = submitTutorialStep(st, [...FINAL_SECRET]);
  assert.ok(r.ok); assert.equal(r.finished, true); assert.equal(r.evaluation.exact, 4);
  st = r.state; assert.equal(st.completed, true); assert.equal(st.step, 8);
});

test('tutoriel : passer, recommencer et résistance aux données LocalStorage corrompues', () => {
  let st = skipTutorial({ step: 4, completed: false, skipped: false });
  saveTutorial(st);
  assert.deepEqual(loadTutorial(), { step: 4, completed: false, skipped: true });
  st = restartTutorial(); saveTutorial(st);
  assert.deepEqual(loadTutorial(), { step: 1, completed: false, skipped: false });
  for (const bad of ['{bad', 'null', '42', '[]', JSON.stringify({ step: 99, completed: 'yes' })]) {
    raw('tutorial', bad);
    assert.deepEqual(loadTutorial(), { step: 1, completed: false, skipped: false });
  }
});

test('tutoriel : isolation stricte vis-à-vis de la partie active (aucune fuite ni écrasement du secret)', () => {
  const rules = getLevel(1);
  let g = createGame(rules, Math.random, [9, 1, 5, 3]);
  g = submitGuess(g, [1, 2, 3, 4]).state;
  saveActive({ level: 1, state: g, elapsed: 33, input: [9] });
  const before = read('active');

  let tState = loadTutorial();
  tState = submitTutorialStep(tState, 'unlock').state;
  tState = submitTutorialStep(tState, '4271').state;
  saveTutorial(tState);
  saveTutorial(skipTutorial(tState));
  saveTutorial(restartTutorial());

  assert.equal(read('active'), before);
  assert.deepEqual(loadActive().state.secret, [9, 1, 5, 3]);
  assert.notDeepEqual(TUTORIAL_SECRET, loadActive().state.secret);
});
