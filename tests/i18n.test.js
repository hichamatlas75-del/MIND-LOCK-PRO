import './helpers/mock-storage.js';
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path';
import fr from '../src/i18n/fr.js'; import en from '../src/i18n/en.js'; import ar from '../src/i18n/ar.js';
const root = path.resolve(import.meta.dirname, '..');
const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const ARABIC = /[\u0600-\u06FF]/, vars = s => (s.match(/\{\w+\}/g) || []).sort().join();
const SAME_OK = new Set(['title', 'normal', 'expert', 'version', 'noscript', 'hintText', 'pause']); // identiques FR/EN légitimement

test('les 3 langues ont exactement les mêmes clés, sans valeur vide', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(fr).sort());
  for (const [n, d] of [['fr', fr], ['en', en], ['ar', ar]]) for (const [k, v] of Object.entries(d)) assert.ok(typeof v === 'string' && v.trim(), `${n}.${k}`);
});
test('variables {x} identiques dans chaque langue', () => {
  for (const k of Object.keys(fr)) { assert.equal(vars(en[k]), vars(fr[k]), 'en.' + k); assert.equal(vars(ar[k]), vars(fr[k]), 'ar.' + k); }
});
test('aucun texte dans la mauvaise langue : pas d\'arabe en FR/EN, arabe présent en AR, pas de FR copié en EN', () => {
  for (const k of Object.keys(fr)) {
    assert.ok(!ARABIC.test(fr[k]) && !ARABIC.test(en[k]), 'arabe dans fr/en : ' + k);
    if (k !== 'title') assert.ok(ARABIC.test(ar[k]), 'ar sans arabe : ' + k);
    if (!SAME_OK.has(k)) assert.notEqual(en[k], fr[k], 'en non traduit : ' + k);
  }
});
test('toutes les clés t(\'…\') du code existent', () => {
  const used = new Set();
  for (const f of walk('src').filter(f => f.endsWith('.js') && !f.includes('i18n/')))
    for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/\bt\('(\w+)'/g)) used.add(m[1]);
  assert.ok(used.size > 40);
  for (const k of used) assert.ok(k in fr, 'clé manquante : ' + k);
  // clés dynamiques : paliers de difficulté
  for (const k of ['beginner', 'normal', 'expert', 'master', 'repeatsOn', 'repeatsOff', 'won', 'lost', 'length', 'repeats', 'notDigit', 'finished', 'noHints']) assert.ok(k in fr, k);
});
