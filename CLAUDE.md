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

- `src/app/` : `signal.ts` (état réactif minimal, `subscribe` appelle immédiatement) et `router.ts` (routeur par hash ; une `View` a `mount(container, params)` qui renvoie une fonction de nettoyage — toujours se désabonner des signaux/événements dedans). `#/solve/12` → route `solve`, params `["12"]` ; une route sans `label` n'a pas d'onglet et indique via `tab` l'onglet à surligner.
- `src/ui/dom.ts` : helper `h(tag, props, ...children)` ; `onxxx` = écouteurs, autres props = propriétés DOM ou attributs.
- `src/ble/` : `smart-cube.ts` définit l'interface `SmartCube` / `CubeEvent`, la seule dont dépend le reste de l'appli. `gan-cube.ts` adapte gan-web-bluetooth, `keyboard-cube.ts` est un faux cube clavier pour le dev sur PC. `cube-service.ts` est le point d'accès unique (`cubeStatus`, `onCubeEvent`, connexion/déconnexion, MAC mémorisée).
- `src/timer/` : logique pure du chrono. `timer-machine.ts` (états idle/inspecting/holding/ready/running, temps injecté), `stats.ts` (moyennes WCA ; **Infinity = DNF**, null = indisponible), `format.ts` (tronqué au centième), `scramble.ts` (mélanges, voir plus bas).
- `src/cube/` : `facelets.ts` = modèle du cube au format 54 facelets Kociemba (le même que le GAN envoie) ; permutations calculées par géométrie 3D, ne pas les écrire à la main. `scramble-tracker.ts` guide l'application du mélange (le cube n'envoie que des quarts de tour, R2 = R R) et calcule les corrections. `smart-session.ts` = machine à états du chrono connecté (needSolve → scrambling → inspecting/waiting → running) ; l'état réel du cube fait foi pour « résolu ».
- `facelets.ts` gère aussi la notation étendue pour les algos (`r`/`Rw`, `M E S`, `x y z`) via `applyAlg`/`parseAnyAlg` ; `parseMove`/`parseAlg` restent limités aux faces (mélanges, cube connecté). `CROSS_GROUPS[face]` donne les autocollants croix / emplacements F2L / F2L / face de dernière couche relatifs à une face de croix.
- `cases.ts` : tables OLL (57), PLL (21) et des 3 cas de croix du 2-look (`EO_CASES`, famille `caseKind` = `"eo"` : seules les arêtes comptent, signature `eoSignature`) définies par un algo standard ; l'état d'un cas = résolu + algo inversé. Reconnaissance par signature invariante par AUF et rotation y, dernière couche en haut. Les tests vérifient que chaque algo préserve les F2L et que les cas sont distincts — mais pas que le numéro/nom est le bon : une inversion d'étiquettes (ex. Ja/Jb) ne serait pas détectée.
- `cfop.ts` : `analyzeSolve(scramble, moves)` rejoue un solve et découpe croix / F2L 1-4 / OLL / PLL (reconnaissance, exécution, TPS, cas). Face de croix = croix terminée le plus tôt, puis F2L le plus tôt. Mouvements comptés en quarts de tour reçus.
- `reconstruction.ts` : mouvements par étape (quarts de tour regroupés, R R → R2), renommage des faces dans le repère croix en bas (`faceMapForCross` + `setupForCross` pour le mélange), fluidité (part du temps hors pauses > 500 ms), blocs de la barre de synthèse.
- `case-diagram.ts` : données d'un schéma de dernière couche (couleurs par position, flèches de permutation PLL) ; `src/ui/case-svg.ts` le dessine en SVG ; `src/ui/views/cases.ts` = onglet Algos `#/algos[/<id>]` : catalogue + état d'apprentissage par cas (réglage `caseStatus` : absent = non appris, `learning` = à travailler, `known` = su) ; l'analyse d'un solve renvoie vers la fiche du cas via `algoHref`. `#/algos/notation` = page Notation (`views/notation.ts`) : un dessin fixe par mouvement, données dans `cube/move-diagram.ts` (couche qui tourne + flèche, sens vérifié par test contre `applyAlg`), dessin dans `ui/move-svg.ts`.
- `case-algs.ts` : ensembles de l'onglet Algos (`SET_CASES` : CFOP, 2-look par « temps » — croix puis OCLL, A-perms puis U/H/Z —, débutant à venir), suggestions d'algos par cas (testées) et « mes algos » (réglage `caseAlgs[id]` = liste, le premier est l'algo entraîné ; absent = algo standard). `checkCaseAlg` (dans `cases.ts`) valide un algo saisi : résout le cas à un AUF près, F2L intacts, rotations/mouvements larges acceptés. Toutes les vérifications comparent aux centres : ne pas « redresser » le cube par ses couleurs.
- `setup.ts` : set-up d'un cas. `shortestSetup` = plus court parmi les algos connus, inversés et réécrits en tours de faces (`toFaceTurns` : mouvements larges/tranches → face + rotation, rotations ramenées au début puis supprimées), réglé sur l'angle du schéma. `setupFromState` = depuis l'état du cube connecté via `experimentalSolve3x3x3IgnoringCenters` (cubing.js, import dynamique). Deux repères : joueur (jaune en haut, vert devant, celui des algos/schémas) et cube GAN (blanc en haut) = joueur après z2 → `switchFrame` échange U↔D et R↔L. `pieces.ts` lit arêtes/coins dans l'ordre et la convention de cubing.js (vérifié par test). `src/ui/setup-panel.ts` = carte Set-up de la fiche (guidage avec `ScrambleTracker`).
- `src/ui/views/solve.ts` : page détail d'un solve (synthèse TPS/mouvements/fluidité + barre des étapes, tableau, replay 3D `cubing/twisty` chargé à la demande avec la reconstruction cliquable).
- `cube-service.ts` maintient `cubeFacelets` (mis à jour avant de notifier les abonnés) et `syncMismatch` (écart entre modèle et état renvoyé par le cube). Le cube clavier est supposé résolu à la connexion.
- Mélanges : `generateScramble()` (random-state WCA via cubing.js en import dynamique + worker, un mélange d'avance ; `optimizeDeps.exclude: ["cubing"]` nécessaire en dev ; en build, `vite.config.ts` isole l'assistant de préchargement de Vite et n'en fait aucun depuis le worker, sinon le worker plante et les mélanges retombent silencieusement sur 20 mouvements aléatoires — vérifier en build après toute mise à jour de Vite/cubing).
- `src/storage/solves.ts` : tout l'historique est chargé en mémoire dans le signal `solves` (ancien → récent) ; passer par `addSolve`/`setPenalty`/`deleteSolve` pour garder base et signal synchronisés.
- `src/storage/` : `db.ts` contient le schéma IndexedDB. Pour le faire évoluer : incrémenter `DB_VERSION` et ajouter un bloc `if (oldVersion < N)` dans `upgrade()`, sans jamais modifier les blocs existants (les données utilisateur n'existent que localement).

## Plan par étapes

0 test BLE ✅ → 1 socle ✅ → 2 chrono manuel + ao5/ao12 ✅ → 3 intégration cube (suivi d'état, guidage du mélange, départ/arrêt auto) ✅ → 4 analyse CFOP façon acubemy : 4a moteur ✅, 4b page détail d'un solve (tableau, reconstruction, replay) ✅, 4c statistiques par étape et par cas → 5 OLL/PLL en répétition espacée → 6 drills de croix → 7 programme quotidien ~20 min + streak → 8 finitions (export/import JSON…).

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` (push sur `main` → `npm ci`, `npm test`, `npm run build`, publication). URL : https://migna.github.io/cube-trainer/. Le `base` Vite vaut `/cube-trainer/` en build et `/` en dev : utiliser des chemins relatifs ou `import.meta.env.BASE_URL`, jamais de chemin absolu codé en dur. Les données IndexedDB sont propres à chaque origine (dev ≠ prod).
