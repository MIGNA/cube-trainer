# Cube Trainer

PWA d'entraînement au Rubik's Cube pour Chrome Android : connexion Bluetooth à un cube GAN, chrono avec ao5/ao12, programme quotidien (OLL/PLL en répétition espacée, drills de croix, streak). Données stockées localement.

## Développement

```sh
npm install
npm run dev        # serveur de dev sur http://localhost:5173
npm run build      # vérification TypeScript + build de production dans dist/
```

### Tester sur le téléphone (Web Bluetooth)

Web Bluetooth exige HTTPS ou `localhost`. Le plus simple :

1. Activer le débogage USB sur le téléphone et le brancher au PC.
2. Sur le PC, ouvrir `chrome://inspect/#devices` dans Chrome, cliquer sur **Port forwarding** et ajouter `5173` → `localhost:5173`.
3. Lancer `npm run dev`, puis ouvrir `http://localhost:5173` dans Chrome sur le téléphone.

Pour que la MAC du cube soit détectée automatiquement, activer `chrome://flags/#enable-experimental-web-platform-features` sur le téléphone. Sinon, la saisir à la main dans la page.

## Déploiement

L'appli est publiée sur **https://migna.github.io/cube-trainer/** par GitHub Actions (`.github/workflows/deploy.yml`) à chaque push sur `main` : tests, build, puis mise en ligne sur GitHub Pages.

Sur le téléphone : ouvrir l'adresse dans Chrome, puis menu ⋮ → **Ajouter à l'écran d'accueil** / **Installer l'application**. L'appli fonctionne ensuite hors ligne et se met à jour automatiquement.
