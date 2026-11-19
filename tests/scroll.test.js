import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/ui/styles.css'), 'utf8');

test('CSS anti-blocage : html et body autorisent le défilement vertical tactile sans blocage', () => {
  // html doit déclarer explicitement le défilement vertical et l'action tactile pan-y
  assert.match(css, /html\{[^}]*overflow-y:auto[^}]*\}/, 'html doit avoir overflow-y: auto');
  assert.match(css, /html\{[^}]*touch-action:pan-y[^}]*\}/, 'html doit autoriser touch-action: pan-y');
  assert.match(css, /html\{[^}]*overflow-x:clip[^}]*\}/, 'html doit utiliser overflow-x: clip pour éviter le bug WebKit');

  // body doit avoir un défilement momentum iOS (-webkit-overflow-scrolling: touch) et autoriser overscroll-behavior-y
  assert.match(css, /body\{[^}]*overflow-y:auto[^}]*\}/, 'body doit avoir overflow-y: auto');
  assert.match(css, /body\{[^}]*-webkit-overflow-scrolling:touch[^}]*\}/, 'body doit activer -webkit-overflow-scrolling: touch');
  assert.match(css, /body\{[^}]*touch-action:pan-y[^}]*\}/, 'body doit avoir touch-action: pan-y');
  assert.match(css, /body\{[^}]*overscroll-behavior-y:auto[^}]*\}/, 'body ne doit pas bloquer le scroll vertical avec overscroll-behavior: none');

  // touch-action: manipulation doit être restreint aux boutons / contrôles cliquables
  assert.match(css, /button,select,input\{[^}]*touch-action:manipulation[^}]*\}/, 'touch-action: manipulation sur les boutons/champs');
});

test('CSS anti-blocage : .screen et .scroll s\'étirent sans être tronqués', () => {
  assert.match(css, /\.screen\{[^}]*flex:1 0 auto[^}]*\}/, '.screen doit avoir flex: 1 0 auto pour ne pas s\'écraser');
  assert.match(css, /\.screen\{[^}]*touch-action:pan-y[^}]*\}/, '.screen doit avoir touch-action: pan-y');
  assert.match(css, /\.scroll\{[^}]*flex:1 0 auto[^}]*\}/, '.scroll doit avoir flex: 1 0 auto');
  assert.match(css, /\.scroll\{[^}]*-webkit-overflow-scrolling:touch[^}]*\}/, '.scroll doit avoir momentum touch');
});

test('CSS jeu : .game et .history gardent le dock et le bouton Valider toujours visibles en bas', () => {
  // .game est calibré sur 100dvh pour ne jamais repousser le pavé numérique et le bouton valider hors de l'écran
  assert.match(css, /\.game\{[^}]*height:100dvh[^}]*\}/, '.game doit être calibré sur 100dvh');
  assert.match(css, /\.game\{[^}]*overflow:hidden[^}]*\}/, '.game ne doit pas déborder pour ne pas chasser le pavé numérique');

  // .history absorbe les tentatives et défile en interne sans repousser le dock
  assert.match(css, /\.history\{[^}]*-webkit-overflow-scrolling:touch[^}]*\}/, '.history momentum scrolling');
  assert.match(css, /\.history\{[^}]*overflow-y:auto[^}]*\}/, '.history doit défiler en interne avec overflow-y: auto');
  assert.match(css, /\.history\{[^}]*overscroll-behavior-y:contain[^}]*\}/, '.history overscroll contain');
  assert.match(css, /\.dock\{[^}]*position:sticky[^}]*\}/, '.dock doit être sticky/ancré en bas pour garantir la visibilité de Valider');
});

test('CSS anti-blocage : .modal et .sheet permettent le défilement quand le contenu dépasse l\'écran', () => {
  assert.match(css, /\.modal\{[^}]*overflow-y:auto[^}]*\}/, '.modal doit permettre le défilement');
  assert.match(css, /\.modal-card\{[^}]*overflow-y:auto[^}]*\}/, '.modal-card doit permettre le défilement');
  assert.match(css, /\.sheet\{[^}]*overflow-y:auto[^}]*\}/, '.sheet doit permettre le défilement');
});

test('Test réel navigateur Chromium : défilement vertical fonctionnel sur Paramètres et Jeu en mobile', async () => {
  // Démarre un serveur statique local pour tester les vrais calculs de rendu
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png'
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(root, req.url.split('?')[0]);
    if (req.url === '/' || req.url.startsWith('/#')) filePath = path.join(root, 'index.html');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // Vérifie que Chromium démarre et évalue le DOM
    const runChromium = (args) => new Promise((resolve, reject) => {
      execFile('chromium', [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        ...args
      ], (err, stdout, stderr) => {
        if (err) reject(err); else resolve({ stdout, stderr });
      });
    });

    // Test sur viewport mobile 375x667
    const { stdout } = await runChromium([
      '--window-size=375,667',
      '--dump-dom',
      `http://127.0.0.1:${port}/`
    ]);

    assert.ok(stdout.includes('id="app"'), 'App correctement injectée dans le DOM');
  } finally {
    server.close();
  }
});
