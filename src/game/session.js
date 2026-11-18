import { loadProgress, saveProgress, recordWin, defaultProgress, clearActive } from './progress.js';
import { loadStats, saveStats, recordResult, defaultStats, starsFor } from './stats.js';

/** État de session partagé par l'UI (progression + stats), persisté automatiquement. */
export const session = {
  progress: loadProgress(),
  stats: loadStats(),
  lastUnlockedLevel: null,
  /** Victoire : met à jour progression + stats. Retourne { stars, rawStars, newBest, clean, hintCapped }. */
  win(level, { attempts, time, maxAttempts, hintsUsed = 0, thresholds }) {
    const rawStars = starsFor(attempts, maxAttempts, { thresholds, hintsUsed: 0 });
    const stars = starsFor(attempts, maxAttempts, { thresholds, hintsUsed });
    const clean = hintsUsed === 0;
    const prev = this.progress.completed[level];
    const prevUnlocked = this.progress.unlocked;
    this.progress = recordWin(this.progress, level, { attempts, time, stars, clean });
    const unlockedNewLevel = this.progress.unlocked > prevUnlocked ? this.progress.unlocked : null;
    if (unlockedNewLevel) this.lastUnlockedLevel = unlockedNewLevel;
    this.stats = recordResult(this.stats, true);
    saveProgress(this.progress); saveStats(this.stats);
    return { stars, rawStars, newBest: !!prev && time < prev.time, clean, hintCapped: stars < rawStars, unlockedNewLevel };
  },
  loss() { this.stats = recordResult(this.stats, false); saveStats(this.stats); },
  reset() {
    this.progress = defaultProgress(); this.stats = defaultStats();
    this.lastUnlockedLevel = null; saveProgress(this.progress); saveStats(this.stats); clearActive();
  }
};
