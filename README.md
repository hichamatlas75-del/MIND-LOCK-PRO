# 🔐 MIND LOCK PRO

Jeu de réflexion et de déduction : découvrez le code secret. PWA installable (Android, iOS, Windows), 100% hors ligne.

> **Statut : v0.4.0 – Expérience PWA Premium (Android, iPhone, iPad, Desktop), Défi Quotidien, Tableau de bord Statistiques & Audio configurable.**

## Stack
HTML5 · CSS3 · JavaScript ES6+ (modules) · PWA · Service Worker · LocalStorage · Web Audio API — sans dépendances.

## Fonctionnalités
100 niveaux · 4 difficultés · Défi Quotidien déterministe (calendrier 14j + partage emoji sans spoiler) · Tutoriel interactif en 8 étapes · Tableau de bord Profil & Statistiques (9 indicateurs + 4 catégories) · Indices & déduction automatique des chiffres absents · Chronomètre & pause anti-triche · Synthétiseur Web Audio (8 effets + volume 0–100 %) · FR/EN/AR (RTL) · Thème sombre/clair · 100 % hors ligne.

## Démarrage
```bash
npm start      # http://localhost:8080
npm test       # 65 tests automatisés (Node ≥ 18)
```

## Écrans (v0.4.0)
Accueil (`#/home`) · 100 Niveaux (`#/levels`) · Jeu (`#/game/:n`) · Défi Quotidien (`#/daily`) · Profil & Statistiques (`#/stats`) · Tutoriel interactif (`#/tutorial`) · Paramètres (`#/settings`).
Captures : [docs/screenshots](docs/screenshots). Test navigateur optionnel : `node scripts/e2e.mjs` (nécessite Chromium et `puppeteer-core`, non inclus dans les dépendances du projet).

## Structure & Guide PWA
Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [docs/PWA_GUIDE.md](docs/PWA_GUIDE.md).

## Feuille de route
1. Interface de jeu et boucle de jeu 2. Niveaux/difficultés 3. Indices et chronomètre 4. Défis quotidiens et stats 5. Audio, i18n complète 6. Icônes PNG, audit Lighthouse, déploiement.

## Licence
Tous droits réservés.
