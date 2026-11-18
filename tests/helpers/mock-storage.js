/** localStorage en mémoire pour les tests Node (à importer AVANT les modules du jeu). */
const data = new Map();
globalThis.localStorage = {
  getItem: k => (data.has(k) ? data.get(k) : null),
  setItem: (k, v) => { data.set(k, String(v)); },
  removeItem: k => { data.delete(k); },
  clear: () => data.clear()
};
export const raw = (k, v) => localStorage.setItem('mlp:' + k, typeof v === 'string' ? v : JSON.stringify(v));
export const read = k => localStorage.getItem('mlp:' + k);
