import { APP } from './config.js';
export const storage = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(APP.storagePrefix + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(APP.storagePrefix + key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) { try { localStorage.removeItem(APP.storagePrefix + key); } catch {} }
};
