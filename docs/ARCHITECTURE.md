# Architecture
- `src/core` : config, stockage (LocalStorage), bus d'événements
- `src/game` : moteur pur (testable) et progression des niveaux
- `src/ui` : styles et (à venir) écrans/composants
- `src/services` : audio (Web Audio), thème
- `src/i18n` : FR / EN / AR (RTL)
- `sw.js` : cache-first hors ligne ; `manifest.webmanifest` : installation PWA
Principe : le moteur n'a aucune dépendance DOM ; l'UI consomme le moteur via des modules ES.

## UI & Services (v0.4.0 — Phase 3.3)
- `src/main.js` : routeur par hash (`#/home`, `#/levels`, `#/game/<n>`, `#/daily`, `#/stats`, `#/tutorial`, `#/settings`) + gestion du cycle de vie mobile (`visibilitychange`, `pagehide`).
- `src/ui/screens/*` : un module par écran (`mountX(root, ctx)` retourne une fonction de nettoyage) :
  - `home.js` (accueil, défi quotidien, progression, tutoriel),
  - `levels.js` (100 niveaux, 4 catégories, effet `.just-unlocked`),
  - `game.js` (boucle de jeu, indices, déduction des chiffres éliminés, pause anti-triche),
  - `daily.js` (défi quotidien déterministe, calendrier 14 jours, partage emoji sans spoiler),
  - `stats-view.js` (tableau de bord Profil & Statistiques complet à 9 indicateurs + progression par catégorie),
  - `tutorial.js` (tutoriel interactif en 8 étapes),
  - `settings.js` (profil, langue FR/EN/AR, thème sombre/clair, son + curseur de volume 0–100 %, vibrations, réinitialisation).
- `src/game/daily.js` : moteur du Défi Quotidien (PRNG déterministe FNV-1a + Mulberry32 par date `YYYY-MM-DD`, participation unique par jour, protection anti-recul d'horloge, séries, partage emoji `🟢`/`🔵`/`⚪`).
- `src/services/audio.js` : synthétiseur Web Audio (8 effets sonores distincts, réglage du volume, verrouillage strict avant interaction utilisateur).
- `src/game/engine.js` : **intact** (aucune modification par rapport à `main`).
- Architecture exclusivement PWA (Android, iPhone, iPad, Desktop) : voir [docs/PWA_GUIDE.md](PWA_GUIDE.md).
