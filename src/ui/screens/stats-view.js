import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { fmtTime, esc, avatarInitial, progressBar, animateBars } from '../components.js';
import { summarizeDashboard } from '../../game/stats.js';
import { loadDailyStore } from '../../game/daily.js';
import { getSettings } from '../../core/settings.js';
import { sfx } from '../../services/audio.js';

/**
 * Écran Profil & Statistiques complet (#/stats — Axe 5) :
 * Affiche les 9 indicateurs joueur et la progression détaillée des 4 catégories.
 */
export function mountStats(root, ctx) {
  const { progress, stats } = ctx.session;
  const daily = loadDailyStore();
  const d = summarizeDashboard(progress, stats, daily);
  const name = getSettings().name.trim(), initial = avatarInitial(name);
  const card = (ic, val, label) => `<div class="stat card"><span class="stat-ic">${icon(ic, 18)}</span><strong>${val}</strong><span>${label}</span></div>`;
  const cats = d.categories.map(c => `
    <div class="cat-row">
      <div class="cat-head">
        <strong>${t(c.key)} <small class="muted">(${c.first}–${c.last})</small></strong>
        <span>${icon('star', 13, 'on', true)} ${c.stars}/${c.maxStars} · <b>${c.completed}/${c.total}</b></span>
      </div>
      ${progressBar(c.percent, t(c.key))}
    </div>`).join('');

  root.innerHTML = `
  <main class="screen stats-screen">
    <h1 class="sr-only">${t('profileStats')}</h1>
    <header class="topbar">
      <button class="icon-btn" data-a="back" aria-label="${t('back')}">${icon('back', 20, 'flip-rtl')}</button>
      <h2 class="page-title">${t('profileStats')}</h2><span class="spacer"></span>
      <button class="icon-btn" data-a="settings" aria-label="${t('settings')}">${icon('settings', 20)}</button>
    </header>
    <div class="scroll">
      <div class="card glass row-item">
        <span class="avatar lg">${initial || icon('user', 22)}</span>
        <div class="ri-text">
          <strong>${name ? esc(name) : t('welcome')}</strong>
          <small>${t('completedLevels')} : ${d.completedLevels}/${d.totalLevels}</small>
        </div>
        <span class="star-pill">${icon('star', 14, 'on', true)} <b>${d.totalStars}</b><small>/${d.maxStars}</small></span>
      </div>

      <h2 class="section-title">${t('stats')}</h2>
      <div class="stats">
        ${card('target', d.totalGames, t('totalGames'))}
        ${card('check', `${d.rate}<small>%</small>`, t('successRate'))}
        ${card('clock', d.avgTime === null ? '—' : fmtTime(d.avgTime), t('avgTime'))}
        ${card('trophy', d.bestTime === null ? '—' : fmtTime(d.bestTime), t('bestTime'))}
        ${card('star', `${d.totalStars}<small>/${d.maxStars}</small>`, t('starsTotal'))}
        ${card('grid', `${d.completedLevels}<small>/${d.totalLevels}</small>`, t('completedLevels'))}
        ${card('flame', `${d.winStreak} <small>(${d.bestStreak})</small>`, t('winStreak'))}
        ${card('calendar', `${d.dailyWins} <small>(🔥${d.dailyStreak})</small>`, t('dailyWinsLabel'))}
      </div>

      <h2 class="section-title">${t('categoryProgress')}</h2>
      <div class="card stack">${cats}</div>
    </div>
  </main>`;
  animateBars(root);

  root.onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'back') { sfx.click(); ctx.go('/home'); }
    else if (a === 'settings') { sfx.click(); ctx.go('/settings'); }
  };
  return () => { root.onclick = null; };
}
