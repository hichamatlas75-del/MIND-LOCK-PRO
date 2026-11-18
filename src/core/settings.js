import { storage } from './storage.js';
const DEFAULTS = { sound: true, vibration: true, name: '' };
const DEFAULT_VOLUME = 80;

/** Préférences joueur (hors thème et langue, gérés par theme.js / i18n). Valeurs invalides → défauts. */
export function getSettings() {
  const raw = storage.get('settings', null);
  const o = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    sound: typeof o.sound === 'boolean' ? o.sound : DEFAULTS.sound,
    vibration: typeof o.vibration === 'boolean' ? o.vibration : DEFAULTS.vibration,
    name: typeof o.name === 'string' ? o.name.slice(0, 20) : DEFAULTS.name
  };
}
export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  storage.set('settings', { ...getSettings(), [key]: value });
}

/** Volume audio (0 à 100, par défaut 80), stocké séparément pour préserver la compatibilité des sauvegardes. */
export function getVolume() {
  const v = storage.get('volume', DEFAULT_VOLUME);
  return Number.isInteger(v) && v >= 0 && v <= 100 ? v : DEFAULT_VOLUME;
}
export function setVolume(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return;
  storage.set('volume', Math.min(100, Math.max(0, n)));
}
