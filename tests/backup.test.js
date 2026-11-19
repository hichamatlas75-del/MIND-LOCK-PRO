import './helpers/mock-storage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBackupPayload,
  parseAndValidateBackup,
  applyBackup,
  getBackupMeta,
  setBackupMeta,
  createSafetyBackup,
  getSafetyBackup,
  hasSafetyBackup,
  revertSafetyBackup,
  BACKUP_SCHEMA_VERSION
} from '../src/game/backup.js';
import { saveProgress, loadProgress, saveActive, loadActive, clearActive } from '../src/game/progress.js';
import { saveStats, loadStats } from '../src/game/stats.js';
import { saveDailyStore, loadDailyStore } from '../src/game/daily.js';
import { saveTutorial, loadTutorial } from '../src/game/tutorial.js';
import { setSetting, getSettings, setVolume, getVolume } from '../src/core/settings.js';
import { applyTheme, getTheme } from '../src/services/theme.js';
import { setLang, getLang } from '../src/i18n/index.js';
import { storage } from '../src/core/storage.js';
import { getLevel } from '../src/game/levels.js';

test('backup : payload d\'export complet avec métadonnées, résumé et données 100% cohérentes', () => {
  localStorage.clear();
  saveProgress({
    unlocked: 12,
    completed: {
      1: { attempts: 2, time: 25, stars: 3, clean: true },
      2: { attempts: 4, time: 60, stars: 2, clean: false }
    }
  });
  saveStats({ played: 10, wins: 8, losses: 2, streak: 3, bestStreak: 5 });
  saveDailyStore({
    lastSeenDate: '2026-11-19',
    streak: 4,
    bestStreak: 7,
    totalWins: 5,
    totalPlayed: 6,
    active: null,
    history: { '2026-11-19': { won: true, attempts: 3, maxAttempts: 9, time: 45, clean: true, stars: 3, emojiGrid: '🟢', dateKey: '2026-11-19' } }
  });
  saveTutorial({ step: 8, completed: true, skipped: false });
  setSetting('name', 'Atlas');
  setSetting('sound', false);
  setSetting('vibration', true);
  setVolume(65);
  applyTheme('light');
  setLang('en');

  const payload = createBackupPayload();
  assert.equal(payload.app, 'MIND LOCK PRO');
  assert.equal(payload.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.ok(typeof payload.exportedAt === 'string');
  assert.equal(payload.summary.unlocked, 12);
  assert.equal(payload.summary.completedCount, 2);
  assert.equal(payload.summary.totalStars, 5);
  assert.equal(payload.summary.playerName, 'Atlas');
  assert.equal(payload.summary.hasActiveGame, false);

  assert.equal(payload.data.progress.unlocked, 12);
  assert.equal(payload.data.stats.wins, 8);
  assert.equal(payload.data.daily.streak, 4);
  assert.equal(payload.data.tutorial.completed, true);
  assert.equal(payload.data.settings.name, 'Atlas');
  assert.equal(payload.data.settings.sound, false);
  assert.equal(payload.data.volume, 65);
  assert.equal(payload.data.theme, 'light');
  assert.equal(payload.data.lang, 'en');
});

test('backup : restauration intégrale d\'une partie en cours (mlp:active) avec tentatives, indices, saisie et éliminations', () => {
  localStorage.clear();
  const rules = getLevel(35);
  const activeGame = {
    level: 35,
    state: {
      secret: [4, 8, 2, 9],
      guesses: [
        { guess: [1, 2, 3, 4], exact: 0, misplaced: 2 },
        { guess: [4, 5, 6, 7], exact: 1, misplaced: 0 }
      ],
      hintsUsed: [{ pos: 0, digit: 4 }],
      status: 'playing',
      rules
    },
    elapsed: 88,
    input: [4, 8],
    eliminated: [1, 3, 5, 6, 7]
  };
  saveActive(activeGame);
  saveProgress({ unlocked: 35, completed: {} });

  const payload = createBackupPayload();
  assert.equal(payload.summary.hasActiveGame, true);
  assert.equal(payload.summary.activeLevel, 35);

  // Écraser la partie en cours
  clearActive();
  assert.equal(loadActive(), null);

  // Réimporter la sauvegarde
  const res = parseAndValidateBackup(JSON.stringify(payload));
  assert.equal(res.ok, true);
  applyBackup(res.payload);

  const restoredActive = loadActive();
  assert.ok(restoredActive);
  assert.equal(restoredActive.level, 35);
  assert.deepEqual(restoredActive.state.secret, [4, 8, 2, 9]);
  assert.equal(restoredActive.state.guesses.length, 2);
  assert.deepEqual(restoredActive.state.hintsUsed, [{ pos: 0, digit: 4 }]);
  assert.equal(restoredActive.elapsed, 88);
  assert.deepEqual(restoredActive.input, [4, 8]);
  assert.deepEqual(restoredActive.eliminated, [1, 3, 5, 6, 7]);
});

test('backup : transfert bidirectionnel (Mobile -> PC -> Mobile) sans perte de données', () => {
  // 1. État sur Mobile
  localStorage.clear();
  saveProgress({
    unlocked: 25,
    completed: {
      1: { attempts: 1, time: 12, stars: 3, clean: true },
      2: { attempts: 3, time: 40, stars: 2, clean: false }
    }
  });
  saveStats({ played: 15, wins: 14, losses: 1, streak: 6, bestStreak: 10 });
  setSetting('name', 'Joueur Mobile');
  applyTheme('dark');
  setLang('fr');

  const mobileExportText = JSON.stringify(createBackupPayload());

  // 2. Import sur PC (partant d'un PC avec données vierges)
  localStorage.clear();
  const pcValidation = parseAndValidateBackup(mobileExportText);
  assert.equal(pcValidation.ok, true);
  assert.equal(pcValidation.summary.playerName, 'Joueur Mobile');
  assert.equal(pcValidation.summary.unlocked, 25);
  applyBackup(pcValidation.payload);

  assert.equal(loadProgress().unlocked, 25);
  assert.equal(loadStats().wins, 14);
  assert.equal(getSettings().name, 'Joueur Mobile');
  assert.equal(getTheme(), 'dark');
  assert.equal(getLang(), 'fr');

  // 3. Le joueur progresse sur PC (débloque le niveau 26)
  saveProgress({
    unlocked: 26,
    completed: {
      ...loadProgress().completed,
      25: { attempts: 4, time: 75, stars: 2, clean: false }
    }
  });
  setSetting('name', 'Joueur Mobile & PC');

  const pcExportText = JSON.stringify(createBackupPayload());

  // 4. Réimport sur le Mobile
  const mobileImportValidation = parseAndValidateBackup(pcExportText);
  assert.equal(mobileImportValidation.ok, true);
  applyBackup(mobileImportValidation.payload);

  assert.equal(loadProgress().unlocked, 26);
  assert.equal(getSettings().name, 'Joueur Mobile & PC');
  assert.ok(loadProgress().completed[25]);
});

test('backup : fichier corrompu, vide ou falsifié rejeté SANS altérer la progression existante', () => {
  localStorage.clear();
  const initialProgress = {
    unlocked: 18,
    completed: { 1: { attempts: 2, time: 30, stars: 3, clean: true } }
  };
  saveProgress(initialProgress);
  saveStats({ played: 5, wins: 5, losses: 0, streak: 5, bestStreak: 5 });
  const snapshotBefore = JSON.stringify(localStorage);

  // 1. Fichier vide
  const emptyRes = parseAndValidateBackup('');
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.error, 'backupEmpty');

  // 2. Fichier texte non-JSON
  const invalidJsonRes = parseAndValidateBackup('Ceci n\'est pas du JSON {');
  assert.equal(invalidJsonRes.ok, false);
  assert.equal(invalidJsonRes.error, 'backupInvalidJson');

  // 3. JSON non objet (tableau ou nombre)
  const arrayRes = parseAndValidateBackup('[1, 2, 3]');
  assert.equal(arrayRes.ok, false);
  assert.equal(arrayRes.error, 'backupInvalid');

  // 4. Objet sans rapport avec MIND LOCK PRO
  const unrelatedRes = parseAndValidateBackup(JSON.stringify({ someKey: 'hello world', count: 42 }));
  assert.equal(unrelatedRes.ok, false);
  assert.equal(unrelatedRes.error, 'backupUnrecognized');

  // 5. Version de schéma future non supportée
  const futureRes = parseAndValidateBackup(JSON.stringify({
    app: 'MIND LOCK PRO',
    schemaVersion: 999,
    data: { progress: { unlocked: 50 } }
  }));
  assert.equal(futureRes.ok, false);
  assert.equal(futureRes.error, 'backupVersionTooNew');

  // INVARIANCE STRICTE : aucune tentative invalide n'a modifié le LocalStorage
  assert.equal(JSON.stringify(localStorage), snapshotBefore);
  assert.deepEqual(loadProgress(), initialProgress);
});

