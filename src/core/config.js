export const APP = { name: 'MIND LOCK PRO', version: '0.2.0', storagePrefix: 'mlp:' };
export const TOTAL_LEVELS = 100;
export const LEVELS_PER_TIER = 25;
export const DIGITS = 10; // chiffres 0-9

/**
 * Paliers de difficulté.
 * codeLength : longueur du code (4 à 6) · baseAttempts/minAttempts : tentatives max
 * (diminuent avec la progression dans le palier) · hints : indices par partie
 * repeatsFrom : index (0-24) du niveau dans le palier à partir duquel les doublons sont permis.
 */
export const DIFFICULTIES = {
  beginner: { codeLength: 4, baseAttempts: 12, minAttempts: 8, hints: 3, repeatsFrom: 15 },
  normal:   { codeLength: 4, baseAttempts: 10, minAttempts: 7, hints: 2, repeatsFrom: 5 },
  expert:   { codeLength: 5, baseAttempts: 10, minAttempts: 7, hints: 1, repeatsFrom: 5 },
  master:   { codeLength: 6, baseAttempts: 10, minAttempts: 7, hints: 0, repeatsFrom: 0 }
};
export const DIFFICULTY_ORDER = ['beginner', 'normal', 'expert', 'master'];
export const LANGS = { fr: 'ltr', en: 'ltr', ar: 'rtl' };
