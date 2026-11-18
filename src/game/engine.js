/** Moteur pur (sans DOM) : génération du code et évaluation d'une tentative. */
export function generateCode(length, symbols, rng = Math.random) {
  return Array.from({ length }, () => Math.floor(rng() * symbols));
}
/** Retourne { exact, misplaced } (bien placés / mal placés). */
export function evaluateGuess(secret, guess) {
  let exact = 0;
  const s = [], g = [];
  secret.forEach((v, i) => { if (v === guess[i]) exact++; else { s.push(v); g.push(guess[i]); } });
  let misplaced = 0;
  for (const v of g) { const i = s.indexOf(v); if (i !== -1) { misplaced++; s.splice(i, 1); } }
  return { exact, misplaced };
}
