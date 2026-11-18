import { storage } from '../core/storage.js';
export function applyTheme(theme = storage.get('theme', 'dark')) {
  document.documentElement.dataset.theme = theme; storage.set('theme', theme);
}
