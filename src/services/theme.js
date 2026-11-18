import { storage } from '../core/storage.js';
const COLORS = { dark: '#090B16', light: '#F3F4FB' };
export const getTheme = () => (storage.get('theme', 'dark') === 'light' ? 'light' : 'dark');
/** Applique le thème (dark | light), le persiste et met à jour la barre système (theme-color). */
export function applyTheme(theme = getTheme()) {
  document.documentElement.dataset.theme = theme; storage.set('theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
}
