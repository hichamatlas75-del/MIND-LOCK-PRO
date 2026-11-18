import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));
const sw = read('sw.js'), html = read('index.html');
const pngSize = f => { const d = fs.readFileSync(path.join(root, f)); assert.equal(d.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', f + ' PNG'); return [d.readUInt32BE(16), d.readUInt32BE(20)]; };
const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

test('manifest : champs requis et icônes PNG 192/512 (any + maskable) existantes', () => {
  for (const k of ['name', 'short_name', 'start_url', 'display', 'icons', 'theme_color', 'background_color']) assert.ok(manifest[k], k);
  assert.equal(manifest.display, 'standalone');
  const has = (size, purpose) => manifest.icons.some(i => i.sizes === size && i.type === 'image/png' && i.purpose === purpose);
  for (const s of ['192x192', '512x512']) { assert.ok(has(s, 'any'), s + ' any'); assert.ok(has(s, 'maskable'), s + ' maskable'); }
  for (const i of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, i.src)), i.src);
    if (i.type === 'image/png') assert.deepEqual(pngSize(i.src), i.sizes.split('x').map(Number), i.src);
  }
});
test('icônes : 180x180 (Apple), 192, 512 et liens dans index.html', () => {
  assert.deepEqual(pngSize('public/icons/icon-180.png'), [180, 180]);
  assert.deepEqual(pngSize('public/icons/icon-192.png'), [192, 192]);
  assert.deepEqual(pngSize('public/icons/icon-512.png'), [512, 512]);
  assert.match(html, /rel="apple-touch-icon"[^>]*icon-180\.png/);
  assert.match(html, /rel="manifest"/); assert.match(html, /name="theme-color"/); assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
});
test('service worker : version de cache = version du package (sinon pas de mise à jour chez les joueurs)', () => {
  assert.equal(sw.match(/const CACHE = '([^']+)'/)[1], `mind-lock-pro-v${pkg.version}`);
  assert.match(read('src/core/config.js'), new RegExp(`version: '${pkg.version.replace(/\./g, '\\.')}'`));
});
test('service worker : précache tous les fichiers de l\'application (et seulement des fichiers existants)', () => {
  const listed = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  for (const f of listed) assert.ok(fs.existsSync(path.join(root, f)), 'manquant : ' + f);
  const required = [...walk('src'), 'index.html', 'manifest.webmanifest', ...walk('public/icons')];
  for (const f of required) assert.ok(listed.includes(f), 'non précaché : ' + f);
});
test('service worker : nettoyage des anciens caches, contournement du cache HTTP, repli navigation seulement', () => {
  assert.match(sw, /caches\.delete/); assert.match(sw, /cache: 'reload'/); assert.match(sw, /skipWaiting/); assert.match(sw, /clients\.claim/);
  assert.match(sw, /req\.mode === 'navigate'/);
});
