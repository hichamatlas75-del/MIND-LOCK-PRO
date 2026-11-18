import fr from './fr.js'; import en from './en.js'; import ar from './ar.js';
import { LANGS } from '../core/config.js';
import { storage } from '../core/storage.js';
const dict = { fr, en, ar };
let lang = storage.get('lang', 'fr');
export const t = k => dict[lang]?.[k] ?? dict.fr[k] ?? k;
export function setLang(l) {
  if (!(l in LANGS)) return;
  lang = l; storage.set('lang', l);
  document.documentElement.lang = l; document.documentElement.dir = LANGS[l];
}
export const getLang = () => lang;
