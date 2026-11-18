import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { esc, fmtTime, stars, diffBadge, confirmDialog, confetti } from '../components.js';
import { getLevel } from '../../game/levels.js';
import { createGame, submitGuess, useHint, hintsLeft } from '../../game/engine.js';
import { saveActive, loadActive, clearActive } from '../../game/progress.js';
import { sfx } from '../../services/audio.js';
import { vibrate } from '../../services/haptics.js';
import { TOTAL_LEVELS } from '../../core/config.js';

/**
 * Écran de jeu. Toute la logique de jeu passe par le moteur (engine.js) ;
 * cet écran ne fait que piloter l'interface et la persistance.
 */
export function mountGame(root, ctx, { n, fresh }) {
  const rules = getLevel(n);
  const saved = loadActive();
  const resume = !fresh && saved && saved.level === n && saved.state?.status === 'playing'
    && saved.state.rules?.codeLength === rules.codeLength ? saved : null;
  let state = resume ? resume.state : createGame(rules);
  let elapsed = resume ? resume.elapsed : 0;
  let input = [], paused = false, busy = false, resultTimer = null;
  const $ = s => root.querySelector(s);
  const playing = () => state.status === 'playing' && !paused;

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button class="key" data-d="${d}" aria-label="${d}">${d}</button>`).join('');
  root.innerHTML = `
  <section class="screen game d-${rules.difficulty}">
    <header class="topbar">
      <button class="icon-btn" data-a="back" aria-label="${t('back')}">${icon('back', 20, 'flip-rtl')}</button>
      <div class="title"><strong>${t('level')} ${n}</strong>
        ${diffBadge(rules.difficulty, ` · ${t('digitsCount', { n: rules.codeLength })}`)}</div>
      <div class="timer-pill">${icon('clock', 15)}<span id="timer">${fmtTime(elapsed)}</span></div>
      <button class="icon-btn" data-a="pause" aria-label="${t('pause')}">${icon('pause', 18)}</button>
    </header>
    <div class="board">
      <div class="card glass secret">
        <div class="secret-head"><span>${icon('lock', 14)} ${t('secretCode')}</span>
          <span class="muted">${t(rules.allowRepeats ? 'repeatsOn' : 'repeatsOff')}</span></div>
        <div class="secret-slots" id="secret"></div>
        <div class="pips" id="pips" aria-label="${t('attempts')}"></div>
      </div>
      <div class="history" id="history" aria-live="polite"></div>
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
  </section>`;

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
    $('#entry').innerHTML = Array.from({ length: rules.codeLength }, (_, i) =>
      `<span class="slot entry-slot ${input[i] !== undefined ? 'filled' : ''} ${i === input.length ? 'next' : ''} ${i === popIdx ? 'pop' : ''}">${input[i] ?? ''}</span>`).join('');
  }
  function renderHistory(animateLast = false) {
    const h = $('#history');
    if (!state.guesses.length) { h.innerHTML = `<div class="empty">${icon('grid', 26)}<p>${t('emptyHistory')}</p></div>`; return; }
    h.innerHTML = state.guesses.map((g, i) => `
      <div class="attempt ${animateLast && i === state.guesses.length - 1 ? 'new' : ''}">
        <span class="idx">${i + 1}</span>
        <span class="digits">${g.guess.map((d, k) => `<b style="--k:${k}">${d}</b>`).join('')}</span>
        <span class="fb"><span class="pill ok" title="${t('placed')}" aria-label="${g.exact} ${t('placed')}">${icon('check', 12)}${g.exact}</span>
          <span class="pill mid" title="${t('misplaced')}" aria-label="${g.misplaced} ${t('misplaced')}"><i class="swap">⇄</i>${g.misplaced}</span></span>
      </div>`).join('');
    h.scrollTop = h.scrollHeight;
  }
  function renderKeys() {
    const full = input.length >= rules.codeLength, on = playing();
    root.querySelectorAll('.key[data-d]').forEach(k => {
      const d = +k.dataset.d;
      k.disabled = !on || full || (!rules.allowRepeats && input.includes(d)); // chiffres interdits
    });
    $('[data-a="erase"]').disabled = !on || !input.length;
    $('[data-a="submit"]').disabled = !on || !full;
    const hb = $('[data-a="hint"]'); hb.disabled = !on || hintsLeft(state) <= 0;
    $('#hintcount').textContent = rules.hints ? hintsLeft(state) : '–';
  }
  const setMsg = m => { $('#msg').textContent = m; };
  const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  const renderAll = () => { renderSecret(); renderPips(); renderEntry(); renderHistory(); renderKeys(); setMsg(''); };

  const persist = () => state.status === 'playing' ? saveActive({ level: n, state, elapsed }) : clearActive();

  /* ---------- timer ---------- */
  const tick = setInterval(() => {
    if (!playing()) return;
    elapsed++; $('#timer').textContent = fmtTime(elapsed);
    if (elapsed % 5 === 0) persist();
  }, 1000);

  /* ---------- actions ---------- */
  function press(d) {
    if (!playing() || input.length >= rules.codeLength || (!rules.allowRepeats && input.includes(d))) return;
    input.push(d); setMsg(''); sfx.tap(); vibrate(8);
    renderEntry(input.length - 1); renderKeys();
  }
  function erase() { if (!playing() || !input.length) return; input.pop(); setMsg(''); sfx.tap(); renderEntry(); renderKeys(); }
  function submit() {
    if (!playing()) return;
    const r = submitGuess(state, input);
    if (r.error) { setMsg(t(r.error)); shake($('#entry')); sfx.error(); vibrate([30, 40, 30]); return; }
    state = r.state; input = []; setMsg('');
    const last = state.guesses.at(-1);
    last.exact ? sfx.good() : sfx.neutral(); vibrate(15);
    renderEntry(); renderHistory(true); renderPips(); renderKeys();
    if (state.status !== 'playing') finish(); else persist();
  }
  function hint() {
    const r = useHint(state);
    if (r.error) { setMsg(t(r.error)); return; }
    state = r.state; sfx.hint(); vibrate(20);
    renderSecret(r.hint.pos); renderKeys(); persist();
  }
  async function restart() {
    if (state.guesses.length && !(await confirmDialog({ title: t('restartTitle'), text: t('restartText') }))) return;
    clearTimeout(resultTimer);
    state = createGame(rules); elapsed = 0; input = []; paused = false;
    $('#overlay').innerHTML = ''; $('#timer').textContent = fmtTime(0);
    persist(); renderAll();
  }
  function pause(on) {
    if (state.status !== 'playing') return;
    paused = on; renderKeys();
    $('#overlay').innerHTML = on ? `<div class="overlay pause"><div class="sheet center">
      <div class="badge-ic">${icon('pause', 26)}</div><h2>${t('paused')}</h2>
      <p class="muted">${t('level')} ${n} · ${fmtTime(elapsed)}</p>
      <button class="btn primary lg" data-a="resume">${icon('play', 18, '', true)}<span>${t('resumeGame')}</span></button>
      <button class="btn ghost" data-a="back">${t('quit')}</button></div></div>` : '';
    if (on) persist();
  }

  function finish() {
    const won = state.status === 'won';
    persist(); renderSecret();
    let res = { stars: 0 };
    if (won) { res = ctx.session.win(n, { attempts: state.guesses.length, time: elapsed, maxAttempts: rules.maxAttempts }); sfx.win(); vibrate([20, 60, 20, 60, 40]); }
    else { ctx.session.loss(); sfx.lose(); vibrate([80, 40, 80]); shake($('#secret')); }
    root.querySelector('.game').classList.add(won ? 'is-won' : 'is-lost');
    resultTimer = setTimeout(() => {
      $('#overlay').innerHTML = `<div class="overlay result ${won ? 'win' : 'lose'}">
        ${won ? '<div class="confetti" id="confetti" aria-hidden="true"></div>' : ''}
        <div class="sheet center">
          <div class="badge-ic ${won ? 'win' : 'lose'}">${icon(won ? 'unlock' : 'x', 28)}</div>
          <h2>${t(won ? 'won' : 'lost')}</h2>
          ${won ? `${stars(res.stars, 26)}${res.newBest ? `<span class="badge d-master">${icon('trophy', 12)} ${t('newBest')}</span>` : ''}`
                : `<p class="muted">${t('codeWas')} <b class="code">${state.secret.join(' ')}</b></p>`}
          <div class="result-stats">
            <div>${icon('clock', 16)}<strong>${fmtTime(elapsed)}</strong><span>${t('time')}</span></div>
            <div>${icon('target', 16)}<strong>${state.guesses.length}/${rules.maxAttempts}</strong><span>${t('attempts')}</span></div>
          </div>
          ${won && n < TOTAL_LEVELS ? `<button class="btn primary lg" data-a="next">${t('next')}</button>` : ''}
          ${won ? '' : `<button class="btn primary lg" data-a="retry">${icon('refresh', 18)}<span>${t('retry')}</span></button>`}
          <button class="btn ghost" data-a="levels">${t('toLevels')}</button>
        </div></div>`;
      if (won) confetti($('#confetti'));
    }, 1000);
  }

  root.onclick = e => {
    const k = e.target.closest('button'); if (!k) return;
    if (k.dataset.d !== undefined) return press(+k.dataset.d);
    ({ erase, submit, hint, restart,
       pause: () => pause(true), resume: () => pause(false),
       back: () => { persist(); ctx.go('/levels'); }, levels: () => ctx.go('/levels'),
       next: () => ctx.go(`/game/${n + 1}`, { fresh: true }),
       retry: () => { $('#overlay').innerHTML = ''; root.querySelector('.game').classList.remove('is-won', 'is-lost'); state = createGame(rules); elapsed = 0; input = []; persist(); renderAll(); $('#timer').textContent = fmtTime(0); }
    })[k.dataset.a]?.();
  };
  const onKey = e => {
    if (document.querySelector('.modal')) return;
    if (/^\d$/.test(e.key)) press(+e.key);
    else if (e.key === 'Backspace') erase();
    else if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') pause(!paused);
  };
  const onVis = () => { if (document.hidden && playing()) pause(true); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);

  persist(); renderAll();
  if (state.status !== 'playing') finish();
  return () => { clearInterval(tick); clearTimeout(resultTimer); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); root.onclick = null; };
}
