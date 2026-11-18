# 🔐 MIND LOCK PRO

Jeu de réflexion et de déduction : découvrez le code secret. PWA installable (Android, iOS, Windows), 100% hors ligne.

> **Statut : v0.2.0 – interface premium (accueil, niveaux, jeu, paramètres).**

## Stack
HTML5 · CSS3 · JavaScript ES6+ (modules) · PWA · Service Worker · LocalStorage · Web Audio API — sans dépendances.

## Fonctionnalités prévues
100 niveaux · 4 difficultés · indices · chronomètre · défis quotidiens · statistiques · sauvegarde auto · FR/EN/AR (RTL) · thème clair/sombre · hors ligne.

## Démarrage
```bash
npm start      # http://localhost:8080
npm test       # tests du moteur (Node ≥ 18)
```

## Écrans (v0.3.0)
Accueil (profil, progression, statistiques) · Niveaux (4 catégories, étoiles, meilleurs temps) · Jeu (code masqué, pavé numérique, historique, pause, indice) · Paramètres (langue, thème, sons, vibrations, réinitialisation).
Captures : [docs/screenshots](docs/screenshots). Test navigateur optionnel : `node scripts/e2e.mjs` (nécessite Chromium et `puppeteer-core`, non inclus dans les dépendances du projet).

## Structure
Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Feuille de route
1. Interface de jeu et boucle de jeu 2. Niveaux/difficultés 3. Indices et chronomètre 4. Défis quotidiens et stats 5. Audio, i18n complète 6. Icônes PNG, audit Lighthouse, déploiement.

## Licence
Tous droits réservés.
