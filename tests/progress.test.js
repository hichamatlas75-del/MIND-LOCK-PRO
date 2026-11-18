import test from 'node:test'; import assert from 'node:assert/strict';
import { defaultProgress, recordWin, isUnlocked } from '../src/game/progress.js';

test('départ : seul le niveau 1 est débloqué', () => {
  const p = defaultProgress(); assert.ok(isUnlocked(p, 1)); assert.ok(!isUnlocked(p, 2)); assert.ok(!isUnlocked(p, 0));
});
test('victoire débloque le suivant, garde le meilleur temps, ne régresse pas', () => {
  let p = recordWin(defaultProgress(), 1, { attempts: 5, time: 60 });
  assert.equal(p.unlocked, 2); assert.ok(isUnlocked(p, 2));
  p = recordWin(p, 1, { attempts: 3, time: 90 }); assert.equal(p.completed[1].time, 60); assert.equal(p.unlocked, 2);
  p = recordWin(p, 1, { attempts: 2, time: 30 }); assert.equal(p.completed[1].time, 30);
  p = recordWin(p, 5, { attempts: 4, time: 10 }); assert.equal(p.unlocked, 6);
  p = recordWin(p, 2, { attempts: 4, time: 10 }); assert.equal(p.unlocked, 6);
});
test('plafonné à 100', () => { assert.equal(recordWin(defaultProgress(), 100, { attempts: 1, time: 1 }).unlocked, 100); });

test('étoiles conservées au maximum', () => {
  let p = recordWin(defaultProgress(), 1, { attempts: 5, time: 60, stars: 2 });
  assert.equal(p.completed[1].stars, 2);
  p = recordWin(p, 1, { attempts: 9, time: 90, stars: 1 }); assert.equal(p.completed[1].stars, 2);
  p = recordWin(p, 1, { attempts: 3, time: 40, stars: 3 }); assert.equal(p.completed[1].stars, 3); assert.equal(p.completed[1].time, 40);
});
