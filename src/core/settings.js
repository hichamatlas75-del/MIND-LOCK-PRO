import { storage } from './storage.js';
const DEFAULTS = { sound: true, vibration: true, name: '' };
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
