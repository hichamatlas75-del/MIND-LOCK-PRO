import { t, setLang, getLang, langs } from '../i18n/index.js';
import { TOTAL_LEVELS } from '../core/config.js';
import { getLevel } from '../game/levels.js';
import { isUnlocked } from '../game/progress.js';
import { applyTheme } from '../services/theme.js';
import { storage } from '../core/storage.js';

/** Écran d'accueil : grille des 100 niveaux. opts : { progress, active, onPlay(n), onResume(), onRefresh() } */
export function mountMenu(root, opts) {
  const { progress, active } = opts;
  const cells = Array.from({ length: TOTAL_LEVELS }, (_, i) => {
    const n = i + 1, open = isUnlocked(progress, n), done = progress.completed[n];
    return `<button class="cell ${getLevel(n).difficulty} ${done ? 'done' : ''}" data-n="${n}" ${open ? '' : 'disabled'}
      aria-label="${t('level')} ${n}">${open ? n : '🔒'}${done ? '<em>✓</em>' : ''}</button>`;
  }).join('');
  root.innerHTML = `
    <main class="menu">
      <h1 class="logo">${t('title')}</h1><p>${t('tagline')}</p>
      <div class="tools">
        <button class="icon" id="theme" aria-label="${t('theme')}">🌓</button>
        <select id="lang" aria-label="${t('lang')}">${langs.map(l => `<option ${l === getLang() ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      ${active ? `<button class="btn" id="resume">▶ ${t('resume')} (${t('level')} ${active.level})</button>` : ''}
      <h2>${t('levels')}</h2><div class="grid">${cells}</div>
    </main>`;
  root.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.n) opts.onPlay(Number(b.dataset.n));
    else if (b.id === 'resume') opts.onResume();
    else if (b.id === 'theme') { applyTheme(storage.get('theme', 'dark') === 'dark' ? 'light' : 'dark'); }
  };
  root.querySelector('#lang').onchange = e => { setLang(e.target.value); opts.onRefresh(); };
  return () => { root.onclick = null; };
}
