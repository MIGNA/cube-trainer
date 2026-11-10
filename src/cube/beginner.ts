// Synthèse de la méthode débutant (couche par couche), d'après Francocube
// (https://www.francocube.com/cyril/rubiks-cube), croix par la marguerite.
// Données pures : l'affichage est dans ui/beginner-summary.ts.
// Les effets décrits (quelle pièce bouge, laquelle reste) sont vérifiés par beginner.test.ts.

export interface BeginnerAlg {
  name: string;
  alg: string;
  /** Quand l'utiliser / comment tenir le cube. */
  when: string;
  /** Histoire, une ligne par mouvement (même nombre que de mouvements). */
  story?: string[];
  /** Schéma de dernière couche à afficher (cas de croix jaune). */
  diagram?: "eo";
}

export interface BeginnerStep {
  title: string;
  goal: string;
  /** Façon de tenir le cube pendant l'étape. */
  hold?: string;
  /** Explications sans formule (marguerite…). */
  text?: string[];
  /** Petit dessin de la marguerite vue de dessus. */
  daisy?: boolean;
  algs: BeginnerAlg[];
  tips?: string[];
}

export const BEGINNER_STEPS: BeginnerStep[] = [
  {
    title: "1a. Croix blanche : la marguerite",
    goal: "Placer les 4 arêtes blanches en croix, alignées avec les centres de leurs couleurs.",
    hold: "Jaune en haut.",
    daisy: true,
    text: [
      "Faire la marguerite : amener les 4 arêtes blanches autour du centre jaune, blanc vers le haut (cœur jaune, pétales blancs).",
      "Avant de monter une arête, tourner U pour qu'aucun pétale déjà posé ne soit à l'arrivée (sinon on l'éjecte).",
      "Descendre les pétales : tourner U jusqu'à ce que l'autre couleur d'un pétale soit au-dessus du centre de même couleur, puis faire un demi-tour de cette face (F2). Quatre fois.",
    ],
    algs: [],
    tips: ["Arête blanche en bas, blanc dessous : demi-tour de sa face (F2…). Arête sur la couronne du milieu : un quart de tour de la face de côté (R, F'…). Arête en haut, blanc sur le côté : F U' R."],
  },
  {
    title: "1b. Coins blancs",
    goal: "Finir la face blanche et sa couronne.",
    hold: "Retourner le cube : croix blanche en haut. Amener le coin sous sa place (en bas, devant à droite).",
    algs: [
      { name: "Blanc devant", alg: "F D F'", when: "L'autocollant blanc du coin regarde vers toi." },
      { name: "Blanc à droite", alg: "R' D' R", when: "L'autocollant blanc du coin regarde vers la droite." },
      { name: "Blanc dessous", alg: "F D' F' R' D2 R", when: "L'autocollant blanc du coin regarde vers le bas." },
    ],
    tips: ["Coin blanc déjà en haut mais mal placé : le sortir avec une des formules, puis recommencer."],
  },
  {
    title: "2. Deuxième couronne : le Belge",
    goal: "Placer les 4 arêtes de la couronne du milieu (sans jaune).",
    hold: "Face blanche toujours en haut. Tourner D pour amener l'arête sous le centre de sa couleur (devant) : elle doit monter à droite ou à gauche.",
    algs: [
      {
        name: "Le Belge (vers la droite)",
        alg: "D' R' D R D F D' F'",
        when: "L'autre couleur de l'arête est celle du centre de droite.",
        story: [
          "Il part à gauche (il est belge…)",
          "Ses copains de droite descendent pour le rappeler",
          "Il revient sur la droite",
          "Ses copains rentrent à la maison",
          "Emporté par son élan, il continue",
          "Et emporte toute la face avec lui",
          "Il se calme et revient sur ses pas",
          "La face se remet en place",
        ],
      },
      { name: "Le Belge (vers la gauche)", alg: "D L D' L' D' F' D F", when: "Même histoire en miroir : l'arête doit aller à gauche." },
    ],
    tips: ["Arête à sa place mais retournée : la sortir avec un Belge (n'importe quelle arête à la place), puis la replacer normalement."],
  },
  {
    title: "3. Croix jaune",
    goal: "Orienter puis placer les 4 arêtes jaunes.",
    hold: "Retourner le cube : face blanche en bas, jaune en haut.",
    algs: [
      { name: "Deux arêtes opposées", alg: "F R U R' U' F'", when: "Ligne jaune horizontale, comme sur le schéma.", diagram: "eo" },
      { name: "Deux arêtes voisines", alg: "F U R U' R' F'", when: "L jaune tenu comme sur le schéma (la même formule à l'envers).", diagram: "eo" },
      {
        name: "La chaise",
        alg: "R U2 R' U' R U' R'",
        when: "Croix faite mais arêtes mal placées : une arête bien placée devant toi, les trois autres tournent dans le sens des aiguilles d'une montre.",
        story: [
          "Il se lève",
          "Part très loin",
          "Sa chaise tombe",
          "Il revient un peu sur ses pas",
          "Redresse sa chaise",
          "Revient devant sa chaise",
          "Se rassied",
        ],
      },
    ],
    tips: ["Point jaune seul (aucune arête) : faire une des deux formules, on retombe sur une ligne ou un L.", "Aucune arête bien placée : faire la chaise une fois depuis n'importe où, puis recommencer."],
  },
  {
    title: "4. Placer les coins : le petit curieux",
    goal: "Mettre chaque coin jaune à sa place, sans s'occuper de son orientation.",
    hold: "Un coin bien placé (ses couleurs = les trois centres qu'il touche) devant à droite : les trois autres tournent dans le sens des aiguilles d'une montre.",
    algs: [
      {
        name: "Le petit curieux",
        alg: "L' U R U' L U R' U'",
        when: "Le petit curieux est le coin bien placé, devant à droite.",
        story: [
          "Ses copains de gauche montent",
          "Il va les voir",
          "Ses copains de droite montent",
          "Il va les voir",
          "Ceux de gauche en ont marre et descendent",
          "Il revient leur dire au revoir",
          "Ceux de droite redescendent",
          "Il revient à sa place",
        ],
      },
    ],
    tips: ["Aucun coin bien placé : faire la formule une fois depuis n'importe où, il y en aura un."],
  },
  {
    title: "5. Orienter les coins",
    goal: "Tourner les coins sur eux-mêmes pour finir le cube.",
    hold: "Seuls les deux coins de droite tournent sur eux-mêmes, en sens opposés ; le reste ne bouge pas. Au plus deux fois, en tournant le cube entre les deux si besoin.",
    algs: [
      {
        name: "Chaise main droite + main gauche",
        alg: "R U2 R' U' R U' R' L' U2 L U L' U L",
        when: "La chaise jouée à droite, puis la même en miroir à gauche (le haut tourne d'abord vers la droite, puis vers la gauche).",
      },
    ],
  },
];

export const BEGINNER_SOURCE = "https://www.francocube.com/cyril/rubiks-cube";
