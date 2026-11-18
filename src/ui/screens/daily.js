import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { fmtTime, stars, diffBadge, toast, confetti } from '../components.js';
import { DAILY_RULES } from '../../core/config.js';
import { deduceEliminatedDigits } from '../../game/levels.js';
import { submitGuess, useHint, hintsLeft } from '../../game/engine.js';
import {
  formatDateKey, recentDateKeys, createDailyGame,
  loadDailyStore, saveDailyStore, canPlayDaily, recordDailyFinish, formatDailyShare
} from '../../game/daily.js';
import { sfx } from '../../services/audio.js';
import { vibrate } from '../../services/haptics.js';

/**
 * Écran du Défi Quotidien (#/daily) :
 * - Code secret déterministe par date (identique pour tous les joueurs).
 * - Une seule participation comptabilisée par jour.
 * - Calendrier des 14 derniers jours, série quotidienne et partage sans spoiler.
 */
export function mountDaily(root, ctx) {
  const todayKey = formatDateKey();
  let store = loadDailyStore();
  const eligibility = canPlayDaily(store, todayKey);
  const resume = eligibility.allowed && store.active && store.active.dateKey === todayKey
    && store.active.state?.status === 'playing' ? store.active : null;
  let state = eligibility.allowed ? (resume ? resume.state : createDailyGame(todayKey)) : null;
  let elapsed = resume ? (resume.elapsed || 0) : 0;
  let input = resume && Array.isArray(resume.input) ? [...resume.input] : [];
  let paused = false, msg = '';
  const $ = s => root.querySelector(s);
  const playing = () => !!state && state.status === 'playing' && !paused;

  function persistActive() {
    if (!state || state.status !== 'playing') return;
    store = { ...store, active: { dateKey: todayKey, state, elapsed, input } };
    saveDailyStore(store);
  }

  function renderCalendar() {
    const days = recentDateKeys(todayKey, 14);
    return `<div class="daily-cal" role="list" aria-label="${t('dailyCalendar')}">${days.map(k => {
      const e = store.history[k];
      const dayNum = k.slice(8);
      const cls = e ? (e.status === 'won' ? 'won' : 'lost') : (k === todayKey ? 'today' : '');
      const sym = e ? (e.status === 'won' ? '✓' : '×') : '·';
      return `<div class="cal-day ${cls}" role="listitem" aria-label="${k} ${e ? e.status : ''}"><small>${dayNum}</small><b>${sym}</b></div>`;
    }).join('')}</div>`;
  }

  function renderSummaryView(entry, clockSkew = false) {
    const won = entry?.status === 'won';
    const gridRows = (entry?.grid || []).map(r =>
      `<div class="share-row">${'🟢'.repeat(r.exact)}${'🔵'.repeat(r.misplaced)}${'⚪'.repeat(r.absent)}</div>`
    ).join('');
    root.innerHTML = `
    <main class="screen daily">
      <h1 class="sr-only">${t('dailyChallenge')}</h1>
      <header class="topbar">
        <button class="icon-btn" data-a="back" aria-label="${t('back')}">${icon('back', 20, 'flip-rtl')}</button>
        <div class="title"><strong>${t('dailyChallenge')}</strong><small class="muted">${todayKey}</small></div>
        <span class="star-pill">${icon('flame', 14)} <b>${store.streak}</b></span>
      </header>
      <div class="scroll">
        ${clockSkew ? `<div class="card"><p class="msg" role="alert">${t('dailyClockSkew')}</p></div>` : `
        <div class="card glass tut-done">
          ${won ? '<div class="confetti" id="daily-confetti" aria-hidden="true"></div>' : ''}
          <div class="badge-ic ${won ? 'win' : 'lose'}">${icon(won ? 'unlock' : 'x', 28)}</div>
          <h2>${t(won ? 'dailyDoneTitle' : 'dailyLostTitle')}</h2>
          ${won ? stars(entry.stars, 24) : ''}
          <div class="result-stats">
            <div>${icon('clock', 16)}<strong>${fmtTime(entry.time)}</strong><span>${t('time')}</span></div>
            <div>${icon('target', 16)}<strong>${entry.attempts}/${entry.maxAttempts}</strong><span>${t('attempts')}</span></div>
          </div>
          <div class="share-preview" aria-label="${t('dailyShare')}">${gridRows}</div>
          <p class="muted">${t('dailyComeBack')}</p>
          <div class="cta" style="width:100%;max-width:340px">
            <button class="btn primary lg" data-a="share">${icon('share', 18)}<span>${t('dailyShare')}</span></button>
            <button class="btn ghost" data-a="back">${t('back')}</button>
          </div>
        </div>`}
        <div class="stats" style="margin-top:12px">
          <div class="stat card"><span class="stat-ic">${icon('flame', 18)}</span><strong>${store.streak}</strong><span>${t('dailyStreak')}</span></div>
          <div class="stat card"><span class="stat-ic">${icon('trophy', 18)}</span><strong>${store.bestStreak}</strong><span>${t('dailyBestStreak')}</span></div>
        </div>
        <h2 class="section-title">${t('dailyCalendar')}</h2>
        <div class="card">${renderCalendar()}</div>
      </div>
    </main>`;
    if (won) confetti(root.querySelector('#daily-confetti'));
  }

  function renderPlayView() {
    const done = state.status !== 'playing';
    const hinted = new Map(state.hintsUsed.map(h => [h.pos, h.digit]));
    const elim = deduceEliminatedDigits(state.guesses);
    const secretSlots = state.secret.map((d, i) =>
      done ? `<span class="slot revealed ${state.status}" style="--i:${i}">${d}</span>`
      : hinted.has(i) ? `<span class="slot hinted">${hinted.get(i)}</span>`
      : `<span class="slot masked">${icon('lock', 15)}</span>`).join('');
    const pips = Array.from({ length: DAILY_RULES.maxAttempts }, (_, i) =>
      `<i class="${i < state.guesses.length ? 'used' : ''}"></i>`).join('') + `<span>${state.guesses.length}/${DAILY_RULES.maxAttempts}</span>`;
    const hist = !state.guesses.length
      ? `<div class="empty">${icon('calendar', 26)}<p>${t('dailyRulesNote')}</p></div>`
      : state.guesses.map((g, i) => {
          const abs = DAILY_RULES.codeLength - g.exact - g.misplaced;
          return `<div class="attempt ${i === state.guesses.length - 1 ? 'new' : ''}">
            <span class="idx">${i + 1}</span>
            <span class="digits">${g.guess.map((d, k) => `<b style="--k:${k}">${d}</b>`).join('')}</span>
            <span class="fb">
              <span class="pill ok" aria-label="${g.exact} ${t('placed')}">${icon('check', 12)}${g.exact}</span>
              <span class="pill mid" aria-label="${g.misplaced} ${t('misplaced')}"><i class="swap">⇄</i>${g.misplaced}</span>
              <span class="pill abs" aria-label="${abs} ${t('absent')}">${icon('x', 11)}${abs}</span>
            </span></div>`;
        }).join('');
    const entry = Array.from({ length: DAILY_RULES.codeLength }, (_, i) => {
      const has = input[i] !== undefined;
      const ghost = !has && hinted.has(i) ? `<em class="ghost" aria-hidden="true">${hinted.get(i)}</em>` : '';
      return `<span class="slot entry-slot ${has ? 'filled' : ''} ${i === input.length ? 'next' : ''}" data-slot="${i}">${has ? input[i] : ghost}</span>`;
    }).join('');
    const full = input.length >= DAILY_RULES.codeLength, on = playing();
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => {
      const dis = !on || full || input.includes(d);
      return `<button class="key ${elim.has(d) ? 'eliminated' : ''}" data-d="${d}" ${dis ? 'disabled' : ''} aria-label="${d}">${d}</button>`;
    }).join('');

    root.innerHTML = `
    <main class="screen game daily-game ${paused ? 'is-paused' : ''}">
      <h1 class="sr-only">${t('dailyChallenge')}</h1>
      <header class="topbar">
        <button class="icon-btn" data-a="back" aria-label="${t('back')}">${icon('back', 20, 'flip-rtl')}</button>
        <div class="title"><strong>${t('dailyChallenge')}</strong>
          ${diffBadge('expert', ` · ${todayKey}`)}</div>
        <div class="timer-pill">${icon('clock', 15)}<span id="timer">${fmtTime(elapsed)}</span></div>
        <button class="icon-btn" data-a="pause" aria-label="${t('pause')}">${icon('pause', 18)}</button>
      </header>
      <div class="board">
        <div class="card glass secret">
          <div class="secret-head"><span>${icon('calendar', 14)} ${t('secretCode')}</span><span class="muted">${t('repeatsOff')}</span></div>
          <div class="secret-slots" id="secret">${secretSlots}</div>
          <div class="pips" id="pips" aria-label="${t('attempts')}">${pips}</div>
          <div class="legend" aria-label="${t('legend')}">
            <span class="pill ok">${icon('check', 11)} ${t('placed')}</span>
            <span class="pill mid"><i class="swap">⇄</i> ${t('misplaced')}</span>
            <span class="pill abs">${icon('x', 11)} ${t('absent')}</span>
          </div>
        </div>
        <div class="history" id="history" aria-live="polite">${hist}</div>
      </div>
      <div class="dock">
        <p class="msg" id="msg" role="alert">${msg}</p>
        <div class="entry" id="entry">${entry}</div>
        <div class="actions">
          <button class="btn ghost sm" data-a="hint" ${!on || hintsLeft(state) <= 0 ? 'disabled' : ''}>${icon('bulb', 16)}<span>${t('hint')}</span><b>${hintsLeft(state)}</b></button>
        </div>
        <div class="keypad" id="keypad">${keys}
          <button class="key alt wide2" data-a="erase" ${!on || !input.length ? 'disabled' : ''} aria-label="${t('erase')}">${icon('backspace', 22)}</button>
          <button class="key go wide3" data-a="submit" ${!on || !full ? 'disabled' : ''}>${icon('check', 20)}<span>${t('validate')}</span></button>
        </div>
      </div>
      <div id="overlay">${paused ? `<div class="overlay pause"><div class="sheet center" role="dialog" aria-modal="true" aria-label="${t('paused')}">
        <div class="badge-ic">${icon('pause', 26)}</div><h2>${t('paused')}</h2>
        <p class="muted">${todayKey} · ${fmtTime(elapsed)}</p>
        <small class="muted">${t('pausedHidden')}</small>
        <button class="btn primary lg" data-a="resume">${icon('play', 18, '', true)}<span>${t('resumeGame')}</span></button>
        <button class="btn ghost" data-a="back">${t('quit')}</button></div></div>` : ''}</div>
    </main>`;
    const h = $('#history'); if (h) h.scrollTop = h.scrollHeight;
  }

  function render() {
    const check = canPlayDaily(store, todayKey);
    if (!check.allowed) {
      if (check.reason === 'clockSkew') renderSummaryView(null, true);
      else renderSummaryView(check.entry, false);
      return;
    }
    renderPlayView();
  }

  const tick = setInterval(() => {
    if (!playing()) return;
    elapsed++;
    const tEl = $('#timer'); if (tEl) tEl.textContent = fmtTime(elapsed);
    if (elapsed % 5 === 0) persistActive();
  }, 1000);

  function press(d) {
    if (!playing() || input.length >= DAILY_RULES.codeLength || input.includes(d)) return;
    input.push(d); msg = ''; sfx.digit(); vibrate(8); persistActive(); render();
  }
  function erase() {
    if (!playing() || !input.length) return;
    input.pop(); msg = ''; sfx.click(); persistActive(); render();
  }
  function submit() {
    if (!playing()) return;
    const r = submitGuess(state, input);
    if (r.error) { msg = t(r.error); sfx.invalid(); vibrate([30, 40, 30]); render(); return; }
    state = r.state; input = []; msg = '';
    const last = state.guesses.at(-1);
    last.exact ? sfx.hint() : sfx.submit(); vibrate(15);
    if (state.status !== 'playing') {
      const fin = recordDailyFinish(store, todayKey, state, elapsed);
      store = fin.store; saveDailyStore(store);
      state.status === 'won' ? sfx.win() : sfx.lose();
    } else persistActive();
    render();
  }
  function hint() {
    if (!playing()) return;
    const r = useHint(state);
    if (r.error) { msg = t(r.error); sfx.invalid(); render(); return; }
    state = r.state; sfx.hint(); vibrate(20); persistActive(); render();
  }
  async function share() {
    const entry = store.history[todayKey];
    if (!entry) return;
    const text = formatDailyShare(todayKey, entry);
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch {}
    try { await navigator.clipboard.writeText(text); } catch {}
    toast(t('dailyCopied'));
  }

  root.onclick = e => {
    const slot = e.target.closest('[data-slot]');
    if (slot && playing()) {
      const idx = +slot.dataset.slot;
      if (idx < input.length) { input = input.slice(0, idx); msg = ''; sfx.click(); persistActive(); render(); }
      return;
    }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d !== undefined) return press(+b.dataset.d);
    const a = b.dataset.a;
    if (a === 'erase') erase();
    else if (a === 'submit') submit();
    else if (a === 'hint') hint();
    else if (a === 'pause') { paused = true; persistActive(); sfx.click(); render(); }
    else if (a === 'resume') { paused = false; sfx.click(); render(); }
    else if (a === 'share') { sfx.click(); share(); }
    else if (a === 'back') { persistActive(); sfx.click(); ctx.go('/home'); }
  };
  const onKey = e => {
    if (!playing()) return;
    if (/^\d$/.test(e.key)) press(+e.key);
    else if (e.key === 'Backspace') erase();
    else if (e.key === 'Enter' && !e.target.closest?.('button')) submit();
    else if (e.key === 'Escape') { paused = !paused; render(); }
  };
  const onVis = () => { if (document.hidden && playing()) { paused = true; persistActive(); render(); } };
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', persistActive);

  if (state) persistActive();
  render();
  return () => {
    persistActive(); clearInterval(tick);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', persistActive);
    root.onclick = null;
  };
}