test('backup : rétrocompatibilité avec ancien format (export plat sans enveloppe app/data)', () => {
  localStorage.clear();
  const legacyFlatBackup = JSON.stringify({
    unlocked: 8,
    completed: {
      1: { attempts: 2, time: 22, stars: 3 },
      2: { attempts: 5, time: 80, stars: 1 }
    },
    stats: { played: 4, wins: 3, losses: 1, streak: 2, bestStreak: 2 },
    settings: { name: 'Ancien Joueur', sound: true, vibration: false },
    theme: 'light',
    lang: 'fr'
  });

  const res = parseAndValidateBackup(legacyFlatBackup);
  assert.equal(res.ok, true);
  assert.equal(res.summary.unlocked, 8);
  assert.equal(res.summary.playerName, 'Ancien Joueur');
  assert.equal(res.summary.totalStars, 4);

  applyBackup(res.payload);
  assert.equal(loadProgress().unlocked, 8);
  assert.equal(loadStats().wins, 3);
  assert.equal(getSettings().name, 'Ancien Joueur');
  assert.equal(getSettings().vibration, false);
});

test('backup : création automatique de la sauvegarde de sécurité pré-import et rollback fiable', () => {
  localStorage.clear();
  // Progression A (actuelle)
  saveProgress({ unlocked: 15, completed: { 1: { attempts: 2, time: 20, stars: 3 } } });
  saveStats({ played: 10, wins: 9, losses: 1, streak: 4, bestStreak: 4 });
  setSetting('name', 'Joueur A');

  assert.equal(hasSafetyBackup(), false);

  // Progression B (à importer)
  const backupB = JSON.stringify({
    app: 'MIND LOCK PRO',
    schemaVersion: 1,
    data: {
      progress: { unlocked: 50, completed: { 1: { attempts: 1, time: 10, stars: 3 } } },
      stats: { played: 60, wins: 55, losses: 5, streak: 12, bestStreak: 20 },
      settings: { name: 'Joueur B', sound: true, vibration: true }
    }
  });

  const validB = parseAndValidateBackup(backupB);
  assert.equal(validB.ok, true);
  applyBackup(validB.payload);

  // État B est appliqué
  assert.equal(loadProgress().unlocked, 50);
  assert.equal(getSettings().name, 'Joueur B');

  // Une sauvegarde de sécurité de l'état A a été créée automatiquement
  assert.equal(hasSafetyBackup(), true);
  const safety = getSafetyBackup();
  assert.equal(safety.summary.unlocked, 15);
  assert.equal(safety.summary.playerName, 'Joueur A');

  // Rollback vers l'état A
  const reverted = revertSafetyBackup();
  assert.equal(reverted, true);
  assert.equal(hasSafetyBackup(), false);

  // Vérification que l'état A est 100% restauré
  assert.equal(loadProgress().unlocked, 15);
  assert.equal(loadStats().wins, 9);
  assert.equal(getSettings().name, 'Joueur A');
});

test('backup : neutralisation des tentatives d\'injection ou de prototype pollution', () => {
  localStorage.clear();
  const maliciousPayload = JSON.stringify({
    app: 'MIND LOCK PRO',
    schemaVersion: 1,
    data: {
      __proto__: { admin: true },
      constructor: { prototype: { hacked: true } },
      progress: { unlocked: '<script>alert(1)</script>', completed: {} },
      settings: { name: '<b onmouseover="alert(1)">Hacker</b>', sound: 'not-a-bool' },
      volume: 999999
    }
  });

  const res = parseAndValidateBackup(maliciousPayload);
  assert.equal(res.ok, true);
  applyBackup(res.payload);

  // Aucune pollution de prototype
  assert.equal(Object.prototype.admin, undefined);
  assert.equal(Object.prototype.hacked, undefined);

  // unlocked assaini en entier valide (1..100)
  assert.equal(typeof loadProgress().unlocked, 'number');
  assert.equal(loadProgress().unlocked, 1);

  // volume plafonné à 80 (fallback valide car 999999 > 100)
  assert.equal(getVolume(), 80);

  // sound assaini en boolean
  assert.equal(typeof getSettings().sound, 'boolean');
});
