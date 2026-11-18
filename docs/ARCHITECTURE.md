# Architecture
- `src/core` : config, stockage (LocalStorage), bus d'événements
- `src/game` : moteur pur (testable) et progression des niveaux
- `src/ui` : styles et (à venir) écrans/composants
- `src/services` : audio (Web Audio), thème
- `src/i18n` : FR / EN / AR (RTL)
- `sw.js` : cache-first hors ligne ; `manifest.webmanifest` : installation PWA
Principe : le moteur n'a aucune dépendance DOM ; l'UI consomme le moteur via des modules ES.

## UI (v0.3.0)
- `src/main.js` : routeur par hash (`#/home`, `#/levels`, `#/game/<n>`, `#/settings`)
- `src/ui/screens/*` : un module par écran (`mountX(root, ctx)` retourne une fonction de nettoyage)
- `src/ui/components.js`, `icons.js`, `styles.css` : composants, icônes SVG, design system (thèmes sombre/clair via variables CSS)
- `src/game/session.js`, `stats.js` : progression + statistiques ; `src/core/settings.js` : préférences
- Le moteur (`engine.js`) n'est pas modifié : l'UI l'appelle sans le dupliquer.
