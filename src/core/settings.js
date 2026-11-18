import { storage } from './storage.js';
const DEFAULTS = { sound: true, vibration: true, name: '' };
/** Préférences joueur (hors thème et langue, gérés par theme.js / i18n). */
export const getSettings = () => ({ ...DEFAULTS, ...(storage.get('settings', {}) || {}) });
export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  storage.set('settings', { ...getSettings(), [key]: value });
}
