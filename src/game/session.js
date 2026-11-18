import { loadProgress, saveProgress, recordWin, defaultProgress, clearActive } from './progress.js';
import { loadStats, saveStats, recordResult, defaultStats, starsFor } from './stats.js';

/** État de session partagé par l'UI (progression + stats), persisté automatiquement. */
export const session = {
  progress: loadProgress(),
  stats: loadStats(),
  /** Victoire : met à jour progression + stats. Retourne { stars, newBest }. */
  win(level, { attempts, time, maxAttempts }) {
    const stars = starsFor(attempts, maxAttempts);
    const prev = this.progress.completed[level];
    this.progress = recordWin(this.progress, level, { attempts, time, stars });
    this.stats = recordResult(this.stats, true);
    saveProgress(this.progress); saveStats(this.stats);
    return { stars, newBest: !!prev && time < prev.time };
  },
  loss() { this.stats = recordResult(this.stats, false); saveStats(this.stats); },
  reset() {
    this.progress = defaultProgress(); this.stats = defaultStats();
    saveProgress(this.progress); saveStats(this.stats); clearActive();
  }
};
