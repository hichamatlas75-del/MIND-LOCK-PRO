import { t, setLang, getLang, langs } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { confirmDialog, toast, avatarInitial, esc } from '../components.js';
import { applyTheme, getTheme } from '../../services/theme.js';
import { getSettings, setSetting, getVolume, setVolume } from '../../core/settings.js';
import { hapticsSupported, vibrate } from '../../services/haptics.js';
import { sfx } from '../../services/audio.js';
import { APP, TOTAL_LEVELS } from '../../core/config.js';
import { summarizeRewards } from '../../game/stats.js';
import {
  getBackupMeta,
  exportBackupFile,
  parseAndValidateBackup,
  applyBackup,
  hasSafetyBackup,
  getSafetyBackup,
  revertSafetyBackup
} from '../../game/backup.js';

const LANG_NAMES = { fr: 'Français', en: 'English', ar: 'العربية' };

function formatBackupDate(iso) {
  if (!iso) return t('noBackupYet');
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t('noBackupYet');
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hr}:${min}`;
  } catch {
    return t('noBackupYet');
  }
}

/** Paramètres : profil, langue, thème, sons, vibrations, sauvegarde/transfert, réinitialisation, à propos. */
export function mountSettings(root, ctx) {
  const s = getSettings(), vol = getVolume(), theme = getTheme(), vib = hapticsSupported();
  const meta = getBackupMeta(), prog = ctx.session.progress, rw = summarizeRewards(prog);
  const safety = getSafetyBackup(), safetyAvailable = hasSafetyBackup();

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
        <div class="row-item"><span class="ri-ic">${icon('volume', 18)}</span>
          <div class="ri-text"><label for="vol"><strong>${t('volume')} (<span id="vol-val">${vol}%</span>)</strong></label>
          <input id="vol" class="range" type="range" min="0" max="100" step="5" value="${vol}" aria-label="${t('volume')}"></div></div>
        ${toggle('vibration', 'vibrate', t('vibration'), vib && s.vibration, !vib, vib ? '' : t('vibrationUnsupported'))}
      </div>

      <h2 class="section-title">${t('backupTransfer')}</h2>
      <div class="card stack">
        <div class="backup-meta-grid">
          <div class="backup-stat">
            <small>${t('lastBackupDate')}</small>
            <strong id="meta-last-backup">${formatBackupDate(meta.lastBackupDate)}</strong>
          </div>
          <div class="backup-stat">
            <small>${t('formatVersion')}</small>
            <strong>v${meta.schemaVersion}</strong>
          </div>
          <div class="backup-stat">
            <small>${t('unlockedLevels')}</small>
            <strong>${prog.unlocked} / ${TOTAL_LEVELS}</strong>
          </div>
          <div class="backup-stat">
            <small>${t('starsTotal')}</small>
            <strong>${rw.totalStars} / ${rw.maxStars}</strong>
          </div>
        </div>
        <div class="backup-actions">
          <button class="btn primary sm" data-a="export-backup">${icon('download', 16, '', true)}<span>${t('exportBackup')}</span></button>
          <button class="btn ghost sm" data-a="import-backup">${icon('upload', 16, '', true)}<span>${t('importBackup')}</span></button>
        </div>
        <input type="file" id="backup-file-input" accept="application/json,.json" style="display:none" aria-hidden="true" tabindex="-1">
        ${safetyAvailable ? `
        <div class="row-item safety-revert">
          <div class="ri-text"><small>${t('safetyBackupAvailable', { date: formatBackupDate(safety.timestamp) })}</small></div>
          <button class="btn ghost sm danger-text" data-a="revert-backup">${icon('undo', 14)}<span>${t('restorePreviousBackup')}</span></button>
        </div>` : ''}
      </div>

      <h2 class="section-title">${t('data')}</h2>
      <div class="card row-item"><span class="ri-ic danger">${icon('trash', 18)}</span>
        <div class="ri-text"><strong>${t('resetProgress')}</strong><small>${t('resetDesc')}</small></div>
        <button class="btn danger sm" data-a="reset">${t('confirm')}</button></div>

      <h2 class="section-title">${t('tutorial')}</h2>
      <div class="card row-item"><span class="ri-ic">${icon('help', 18)}</span>
        <div class="ri-text"><strong>${t('tutorial')}</strong><small>${t('tutorialSub')}</small></div>
        <button class="btn ghost sm" data-a="tutorial">${t('replayTutorial')}</button></div>

      <h2 class="section-title">${t('about')}</h2>
      <div class="card about"><strong>${APP.name}</strong><span class="muted">${t('version')} ${APP.version}</span><p>${t('aboutText')}</p></div>
    </div>
  </main>`;

  root.oninput = e => {
    if (e.target.id === 'pname') { setSetting('name', e.target.value); root.querySelector('.avatar.lg').innerHTML = avatarInitial(e.target.value) || icon('user', 22); }
    else if (e.target.id === 'vol') { setVolume(e.target.value); root.querySelector('#vol-val').textContent = getVolume() + '%'; sfx.digit(); }
  };

  root.onchange = async e => {
    if (e.target.id === 'backup-file-input') {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      let text = '';
      try {
        text = await file.text();
      } catch {
        toast(t('backupInvalid'));
        return;
      }
      const res = parseAndValidateBackup(text);
      if (!res.ok) {
        toast(t(res.error || 'backupInvalid'));
        return;
      }
      const sum = res.summary;
      const activeHtml = sum.hasActiveGame ? `<p class="warn-pill">${t('backupActiveNotice', { level: sum.activeLevel })}</p>` : '';
      const html = `
        <div class="backup-summary-modal">
          <p class="summary-line">${t('backupSummaryDetails', {
            name: esc(sum.playerName || '—'),
            unlocked: sum.unlocked,
            stars: sum.totalStars,
            played: sum.played
          })}</p>
          ${activeHtml}
          <p class="summary-warn">${t('backupReplaceWarning')}</p>
        </div>`;
      const ok = await confirmDialog({
        title: t('confirmImportTitle'),
        html,
        confirmLabel: t('confirmImportAction'),
        danger: true
      });
      if (ok) {
        applyBackup(res.payload);
        sfx.good();
        toast(t('backupImportSuccess'));
        ctx.rerender();
      }
    }
  };

  root.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'back') ctx.go('/home');
    else if (a === 'tutorial') ctx.go('/tutorial');
    else if (a === 'lang') { setLang(b.dataset.v); ctx.rerender(); }
    else if (a === 'theme') { applyTheme(b.dataset.v); ctx.rerender(); }
    else if (a === 'export-backup') {
      try {
        exportBackupFile();
        sfx.good();
        toast(t('backupExportSuccess'));
        ctx.rerender();
      } catch (err) {
        console.error(err);
      }
    } else if (a === 'import-backup') {
      const input = root.querySelector('#backup-file-input');
      if (input) input.click();
    } else if (a === 'revert-backup') {
      const safety = getSafetyBackup();
      if (!safety) return;
      const ok = await confirmDialog({
        title: t('confirmRevertTitle'),
        text: t('confirmRevertText'),
        confirmLabel: t('restorePreviousBackup'),
        danger: true
      });
      if (ok) {
        revertSafetyBackup();
        sfx.good();
        toast(t('revertSuccess'));
        ctx.rerender();
      }
    } else if (a === 'toggle') {
      const k = b.dataset.k, on = !getSettings()[k]; setSetting(k, on);
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
      if (k === 'sound' && on) sfx.good(); if (k === 'vibration' && on) vibrate(30);
    } else if (a === 'reset' && await confirmDialog({ title: t('resetConfirmTitle'), text: t('resetConfirmText'), confirmLabel: t('resetProgress'), danger: true })) {
      ctx.session.reset(); toast('✓'); ctx.rerender();
    }
  };
  return () => { root.onclick = null; root.oninput = null; root.onchange = null; };
}
