// Synthèse de la méthode débutant (couche par couche), croix par la marguerite.
// Données pures : l'affichage est dans ui/beginner-summary.ts.
// Les effets décrits (quelle pièce bouge, laquelle reste) sont vérifiés par beginner.test.ts.
// Textes pour débutants : pas de notation, les gestes viennent de move-names.ts.

import { SOLVED, applyAlg, invertAlg } from "./facelets";
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
  /** Personnages de l'histoire : qui est qui sur le cube. */
  characters?: string[];
  /** L'histoire racontée d'un trait, sans mouvements. */
  tale?: string;
  /** Histoire, une ligne par mouvement (même nombre que de mouvements). */
  story?: string[];
  /**
   * Image du cas. Vue de dessus : "eo" (croix jaune), "edges"/"corners" (dernière couche,
   * seules les arêtes / les coins en couleur, avec flèches), "orient" (jaune seulement).
   * Sinon, avec `piece` : petit cube 3D, la pièce dont on parle en vif.
   */
  diagram?: "eo" | "edges" | "corners" | "orient";
  /** Autocollants (numéros à l'état résolu) de la pièce dont on parle, pour le cube 3D. */
  piece?: number[];
  /** Algo dont l'état de départ est dessiné, quand ce n'est pas `alg`. */
  pictureAlg?: string;
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
    hold: "Croix blanche en bas. Tourner la face du haut pour amener le coin blanc juste au-dessus de sa place (devant à droite).",
    text: ["Le principe : on monte une face pour aller chercher le coin, on pose le coin, et on redescend l'ensemble."],
    algs: [
      {
        name: "Blanc devant",
        piece: [29, 26, 15],
        alg: "U R U' R'",
        when: "L'autocollant blanc du coin regarde vers toi.",
        why: "La face de droite va monter : on écarte d'abord le coin pour qu'elle ne l'emporte pas, puis elle remonte sa place juste à côté de lui.",
        story: ["On décale le coin", "La face de droite monte le chercher", "On pose le coin sur sa place", "On redescend l'ensemble"],
      },
      {
        name: "Blanc à droite",
        piece: [29, 26, 15],
        // Image : avant de tourner le cube (blanc à droite, comme on le voit).
        pictureAlg: "R U R'",
        alg: "y U' L' U L",
        when: "L'autocollant blanc du coin regarde vers la droite. On tourne tout le cube pour qu'il regarde vers toi : le coin est alors au-dessus de sa place à gauche.",
        why: "C'est le même geste que « blanc devant », fait à gauche (en miroir).",
        story: [
          "On tourne le cube : le blanc regarde vers toi",
          "On décale le coin",
          "La face de gauche monte le chercher",
          "On pose le coin sur sa place",
          "On redescend l'ensemble",
        ],
      },
      {
        name: "Blanc en haut",
        piece: [29, 26, 15],
        // Image : coin au-dessus de sa place, blanc vers le haut.
        pictureAlg: "R U2 R' U' R U R'",
        alg: "R U' R'",
        when: "L'autocollant blanc regarde vers le haut : on le ramène d'abord sur le côté. Ensuite, tourner la face du haut pour remettre le coin au-dessus de sa place, et on retombe sur « blanc à droite ».",
        why: `Coin au-dessus de sa place de droite : cette formule. Au-dessus de la place de gauche : son miroir L' U L (${["L'", "U", "L"].map(say).join(" ; ")}). Jamais l'inverse : le coin descendrait au mauvais endroit.`,
        story: ["La face de droite monte : le coin part derrière", "On tourne le haut : le coin s'écarte", "On redescend la face : le coin reste en haut, blanc sur le côté"],
      },
      {
        name: "Coin coincé en bas",
        piece: [29, 26, 15],
        // Image : un coin blanc à sa place mais mal tourné.
        pictureAlg: "U R U' R' U R U' R'",
        alg: "R U R'",
        when: "Un coin blanc est en bas mais mal placé ou mal tourné. Si c'est un mauvais coin et qu'il reste des coins à faire : ne rien faire, il sera chassé quand on posera le bon. Sinon, le mettre en bas à droite (peu importe son sens) et le sortir.",
        why: "La face de droite remonte le coin coincé ; on l'écarte et on redescend : il est en haut, on revient à un cas connu.",
        story: ["La face de droite monte, avec le coin coincé", "On tourne le haut : le coin s'écarte", "On redescend la face : le coin reste en haut"],
      },
    ],
    tips: ["Lien avec le F2L (méthode rapide) : on y insère une paire coin + arête avec exactement ce geste. Monter, poser, redescendre, c'est le geste de base du F2L."],
  },
  {
    title: "2. Deuxième couronne : le Belge",
    goal: "Placer les 4 arêtes de la couronne du milieu (sans jaune).",
    hold: "Blanc toujours en bas. Tourner la face du haut pour amener l'arête (en haut) au-dessus du centre de sa couleur de devant : elle doit descendre à droite ou à gauche.",
    algs: [
      {
        name: "Le Belge (vers la droite)",
        piece: [23, 12],
        alg: "U R U' R' U' F' U F",
        when: "L'autre couleur de l'arête est celle du centre de droite.",
        characters: [
          "Le Belge : l'arête en haut devant (en vif sur l'image). Il doit descendre à droite.",
          "Ses copains : la face de droite.",
          "La maison : en bas, là où vivent les copains.",
          "La face : la face de devant.",
        ],
        tale: "Le Belge doit aller à droite… mais comme il est belge, il part à gauche. Ses copains de droite montent le chercher. Il revient vers eux, et les copains rentrent à la maison. Emporté par son élan, il continue vers la droite, et toute la face bascule ! Il se calme et revient sur ses pas ; la face se remet en place et l'emmène avec elle : le voilà chez lui.",
        story: [
          "Il part à gauche (il est belge…)",
          "Ses copains de droite montent le chercher",
          "Il revient vers eux",
          "Ses copains rentrent à la maison",
          "Emporté par son élan, il continue vers la droite",
          "Toute la face bascule",
          "Il se calme et revient sur ses pas",
          "La face se remet en place et l'emmène chez lui",
        ],
      },
      {
        name: "Le Belge (vers la gauche)",
        alg: "U' L' U L U F U' F'",
        when: "Même histoire en miroir : l'arête doit aller à gauche, ses copains sont la face de gauche.",
        piece: [21, 41],
        story: [
          "Il part à droite (toujours belge…)",
          "Ses copains de gauche montent le chercher",
          "Il revient vers eux",
          "Ses copains rentrent à la maison",
          "Emporté par son élan, il continue vers la gauche",
          "Toute la face bascule",
          "Il se calme et revient sur ses pas",
          "La face se remet en place et l'emmène chez lui",
        ],
      },
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
        diagram: "edges",
        alg: "R U2 R' U' R U' R'",
        when: "Croix faite mais arêtes mal placées : une arête bien placée devant toi, les trois autres tournent dans le sens des aiguilles d'une montre.",
        characters: ["Le Belge (encore lui !) : le coin en bas à droite, assis sur sa chaise.", "Sa chaise : la face de droite."],
        tale: "Le Belge est assis en bas à droite. Il se lève, part très loin… et sa chaise tombe. Il revient un peu sur ses pas, redresse sa chaise, revient devant elle et se rassied.",
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
    title: "4. Placer les coins : le fêtard",
    goal: "Mettre chaque coin jaune à sa place, sans s'occuper de son orientation.",
    hold: "Un coin bien placé (ses couleurs = les trois centres qu'il touche) devant à droite : les trois autres tournent dans le sens des aiguilles d'une montre.",
    algs: [
      {
        name: "Le fêtard",
        diagram: "corners",
        alg: "L' U R U' L U R' U'",
        when: "Le fêtard est le coin bien placé, devant à droite.",
        characters: [
          "Le Belge, qui veut faire la fête : le coin devant à droite, déjà à sa place.",
          "Ses amis de gauche : la face de gauche.",
          "Ses amis de droite : la face de droite.",
        ],
        tale: "Le Belge veut faire la fête. Ses amis de gauche montent : il va les voir. Ses amis de droite montent à leur tour : il va les voir. Ceux de gauche en ont marre et rentrent chez eux : il va leur dire au revoir. Ceux de droite rentrent aussi, et le Belge rentre chez lui. Pendant la fête, les trois autres coins ont changé de place.",
        story: [
          "Ses amis de gauche montent",
          "Il va les voir",
          "Ses amis de droite montent",
          "Il va les voir",
          "Ceux de gauche en ont marre et rentrent",
          "Il va leur dire au revoir",
          "Ceux de droite rentrent aussi",
          "Il rentre chez lui",
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
        diagram: "orient",
        alg: "R U2 R' U' R U' R' L' U2 L U L' U L",
        when: "La chaise jouée à droite, puis la même en miroir à gauche (le haut tourne d'abord vers la droite, puis vers la gauche).",
      },
    ],
  },
];

// Première couche (en bas) : face D + rangée du bas de F, R, L, B.
export const FIRST_LAYER = [27, 28, 29, 30, 31, 32, 33, 34, 35, 24, 25, 26, 15, 16, 17, 42, 43, 44, 51, 52, 53];

/** Importance d'un autocollant sur l'image : 2 = pièce dont on parle, 1 = déjà fait, 0 = sans importance. */
export type Emphasis = 0 | 1 | 2;

/**
 * Cube 3D d'un cas : état de départ (résolu + algo inversé) et, pour chaque position,
 * l'importance de l'autocollant qui s'y trouve (suivi des autocollants par numéro).
 */
export function casePicture(a: BeginnerAlg): { state: string; emphasis: Emphasis[] } | null {
  if (!a.piece) return null;
  const piece = a.piece;
  const setup = invertAlg(a.pictureAlg ?? a.alg);
  const label = Array.from({ length: 54 }, (_, i) => String.fromCharCode(48 + i)).join("");
  const origin = [...applyAlg(label, setup)].map((ch) => ch.charCodeAt(0) - 48);
  return {
    state: applyAlg(SOLVED, setup),
    emphasis: origin.map((o): Emphasis => (piece.includes(o) ? 2 : FIRST_LAYER.includes(o) ? 1 : 0)),
  };
}
