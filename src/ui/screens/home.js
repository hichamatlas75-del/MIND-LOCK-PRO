import { t, setLang } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { logo, langSelect, levelCell, progressBar, animateBars, fmtTime, esc, avatarInitial, diffBadge, toast } from '../components.js';
import { summarize, summarizeRewards } from '../../game/stats.js';
import { getLevel } from '../../game/levels.js';
import { loadActive, isUnlocked } from '../../game/progress.js';
import { loadTutorial } from '../../game/tutorial.js';
import { loadDailyStore, formatDateKey } from '../../game/daily.js';
import { getSettings } from '../../core/settings.js';
import { sfx } from '../../services/audio.js';
import { LEVELS_PER_TIER } from '../../core/config.js';

/** Tableau de bord : profil, progression globale, défi quotidien, tutoriel, statistiques, aperçu des niveaux. */
export function mountHome(root, ctx) {
  const { progress, stats, lastUnlockedLevel } = ctx.session;
  const sm = summarize(progress, stats), rw = summarizeRewards(progress), cur = sm.currentLevel, lvl = getLevel(cur);
  const tut = loadTutorial(), daily = loadDailyStore(), todayDone = !!daily.history[formatDateKey()];
  const name = getSettings().name.trim(), initial = avatarInitial(name);
  const active = loadActive();
  const tierStart = Math.floor((cur - 1) / LEVELS_PER_TIER) * LEVELS_PER_TIER + 1;
  const cells = Array.from({ length: LEVELS_PER_TIER }, (_, i) =>
    levelCell(tierStart + i, progress, { current: cur, justUnlocked: lastUnlockedLevel })).join('');
  const stat = (ic, value, label) => `<div class="stat card"><span class="stat-ic">${icon(ic, 18)}</span><strong>${value}</strong><span>${label}</span></div>`;

  root.innerHTML = `
  <main class="screen home">
    <h1 class="sr-only">${t('title')}</h1>
    <header class="topbar">
      ${logo()}<span class="spacer"></span>
      ${langSelect()}
      <button class="icon-btn" data-a="tutorial" aria-label="${t('tutorial')}">${icon('help', 20)}</button>
      <button class="icon-btn" data-a="settings" aria-label="${t('settings')}">${icon('settings', 20)}</button>
      <button class="avatar" data-a="stats" aria-label="${t('profile')}">${initial || icon('user', 18)}</button>
    </header>
    <div class="scroll">
      <div class="hero card glass">
        <div class="hero-top">
          <p class="eyebrow">${name ? t('welcomeName', { name: esc(name) }) : t('welcome')}</p>
          <span class="star-pill" aria-label="${t('starsTotal')}">${icon('star', 14, 'on', true)} <b>${rw.totalStars}</b><small>/${rw.maxStars}</small></span>
        </div>
        <div class="hero-level">
          <div><span class="muted">${t('currentLevel')}</span><strong class="big">${cur}</strong></div>
          ${diffBadge(lvl.difficulty, ` · ${t('digitsCount', { n: lvl.codeLength })}`)}
        </div>
        <div class="progress-head"><span class="muted">${t('overall')}</span><b>${sm.percent}%</b></div>
        ${progressBar(sm.percent)}
        <div class="cta">
          <button class="btn primary lg" data-a="continue">${icon('play', 18, '', true)}<span>${t('continue_')}</span></button>
          <button class="btn ghost" data-a="new">${t('newGame')}</button>
        </div>
      </div>

      <div class="card daily-banner">
        <span class="ri-ic">${icon('calendar', 18)}</span>
        <div class="ri-text">
          <strong>${t('dailyChallenge')} ${daily.streak ? `<span class="badge d-master">🔥 ${daily.streak}</span>` : ''}</strong>
          <small>${t('dailySub')}</small>
        </div>
        <button class="btn ${todayDone ? 'ghost' : 'primary'} sm" data-a="daily">${todayDone ? '✓ ' + t('done') : t('play')}</button>
      </div>

      <div class="card tut-banner">
        <div class="ri-text">
          <strong>${icon('bulb', 16)} ${t(tut.completed ? 'replayTutorial' : 'startTutorial')}</strong>
          <small>${t('tutorialSub')}</small>
        </div>
        <button class="btn ${tut.completed ? 'ghost' : 'primary'} sm" data-a="tutorial">${t('tutorial')}</button>
      </div>

      <div class="section-head"><h2 class="section-title">${t('stats')}</h2>
        <button class="link" data-a="stats">${t('profileStats')} ${icon('back', 14, 'flip-rtl-inv')}</button></div>
      <div class="stats">
        ${stat('check', `${sm.completed}<small>/100</small>`, t('completedLevels'))}
        ${stat('clock', sm.bestTime === null ? '—' : fmtTime(sm.bestTime), t('bestTime'))}
        ${stat('target', `${sm.rate}<small>%</small>`, t('successRate'))}
        ${stat('flame', sm.streak, t('winStreak'))}
      </div>

      <div class="section-head"><h2 class="section-title">${t('levels')}</h2>
        <button class="link" data-a="levels">${t('seeAll')} ${icon('back', 14, 'flip-rtl-inv')}</button></div>
      <div class="lv-grid">${cells}</div>
    </div>
  </main>`;
  animateBars(root);

  root.onchange = e => { if (e.target.dataset.a === 'lang') { sfx.click(); setLang(e.target.value); ctx.rerender(); } };
  root.onclick = e => {
    const lv = e.target.closest('[data-lv]');
    if (lv) { sfx.click(); return isUnlocked(progress, +lv.dataset.lv) ? ctx.go(`/game/${lv.dataset.lv}`) : toast(t('lockedHint')); }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    sfx.click();
    if (a === 'settings') ctx.go('/settings');
    else if (a === 'tutorial') ctx.go('/tutorial');
    else if (a === 'daily') ctx.go('/daily');
    else if (a === 'stats') ctx.go('/stats');
    else if (a === 'levels') ctx.go('/levels');
    else if (a === 'continue') ctx.go(`/game/${active ? active.level : cur}`);
    else if (a === 'new') ctx.go(`/game/${cur}`, { fresh: true });
  };
  return () => { root.onclick = null; root.onchange = null; };
}
