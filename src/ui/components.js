import { t, langs, getLang } from '../i18n/index.js';
import { icon, logoMark } from './icons.js';
import { getLevel } from '../game/levels.js';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const logo = () => `<div class="logo-lockup">${logoMark(28)}<span class="wordmark">MIND<b>LOCK</b><em>PRO</em></span></div>`;

/** Sélecteur de langue compact (data-a="lang"). */
export const langSelect = () => `<label class="lang-select">
  <select data-a="lang" aria-label="${t('lang')}">${langs.map(l => `<option value="${l}" ${l === getLang() ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}</select></label>`;

export const stars = (n, size = 12) =>
  `<span class="stars" aria-label="${n}/3">${[1, 2, 3].map(i => icon('star', size, i <= n ? 'on' : 'off', i <= n)).join('')}</span>`;

export const diffBadge = (difficulty, extra = '') => `<span class="badge d-${difficulty}">${t(difficulty)}${extra}</span>`;

/** Initiale du profil (avatar). */
export const avatarInitial = name => (name?.trim()[0] || '').toUpperCase();

/**
 * Cellule de niveau : état verrouillé / courant / terminé (étoiles, meilleur temps si detail).
 */
export function levelCell(n, progress, { current, detail = false, justUnlocked = null } = {}) {
  const open = n <= progress.unlocked, done = progress.completed[n];
  const d = getLevel(n).difficulty;
  const state = (done ? 'done' : !open ? 'locked' : n === current ? 'current' : 'open') + (n === justUnlocked ? ' just-unlocked' : '');
  const body = !open ? icon('lock', 16)
    : `<span class="num">${n}</span>${done ? stars(done.stars || 1, 9) + (detail ? `<small>${fmtTime(done.time)}</small>` : '') : ''}`;
  return `<button class="lv ${state} d-${d}" data-lv="${n}" ${open ? '' : 'disabled'}
    aria-label="${t('level')} ${n} · ${t(d)} · ${t(done ? 'done' : open ? 'play' : 'locked')}">${body}</button>`;
}

/** Barre de progression animée (la largeur est appliquée après insertion dans le DOM). */
export const progressBar = (pct, label = t('overall')) => `<div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i data-w="${pct}"></i></div>`;
export function animateBars(root) {
  requestAnimationFrame(() => requestAnimationFrame(() =>
    root.querySelectorAll('.bar i[data-w]').forEach(i => { i.style.width = i.dataset.w + '%'; })));
}

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2300);
}

/** Boîte de dialogue de confirmation. Résout true/false. */
export function confirmDialog({ title, text, confirmLabel = t('confirm'), danger = false }) {
  return new Promise(resolve => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-card" role="alertdialog" aria-modal="true" aria-label="${esc(title)}" aria-describedby="modal-desc">
      <h2>${esc(title)}</h2><p id="modal-desc">${esc(text)}</p>
      <div class="modal-actions"><button class="btn ghost" data-r="0">${t('cancel')}</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(confirmLabel)}</button></div></div>`;
    const close = v => { document.removeEventListener('keydown', onKey, true); m.remove(); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
    m.onclick = e => { const b = e.target.closest('[data-r]'); if (b) close(b.dataset.r === '1'); else if (e.target === m) close(false); };
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(m); m.querySelector('[data-r="0"]').focus();
  });
}

/** Confettis élégants (CSS), désactivés via prefers-reduced-motion. */
export function confetti(container, count = 26) {
  const colors = ['#8157FF', '#21D4FD', '#19D6A0', '#F5F6FF'];
  container.innerHTML = Array.from({ length: count }, (_, i) =>
    `<i style="--x:${((i * 37) % 100)}%;--r:${(i * 53) % 360}deg;--d:${1.6 + (i % 5) * 0.25}s;--dl:${(i % 7) * 0.08}s;--c:${colors[i % 4]}"></i>`).join('');
}
