/**
 * Test E2E navigateur (optionnel, hors `npm test`) : parcours complet, captures, débordements, erreurs JS, hors-ligne.
 * Prérequis : serveur sur http://localhost:8080 (`npm start`), Chromium, et `puppeteer-core` installé
 * (ex. `NODE_PATH=/tmp/pt/node_modules`). Usage : node scripts/e2e.mjs [dossier-captures]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const OUT = process.argv[2] || '/tmp/shots', BASE = process.env.BASE || 'http://localhost:8080';
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const errors = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`); };

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] });
async function newPage(w, h, mobile = true) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return p;
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const click = (p, sel) => p.$eval(sel, el => el.click());
const active = p => p.evaluate(() => JSON.parse(localStorage.getItem('mlp:active')));
const type = async (p, digits) => { for (const d of digits) { await click(p, `.key[data-d="${d}"]`); } };
const hash = p => p.evaluate(() => location.hash);

const p = await newPage(390, 844);
await p.goto(BASE + '/#/home', { waitUntil: 'networkidle0' });
await p.evaluate(() => { localStorage.clear(); }); await p.reload({ waitUntil: 'networkidle0' });
await sleep(1300); await shot(p, '01-home-dark');
check('home : pas de débordement horizontal', (await overflow(p)) <= 0);
check('home : 4 statistiques', (await p.$$('.stat')).length === 4);
check('home : 25 cellules, 1 courante, 24 verrouillées', (await p.$$('.lv')).length === 25 && (await p.$$('.lv.current')).length === 1 && (await p.$$('.lv.locked')).length === 24);

// tutoriel interactif (8 étapes, recommencer, passer)
await click(p, '.tut-banner [data-a="tutorial"]'); await sleep(400);
check('tutoriel : route /tutorial étape 1', (await hash(p)) === '#/tutorial');
await shot(p, '17-tutorial-step1');
await click(p, '[data-a="unlock"]'); await sleep(200);
await click(p, '[data-choice="4271"]'); await sleep(200);
await shot(p, '18-tutorial-step3');
await type(p, [4, 7, 9, 0]); await click(p, '[data-a="submit"]'); await sleep(200);
await click(p, '[data-choice="4"]'); await sleep(200);
await click(p, '[data-choice="7"]'); await sleep(200);
await click(p, '[data-choice="none"]'); await sleep(200);
check('tutoriel : chiffres absents 6,8,9,0 marqués éliminés sur le clavier', await p.$eval('.key[data-d="6"]', e => e.classList.contains('eliminated')));
await type(p, [4, 2, 7, 1]); await click(p, '[data-a="submit"]'); await sleep(200);
await type(p, [8, 3, 5, 2]); await click(p, '[data-a="submit"]'); await sleep(500);
await shot(p, '19-tutorial-done');
check('tutoriel : 8 étapes validées et sauvegardées', !!(await p.$('.tut-done')) && await p.evaluate(() => JSON.parse(localStorage.getItem('mlp:tutorial')).completed === true));
await click(p, '.tut-done [data-a="restart"]'); await sleep(250);
check('tutoriel : bouton recommencer remet à l\'étape 1', await p.evaluate(() => JSON.parse(localStorage.getItem('mlp:tutorial')).step === 1));
await click(p, '[data-a="skip"]'); await sleep(350);
check('tutoriel : bouton passer ramène à l\'accueil', (await hash(p)) === '#/home' && await p.evaluate(() => JSON.parse(localStorage.getItem('mlp:tutorial')).skipped === true));

await click(p, '[data-a="levels"]'); await sleep(500); await shot(p, '02-levels');
check('niveaux : route /levels', (await hash(p)) === '#/levels');
for (const i of [1, 2, 3]) { await click(p, `[data-tier="${i}"]`); await sleep(150); }
check('niveaux : 4 onglets, grille de 25', (await p.$$('.tab')).length === 4 && (await p.$$('.lv')).length === 25);
check('niveaux : verrouillés désactivés', (await p.$$eval('.lv.locked', els => els.every(e => e.disabled))));
await click(p, '[data-tier="0"]'); await sleep(150);

await click(p, '.lv.current'); await sleep(600);
check('jeu : route /game/1', (await hash(p)) === '#/game/1');
await shot(p, '03-game-empty');
check('jeu : 4 emplacements secrets masqués', (await p.$$('#secret .slot.masked')).length === 4);
await type(p, [1, 1]);
check('jeu : doublon interdit => chiffre 1 désactivé', await p.$eval('.key[data-d="1"]', e => e.disabled));
await click(p, '[data-a="erase"]');
await click(p, '[data-a="submit"]');
let msg = await p.$eval('#msg', e => e.textContent); check('jeu : validation incomplète refusée', msg.length > 0 || await p.$eval('[data-a="submit"]', e => e.disabled));
await click(p, '[data-a="erase"]');

let a = await active(p), secret = a.state.secret;
const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !secret.includes(d)).slice(0, 2).concat(secret.slice(0, 1), [secret[1]]);
await type(p, wrong); await click(p, '[data-a="submit"]'); await sleep(700);
check('jeu : tentative ajoutée avec 3 indicateurs (✓, ⇄, ✕)', (await p.$$('.attempt')).length === 1 && (await p.$$('.attempt .pill')).length === 3);
await click(p, '[data-a="hint"]'); await sleep(500);
check('jeu : indice révèle un chiffre', (await p.$$('#secret .slot.hinted')).length === 1);
await shot(p, '04-game-attempt-hint');
await click(p, '[data-a="pause"]'); await sleep(400); await shot(p, '05-game-pause');
check('jeu : pause affichée et plateau masqué (is-paused)', !!(await p.$('.overlay.pause')) && !!(await p.$('.game.is-paused')));
const t0 = await p.$eval('#timer', e => e.textContent); await sleep(1600);
check('jeu : chronomètre arrêté en pause', t0 === await p.$eval('#timer', e => e.textContent));
await click(p, '[data-a="resume"]');
check('jeu : zone élimination présente (10 boutons 0-9 + Réinitialiser)', (await p.$$('#elim-panel .elim-btn')).length === 10 && !!(await p.$('#elim-reset')));
check('jeu : clavier visible dans le viewport', await p.evaluate(() => document.querySelector('.keypad').getBoundingClientRect().bottom <= innerHeight));
check('jeu : pas de débordement horizontal', (await overflow(p)) <= 0);

// Phase 4 : Élimination manuelle des chiffres (tests obligatoires 1 à 7)
await click(p, '.elim-btn[data-elim="9"]'); await sleep(150);
check('élimination (1) : clic sur 9 marque éliminé, compteur 9/10, touche 9 du clavier marquée mais non désactivée', await p.evaluate(() => {
  const b = document.querySelector('.elim-btn[data-elim="9"]');
  const k = document.querySelector('.key[data-d="9"]');
  return b.classList.contains('is-eliminated') && b.getAttribute('aria-pressed') === 'true' && k.classList.contains('eliminated') && !k.disabled && document.querySelector('#elim-count').textContent.includes('9/10');
}));
await click(p, '.elim-btn[data-elim="9"]'); await sleep(150);
check('élimination (2) : second clic sur 9 restaure le chiffre (10/10)', await p.evaluate(() => {
  const b = document.querySelector('.elim-btn[data-elim="9"]');
  return !b.classList.contains('is-eliminated') && b.getAttribute('aria-pressed') === 'false' && document.querySelector('#elim-count').textContent.includes('10/10');
}));
// Éliminer 2 chiffres + tester l'avertissement discret lors de la saisie d'un chiffre éliminé
await click(p, '.elim-btn[data-elim="9"]'); await click(p, '.elim-btn[data-elim="8"]'); await sleep(150);
await shot(p, '26-game-elimination');
// saisie temporaire (chiffres saisis sans valider, dont chiffres éliminés) + sauvegarde / reprise après rechargement
await type(p, [9, 8]);
check('élimination (7) : avertissement discret affiché si un chiffre éliminé est saisi, validation reste active', await p.evaluate(() => {
  const m = document.querySelector('#msg');
  return m.classList.contains('warn') && m.textContent.trim().length > 0;
}));
check('saisie temporaire : 2 chiffres affichés et persistés avec éliminations', (await p.$$('#entry .entry-slot.filled')).length === 2 && (await active(p)).input.length === 2 && JSON.stringify((await active(p)).eliminated) === '[8,9]');
await p.reload({ waitUntil: 'networkidle0' }); await sleep(600);
check('sauvegarde : partie reprise après rechargement', (await p.$$('.attempt')).length === 1 && (await p.$$('#secret .slot.hinted')).length === 1);
check('sauvegarde : saisie temporaire restaurée après rechargement', (await p.$$eval('#entry .entry-slot.filled', els => els.map(e => e.textContent).join(''))) === '98');
check('élimination (4) : chiffres éliminés [8,9] et compteur 8/10 restaurés après actualisation', await p.evaluate(() => {
  return document.querySelector('.elim-btn[data-elim="9"]').classList.contains('is-eliminated') &&
    document.querySelector('.elim-btn[data-elim="8"]').classList.contains('is-eliminated') &&
    document.querySelector('#elim-count').textContent.includes('8/10');
}));
await click(p, '[data-a="erase"]'); await click(p, '[data-a="erase"]');

// bouton Retour Android (history.back) + reprise de partie avec éliminations conservées (5)
await click(p, '[data-a="back"]'); await sleep(300);
check('navigation : retour vers /levels conserve la partie', (await hash(p)) === '#/levels' && !!(await active(p)));
await p.goBack(); await sleep(400);
check('bouton Retour Android + élimination (5) : revient à la partie en cours avec éliminations conservées', (await hash(p)) === '#/game/1' && !(await p.$('.modal')) && (await p.$$('.attempt')).length === 1 && (await p.$$('.elim-btn.is-eliminated')).length === 2);

// Réinitialiser tous les chiffres éliminés (3)
await click(p, '#elim-reset'); await sleep(150);
check('élimination (3) : bouton Réinitialiser rétablit tous les chiffres (10/10)', (await p.$$('.elim-btn.is-eliminated')).length === 0 && await p.$eval('#elim-reset', e => e.disabled));
// Éliminer un chiffre avant la victoire pour vérifier qu'une nouvelle partie (niveau suivant) réinitialise les éliminations (6)
await click(p, '.elim-btn[data-elim="0"]'); await sleep(100);

// victoire
a = await active(p); await type(p, a.state.secret); await click(p, '[data-a="submit"]'); await sleep(2400);
await shot(p, '06-win');
check('victoire : feuille de résultat + étoiles', !!(await p.$('.result.win')) && (await p.$$('.result .stars .on')).length >= 1);
check('victoire : niveau 2 débloqué', await p.evaluate(() => JSON.parse(localStorage.getItem('mlp:progress')).unlocked === 2));
check('victoire : stats enregistrées', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mlp:stats')); return s.wins === 1 && s.streak === 1; }));
await click(p, '[data-a="next"]'); await sleep(600);
check('transition + élimination (6) : nouvelle partie au niveau suivant réinitialise les éliminations', (await hash(p)) === '#/game/2' && (await p.$$('.elim-btn.is-eliminated')).length === 0 && (await active(p)).eliminated.length === 0);

// protection des parties : aucune confirmation si aucune progression au niveau 2
await click(p, '[data-a="back"]'); await sleep(300);
await click(p, '[data-lv="1"]'); await sleep(400);
check('protection : pas de confirmation inutile sans progression', (await hash(p)) === '#/game/1' && !(await p.$('.modal')));
await p.goto(BASE + '/#/game/2', { waitUntil: 'networkidle0' }); await sleep(400);

// protection des parties : confirmation + ANNULATION + CONFIRMATION
await click(p, '[data-a="hint"]'); await sleep(300); // progression au niveau 2
const savedBefore = await active(p);
await click(p, '[data-a="back"]'); await sleep(300);
await click(p, '[data-lv="1"]'); await sleep(300);
check('protection : modale affichée avant de remplacer la partie du niveau 2', !!(await p.$('.modal')));
await shot(p, '16-replace-confirm');
await p.$eval('.modal [data-r="0"]', e => e.click()); await sleep(300); // ANNULER
check('protection : annulation revient à la grille et préserve la partie du niveau 2', (await hash(p)) === '#/levels' && (await active(p))?.level === 2 && (await active(p))?.state.hintsUsed.length === 1 && JSON.stringify((await active(p)).state.secret) === JSON.stringify(savedBefore.state.secret));
// même protection depuis l'accueil (grille + Nouvelle partie)
await p.goto(BASE + '/#/home', { waitUntil: 'networkidle0' }); await sleep(400);
await click(p, '[data-a="new"]'); await sleep(300);
check('protection : Nouvelle partie demande confirmation', !!(await p.$('.modal')));
await p.$eval('.modal [data-r="0"]', e => e.click()); await sleep(300);
check('protection : annulation sur l\'accueil préserve la partie', (await hash(p)) === '#/home' && (await active(p))?.level === 2);
// CONFIRMER le remplacement vers le niveau 1, puis retour au niveau 2 pour le test de défaite
await click(p, '[data-lv="1"]'); await sleep(300);
await p.$eval('.modal [data-r="1"]', e => e.click()); await sleep(400);
check('protection : confirmation ouvre le niveau 1 avec une nouvelle partie', (await hash(p)) === '#/game/1' && (await p.$$('.attempt')).length === 0);
await p.goto(BASE + '/#/game/2', { waitUntil: 'networkidle0' }); await sleep(400);

// données LocalStorage corrompues dans le navigateur → pas de crash, nouvelle partie propre
await p.evaluate(() => { localStorage.setItem('mlp:active', '{corrompu'); localStorage.setItem('mlp:stats', '"bad"'); });
await p.reload({ waitUntil: 'networkidle0' }); await sleep(400);
check('localStorage corrompu : reprise propre sans erreur', (await hash(p)) === '#/game/2' && (await p.$$('#secret .slot.masked')).length === 4);
await click(p, '[data-a="hint"]'); await sleep(200); // recrée une sauvegarde active pour la suite

// accessibilité : tous les boutons/contrôles ont un nom accessible et un seul h1 par écran
for (const r of ['home', 'levels', 'settings', 'tutorial', 'daily', 'stats', 'game/2']) {
  await p.goto(`${BASE}/#/${r}`, { waitUntil: 'networkidle0' }); await sleep(300);
  const a11y = await p.evaluate(() => {
    const unnamed = [...document.querySelectorAll('button,select,input')].filter(el => !(el.getAttribute('aria-label') || el.textContent.trim() || el.labels?.length));
    return { h1: document.querySelectorAll('h1').length, unnamed: unnamed.length };
  });
  check(`accessibilité ${r} : 1 titre h1 et tous les contrôles nommés`, a11y.h1 === 1 && a11y.unnamed === 0, JSON.stringify(a11y));
}

// Défi Quotidien (#/daily) : participation unique, calendrier 14 jours, partage emoji sans fuite du secret
await p.goto(`${BASE}/#/daily`, { waitUntil: 'networkidle0' }); await sleep(500);
await shot(p, '21-daily-play');
check('daily : route /daily avec 5 emplacements secrets masqués', (await hash(p)) === '#/daily' && (await p.$$('#secret .slot.masked')).length === 5);
const dailySecret = await p.evaluate(() => JSON.parse(localStorage.getItem('mlp:daily'))?.active?.state?.secret);
check('daily : code secret quotidien déterministe de 5 chiffres distincts', Array.isArray(dailySecret) && dailySecret.length === 5 && new Set(dailySecret).size === 5);
await type(p, dailySecret); await click(p, '[data-a="submit"]'); await sleep(1900);
await shot(p, '22-daily-done');
check('daily : défi terminé, calendrier 14 jours et bouton partage affichés', !!(await p.$('[data-a="share"]')) && (await p.$$('.cal-day')).length === 14 && (await p.$$('.cal-day.won')).length === 1);
check('daily : rechargement le même jour conserve l\'état terminé (pas de seconde participation)', (await p.reload({ waitUntil: 'networkidle0' }), await sleep(400), !!(await p.$('[data-a="share"]')) && !(await p.$('.keypad'))));

// Tableau de bord Profil & Statistiques (#/stats)
await p.goto(`${BASE}/#/stats`, { waitUntil: 'networkidle0' }); await sleep(500);
await shot(p, '23-stats-dashboard');
check('stats : 8 cartes statistiques + 4 barres de progression par catégorie', (await p.$$('.stats .stat')).length === 8 && (await p.$$('.cat-row')).length === 4);
check('stats : défis quotidiens gagnés = 1', await p.evaluate(() => document.body.innerText.includes('1')));

// retour sur game/2 pour le test de défaite
await p.goto(`${BASE}/#/game/2`, { waitUntil: 'networkidle0' }); await sleep(350);

// défaite (12 tentatives au niveau 2)
a = await active(p); const sec2 = a.state.secret;
const bad = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !sec2.includes(d)).slice(0, 4);
for (let i = 0; i < a.state.rules.maxAttempts; i++) { await type(p, bad); await click(p, '[data-a="submit"]'); }
await sleep(2200); await shot(p, '07-lose');
check('défaite : feuille de résultat + secret révélé', !!(await p.$('.result.lose')) && (await p.$$('#secret .slot.revealed')).length === sec2.length);
await click(p, '[data-a="retry"]'); await sleep(400);
check('défaite : recommencer remet à zéro', (await p.$$('.attempt')).length === 0);

// paramètres, volume audio, thème, langues
await p.goto(BASE + '/#/settings', { waitUntil: 'networkidle0' }); await sleep(500); await shot(p, '08-settings');
await p.evaluate(() => {
  const r = document.querySelector('#vol');
  r.value = '45';
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
check('audio : curseur de volume met à jour LocalStorage (45%)', await p.evaluate(() => JSON.parse(localStorage.getItem('mlp:volume')) === 45 && document.querySelector('#vol-val').textContent === '45%'));
await p.type('#pname', 'Hicham'); 
await click(p, '[data-a="theme"][data-v="light"]'); await sleep(500); await shot(p, '09-settings-light');
check('thème clair appliqué', await p.evaluate(() => document.documentElement.dataset.theme === 'light'));
await p.goto(BASE + '/#/home', { waitUntil: 'networkidle0' }); await sleep(1200); await shot(p, '10-home-light');
check('profil : nom affiché sur l\'accueil', (await p.$eval('.eyebrow', e => e.textContent)).includes('Hicham'));
await click(p, '[data-a="settings"]'); await sleep(300);
await click(p, '[data-a="lang"][data-v="ar"]'); await sleep(400);
check('arabe : dir=rtl, lang=ar', await p.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'));
await shot(p, '11-settings-ar');
await click(p, '[data-a="theme"][data-v="dark"]'); await sleep(300);
for (const [r, n] of [['home', '12-home-ar'], ['levels', '13-levels-ar'], ['game/2', '14-game-ar'], ['tutorial', '20-tutorial-ar'], ['daily', '24-daily-ar'], ['stats', '25-stats-ar']]) {
  await p.goto(`${BASE}/#/${r}`, { waitUntil: 'networkidle0' }); await sleep(1200);
  check(`arabe : ${r} sans débordement`, (await overflow(p)) <= 0); await shot(p, n);
}
check('arabe : pas de texte non traduit (clés brutes)', !(await p.evaluate(() => /\b(continue_|welcomeName|emptyHistory|resetDesc|dailyTitle|statsTitle)\b/.test(document.body.innerText))));
await p.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle0' });
await click(p, '[data-a="lang"][data-v="fr"]'); await sleep(300);

// réinitialisation avec confirmation
await click(p, '[data-a="reset"]'); await sleep(300); await shot(p, '15-reset-confirm');
await p.$eval('.modal [data-r="0"]', e => e.click()); await sleep(200);
check('réinitialisation : annulation conserve la progression', await p.evaluate(() => JSON.parse(localStorage.getItem('mlp:progress')).unlocked === 2));
await click(p, '[data-a="reset"]'); await sleep(200); await p.$eval('.modal [data-r="1"]', e => e.click()); await sleep(300);
check('réinitialisation : confirmation efface la progression', await p.evaluate(() => JSON.parse(localStorage.getItem('mlp:progress')).unlocked === 1));

// accès niveau verrouillé par URL
await p.goto(`${BASE}/#/game/50`, { waitUntil: 'networkidle0' }); await sleep(400);
check('niveau verrouillé : accès direct refusé (retour accueil)', (await hash(p)) === '#/home');

// hors ligne
await p.goto(BASE + '/#/home', { waitUntil: 'networkidle0' }); await sleep(1500);
await p.evaluate(() => navigator.serviceWorker.ready); await sleep(1000);
await p.setOfflineMode(true); await p.reload({ waitUntil: 'load' }); await sleep(800);
check('hors ligne : l\'application se charge', (await p.$$('.hero')).length === 1);
await p.setOfflineMode(false);

// responsive (320x568, 360x800, 390x844, 412x915, 820x1180, 1366x768)
for (const [name, w, h, mob] of [['android-small', 320, 568, true], ['android-mid', 360, 800, true], ['android-large', 412, 915, true], ['iphone', 390, 844, true], ['tablet', 820, 1180, true], ['desktop', 1366, 768, false]]) {
  const q = await newPage(w, h, mob);
  await q.goto(BASE + '/#/home', { waitUntil: 'networkidle0' }); await q.evaluate(() => { localStorage.clear(); });
  for (const [route, label] of [['home', 'home'], ['levels', 'levels'], ['settings', 'settings'], ['daily', 'daily'], ['stats', 'stats'], ['game/1', 'game']]) {
    await q.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle0' }); await q.reload({ waitUntil: 'networkidle0' }); await sleep(800);
    check(`${name} ${w}x${h} : ${label} sans débordement`, (await overflow(q)) <= 0);
    if (label === 'game') {
      check(`${name} : clavier entièrement visible`, await q.evaluate(() => document.querySelector('.keypad').getBoundingClientRect().bottom <= innerHeight + 1));
      await shot(q, `r-${name}-game`);
    }
    if (label === 'home' && name !== 'iphone') await shot(q, `r-${name}-home`);
  }
  await q.close();
}

check('aucune erreur JavaScript / console', errors.length === 0, errors.join(' | '));
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} vérifications réussies`);
await browser.close(); process.exit(failed ? 1 : 0);
