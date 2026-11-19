# Guide d'Architecture & d'Installation PWA — MIND LOCK PRO (`v0.5.2`)

**MIND LOCK PRO** est conçu **exclusivement comme une Progressive Web App (PWA)** multiplateforme (Android, iPhone, iPad et ordinateur), sans aucun code ni empaquetage natif (pas d'APK, pas de TWA, pas de Capacitor, pas de publication App Store / Google Play).

---

## 1. Principes architecturaux 100 % PWA

1. **Zéro dépendance externe** (`package.json`) : HTML5, CSS3 et JavaScript ES6+ natifs (modules ES).
2. **Manifest Web complet** (`manifest.webmanifest`) :
   - `display: "standalone"` et `orientation: "portrait"`.
   - `background_color: "#090B16"` et `theme_color: "#090B16"` synchronisés dynamiquement avec le thème sombre/clair via `src/services/theme.js`.
   - Icônes PNG `192×192` et `512×512` (`any` et `maskable`), icône Apple Touch `180×180` (`index.html`) et icône vectorielle `icon.svg`.
   - Raccourcis d'application (`shortcuts`) vers le Défi Quotidien (`#/daily`) et la grille des 100 niveaux (`#/levels`).
3. **Fonctionnement 100 % hors ligne** (`sw.js`) :
   - Stratégie **précache intégral + cache-first** des 39 fichiers de l'application (40 entrées précachées) avec `cache: 'reload'` à l'installation pour contourner le cache HTTP navigateur.
   - Nettoyage automatique des anciens caches lors de l'événement `activate`.
   - Notification non intrusive (`controllerchange` → toast `updateReady`) lorsqu'une nouvelle version est installée, sans jamais interrompre ni recharger de force une partie en cours.
4. **Persistance locale durable** (`src/core/storage.js` & `src/main.js`) :
   - Stockage 100 % local via `localStorage` sous le préfixe `mlp:` (`mlp:progress`, `mlp:active`, `mlp:stats`, `mlp:daily`, `mlp:tutorial`, `mlp:settings`, `mlp:volume`, `mlp:theme`, `mlp:lang`).
   - Appel automatique à `navigator.storage?.persist?.()` au démarrage afin de protéger les sauvegardes du joueur contre toute purge automatique du navigateur sur mobile (Safari iOS/iPadOS et Chrome Android).
   - Sauvegarde synchrone lors des interruptions (`visibilitychange`, `pagehide`, `beforeunload`).

---

## 2. Installation depuis les navigateurs compatibles

- **Android (Chrome, Edge, Samsung Internet, Brave)** :
  - L'événement standard `beforeinstallprompt` est pris en charge, ou via le menu du navigateur **« Installer l'application » / « Ajouter à l'écran d'accueil »**.
- **iPhone & iPad (Safari iOS / iPadOS)** :
  - Ouvrir le jeu dans Safari, appuyer sur le bouton **Partager**, puis choisir **« Sur l'écran d'accueil »**.
  - Les balises `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `apple-touch-icon` (`180×180`) et les marges `env(safe-area-inset-*)` assurent un affichage plein écran adapté aux encoches et à la barre d'accueil iOS.
- **Ordinateur (Chrome, Edge, Safari macOS)** :
  - Cliquer sur l'icône **Installer MIND LOCK PRO** dans la barre d'adresse (ou *Fichier → Ajouter au Dock* sur macOS).

---

## 3. Procédure de mise à jour de version

À chaque nouvelle version :
1. Incrémenter la version dans `package.json`, `src/core/config.js` (`APP.version`) et `sw.js` (`CACHE = 'mind-lock-pro-vX.Y.Z'`).
2. Vérifier la cohérence et la liste des fichiers précachés avec `npm test` (`tests/pwa.test.js` contrôle automatiquement que chaque fichier de `src/` et `public/icons/` figure dans `ASSETS` de `sw.js`).
