# Étude technique — Distribution Android de MIND LOCK PRO (`v0.4.0`)

Ce document présente l'analyse technique comparative demandée à l'**Axe 6** de la Phase 3.3 pour distribuer **MIND LOCK PRO** sur Android et Google Play, tout en préservant l'architecture modulaire JavaScript ES6 sans dépendance lourde.

---

## 1. Comparatif des 3 approches de distribution Android

| Critère | 1. PWA installable directe | 2. Trusted Web Activity (TWA / Bubblewrap) | 3. Capacitor (WebView embarquée) |
| :--- | :--- | :--- | :--- |
| **Principe** | Installation depuis Chrome Android (« Ajouter à l'écran d'accueil » / WebAPK). | Conteneur Android officiel Google Play qui ouvre la PWA plein écran dans le moteur Chrome de l'appareil (vérifié par Digital Asset Links). | Application Android native embarquant tous les fichiers HTML/CSS/JS dans les `assets/` de l'APK/AAB et les exécutant dans `android.webkit.WebView`. |
| **Distribution Google Play** | Non (installation directe depuis l'URL HTTPS). | **Oui** (fichier `.aab` signé publiable sur Google Play). | **Oui** (fichier `.aab` signé publiable sur Google Play). |
| **Poids du binaire (`.aab` / `.apk`)** | 0 Mo de binaire natif (~150 Ko de cache PWA). | **Très léger (~1,5 à 2,5 Mo)** : aucun moteur ni asset dupliqué. | Moyen (~5 à 12 Mo) : inclut le runtime Capacitor + pont natif + assets. |
| **Fonctionnement 100 % hors ligne** | **Oui** après le 1er chargement grâce à `sw.js` (précache complet des 35 fichiers). | **Oui** après le 1er lancement grâce au Service Worker (`sw.js`). | **Oui dès l'installation** sans aucun appel réseau (fichiers locaux dans l'APK). |
| **Mises à jour du jeu** | Instantanées via `sw.js` dès que la version `CACHE` change. | **Instantanées côté web** + mises à jour Play Store uniquement si le manifeste natif change. | Requiert une nouvelle soumission `.aab` sur Google Play (sauf système OTA tiers). |
| **Impact sur le dépôt actuel** | **Aucun** (déjà 100 % fonctionnel). | **Aucun** : généré dans un dossier séparé ou en CI à partir de l'URL de production. | Ajoute `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` et un dossier `android/` (~50 fichiers Gradle). |
| **Accès APIs appareil** | Web Audio API, Vibration API (`navigator.vibrate`), Web Share API, `localStorage`, plein écran portrait. | Identique à Chrome Android (Web Audio, Vibration, Web Share, plein écran, raccourcis d'icône). | Accès aux plugins natifs Java/Kotlin (Play Games Services natif, achats in-app natifs, haptique avancée). |

---

## 2. Recommandation architecturale pour MIND LOCK PRO

### Stratégie recommandée en 2 paliers (sans alourdir le dépôt)

1. **Court terme & publication Google Play rapide : PWA + Trusted Web Activity (TWA via `@bubblewrap/cli`)**
   - **Justification** : MIND LOCK PRO est une application web pure (~150 Ko au total, 0 dépendance runtime), déjà dotée d'un `manifest.webmanifest` complet (icônes `192×192`, `512×512`, `maskable`, raccourcis Android `shortcuts`, orientation `portrait`, `theme_color: #070A14`), d'un Service Worker `cache-first` (`sw.js`) et de toutes les intégrations Web natives (Web Audio synthétisé, Vibration API, Web Share API, gestion du bouton Retour Android via `popstate`/`hashchange`, sauvegarde automatique sur `visibilitychange` et `pagehide`).
   - **Avantage** : **zéro modification du code source** et **zéro dépendance npm ajoutée au projet**. L'AAB Google Play est généré avec Bubblewrap en pointant sur l'URL HTTPS de la PWA.
2. **Moyen terme (si ajout futur de fonctionnalités natives hors Web telles que Google Play Games Services natif ou facturation Play Billing hors navigateur) : Capacitor**
   - Le code actuel fonctionne tel quel dans Capacitor en définissant `"webDir": "."` (ou un dossier de distribution statique), car tous les chemins (`./src/...`, `./public/...`) sont relatifs.

---

## 3. Configurations de référence prêtes à l'emploi

### 3.1. Configuration TWA (`twa-manifest.json` pour Bubblewrap)

```json
{
  "packageId": "pro.mindlock.app",
  "host": "hichamatlas75-del.github.io",
  "name": "MIND LOCK PRO",
  "launcherName": "MIND LOCK",
  "display": "standalone",
  "themeColor": "#070A14",
  "navigationColor": "#070A14",
  "navigationColorDark": "#070A14",
  "navigationDividerColor": "#070A14",
  "navigationDividerColorDark": "#070A14",
  "backgroundColor": "#070A14",
  "enableNotifications": false,
  "startUrl": "/MIND-LOCK-PRO/index.html#/home",
  "iconUrl": "https://hichamatlas75-del.github.io/MIND-LOCK-PRO/public/icons/icon-512.png",
  "maskableIconUrl": "https://hichamatlas75-del.github.io/MIND-LOCK-PRO/public/icons/icon-maskable-512.png",
  "splashScreenFadeOutDuration": 300,
  "signingKey": {
    "path": "./android.keystore",
    "alias": "mindlockpro"
  },
  "appVersionName": "0.4.0",
  "appVersionCode": 400,
  "shortcuts": [
    {
      "name": "Défi quotidien",
      "shortName": "Quotidien",
      "url": "/MIND-LOCK-PRO/index.html#/daily",
      "chosenIconUrl": "https://hichamatlas75-del.github.io/MIND-LOCK-PRO/public/icons/icon-192.png"
    },
    {
      "name": "100 Niveaux",
      "shortName": "Niveaux",
      "url": "/MIND-LOCK-PRO/index.html#/levels",
      "chosenIconUrl": "https://hichamatlas75-del.github.io/MIND-LOCK-PRO/public/icons/icon-192.png"
    }
  ],
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "https://hichamatlas75-del.github.io/MIND-LOCK-PRO/manifest.webmanifest",
  "fallbackType": "customtabs",
  "features": {},
  "alphaDependencies": { "enabled": false },
  "enableSiteSettingsShortcut": true,
  "isChromeOSOnly": false,
  "isMetaQuest": false,
  "minSdkVersion": 21,
  "orientation": "portrait"
}
```

### 3.2. Fichier Digital Asset Links (`.well-known/assetlinks.json`)

Pour supprimer la barre d'adresse Chrome dans la TWA, ce fichier doit être servi en HTTPS sur `https://<domaine>/.well-known/assetlinks.json` avec l'empreinte SHA-256 du certificat de signature Google Play App Signing :

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "pro.mindlock.app",
      "sha256_cert_fingerprints": [
        "REMPLACER_PAR_EMPREINTE_SHA256_PLAY_CONSOLE"
      ]
    }
  }
]
```

### 3.3. Configuration alternative Capacitor (`capacitor.config.json`)

Si un packaging 100 % embarqué (sans dépendance à un domaine HTTPS distant) est souhaité ultérieurement :

```json
{
  "appId": "pro.mindlock.app",
  "appName": "MIND LOCK PRO",
  "webDir": ".",
  "bundledWebRuntime": false,
  "backgroundColor": "#070A14",
  "android": {
    "allowMixedContent": false,
    "captureInput": true,
    "webContentsDebuggingEnabled": false
  }
}
```

---

## 4. Liste de vérification Android & PWA vérifiée dans `v0.4.0`

- **Manifest Web (`manifest.webmanifest`)** : `id`, `name`, `short_name`, `start_url`, `scope`, `display: "standalone"`, `orientation: "portrait"`, `background_color: "#070A14"`, `theme_color: "#070A14"`, `categories: ["games", "puzzle"]`, icônes PNG `192×192` et `512×512` (`any` + `maskable`), et `shortcuts` Android (Défi quotidien & 100 Niveaux).
- **Cycle de vie mobile & interruptions (`src/main.js`, `src/ui/screens/game.js`, `src/ui/screens/daily.js`)** :
  - `visibilitychange` (passage en arrière-plan / appel téléphonique / changement d'application) : arrêt immédiat du chronomètre et persistance instantanée de l'état de la partie (`session.save()` / `saveDailyStore()`).
  - `pagehide` / `beforeunload` : sauvegarde synchrone garantie avant fermeture de l'onglet ou de la WebView.
- **Bouton Retour Android** : navigation basée sur le hash (`#/home`, `#/levels`, `#/game/:n`, `#/daily`, `#/stats`, `#/tutorial`, `#/settings`) compatible avec le geste Retour système Android sans quitter brusquement l'application ni perdre la partie en cours.
- **Audio mobile (`src/services/audio.js`)** : déverrouillage strict de l'`AudioContext` uniquement après la première interaction utilisateur (`pointerdown`, `keydown`, `click`), évitant tout blocage d'autoplay sur Chrome Android et WebView.
