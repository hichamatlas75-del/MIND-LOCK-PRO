export const APP = { name: 'MIND LOCK PRO', version: '0.3.2', storagePrefix: 'mlp:' };
export const TOTAL_LEVELS = 100;
export const LEVELS_PER_TIER = 25;
export const DIGITS = 10; // chiffres 0-9

/**
 * 4 paliers de 25 niveaux, calibrés sur l'entropie réelle (N combinaisons) :
 * - beginner (1-25)  : 4 chiffres, 1-18 sans doublons (5 040) puis 19-25 avec doublons (10 000), 12→9 coups, 3→2 indices
 * - normal   (26-50) : 4 chiffres, 26-32 sans doublons en 9 coups puis 33-50 avec doublons, 9→8 coups, 2→1 indices
 * - expert   (51-75) : 5 chiffres, 51-60 sans doublons (30 240) puis 61-75 avec doublons (100 000), 11→8 coups, 1 indice
 * - master   (76-100): 6 chiffres avec doublons (1 000 000), 12→9 coups, 1 indice (76-85) puis 0 indice (86-100)
 */
export const DIFFICULTIES = {
  beginner: { codeLength: 4, baseAttempts: 12, minAttempts: 9, stepEvery: 7,  hints: 3, lateHints: 2, hintsDropAt: 18, repeatsFrom: 18, basePar: 60,  parStep: 2 },
  normal:   { codeLength: 4, baseAttempts: 9,  minAttempts: 8, stepEvery: 13, hints: 2, lateHints: 1, hintsDropAt: 15, repeatsFrom: 7,  basePar: 95,  parStep: 2 },
  expert:   { codeLength: 5, baseAttempts: 11, minAttempts: 8, stepEvery: 7,  hints: 1, lateHints: 1, hintsDropAt: 25, repeatsFrom: 10, basePar: 140, parStep: 3 },
  master:   { codeLength: 6, baseAttempts: 12, minAttempts: 9, stepEvery: 7,  hints: 1, lateHints: 0, hintsDropAt: 10, repeatsFrom: 0,  basePar: 200, parStep: 3 }
};
export const DIFFICULTY_ORDER = ['beginner', 'normal', 'expert', 'master'];
export const LANGS = { fr: 'ltr', en: 'ltr', ar: 'rtl' };
