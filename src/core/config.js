export const APP = { name: 'MIND LOCK PRO', version: '0.1.0', storagePrefix: 'mlp:' };
export const TOTAL_LEVELS = 100;
export const DIFFICULTIES = {
  easy:   { codeLength: 3, symbols: 5, maxAttempts: 12, hints: 3 },
  normal: { codeLength: 4, symbols: 6, maxAttempts: 10, hints: 2 },
  hard:   { codeLength: 5, symbols: 8, maxAttempts: 10, hints: 1 },
  expert: { codeLength: 6, symbols: 9, maxAttempts: 8,  hints: 0 }
};
export const LANGS = { fr: 'ltr', en: 'ltr', ar: 'rtl' };
