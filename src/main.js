import { setLang, getLang } from './i18n/index.js';
import { applyTheme } from './services/theme.js';
import { session } from './game/session.js';
import { isUnlocked } from './game/progress.js';
import { TOTAL_LEVELS } from './core/config.js';
import { mountHome } from './ui/screens/home.js';
import { mountLevels } from './ui/screens/levels.js';
import { mountSettings } from './ui/screens/settings.js';
import { mountGame } from './ui/screens/game.js';

const root = document.getElementById('app');
let cleanup = () => {};
let nextOpts = {}; // options transitoires de navigation (ex. { fresh: true })

/** Routes par hash : #/home · #/levels · #/settings · #/game/<n>  (le bouton Retour Android fonctionne). */
function parse() {
  const [, name = 'home', arg] = location.hash.split('/');
  return { name, n: Number(arg) };
}
function go(path, opts = {}) {
  nextOpts = opts;
  if (location.hash === '#' + path) render(); else location.hash = path;
}
function render() {
  cleanup(); cleanup = () => {};
  const { name, n } = parse(), ctx = { go, rerender: render, session }, opts = nextOpts; nextOpts = {};
  document.documentElement.lang = getLang();
  let mount;
  if (name === 'game' && Number.isInteger(n) && n >= 1 && n <= TOTAL_LEVELS && isUnlocked(session.progress, n)) mount = r => mountGame(r, ctx, { n, fresh: !!opts.fresh });
  else if (name === 'levels') mount = r => mountLevels(r, ctx);
  else if (name === 'settings') mount = r => mountSettings(r, ctx);
  else if (name === 'home') mount = r => mountHome(r, ctx);
  else return go('/home');
  root.innerHTML = '';
  cleanup = mount(root) || (() => {});
  window.scrollTo(0, 0);
}

applyTheme(); setLang(getLang());
window.addEventListener('hashchange', render);
if (!location.hash) history.replaceState(null, '', '#/home');
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
