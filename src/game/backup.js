import { storage } from '../core/storage.js';
import { APP, TOTAL_LEVELS } from '../core/config.js';
import { loadProgress, sanitizeProgress, loadActive, validateActive } from './progress.js';
import { loadStats, summarizeRewards } from './stats.js';
import { loadDailyStore, sanitizeDailyStore } from './daily.js';
import { loadTutorial, sanitizeTutorial } from './tutorial.js';
import { getSettings, getVolume, setVolume } from '../core/settings.js';
import { getTheme, applyTheme } from '../services/theme.js';
import { getLang, setLang } from '../i18n/index.js';
import { session } from './session.js';

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_FILENAME = 'mind-lock-pro-backup.json';

/** Métadonnées de suivi des sauvegardes (horodatage du dernier export ou import). */
export function getBackupMeta() {
  const raw = storage.get('backup:meta', null);
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    lastBackupDate: typeof o.lastBackupDate === 'string' ? o.lastBackupDate : null,
    lastAction: typeof o.lastAction === 'string' ? o.lastAction : null,
    schemaVersion: BACKUP_SCHEMA_VERSION
  };
}

export function setBackupMeta(meta) {
  const prev = getBackupMeta();
  storage.set('backup:meta', { ...prev, ...meta });
}

/**
 * Construit le payload complet de sauvegarde JSON à partir de l'état actuel de LocalStorage.
 * Pur et sans dépendance externe.
 */
export function createBackupPayload() {
  const progress = loadProgress();
  const stats = loadStats();
  const daily = loadDailyStore();
  const tutorial = loadTutorial();
  const settings = getSettings();
  const volume = getVolume();
  const theme = getTheme();
  const lang = getLang();
  const active = loadActive();
  const rw = summarizeRewards(progress);

  const exportedAt = new Date().toISOString();
  const summary = {
    unlocked: progress.unlocked,
    completedCount: Object.keys(progress.completed || {}).length,
    totalStars: rw.totalStars,
    maxStars: rw.maxStars,
    perfectLevels: rw.perfectLevels,
    cleanLevels: rw.cleanLevels,
    played: stats.played,
    wins: stats.wins,
    winStreak: stats.streak,
    bestStreak: stats.bestStreak,
    dailyWins: daily.totalWins,
    dailyStreak: daily.streak,
    playerName: settings.name || '',
    hasActiveGame: !!active,
    activeLevel: active ? active.level : null
  };

  return {
    app: APP.name,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP.version,
    exportedAt,
    summary,
    data: {
      progress,
      stats,
      daily,
      tutorial,
      settings,
      volume,
      theme,
      lang,
      active
    }
  };
}

/**
 * Déclenche le téléchargement du fichier JSON de sauvegarde via l'API Web standard (Blob + URL.createObjectURL).
 * Compatible Android, iOS/iPadOS, Windows, macOS (Chrome, Safari, Firefox, Edge).
 */
export function exportBackupFile(filename = BACKUP_FILENAME) {
  const payload = createBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);

  setBackupMeta({
    lastAction: 'export',
    lastBackupDate: payload.exportedAt
  });

  return payload;
}

/**
 * Analyse, vérifie et assainit rigoureusement un texte JSON de sauvegarde avant toute utilisation.
 * Ne fait jamais confiance aux données brutes ni au résumé inclus dans le fichier.
 * Retourne { ok: true, payload, summary } ou { ok: false, error: string }.
 */
