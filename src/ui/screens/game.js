import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { fmtTime, stars, diffBadge, confirmDialog, confetti } from '../components.js';
import { getLevel } from '../../game/levels.js';
import { createGame, submitGuess, useHint, hintsLeft } from '../../game/engine.js';
import { saveActive, loadActive, clearActive, toggleEliminated, hasEliminatedInInput } from '../../game/progress.js';
import { sfx } from '../../services/audio.js';
import { vibrate } from '../../services/haptics.js';
import { TOTAL_LEVELS } from '../../core/config.js';

/**
 * Écran de jeu. Toute la logique de jeu passe par le moteur (`engine.js`) ;
 * cet écran pilote l'interface, l'élimination manuelle des chiffres et la persistance.
 */
export function mountGame(root, ctx, { n, fresh }) {
  const rules = getLevel(n);
  const saved = loadActive(); // déjà validée (données invalides = null)
  const resume = !fresh && saved && saved.level === n ? saved : null;
  let state = resume ? resume.state : createGame(rules);
  let elapsed = resume ? resume.elapsed : 0;
  let input = resume ? resume.input : []; // la saisie non validée est restaurée
  let eliminated = resume && Array.isArray(resume.eliminated) ? [...resume.eliminated] : [];
  let paused = false, resultTimer = null;
  const $ = s => root.querySelector(s);
  const playing = () => state.status === 'playing' && !paused;

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button class="key" data-d="${d}" aria-label="${d}">${d}</button>`).join('');
  const elimBtns = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d =>
    `<button class="elim-btn" data-elim="${d}" aria-pressed="false" aria-label="${t('elimDigitLabel', { d })}">${d}</button>`
  ).join('');
  root.innerHTML = `
  <main class="screen game d-${rules.difficulty}">
    <h1 class="sr-only">${t('level')} ${n}</h1>
    <header class="topbar">
      <button class="icon-btn" data-a="back" aria-label="${t('back')}">${icon('back', 20, 'flip-rtl')}</button>
      <div class="title"><strong>${t('level')} ${n}</strong>
        ${diffBadge(rules.difficulty, ` · ${t('digitsCount', { n: rules.codeLength })}`)}</div>
      <div class="timer-pill">${icon('clock', 15)}<span id="timer">${fmtTime(elapsed)}</span></div>
      <button class="icon-btn" data-a="tutorial" aria-label="${t('tutorial')}">${icon('help', 18)}</button>
      <button class="icon-btn" data-a="pause" aria-label="${t('pause')}">${icon('pause', 18)}</button>
    </header>
    <div class="board">
      <div class="card glass secret">
        <div class="secret-head"><span>${icon('lock', 14)} ${t('secretCode')}</span>
          <span class="muted">${t(rules.allowRepeats ? 'repeatsOn' : 'repeatsOff')}</span></div>
        <div class="secret-slots" id="secret"></div>
        <div class="pips" id="pips" aria-label="${t('attempts')}"></div>
        <div class="legend" aria-label="${t('legend')}">
          <span class="pill ok">${icon('check', 11)} ${t('placed')}</span>
          <span class="pill mid"><i class="swap">⇄</i> ${t('misplaced')}</span>
          <span class="pill abs">${icon('x', 11)} ${t('absent')}</span>
        </div>
      </div>
      <div class="history" id="history" aria-live="polite"></div>
      <section class="elim-bar" id="elim-panel" aria-label="${t('elimTitle')}">
        <div class="elim-head">
          <span class="elim-title">${t('elimTitle')}</span>
          <span class="elim-count" id="elim-count"></span>
          <button class="elim-reset" id="elim-reset" data-a="elim-reset">${t('elimReset')}</button>
        </div>
        <div class="elim-digits" id="elim-digits">${elimBtns}</div>
      </section>
    </div>
    <div class="dock">
      <p class="msg" id="msg" role="alert"></p>
      <div class="entry" id="entry"></div>
      <div class="actions">
        <button class="btn ghost sm" data-a="hint">${icon('bulb', 16)}<span>${t('hint')}</span><b id="hintcount"></b></button>
        <button class="btn ghost sm" data-a="restart">${icon('refresh', 16)}<span>${t('restart')}</span></button>
      </div>
      <div class="keypad" id="keypad">${keys}
        <button class="key alt wide2" data-a="erase" aria-label="${t('erase')}">${icon('backspace', 22)}</button>
        <button class="key go wide3" data-a="submit">${icon('check', 20)}<span>${t('validate')}</span></button>
      </div>
    </div>
    <div id="overlay"></div>
  </main>`;

  /* ---------- rendus partiels ---------- */
  function renderSecret(justHint = -1) {
    const done = state.status !== 'playing';
    const hinted = new Map(state.hintsUsed.map(h => [h.pos, h.digit]));
    $('#secret').innerHTML = state.secret.map((d, i) =>
      done ? `<span class="slot revealed ${state.status}" style="--i:${i}">${d}</span>`
      : hinted.has(i) ? `<span class="slot hinted ${i === justHint ? 'pop' : ''}" aria-label="${t('hintText', { p: i + 1, d: hinted.get(i) })}">${hinted.get(i)}</span>`
      : `<span class="slot masked">${icon('lock', 15)}</span>`).join('');
  }
  const renderPips = () => { $('#pips').innerHTML = Array.from({ length: rules.maxAttempts }, (_, i) =>
    `<i class="${i < state.guesses.length ? 'used' : ''}"></i>`).join('') + `<span>${state.guesses.length}/${rules.maxAttempts}</span>`; };
  function renderEntry(popIdx = -1) {
    const hinted = new Map(state.hintsUsed.map(h => [h.pos, h.digit]));
    $('#entry').innerHTML = Array.from({ length: rules.codeLength }, (_, i) => {
      const has = input[i] !== undefined;
      const ghost = !has && hinted.has(i) ? `<em class="ghost" aria-hidden="true">${hinted.get(i)}</em>` : '';
      return `<span class="slot entry-slot ${has ? 'filled' : ''} ${i === input.length ? 'next' : ''} ${i === popIdx ? 'pop' : ''}" data-slot="${i}">${has ? input[i] : ghost}</span>`;
    }).join('');
  }
  function renderHistory(animateLast = false) {
    const h = $('#history');
    if (!state.guesses.length) { h.innerHTML = `<div class="empty">${icon('grid', 26)}<p>${t('emptyHistory')}</p></div>`; return; }
    h.innerHTML = state.guesses.map((g, i) => {
      const abs = rules.codeLength - g.exact - g.misplaced;
      return `<div class="attempt ${animateLast && i === state.guesses.length - 1 ? 'new' : ''}">
        <span class="idx">${i + 1}</span>
        <span class="digits">${g.guess.map((d, k) => `<b style="--k:${k}">${d}</b>`).join('')}</span>
        <span class="fb">
          <span class="pill ok" title="${t('placed')}" aria-label="${g.exact} ${t('placed')}">${icon('check', 12)}${g.exact}</span>
          <span class="pill mid" title="${t('misplaced')}" aria-label="${g.misplaced} ${t('misplaced')}"><i class="swap">⇄</i>${g.misplaced}</span>
          <span class="pill abs" title="${t('absent')}" aria-label="${abs} ${t('absent')}">${icon('x', 11)}${abs}</span>
        </span>
      </div>`;
    }).join('');
    h.scrollTop = h.scrollHeight;
  }
  function renderElimination(animDigit = -1) {
    const elimSet = new Set(eliminated);
    const on = playing();
    const avail = rules.digits - elimSet.size;
    $('#elim-count').textContent = t('elimAvailable', { n: avail, total: rules.digits });
    const resetBtn = $('#elim-reset');
    resetBtn.disabled = !on || elimSet.size === 0;
    root.querySelectorAll('.elim-btn[data-elim]').forEach(btn => {
      const d = +btn.dataset.elim;
      const isElim = elimSet.has(d);
      btn.classList.toggle('is-eliminated', isElim);
      btn.classList.toggle('pop', d === animDigit);
      btn.setAttribute('aria-pressed', String(isElim));
      btn.disabled = !on;
    });
  }
  function renderKeys() {
    const full = input.length >= rules.codeLength, on = playing();
    const elimSet = new Set(eliminated);
    root.querySelectorAll('.key[data-d]').forEach(k => {
      const d = +k.dataset.d;
      k.classList.toggle('eliminated', elimSet.has(d));
      // Un chiffre éliminé manuellement reste saisissable sur le clavier (seuls les doublons interdits ou la fin de saisie désactivent la touche)
      k.disabled = !on || full || (!rules.allowRepeats && input.includes(d));
    });
    $('[data-a="erase"]').disabled = !on || !input.length;
    $('[data-a="submit"]').disabled = !on || !full;
    const hb = $('[data-a="hint"]'); hb.disabled = !on || hintsLeft(state) <= 0;
    $('#hintcount').textContent = rules.hints ? hintsLeft(state) : '–';
  }
  function setMsg(m = '', warn = false) {
    const el = $('#msg');
    if (!m && hasEliminatedInInput(input, eliminated)) {
      el.textContent = t('elimWarn');
      el.classList.add('warn');
      return;
    }
    el.textContent = m;
    el.classList.toggle('warn', !!warn && !!m);
  }
  const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  const renderAll = () => { renderSecret(); renderPips(); renderEntry(); renderHistory(); renderElimination(); renderKeys(); setMsg(''); };

  /** Sauvegarde automatique : partie, chronomètre, indices, saisie en cours ET chiffres éliminés. */
  const persist = () => {
    const snap = { level: n, state, elapsed, input, eliminated };
    if (state.status === 'playing') saveActive(snap); else clearActive();
  };

  /* ---------- timer ---------- */
  const tick = setInterval(() => {
    if (!playing()) return;
    elapsed++; $('#timer').textContent = fmtTime(elapsed);
    if (elapsed % 5 === 0) persist();
  }, 1000);

  /* ---------- actions ---------- */
  function toggleElim(d) {
    if (!playing()) return;
    eliminated = toggleEliminated(eliminated, d, rules.digits);
    sfx.click(); vibrate(6); persist();
    renderElimination(d); renderKeys(); setMsg('');
  }
  function resetElim() {
    if (!playing() || !eliminated.length) return;
    eliminated = [];
    sfx.click(); vibrate(10); persist();
    renderElimination(); renderKeys(); setMsg('');
  }
  function press(d) {
    if (!playing() || input.length >= rules.codeLength || (!rules.allowRepeats && input.includes(d))) return;
    input.push(d); sfx.digit(); vibrate(8); persist();
    renderEntry(input.length - 1); renderKeys(); setMsg('');
  }
  function erase() { if (!playing() || !input.length) return; input.pop(); sfx.click(); persist(); renderEntry(); renderKeys(); setMsg(''); }
  function submit() {
    if (!playing()) return;
    const r = submitGuess(state, input);
    if (r.error) { setMsg(t(r.error)); shake($('#entry')); sfx.invalid(); vibrate([30, 40, 30]); return; }
    state = r.state; input = []; setMsg('');
    const last = state.guesses.at(-1);
    last.exact ? sfx.hint() : sfx.submit(); vibrate(15);
    renderEntry(); renderHistory(true); renderPips(); renderKeys();
    if (state.status !== 'playing') finish(); else persist();
  }
  function hint() {
    const r = useHint(state);
    if (r.error) { setMsg(t(r.error)); return; }
    state = r.state; sfx.hint(); vibrate(20);
    renderSecret(r.hint.pos); renderEntry(); renderKeys(); persist();
  }
  async function restart() {
    if ((state.guesses.length || eliminated.length) && !(await confirmDialog({ title: t('restartTitle'), text: t('restartText') }))) return;
    clearTimeout(resultTimer);
    state = createGame(rules); elapsed = 0; input = []; eliminated = []; paused = false;
    root.querySelector('.game').classList.remove('is-paused', 'is-won', 'is-lost');
    $('#overlay').innerHTML = ''; $('#timer').textContent = fmtTime(0);
    persist(); renderAll();
  }
  function pause(on) {
    if (state.status !== 'playing') return;
    paused = on;
    root.querySelector('.game').classList.toggle('is-paused', on);
    renderElimination(); renderKeys();
    $('#overlay').innerHTML = on ? `<div class="overlay pause"><div class="sheet center" role="dialog" aria-modal="true" aria-label="${t('paused')}">
      <div class="badge-ic">${icon('pause', 26)}</div><h2>${t('paused')}</h2>
      <p class="muted">${t('level')} ${n} · ${fmtTime(elapsed)}</p>
      <small class="muted">${t('pausedHidden')}</small>
      <button class="btn primary lg" data-a="resume">${icon('play', 18, '', true)}<span>${t('resumeGame')}</span></button>
      <button class="btn ghost" data-a="back">${t('quit')}</button></div></div>` : '';
    if (on) { persist(); $('[data-a="resume"]')?.focus(); }
  }

  function finish() {
    const won = state.status === 'won';
    persist(); renderSecret(); renderElimination();
    let res = { stars: 0, clean: false, hintCapped: false, newBest: false, unlockedNewLevel: null };
    if (won) {
      res = ctx.session.win(n, {
        attempts: state.guesses.length, time: elapsed, maxAttempts: rules.maxAttempts,
        hintsUsed: state.hintsUsed.length, thresholds: rules.starThresholds
      });
      sfx.win(); if (res.unlockedNewLevel) setTimeout(() => sfx.unlock(), 450); vibrate([20, 60, 20, 60, 40]);
    } else { ctx.session.loss(); sfx.lose(); vibrate([80, 40, 80]); shake($('#secret')); }
    root.querySelector('.game').classList.add(won ? 'is-won' : 'is-lost');
    const [s3] = rules.starThresholds;
    const rewardBadges = !won ? '' : [
      res.clean ? `<span class="badge d-beginner">${icon('check', 12)} ${t('noHintBadge')}</span>` : '',
      res.newBest ? `<span class="badge d-master">${icon('trophy', 12)} ${t('newBest')}</span>` : '',
      res.unlockedNewLevel ? `<span class="badge d-normal unlock-pop">${icon('unlock', 12)} ${t('levelUnlockedBadge', { n: res.unlockedNewLevel })}</span>` : ''
    ].filter(Boolean).join(' ');
    const rewardNote = !won ? ''
      : res.hintCapped ? `<small class="muted">${t('hintCapNote', { n: res.stars })}</small>`
      : res.stars < 3 ? `<small class="muted">${t('starGoal3', { n: s3 })}</small>` : '';
    resultTimer = setTimeout(() => {
      $('#overlay').innerHTML = `<div class="overlay result ${won ? 'win' : 'lose'}">
        ${won ? '<div class="confetti" id="confetti" aria-hidden="true"></div>' : ''}
        <div class="sheet center" role="dialog" aria-modal="true" aria-label="${t(won ? 'won' : 'lost')}">
          <div class="badge-ic ${won ? 'win' : 'lose'}">${icon(won ? 'unlock' : 'x', 28)}</div>
          <h2>${t(won ? 'won' : 'lost')}</h2>
          ${won ? `${stars(res.stars, 26)}${rewardBadges ? `<div class="reward-badges">${rewardBadges}</div>` : ''}${rewardNote}`
                : `<p class="muted">${t('codeWas')} <b class="code">${state.secret.join(' ')}</b></p>`}
          <div class="result-stats">
            <div>${icon('clock', 16)}<strong>${fmtTime(elapsed)}</strong><span>${t('time')} (${t('parTimeLabel')} ${fmtTime(rules.parTime)})</span></div>
            <div>${icon('target', 16)}<strong>${state.guesses.length}/${rules.maxAttempts}</strong><span>${t('attempts')}</span></div>
          </div>
          ${won && n < TOTAL_LEVELS ? `<button class="btn primary lg" data-a="next">${t('next')}</button>` : ''}
          ${won ? '' : `<button class="btn primary lg" data-a="retry">${icon('refresh', 18)}<span>${t('retry')}</span></button>`}
          <button class="btn ghost" data-a="levels">${t('toLevels')}</button>
        </div></div>`;
      if (won) confetti($('#confetti'));
      $('.result .btn.primary')?.focus();
    }, 1000);
  }

  root.onclick = e => {
    const slot = e.target.closest('[data-slot]');
    if (slot && playing()) {
      const idx = +slot.dataset.slot;
      if (idx < input.length) { input = input.slice(0, idx); sfx.click(); persist(); renderEntry(); renderKeys(); setMsg(''); }
      return;
    }
    const k = e.target.closest('button'); if (!k) return;
    if (k.dataset.elim !== undefined) return toggleElim(+k.dataset.elim);
    if (k.dataset.d !== undefined) return press(+k.dataset.d);
    ({ erase, submit, hint, restart,
       'elim-reset': resetElim,
       pause: () => pause(true), resume: () => pause(false),
       tutorial: () => { persist(); ctx.go('/tutorial'); },
       back: () => { persist(); ctx.go('/levels'); }, levels: () => ctx.go('/levels'),
       next: () => ctx.go(`/game/${n + 1}`, { fresh: true }),
       retry: () => { $('#overlay').innerHTML = ''; root.querySelector('.game').classList.remove('is-won', 'is-lost'); state = createGame(rules); elapsed = 0; input = []; eliminated = []; persist(); renderAll(); $('#timer').textContent = fmtTime(0); }
    })[k.dataset.a]?.();
  };
  const onKey = e => {
    if (document.querySelector('.modal')) return;
    if (/^\d$/.test(e.key)) press(+e.key);
    else if (e.key === 'Backspace') erase();
    else if (e.key === 'Enter') { if (!e.target.closest?.('button')) submit(); }
    else if (e.key === 'Escape') pause(!paused);
  };
  const onVis = () => { if (document.hidden && playing()) pause(true); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', persist);

  persist(); renderAll();
  return () => {
    persist();
    clearInterval(tick); clearTimeout(resultTimer);
    document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', persist); root.onclick = null;
  };
}
