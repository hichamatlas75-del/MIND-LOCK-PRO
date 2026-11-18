import fr from './fr.js'; import en from './en.js'; import ar from './ar.js';
import { LANGS } from '../core/config.js';
import { storage } from '../core/storage.js';
const dict = { fr, en, ar };
const saved = storage.get('lang', 'fr');
let lang = typeof saved === 'string' && Object.hasOwn(LANGS, saved) ? saved : 'fr';
/** Traduit une clé ; {var} remplacé via vars. */
export const t = (k, vars = {}) =>
  (dict[lang]?.[k] ?? dict.fr[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
export function setLang(l) {
  if (!Object.hasOwn(LANGS, l)) return;
  lang = l; storage.set('lang', l);
  document.documentElement.lang = l; document.documentElement.dir = LANGS[l];
}
export const getLang = () => lang;
export const langs = Object.keys(LANGS);