export function parseAndValidateBackup(jsonText) {
  if (typeof jsonText !== 'string' || !jsonText.trim()) {
    return { ok: false, error: 'backupEmpty' };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'backupInvalidJson' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'backupInvalid' };
  }

  // Détection du format canonique MIND LOCK PRO vs format plat
  const isCanonical = parsed.app === APP.name || parsed.app === 'MIND LOCK PRO';
  const rawData = (isCanonical && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data))
    ? parsed.data
    : parsed;

  // Reconnaissance minimale : au moins l'un des objets ou indicateurs de jeu connus
  const hasRecognizableData = isCanonical ||
    ('progress' in rawData) || ('stats' in rawData) || ('unlocked' in rawData) || ('completed' in rawData);

  if (!hasRecognizableData) {
    return { ok: false, error: 'backupUnrecognized' };
  }

  // Version de schéma plus récente non prise en charge
  if (Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'backupVersionTooNew' };
  }

  // 1. Assainissement de la progression
  const rawProg = rawData.progress || (Number.isInteger(rawData.unlocked) || rawData.completed ? rawData : null);
  const sanitizedProgress = sanitizeProgress(rawProg);

  // 2. Assainissement des statistiques globales
  const rawStats = rawData.stats;
  const isStatsOk = rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats) &&
    ['played', 'wins', 'losses', 'streak', 'bestStreak'].every(k => Number.isInteger(rawStats[k]) && rawStats[k] >= 0);
  const sanitizedStats = isStatsOk
    ? {
        played: rawStats.played,
        wins: rawStats.wins,
        losses: rawStats.losses,
        streak: rawStats.streak,
        bestStreak: Math.max(rawStats.bestStreak, rawStats.streak)
      }
    : { played: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0 };

  // 3. Assainissement du Défi Quotidien
  const sanitizedDaily = sanitizeDailyStore(rawData.daily);

  // 4. Assainissement du tutoriel
  const sanitizedTutorial = sanitizeTutorial(rawData.tutorial);

  // 5. Assainissement des paramètres
  const rawSettings = rawData.settings && typeof rawData.settings === 'object' && !Array.isArray(rawData.settings) ? rawData.settings : {};
  const sanitizedSettings = {
    sound: typeof rawSettings.sound === 'boolean' ? rawSettings.sound : true,
    vibration: typeof rawSettings.vibration === 'boolean' ? rawSettings.vibration : true,
    name: typeof rawSettings.name === 'string' ? rawSettings.name.trim().slice(0, 20) : ''
  };

  // 6. Volume
  const rawVol = Number(rawData.volume);
  const sanitizedVolume = Number.isInteger(rawVol) && rawVol >= 0 && rawVol <= 100 ? rawVol : 80;

  // 7. Thème et Langue
  const sanitizedTheme = rawData.theme === 'light' ? 'light' : 'dark';
  const sanitizedLang = (rawData.lang === 'en' || rawData.lang === 'ar') ? rawData.lang : 'fr';

  // 8. Partie en cours (active)
  const sanitizedActive = validateActive(rawData.active);

  // 9. Calcul certifié du résumé à partir des données réellement assainies
  const rw = summarizeRewards(sanitizedProgress);
  const summary = {
    unlocked: sanitizedProgress.unlocked,
    completedCount: Object.keys(sanitizedProgress.completed || {}).length,
    totalStars: rw.totalStars,
    maxStars: rw.maxStars,
    perfectLevels: rw.perfectLevels,
    cleanLevels: rw.cleanLevels,
    played: sanitizedStats.played,
    wins: sanitizedStats.wins,
    winStreak: sanitizedStats.streak,
    bestStreak: sanitizedStats.bestStreak,
    dailyWins: sanitizedDaily.totalWins,
    dailyStreak: sanitizedDaily.streak,
    playerName: sanitizedSettings.name,
    hasActiveGame: !!sanitizedActive,
    activeLevel: sanitizedActive ? sanitizedActive.level : null,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    schemaVersion: parsed.schemaVersion || 1
  };

  const validatedPayload = {
    app: APP.name,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP.version,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    summary,
    data: {
      progress: sanitizedProgress,
      stats: sanitizedStats,
      daily: sanitizedDaily,
      tutorial: sanitizedTutorial,
      settings: sanitizedSettings,
      volume: sanitizedVolume,
      theme: sanitizedTheme,
      lang: sanitizedLang,
      active: sanitizedActive
    }
  };

  return { ok: true, payload: validatedPayload, summary };
}

/** Sauvegarde de sécurité automatique créée juste avant d'écraser la progression existante. */
export function createSafetyBackup() {
  const current = createBackupPayload();
  const safety = {
    timestamp: new Date().toISOString(),
    summary: current.summary,
    data: current.data
  };
  storage.set('backup:safety', safety);
  return safety;
}

export function getSafetyBackup() {
  return storage.get('backup:safety', null);
}

export function hasSafetyBackup() {
  const s = getSafetyBackup();
  return !!(s && s.data && typeof s.timestamp === 'string');
}

/**
 * Restaure la sauvegarde de sécurité précédente créée avant le dernier import.
 * Retourne true si réussie, false sinon.
 */
export function revertSafetyBackup() {
  const safety = getSafetyBackup();
  if (!safety || !safety.data) return false;
  applySanitizedData(safety.data);
  storage.remove('backup:safety');
  setBackupMeta({
    lastAction: 'revert',
    lastBackupDate: safety.timestamp
  });
  return true;
}

/**
 * Applique un jeu de données assaini dans LocalStorage, synchronise la session et met à jour l'état de l'application.
 */
export function applySanitizedData(data) {
  storage.set('progress', data.progress);
  storage.set('stats', data.stats);
  storage.set('daily', data.daily);
  storage.set('tutorial', data.tutorial);
  storage.set('settings', data.settings);
  storage.set('volume', data.volume);
  storage.set('theme', data.theme);
  storage.set('lang', data.lang);

  if (data.active) {
    storage.set('active', data.active);
  } else {
    storage.remove('active');
  }

  // Synchronise l'instance partagée de session pour l'UI
  session.progress = data.progress;
  session.stats = data.stats;
  session.lastUnlockedLevel = null;

  // Applique immédiatement le thème et la langue
  applyTheme(data.theme);
  setLang(data.lang);
}

/**
 * Applique une sauvegarde validée :
 * 1. Crée automatiquement une sauvegarde de secours locale.
 * 2. Écrit les données assainies dans LocalStorage.
 * 3. Met à jour les métadonnées.
 */
export function applyBackup(validatedPayload) {
  if (!validatedPayload?.data) throw new Error('Données de sauvegarde invalides');
  createSafetyBackup();
  applySanitizedData(validatedPayload.data);
  setBackupMeta({
    lastAction: 'import',
    lastBackupDate: new Date().toISOString()
  });
  return true;
}
