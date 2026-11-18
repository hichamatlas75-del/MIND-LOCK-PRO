import { setLang, getLang, t } from './i18n/index.js';
import { applyTheme } from './services/theme.js';
import { session } from './game/session.js';
import { isUnlocked, loadActive, clearActive, needsReplaceConfirm } from './game/progress.js';
import { TOTAL_LEVELS } from './core/config.js';
import { mountHome } from './ui/screens/home.js';
import { mountLevels } from './ui/screens/levels.js';
import { mountSettings } from './ui/screens/settings.js';
import { mountGame } from './ui/screens/game.js';
import { confirmDialog, toast } from './ui/components.js';

const root = document.getElementById('app');
let cleanup = () => {};
let nextOpts = {};   // options transitoires de navigation (ex. { fresh: true })
let lastHash = '#/home'; // dernière route affichée (pour annuler une navigation)
let token = 0;       // invalide les rendus obsolètes pendant une confirmation

/** Routes par hash : #/home · #/levels · #/settings · #/game/<n>  (le bouton Retour Android fonctionne). */
function parse() {
  const [, name = 'home', arg] = location.hash.split('/');
  return { name, n: Number(arg) };
}
function go(path, opts = {}) {
  nextOpts = opts;
  if (location.hash === '#' + path) render(); else location.hash = path;
}

async function render() {
  const my = ++token;
  const { name, n } = parse(), opts = nextOpts; nextOpts = {};
  cleanup(); cleanup = () => {}; // sauvegarde l'écran de jeu quittant avant toute décision
  const ctx = { go, rerender: render, session };
  document.documentElement.lang = getLang();

  let mount;
  if (name === 'game' && Number.isInteger(n) && n >= 1 && n <= TOTAL_LEVELS && isUnlocked(session.progress, n)) {
    let fresh = !!opts.fresh;
    // Protection des parties : jamais d'écrasement silencieux d'une partie avec progression.
    if (needsReplaceConfirm(loadActive(), n, fresh)) {
      const ok = await confirmDialog({ title: t('replaceTitle'), text: t('replaceText', { n: loadActive()?.level ?? '' }), confirmLabel: t('confirm') });
      if (my !== token) return;
      if (!ok) { history.replaceState(null, '', lastHash); return render(); } // on revient à l'écran précédent, partie intacte
      clearActive(); fresh = true;
    }
    mount = r => mountGame(r, ctx, { n, fresh });
  }
  else if (name === 'levels') mount = r => mountLevels(r, ctx);
  else if (name === 'settings') mount = r => mountSettings(r, ctx);
  else if (name === 'home') mount = r => mountHome(r, ctx);
  else { history.replaceState(null, '', '#/home'); return render(); }

  root.innerHTML = '';
  cleanup = mount(root) || (() => {});
  lastHash = location.hash;
  window.scrollTo(0, 0);
}

applyTheme(); setLang(getLang());
window.addEventListener('hashchange', render);
if (!location.hash) history.replaceState(null, '', '#/home');
render();

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(console.error);
  // Nouvelle version activée : on prévient le joueur (aucun rechargement forcé en pleine partie).
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) toast(t('updateReady')); });
}
