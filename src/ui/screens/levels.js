import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { levelCell, progressBar, animateBars, toast } from '../components.js';
import { DIFFICULTY_ORDER, LEVELS_PER_TIER } from '../../core/config.js';
import { getLevel } from '../../game/levels.js';
import { isUnlocked } from '../../game/progress.js';
import { summarize, summarizeRewards } from '../../game/stats.js';

let selectedTier = null; // mémorise l'onglet entre deux visites

/** Écran des 100 niveaux, organisés en 4 catégories (onglets). */
export function mountLevels(root, ctx) {
  const { progress, stats } = ctx.session;
  const cur = summarize(progress, stats).currentLevel, rw = summarizeRewards(progress);
  if (selectedTier === null) selectedTier = Math.floor((cur - 1) / LEVELS_PER_TIER);
  const tier = selectedTier, first = tier * LEVELS_PER_TIER + 1, last = first + LEVELS_PER_TIER - 1;
  const diff = DIFFICULTY_ORDER[tier], rules = getLevel(first);
  const doneInTier = Object.keys(progress.completed).filter(n => n >= first && n <= last).length;
  const tabs = DIFFICULTY_ORDER.map((d, i) => `<button role="tab" class="tab d-${d} ${i === tier ? 'active' : ''}" data-tier="${i}" aria-selected="${i === tier}">${t(d)}</button>`).join('');
  const cells = Array.from({ length: LEVELS_PER_TIER }, (_, i) => levelCell(first + i, progress, { current: cur, detail: true, justUnlocked: ctx.session.lastUnlockedLevel })).join('');

  root.innerHTML = `
  <main class="screen levels">
    <h1 class="sr-only">${t('levels')}</h1>
    <header class="topbar">
      <button class="icon-btn" data-a="back" aria-label="${t('back')}">${icon('back', 20, 'flip-rtl')}</button>
      <h2 class="page-title">${t('levels')}</h2><span class="spacer"></span>
      <span class="star-pill" aria-label="${t('starsTotal')}">${icon('star', 14, 'on', true)} <b>${rw.totalStars}</b><small>/${rw.maxStars}</small></span>
    </header>
    <div class="scroll">
      <div class="tabs" role="tablist">${tabs}</div>
      <div class="tier-head card glass">
        <div><strong>${t(diff)}</strong><span class="muted">${first}–${last} · ${t('digitsCount', { n: rules.codeLength })}</span></div>
        <div class="tier-metrics">
          <span>${icon('star', 13, 'on', true)} ${rw.tierStars[tier]}/${LEVELS_PER_TIER * 3}</span>
          <b>${doneInTier}/${LEVELS_PER_TIER}</b>
        </div>
      </div>
      ${progressBar(Math.round(doneInTier / LEVELS_PER_TIER * 100), t(diff))}
      <div class="lv-grid detail" style="margin-top:14px">${cells}</div>
    </div>
  </main>`;
  animateBars(root);

  root.onclick = e => {
    const tab = e.target.closest('[data-tier]');
    if (tab) { selectedTier = +tab.dataset.tier; return ctx.rerender(); }
    const lv = e.target.closest('[data-lv]');
    if (lv) return isUnlocked(progress, +lv.dataset.lv) ? ctx.go(`/game/${lv.dataset.lv}`) : toast(t('lockedHint'));
    if (e.target.closest('[data-a="back"]')) ctx.go('/home');
  };
  return () => { root.onclick = null; };
}
