import { t, setLang, getLang, langs } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { confirmDialog, toast, avatarInitial, esc } from '../components.js';
import { applyTheme, getTheme } from '../../services/theme.js';
import { getSettings, setSetting } from '../../core/settings.js';
import { hapticsSupported, vibrate } from '../../services/haptics.js';
import { sfx } from '../../services/audio.js';
import { APP } from '../../core/config.js';

const LANG_NAMES = { fr: 'Français', en: 'English', ar: 'العربية' };

/** Paramètres : profil, langue, thème, sons, vibrations, réinitialisation, à propos. */
export function mountSettings(root, ctx) {
  const s = getSettings(), theme = getTheme(), vib = hapticsSupported();
  const seg = (action, items, current) => `<div class="segmented" role="radiogroup">${items.map(([v, label]) =>
    `<button role="radio" aria-checked="${v === current}" class="${v === current ? 'active' : ''}" data-a="${action}" data-v="${v}">${label}</button>`).join('')}</div>`;
  const toggle = (key, ic, label, on, disabled = false, note = '') => `
    <div class="row-item"><span class="ri-ic">${icon(ic, 18)}</span>
      <div class="ri-text"><strong>${label}</strong>${note ? `<small>${note}</small>` : ''}</div>
      <button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${label}" data-a="toggle" data-k="${key}" ${disabled ? 'disabled' : ''}><i></i></button></div>`;

  root.innerHTML = `
  <main class="screen settings">
    <h1 class="sr-only">${t('settings')}</h1>
    <header class="topbar">
      <button class="icon-btn" data-a="back" aria-label="${t('back')}">${icon('back', 20, 'flip-rtl')}</button>
      <h2 class="page-title">${t('settings')}</h2><span class="spacer"></span>
    </header>
    <div class="scroll">
      <h2 class="section-title">${t('profile')}</h2>
      <div class="card row-item"><span class="avatar lg">${avatarInitial(s.name) || icon('user', 22)}</span>
        <div class="ri-text"><label for="pname"><strong>${t('playerName')}</strong></label>
        <input id="pname" class="input" maxlength="20" autocomplete="off" value="${esc(s.name)}" placeholder="${t('namePlaceholder')}"></div></div>

      <h2 class="section-title">${t('appearance')}</h2>
      <div class="card stack">
        <div class="ri-text"><strong>${icon('globe', 16)} ${t('lang')}</strong></div>
        ${seg('lang', langs.map(l => [l, LANG_NAMES[l]]), getLang())}
        <div class="ri-text"><strong>${icon(theme === 'dark' ? 'moon' : 'sun', 16)} ${t('theme')}</strong></div>
        ${seg('theme', [['dark', t('dark')], ['light', t('light')]], theme)}
      </div>

      <h2 class="section-title">${t('audioHaptics')}</h2>
      <div class="card">
        ${toggle('sound', 'volume', t('sound'), s.sound)}
        ${toggle('vibration', 'vibrate', t('vibration'), vib && s.vibration, !vib, vib ? '' : t('vibrationUnsupported'))}
      </div>

      <h2 class="section-title">${t('data')}</h2>
      <div class="card row-item"><span class="ri-ic danger">${icon('trash', 18)}</span>
        <div class="ri-text"><strong>${t('resetProgress')}</strong><small>${t('resetDesc')}</small></div>
        <button class="btn danger sm" data-a="reset">${t('confirm')}</button></div>

      <h2 class="section-title">${t('about')}</h2>
      <div class="card about"><strong>${APP.name}</strong><span class="muted">${t('version')} ${APP.version}</span><p>${t('aboutText')}</p></div>
    </div>
  </main>`;

  root.oninput = e => { if (e.target.id === 'pname') { setSetting('name', e.target.value); root.querySelector('.avatar.lg').innerHTML = avatarInitial(e.target.value) || icon('user', 22); } };
  root.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'back') ctx.go('/home');
    else if (a === 'lang') { setLang(b.dataset.v); ctx.rerender(); }
    else if (a === 'theme') { applyTheme(b.dataset.v); ctx.rerender(); }
    else if (a === 'toggle') {
      const k = b.dataset.k, on = !getSettings()[k]; setSetting(k, on);
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
      if (k === 'sound' && on) sfx.good(); if (k === 'vibration' && on) vibrate(30);
    } else if (a === 'reset' && await confirmDialog({ title: t('resetConfirmTitle'), text: t('resetConfirmText'), confirmLabel: t('resetProgress'), danger: true })) {
      ctx.session.reset(); toast('✓'); ctx.rerender();
    }
  };
  return () => { root.onclick = null; root.oninput = null; };
}
