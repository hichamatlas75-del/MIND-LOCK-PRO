/**
 * Génère les icônes PNG depuis les SVG (outil de build, non requis à l'exécution).
 * Prérequis : Chromium + puppeteer-core. Usage : node scripts/make-icons.mjs
 * Sorties : public/icons/icon-180.png (Apple, plein cadre), icon-192/512.png (any), icon-maskable-192/512.png
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const dir = new URL('../public/icons/', import.meta.url).pathname;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
async function render(svgFile, size, out) {
  const svg = fs.readFileSync(dir + svgFile).toString('base64');
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${svg}" width="${size}" height="${size}" style="display:block"></body></html>`);
  await page.screenshot({ path: dir + out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('✓', out, size + 'x' + size);
}
await render('icon-maskable.svg', 180, 'icon-180.png'); // iOS applique son propre masque : plein cadre
for (const s of [192, 512]) { await render('icon.svg', s, `icon-${s}.png`); await render('icon-maskable.svg', s, `icon-maskable-${s}.png`); }
await browser.close();
