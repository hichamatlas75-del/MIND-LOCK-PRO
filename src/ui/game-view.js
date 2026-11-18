import { t } from '../i18n/index.js';
import { createGame, submitGuess, useHint, attemptsLeft, hintsLeft } from '../game/engine.js';
import { getLevel } from '../game/levels.js';
import { saveActive, clearActive } from '../game/progress.js';
import { beep } from '../services/audio.js';

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Écran de jeu. opts : { levelNumber, resume?:{state,elapsed}, onExit(), onWin(info), onNext() }
 * Retourne une fonction de nettoyage (timer + clavier).
 */
export function mountGame(root, opts) {
  const rules = getLevel(opts.levelNumber);
  let state = opts.resume?.state ?? createGame(rules);
  let elapsed = opts.resume?.elapsed ?? 0;
  let input = [];
  let message = '';
  let tick = null;

  const persist = () => state.status === 'playing'
    ? saveActive({ level: rules.number, state, elapsed }) : clearActive();

  function startTimer() {
    clearInterval(tick);
    tick = setInterval(() => {
      if (state.status !== 'playing') return;
      elapsed++;
      const el = root.querySelector('#timer'); if (el) el.textContent = fmt(elapsed);
      if (elapsed % 5 === 0) persist();
    }, 1000);
  }

  function render() {
    const slots = Array.from({ length: rules.codeLength }, (_, i) =>
      `<span class="slot ${input[i] !== undefined ? 'filled' : ''}">${input[i] ?? ''}</span>`).join('');
    const rows = state.guesses.map((g, i) => `
      <li class="row"><span class="idx">${i + 1}</span>
        <span class="digits">${g.guess.map(d => `<b>${d}</b>`).join('')}</span>
        <span class="fb"><i class="dot ok">${g.exact}</i><i class="dot mid">${g.misplaced}</i></span></li>`).join('');
    const hints = state.hintsUsed.map(h => `<span class="chip">${t('hintText', { p: h.pos + 1, d: h.digit })}</span>`).join('');
    const keys = [1,2,3,4,5,6,7,8,9,0].map(d => `<button class="key" data-d="${d}">${d}</button>`).join('');
    const over = state.status !== 'playing';
    const banner = !over ? '' : state.status === 'won'
      ? `<div class="banner win"><h2>${t('won')}</h2><p>${state.guesses.length} · ${fmt(elapsed)}</p>
          ${rules.number < 100 ? `<button class="btn" id="next">${t('next')}</button>` : ''}</div>`
      : `<div class="banner lose"><h2>${t('lost')}</h2><p class="secret">${state.secret.join(' ')}</p>
          <button class="btn" id="retry">${t('retry')}</button></div>`;
    root.innerHTML = `
      <section class="game">
        <header class="bar">
          <button class="icon" id="exit" aria-label="${t('back')}">←</button>
          <div><strong>${t('level')} ${rules.number}</strong>
            <small>${t(rules.difficulty)} · ${t(rules.allowRepeats ? 'repeatsOn' : 'repeatsOff')}</small></div>
          <span id="timer" class="timer">${fmt(elapsed)}</span>
        </header>
        <p class="meta">${t('attempts')} : ${state.guesses.length}/${rules.maxAttempts}</p>
        <ol class="history">${rows}</ol>
        <div class="hints">${hints}</div>
        <p class="msg" role="alert">${message}</p>
        <div class="slots">${slots}</div>
        <div class="keypad">${keys}
          <button class="key alt" id="erase" aria-label="${t('erase')}">⌫</button>
          <button class="key go" id="submit">${t('validate')}</button></div>
        <div class="actions">
          <button class="btn ghost" id="hint" ${over || hintsLeft(state) <= 0 ? 'disabled' : ''}>💡 ${t('hint')} (${hintsLeft(state)})</button>
          <button class="btn ghost" id="restart">${t('restart')}</button></div>
        ${banner}
      </section>`;
    root.querySelector('.history').scrollTop = 1e6;
  }

  function restart() {
    state = createGame(rules); elapsed = 0; input = []; message = ''; persist(); render();
  }
  function submit() {
    const r = submitGuess(state, input);
    if (r.error) { message = t(r.error); beep(180, 150, 'square'); return render(); }
    state = r.state; input = []; message = '';
    const last = state.guesses.at(-1);
    beep(last.exact ? 660 : 400, 100);
    if (state.status === 'won') { beep(880, 300); opts.onWin({ level: rules.number, attempts: state.guesses.length, time: elapsed }); }
    persist(); render();
  }
  function press(d) { if (state.status === 'playing' && input.length < rules.codeLength) { input.push(d); message = ''; render(); } }
  function erase() { input.pop(); message = ''; render(); }
  function hint() { const r = useHint(state); if (r.error) message = t(r.error); else { state = r.state; message = ''; } persist(); render(); }

  root.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d !== undefined) return press(Number(b.dataset.d));
    ({ erase, submit, hint, restart, retry: restart,
       exit: () => { persist(); opts.onExit(); }, next: opts.onNext })[b.id]?.();
  };
  const onKey = e => {
    if (/^\d$/.test(e.key)) press(Number(e.key));
    else if (e.key === 'Backspace') erase();
    else if (e.key === 'Enter') submit();
  };
  document.addEventListener('keydown', onKey);
  persist(); render(); startTimer();
  return () => { clearInterval(tick); document.removeEventListener('keydown', onKey); root.onclick = null; };
}
