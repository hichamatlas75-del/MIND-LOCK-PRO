import { setLang, getLang } from './i18n/index.js';
import { applyTheme } from './services/theme.js';
import { mountMenu } from './ui/menu-view.js';
import { mountGame } from './ui/game-view.js';
import { loadProgress, saveProgress, recordWin, loadActive } from './game/progress.js';
import { TOTAL_LEVELS } from './core/config.js';

const root = document.getElementById('app');
let progress = loadProgress();
let cleanup = () => {};

function show(mount, opts) { cleanup(); cleanup = mount(root, opts); }

function menu() {
  show(mountMenu, {
    progress, active: loadActive(),
    onPlay: n => game(n),
    onResume: () => { const a = loadActive(); a ? game(a.level, { state: a.state, elapsed: a.elapsed }) : menu(); },
    onRefresh: menu
  });
}
function game(n, resume) {
  show(mountGame, {
    levelNumber: n, resume,
    onExit: menu,
    onWin: info => { progress = recordWin(progress, info.level, info); saveProgress(progress); },
    onNext: () => game(Math.min(TOTAL_LEVELS, n + 1))
  });
}

applyTheme(); setLang(getLang()); menu();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
