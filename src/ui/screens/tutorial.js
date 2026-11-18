import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { progressBar, animateBars, confetti } from '../components.js';
import {
  TUTORIAL_TOTAL_STEPS, TUTORIAL_RULES, getTutorialStep,
  loadTutorial, saveTutorial, submitTutorialStep, skipTutorial, restartTutorial
} from '../../game/tutorial.js';
import { deduceEliminatedDigits } from '../../game/levels.js';
import { sfx } from '../../services/audio.js';
import { vibrate } from '../../services/haptics.js';

/**
 * Écran du tutoriel interactif en 8 étapes (#/tutorial).
 * Utilise uniquement les codes fixes de `tutorial.js` — aucun accès à la partie en cours (`mlp:active`).
 */
export function mountTutorial(root, ctx) {
  let state = loadTutorial();
  // Si le joueur ouvre le tutoriel alors qu'il l'avait déjà terminé, on reprend à l'étape 1 pour le revoir.
  let viewFinished = false;
  let input = [];
  let msg = '';

  function render() {
    const step = state.step, def = getTutorialStep(step);
    const pct = viewFinished ? 100 : Math.round(((step - 1) / TUTORIAL_TOTAL_STEPS) * 100);
    const elim = deduceEliminatedDigits(def.history);
    const slots = def.secret.map((d, i) =>
      viewFinished || (step >= 4 && step <= 6 && i === 0)
        ? `<span class="slot hinted">${d}</span>`
        : `<span class="slot masked">${icon('lock', 15)}</span>`
    ).join('');
    const hist = def.history.map((g, i) => {
      const abs = TUTORIAL_RULES.codeLength - g.exact - g.misplaced;
      return `<div class="attempt">
        <span class="idx">${i + 1}</span>
        <span class="digits">${g.guess.map(d => `<b>${d}</b>`).join('')}</span>
        <span class="fb">
          <span class="pill ok" aria-label="${g.exact} ${t('placed')}">${icon('check', 12)}${g.exact}</span>
          <span class="pill mid" aria-label="${g.misplaced} ${t('misplaced')}"><i class="swap">⇄</i>${g.misplaced}</span>
          <span class="pill abs" aria-label="${abs} ${t('absent')}">${icon('x', 11)}${abs}</span>
        </span></div>`;
    }).join('');

    let body = '';
    if (viewFinished) {
      body = `<div class="card glass tut-done">
        <div class="confetti" id="tut-confetti" aria-hidden="true"></div>
        <div class="badge-ic win">${icon('unlock', 28)}</div>
        <h2>${t('tutorialDoneTitle')}</h2>
        <p class="muted">${t('tutorialDoneText')}</p>
        <div class="cta">
          <button class="btn primary lg" data-a="done">${icon('play', 18, '', true)}<span>${t('play')}</span></button>
          <button class="btn ghost" data-a="restart">${icon('refresh', 16)}<span>${t('restartTutorial')}</span></button>
        </div></div>`;
    } else if (def.type === 'action') {
      body = `<div class="cta"><button class="btn primary lg" data-a="unlock">${icon('unlock', 18)}<span>${t('tut1Btn')}</span></button></div>`;
    } else if (def.type === 'choice') {
      body = `<div class="tut-choices">${def.choices.map((c, idx) =>
        `<button class="btn ghost tut-choice" data-choice="${c}">${t(`tut${step}Opt${idx}`)}</button>`).join('')}</div>`;
    } else {
      const entry = Array.from({ length: TUTORIAL_RULES.codeLength }, (_, i) =>
        `<button type="button" class="slot entry-slot ${input[i] !== undefined ? 'filled' : ''} ${i === input.length ? 'next' : ''}" data-slot="${i}" aria-label="Position ${i + 1}">${input[i] ?? ''}</button>`
      ).join('');
      const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => {
        const isElim = elim.has(d);
        const dis = input.length >= TUTORIAL_RULES.codeLength || input.includes(d);
        return `<button class="key ${isElim ? 'eliminated' : ''}" data-d="${d}" ${dis ? 'disabled' : ''} aria-label="${d}">${d}</button>`;
      }).join('');
      body = `<div class="entry" id="tut-entry">${entry}</div>
        <div class="keypad">${keys}
          <button class="key alt wide2" data-a="erase" ${input.length ? '' : 'disabled'} aria-label="${t('erase')}">${icon('backspace', 22)}</button>
          <button class="key go wide3" data-a="submit" ${input.length === TUTORIAL_RULES.codeLength ? '' : 'disabled'}>${icon('check', 20)}<span>${t('validate')}</span></button>
        </div>`;
    }

    root.innerHTML = `
    <main class="screen tutorial">
      <h1 class="sr-only">${t('tutorial')}</h1>
      <header class="topbar">
        <button class="icon-btn" data-a="back" aria-label="${t('back')}">${icon('back', 20, 'flip-rtl')}</button>
        <div class="title"><strong>${t('tutorial')}</strong>
          <small class="muted">${t('stepOf', { s: step, total: TUTORIAL_TOTAL_STEPS })}</small></div>
        <button class="icon-btn" data-a="restart" aria-label="${t('restartTutorial')}">${icon('refresh', 18)}</button>
        <button class="btn ghost sm" data-a="skip">${t('skipTutorial')}</button>
      </header>
      <div class="scroll">
        ${progressBar(pct, t('tutorial'))}
        <div class="card glass secret" style="margin-top:12px">
          <div class="secret-head"><span>${icon('lock', 14)} ${t('secretCode')}</span><span class="muted">${t('repeatsOff')}</span></div>
          <div class="secret-slots">${slots}</div>
          <div class="legend" aria-label="${t('legend')}">
            <span class="pill ok">${icon('check', 11)} ${t('placed')}</span>
            <span class="pill mid"><i class="swap">⇄</i> ${t('misplaced')}</span>
            <span class="pill abs">${icon('x', 11)} ${t('absent')}</span>
          </div>
        </div>
        ${hist ? `<div class="history tut-history">${hist}</div>` : ''}
        <div class="card tut-card">
          <h2>${t(`tut${step}Title`)}</h2>
          <p class="muted">${t(`tut${step}Text`)}</p>
          <p class="msg" id="tut-msg" role="alert">${msg}</p>
          ${body}
        </div>
      </div>
    </main>`;
    animateBars(root);
    if (viewFinished) confetti(root.querySelector('#tut-confetti'));
  }

  function advance(payload) {
    const r = submitTutorialStep(state, payload);
    if (!r.ok) {
      msg = t(r.error); sfx.error(); vibrate([30, 40, 30]);
      render();
      return;
    }
    state = r.state; saveTutorial(state);
    input = []; msg = '';
    if (r.finished) { viewFinished = true; sfx.win(); vibrate([20, 60, 20]); }
    else { sfx.good(); vibrate(15); }
    render();
  }

  root.onclick = e => {
    const slot = e.target.closest('[data-slot]');
    if (slot) { const idx = +slot.dataset.slot; if (idx < input.length) { input = input.slice(0, idx); msg = ''; render(); } return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d !== undefined) {
      const d = +b.dataset.d;
      if (input.length < TUTORIAL_RULES.codeLength && !input.includes(d)) { input.push(d); msg = ''; sfx.tap(); render(); }
      return;
    }
    if (b.dataset.choice !== undefined) return advance(b.dataset.choice);
    const a = b.dataset.a;
    if (a === 'unlock') advance('unlock');
    else if (a === 'erase') { input.pop(); msg = ''; sfx.tap(); render(); }
    else if (a === 'submit') advance(input);
    else if (a === 'restart') { state = restartTutorial(); saveTutorial(state); viewFinished = false; input = []; msg = ''; render(); }
    else if (a === 'skip') { state = skipTutorial(state); saveTutorial(state); ctx.go('/home'); }
    else if (a === 'back' || a === 'done') ctx.go('/home');
  };
  const onKey = e => {
    const def = getTutorialStep(state.step);
    if (viewFinished || def.type !== 'code') return;
    if (/^\d$/.test(e.key)) {
      const d = +e.key;
      if (input.length < TUTORIAL_RULES.codeLength && !input.includes(d)) { input.push(d); msg = ''; sfx.tap(); render(); }
    } else if (e.key === 'Backspace' && input.length) { input.pop(); msg = ''; render(); }
    else if (e.key === 'Enter' && !e.target.closest?.('button') && input.length === TUTORIAL_RULES.codeLength) advance(input);
  };
  document.addEventListener('keydown', onKey);
  render();
  return () => { document.removeEventListener('keydown', onKey); root.onclick = null; };
}
