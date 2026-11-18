/**
 * Moteur pur (sans DOM) : génération, validation, évaluation, états de partie.
 * Règles = { codeLength, digits, allowRepeats, maxAttempts, hints }.
 */

/** Génère un code (tableau d'entiers 0..digits-1). Sans doublons si !allowRepeats. */
export function generateCode(rules, rng = Math.random) {
  const { codeLength, digits, allowRepeats } = rules;
  if (!allowRepeats && codeLength > digits) throw new RangeError('Code impossible sans doublons');
  if (allowRepeats) return Array.from({ length: codeLength }, () => Math.floor(rng() * digits));
  const pool = Array.from({ length: digits }, (_, i) => i);
  const code = [];
  for (let i = 0; i < codeLength; i++) code.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return code;
}

/** Évalue une tentative : { exact: bien placés, misplaced: mal placés }. Gère les doublons. */
export function evaluateGuess(secret, guess) {
  let exact = 0;
  const rs = [], rg = [];
  secret.forEach((v, i) => { if (v === guess[i]) exact++; else { rs.push(v); rg.push(guess[i]); } });
  let misplaced = 0;
  for (const v of rg) { const i = rs.indexOf(v); if (i !== -1) { misplaced++; rs.splice(i, 1); } }
  return { exact, misplaced };
}

/**
 * Valide une tentative. Retourne { valid:true } ou { valid:false, error } avec error ∈
 * 'notArray' | 'length' | 'notDigit' | 'repeats'.
 */
export function validateGuess(guess, rules) {
  if (!Array.isArray(guess)) return { valid: false, error: 'notArray' };
  if (guess.length !== rules.codeLength) return { valid: false, error: 'length' };
  if (!guess.every(v => Number.isInteger(v) && v >= 0 && v < rules.digits)) return { valid: false, error: 'notDigit' };
  if (!rules.allowRepeats && new Set(guess).size !== guess.length) return { valid: false, error: 'repeats' };
  return { valid: true };
}

/** Crée une partie. status : 'playing' | 'won' | 'lost'. */
export function createGame(rules, rng = Math.random, secret = generateCode(rules, rng)) {
  return { rules, secret, guesses: [], hintsUsed: [], status: 'playing' };
}

/**
 * Soumet une tentative (retourne un NOUVEL état, sans muter l'ancien).
 * { state, error? } — error défini si la tentative est refusée ou la partie terminée.
 */
export function submitGuess(state, guess) {
  if (state.status !== 'playing') return { state, error: 'finished' };
  const v = validateGuess(guess, state.rules);
  if (!v.valid) return { state, error: v.error };
  const result = evaluateGuess(state.secret, guess);
  const guesses = [...state.guesses, { guess: [...guess], ...result }];
  let status = 'playing';
  if (result.exact === state.rules.codeLength) status = 'won';
  else if (guesses.length >= state.rules.maxAttempts) status = 'lost';
  return { state: { ...state, guesses, status } };
}

/** Révèle un chiffre à une position non encore révélée. { state, hint? , error? } */
export function useHint(state, rng = Math.random) {
  if (state.status !== 'playing') return { state, error: 'finished' };
  if (state.hintsUsed.length >= state.rules.hints) return { state, error: 'noHints' };
  const taken = new Set(state.hintsUsed.map(h => h.pos));
  const free = state.secret.map((_, i) => i).filter(i => !taken.has(i));
  if (!free.length) return { state, error: 'noHints' };
  const pos = free[Math.floor(rng() * free.length)];
  const hint = { pos, digit: state.secret[pos] };
  return { state: { ...state, hintsUsed: [...state.hintsUsed, hint] }, hint };
}

export const attemptsLeft = s => s.rules.maxAttempts - s.guesses.length;
export const hintsLeft = s => s.rules.hints - s.hintsUsed.length;
