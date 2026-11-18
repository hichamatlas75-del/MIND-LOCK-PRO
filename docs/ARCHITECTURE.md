# Architecture
- `src/core` : config, stockage (LocalStorage), bus d'événements
- `src/game` : moteur pur (testable) et progression des niveaux
- `src/ui` : styles et (à venir) écrans/composants
- `src/services` : audio (Web Audio), thème
- `src/i18n` : FR / EN / AR (RTL)
- `sw.js` : cache-first hors ligne ; `manifest.webmanifest` : installation PWA
Principe : le moteur n'a aucune dépendance DOM ; l'UI consomme le moteur via des modules ES.
