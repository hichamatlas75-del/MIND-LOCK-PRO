import { t, setLang, getLang } from './i18n/index.js';
import { applyTheme } from './services/theme.js';

function render() {
  document.getElementById('app').innerHTML = `
    <main class="splash">
      <h1 class="logo">${t('title')}</h1>
      <p>${t('tagline')}</p>
      <button class="btn" disabled>${t('play')}</button>
    </main>`;
}
applyTheme(); setLang(getLang()); render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
