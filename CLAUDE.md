# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

L'utilisateur est francophone : répondre et commenter le code en français.

## Projet

PWA de cubing pour Chrome Android : Vite + TypeScript **sans framework**, cube GAN i4 Leap via Web Bluetooth (`gan-web-bluetooth`), données locales IndexedDB (`idb`), `vite-plugin-pwa` (manifeste, service worker, icônes générées depuis `public/icon.svg`).

## Commandes

```sh
npm run dev        # http://localhost:5173
npm run build      # tsc (vérification de types) + build dans dist/
npm run typecheck
npm test           # Vitest (fichiers *.test.ts à côté du code)
npx vitest run src/timer/stats.test.ts -t "ao5"   # un fichier / un test
```

Garder la logique pure (stats, machine à états du chrono, mélanges…) hors du DOM pour pouvoir la tester ; les vues ne font que l'affichage et les entrées.

Web Bluetooth exige HTTPS ou localhost ; test sur téléphone via `chrome://inspect` → Port forwarding 5173 (voir README).

## Architecture

- `src/app/` : `signal.ts` (état réactif minimal, `subscribe` appelle immédiatement) et `router.ts` (routeur par hash ; une `View` a `mount(container)` qui renvoie une fonction de nettoyage — toujours se désabonner des signaux/événements dedans).
- `src/ui/dom.ts` : helper `h(tag, props, ...children)` ; `onxxx` = écouteurs, autres props = propriétés DOM ou attributs.
- `src/ble/` : `smart-cube.ts` définit l'interface `SmartCube` / `CubeEvent`, la seule dont dépend le reste de l'appli. `gan-cube.ts` adapte gan-web-bluetooth, `keyboard-cube.ts` est un faux cube clavier pour le dev sur PC. `cube-service.ts` est le point d'accès unique (`cubeStatus`, `onCubeEvent`, connexion/déconnexion, MAC mémorisée).
- `src/timer/` : logique pure du chrono. `timer-machine.ts` (états idle/inspecting/holding/ready/running, temps injecté), `stats.ts` (moyennes WCA ; **Infinity = DNF**, null = indisponible), `format.ts` (tronqué au centième), `scramble.ts` (mélanges, voir plus bas).
- `src/cube/` : `facelets.ts` = modèle du cube au format 54 facelets Kociemba (le même que le GAN envoie) ; permutations calculées par géométrie 3D, ne pas les écrire à la main. `scramble-tracker.ts` guide l'application du mélange (le cube n'envoie que des quarts de tour, R2 = R R) et calcule les corrections. `smart-session.ts` = machine à états du chrono connecté (needSolve → scrambling → inspecting/waiting → running) ; l'état réel du cube fait foi pour « résolu ».
- `cube-service.ts` maintient `cubeFacelets` (mis à jour avant de notifier les abonnés) et `syncMismatch` (écart entre modèle et état renvoyé par le cube). Le cube clavier est supposé résolu à la connexion.
- Mélanges : `generateScramble()` (random-state WCA via cubing.js en import dynamique + worker, un mélange d'avance ; `optimizeDeps.exclude: ["cubing"]` nécessaire en dev).
- `src/storage/solves.ts` : tout l'historique est chargé en mémoire dans le signal `solves` (ancien → récent) ; passer par `addSolve`/`setPenalty`/`deleteSolve` pour garder base et signal synchronisés.
- `src/storage/` : `db.ts` contient le schéma IndexedDB. Pour le faire évoluer : incrémenter `DB_VERSION` et ajouter un bloc `if (oldVersion < N)` dans `upgrade()`, sans jamais modifier les blocs existants (les données utilisateur n'existent que localement).

## Plan par étapes

0 test BLE ✅ → 1 socle ✅ → 2 chrono manuel + ao5/ao12 ✅ → 3 intégration cube (suivi d'état, guidage du mélange, départ/arrêt auto) ✅ → 4 détection des étapes CFOP → 5 OLL/PLL en répétition espacée → 6 drills de croix → 7 programme quotidien ~20 min + streak → 8 finitions (export/import JSON…).

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` (push sur `main` → `npm ci`, `npm test`, `npm run build`, publication). URL : https://migna.github.io/cube-trainer/. Le `base` Vite vaut `/cube-trainer/` en build et `/` en dev : utiliser des chemins relatifs ou `import.meta.env.BASE_URL`, jamais de chemin absolu codé en dur. Les données IndexedDB sont propres à chaque origine (dev ≠ prod).
