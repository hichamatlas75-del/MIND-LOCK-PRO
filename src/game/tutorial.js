import { storage } from '../core/storage.js';
import { evaluateGuess, validateGuess } from './engine.js';

export const TUTORIAL_TOTAL_STEPS = 8;
export const TUTORIAL_RULES = Object.freeze({ codeLength: 4, digits: 10, allowRepeats: false });
export const TUTORIAL_SECRET = Object.freeze([4, 2, 7, 1]);
export const FINAL_SECRET = Object.freeze([8, 3, 5, 2]);

/**
 * Définition des 8 étapes interactives du tutoriel.
 * Aucun accès à la partie en cours (`mlp:active`) : codes pédagogiques fixes et isolés.
 */
export const TUTORIAL_STEPS = Object.freeze([
  { step: 1, key: 'principle', type: 'action', secret: TUTORIAL_SECRET, history: [] },
  { step: 2, key: 'secret',    type: 'choice', secret: TUTORIAL_SECRET, choices: ['4271', '4471', '427'], answer: '4271', history: [] },
  { step: 3, key: 'attempt',   type: 'code',   secret: TUTORIAL_SECRET, target: [4, 7, 9, 0], history: [] },
  { step: 4, key: 'exact',     type: 'choice', secret: TUTORIAL_SECRET, choices: ['4', '7', '9'], answer: '4',
    history: [{ guess: [4, 7, 9, 0], exact: 1, misplaced: 1 }] },
  { step: 5, key: 'misplaced', type: 'choice', secret: TUTORIAL_SECRET, choices: ['7', '4', '0'], answer: '7',
    history: [{ guess: [4, 7, 9, 0], exact: 1, misplaced: 1 }] },
  { step: 6, key: 'absent',    type: 'choice', secret: TUTORIAL_SECRET, choices: ['none', 'all', 'one'], answer: 'none',
    history: [{ guess: [4, 7, 9, 0], exact: 1, misplaced: 1 }, { guess: [6, 8, 9, 0], exact: 0, misplaced: 0 }] },
  { step: 7, key: 'guided',    type: 'code',   secret: TUTORIAL_SECRET, target: [4, 2, 7, 1],
    history: [
      { guess: [4, 7, 9, 0], exact: 1, misplaced: 1 },
      { guess: [6, 8, 9, 0], exact: 0, misplaced: 0 },
      { guess: [4, 2, 1, 5], exact: 2, misplaced: 1 },
      { guess: [4, 2, 7, 3], exact: 3, misplaced: 0 }
    ] },
  { step: 8, key: 'final',     type: 'code',   secret: FINAL_SECRET, target: [8, 3, 5, 2],
    history: [
      { guess: [3, 8, 9, 0], exact: 0, misplaced: 2 },
      { guess: [8, 3, 1, 4], exact: 2, misplaced: 0 },
      { guess: [8, 3, 2, 5], exact: 2, misplaced: 2 }
    ] }
]);

export const defaultTutorial = () => ({ step: 1, completed: false, skipped: false });

export function sanitizeTutorial(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultTutorial();
  const step = Number.isInteger(raw.step) && raw.step >= 1 && raw.step <= TUTORIAL_TOTAL_STEPS ? raw.step : 1;
  return { step, completed: raw.completed === true, skipped: raw.skipped === true };
}
export const loadTutorial = () => sanitizeTutorial(storage.get('tutorial', null));
export const saveTutorial = t => storage.set('tutorial', sanitizeTutorial(t));

export function getTutorialStep(step = 1) {
  if (!Number.isInteger(step) || step < 1 || step > TUTORIAL_TOTAL_STEPS) throw new RangeError('Étape invalide');
  return TUTORIAL_STEPS[step - 1];
}

/**
 * Valide l'action du joueur sur l'étape `step` sans muter l'état.
 * Retourne { ok:boolean, error?:string, evaluation?:{exact:number,misplaced:number,absent:number} }.
 */
export function validateTutorialStep(step, payload) {
  const def = getTutorialStep(step);
  if (def.type === 'action') return payload === 'unlock' ? { ok: true } : { ok: false, error: 'tutTryAgain' };
  if (def.type === 'choice') return payload === def.answer ? { ok: true } : { ok: false, error: 'tutWrongChoice' };
  const v = validateGuess(payload, TUTORIAL_RULES);
  if (!v.valid) return { ok: false, error: v.error };
  const ev = evaluateGuess(def.secret, payload);
  const evaluation = { ...ev, absent: TUTORIAL_RULES.codeLength - ev.exact - ev.misplaced };
  const match = def.target.every((d, i) => d === payload[i]);
  if (!match) return { ok: false, error: step === 3 ? 'tutEnterDemo' : 'tutNotSolved', evaluation };
  return { ok: true, evaluation };
}

/** Applique une réponse validée et fait progresser l'état du tutoriel. Pur. */
export function submitTutorialStep(state, payload) {
  const clean = sanitizeTutorial(state);
  const res = validateTutorialStep(clean.step, payload);
  if (!res.ok) return { state: clean, ...res };
  const last = clean.step >= TUTORIAL_TOTAL_STEPS;
  const next = {
    step: last ? TUTORIAL_TOTAL_STEPS : clean.step + 1,
    completed: clean.completed || last,
    skipped: false
  };
  return { state: next, ok: true, finished: last, evaluation: res.evaluation };
}

export const skipTutorial = state => ({ ...sanitizeTutorial(state), skipped: true });
export const restartTutorial = () => defaultTutorial();
