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
```

Web Bluetooth exige HTTPS ou localhost ; test sur téléphone via `chrome://inspect` → Port forwarding 5173 (voir README).

## Architecture

- `src/app/` : `signal.ts` (état réactif minimal, `subscribe` appelle immédiatement) et `router.ts` (routeur par hash ; une `View` a `mount(container)` qui renvoie une fonction de nettoyage — toujours se désabonner des signaux/événements dedans).
- `src/ui/dom.ts` : helper `h(tag, props, ...children)` ; `onxxx` = écouteurs, autres props = propriétés DOM ou attributs.
- `src/ble/` : `smart-cube.ts` définit l'interface `SmartCube` / `CubeEvent`, la seule dont dépend le reste de l'appli. `gan-cube.ts` adapte gan-web-bluetooth, `keyboard-cube.ts` est un faux cube clavier pour le dev sur PC. `cube-service.ts` est le point d'accès unique (`cubeStatus`, `onCubeEvent`, connexion/déconnexion, MAC mémorisée).
- `src/storage/` : `db.ts` contient le schéma IndexedDB. Pour le faire évoluer : incrémenter `DB_VERSION` et ajouter un bloc `if (oldVersion < N)` dans `upgrade()`, sans jamais modifier les blocs existants (les données utilisateur n'existent que localement).

## Plan par étapes

0 test BLE ✅ → 1 socle ✅ → 2 chrono manuel + ao5/ao12 → 3 intégration cube (suivi d'état, guidage du mélange, départ/arrêt auto) → 4 détection des étapes CFOP → 5 OLL/PLL en répétition espacée → 6 drills de croix → 7 programme quotidien ~20 min + streak → 8 finitions (export/import JSON…).
