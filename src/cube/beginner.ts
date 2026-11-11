// Synthèse de la méthode débutant (couche par couche), croix par la marguerite.
// Données pures : l'affichage est dans ui/beginner-summary.ts.
// Les effets décrits (quelle pièce bouge, laquelle reste) sont vérifiés par beginner.test.ts.
// Textes pour débutants : pas de notation, les gestes viennent de move-names.ts.

import { describeMove } from "./move-names";

/** Geste en français d'un mouvement (« face de droite, vers le haut »). */
const say = (move: string): string => describeMove(move)!;

export interface BeginnerAlg {
  name: string;
  alg: string;
  /** Quand l'utiliser / comment tenir le cube. */
  when: string;
  /** Pourquoi ça marche, en une phrase. */
  why?: string;
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
    hold: "Jaune en haut, blanc en bas : on garde le cube dans ce sens jusqu'à la fin.",
    daisy: true,
    text: [
      "Faire la marguerite : amener les 4 arêtes blanches autour du centre jaune, blanc vers le haut (cœur jaune, pétales blancs).",
      "Avant de monter une arête, tourner la face du haut pour qu'aucun pétale déjà posé ne soit à l'arrivée (sinon on l'éjecte).",
      "Descendre les pétales : tourner la face du haut jusqu'à ce que l'autre couleur d'un pétale soit juste au-dessus du centre de la même couleur, puis faire un demi-tour de cette face de côté : le pétale descend en bas, à sa place. Quatre fois.",
    ],
    algs: [],
    tips: ["Arête blanche en bas, blanc dessous : un demi-tour de la face de côté où elle se trouve la fait monter.", "Arête sur la couronne du milieu : un quart de tour de la face de côté qui la touche la fait monter (dans le sens qui met le blanc en haut).", "Arête en haut mais blanc sur le côté : la mettre devant, puis F U' R (face de devant dans le sens des aiguilles d'une montre, face du haut vers la droite, face de droite vers le haut)."],
  },
  {
    title: "1b. Coins blancs",
    goal: "Finir la face blanche et sa couronne.",
    hold: "Croix blanche en bas. Tourner la face du haut pour amener le coin blanc en haut, juste au-dessus de sa place (devant à droite). Puis : ouvrir, glisser, refermer.",
    algs: [
      {
        name: "Blanc vers la droite",
        alg: "R U R'",
        when: "L'autocollant blanc du coin regarde vers la droite.",
        why: `On ouvre : la place monte (${say("R")}). Le coin glisse dedans (${say("U")}). On referme (${say("R'")}).`,
      },
      {
        name: "Blanc vers l'avant",
        alg: "F' U' F",
        when: "L'autocollant blanc du coin regarde vers toi.",
        why: `Le même geste, par l'avant : on ouvre (${say("F'")}), le coin glisse dedans (${say("U'")}), on referme (${say("F")}).`,
      },
      {
        name: "Blanc vers le haut",
        alg: "R U2 R' U' R U R'",
        when: "L'autocollant blanc du coin regarde vers le haut.",
        why: `On ne peut pas le glisser tel quel : on ouvre, on l'éloigne d'un demi-tour (${say("U2")}), on referme et on le ramène (${say("U'")}). Il a tourné : blanc vers la droite. Il reste à ouvrir, glisser, refermer.`,
      },
      {
        name: "Coin coincé en bas",
        alg: "R U R'",
        when: "Un coin blanc est déjà en bas, devant à droite, mais mal placé ou mal tourné.",
        why: "On ouvre, on le fait sortir en haut, on referme : il est en haut, on recommence normalement.",
      },
    ],
    tips: [
      "Lien avec le F2L (méthode rapide) : on y insère une paire coin + arête exactement comme ça. Ouvrir, glisser, refermer, c'est le geste de base du F2L.",
      `Le sexy move, c'est ce geste répété (${["R", "U", "R'", "U'"].map(say).join(", ")}) : refait plusieurs fois, il finit aussi par placer le coin.`,
    ],
  },
  {
    title: "2. Deuxième couronne : le Belge",
    goal: "Placer les 4 arêtes de la couronne du milieu (sans jaune).",
    hold: "Blanc toujours en bas. Tourner la face du haut pour amener l'arête (en haut) au-dessus du centre de sa couleur de devant : elle doit descendre à droite ou à gauche.",
    algs: [
      {
        name: "Le Belge (vers la droite)",
        alg: "U R U' R' U' F' U F",
        when: "L'autre couleur de l'arête est celle du centre de droite.",
        story: [
          "Il part à gauche (il est belge…)",
          "Ses copains de droite montent le chercher",
          "Il revient sur la droite",
          "Ses copains rentrent à la maison",
          "Emporté par son élan, il continue",
          "Et emporte toute la face avec lui",
          "Il se calme et revient sur ses pas",
          "La face se remet en place",
        ],
      },
      { name: "Le Belge (vers la gauche)", alg: "U' L' U L U F U' F'", when: "Même histoire en miroir : l'arête doit aller à gauche." },
    ],
    tips: ["Arête à sa place mais retournée : la sortir avec un Belge (n'importe quelle arête à la place), puis la replacer normalement."],
  },
  {
    title: "3. Croix jaune",
    goal: "Orienter puis placer les 4 arêtes jaunes.",
    algs: [
      { name: "Deux arêtes opposées", alg: "F R U R' U' F'", when: "Ligne jaune horizontale, comme sur le schéma.", diagram: "eo" },
      { name: "Deux arêtes voisines", alg: "f R U R' U' f'", when: "L jaune tenu comme sur le schéma (f : les deux couches de devant tournent ensemble).", diagram: "eo" },
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
